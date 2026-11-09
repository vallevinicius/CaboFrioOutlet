export const REVENUE_STATUSES = ['confirmado', 'enviado', 'entregue'];
export const ALLOWED_PERIODS = [7, 30, 90];
export const DEFAULT_PERIOD = 30;
/** Mesmo limite usado pela aba Estoque do painel. */
export const LOW_STOCK_LIMIT = 5;

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // Brasil (sem horário de verão desde 2019)

export interface ReportOrder {
  createdAt: Date;
  status: string;
  total: number;
  items: { productId: string | null; productName: string; quantity: number; unitPrice: number }[];
}

export interface DayPoint {
  date: string; // AAAA-MM-DD (horário de Brasília)
  revenue: number;
  orders: number;
}

export interface TopProduct {
  productId: string | null;
  name: string;
  quantity: number;
  revenue: number;
}

export interface Overview {
  periodDays: number;
  revenue: number;
  paidOrders: number;
  averageTicket: number;
  pendingOrders: number;
  cancelledOrders: number;
  series: DayPoint[];
  topProducts: TopProduct[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function dayKey(date: Date): string {
  return new Date(date.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Aceita só 7, 30 ou 90 dias; qualquer outra coisa vira o padrão. */
export function parsePeriod(raw: unknown): number {
  const n = Number(raw);
  return ALLOWED_PERIODS.includes(n) ? n : DEFAULT_PERIOD;
}

export function buildOverview(orders: ReportOrder[], periodDays: number, now: Date = new Date()): Overview {
  // Série com todos os dias do período (dias sem venda aparecem com zero).
  const series: DayPoint[] = [];
  const index = new Map<string, DayPoint>();
  for (let i = periodDays - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    const point = { date: key, revenue: 0, orders: 0 };
    series.push(point);
    index.set(key, point);
  }

  let revenue = 0;
  let paidOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  const products = new Map<string, TopProduct>();

  for (const order of orders) {
    const point = index.get(dayKey(order.createdAt));
    if (!point) continue; // fora do período
    if (order.status === 'pendente') pendingOrders++;
    else if (order.status === 'cancelado') cancelledOrders++;

    if (!REVENUE_STATUSES.includes(order.status)) continue;
    revenue += order.total;
    paidOrders++;
    point.revenue += order.total;
    point.orders++;

    for (const item of order.items) {
      const key = item.productId ?? `nome:${item.productName}`;
      const entry = products.get(key) ?? { productId: item.productId, name: item.productName, quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += item.unitPrice * item.quantity;
      products.set(key, entry);
    }
  }

  const topProducts = [...products.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5)
    .map((p) => ({ ...p, revenue: round2(p.revenue) }));

  return {
    periodDays,
    revenue: round2(revenue),
    paidOrders,
    averageTicket: paidOrders > 0 ? round2(revenue / paidOrders) : 0,
    pendingOrders,
    cancelledOrders,
    series: series.map((p) => ({ ...p, revenue: round2(p.revenue) })),
    topProducts,
  };
}

export interface StockProduct {
  id: string;
  name: string;
  sizes: { size: string; stock: number }[];
}

export interface LowStockEntry {
  productId: string;
  name: string;
  size: string;
  stock: number;
}

export interface LowStockReport {
  outOfStock: number;
  lowStock: number;
  items: LowStockEntry[];
}

/** Tamanhos esgotados ou com poucas unidades, dos que mais precisam de reposição para os que menos. */
export function buildLowStock(products: StockProduct[], limit = LOW_STOCK_LIMIT, maxItems = 30): LowStockReport {
  const all: LowStockEntry[] = [];
  for (const p of products) {
    for (const s of p.sizes) {
      if (s.stock <= limit) all.push({ productId: p.id, name: p.name, size: s.size, stock: s.stock });
    }
  }
  all.sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, 'pt-BR'));
  return {
    outOfStock: all.filter((e) => e.stock === 0).length,
    lowStock: all.filter((e) => e.stock > 0).length,
    items: all.slice(0, maxItems),
  };
}
