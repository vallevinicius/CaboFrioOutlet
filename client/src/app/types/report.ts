export interface DayPoint {
  date: string;
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

export interface OverviewResponse {
  overview: Overview;
  lowStock: LowStockReport;
}
