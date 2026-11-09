import { describe, expect, it } from 'vitest';
import { ReportOrder, buildLowStock, buildOverview, dayKey, parsePeriod } from './reports';

const NOW = new Date('2026-11-09T15:00:00Z'); // 12h em Brasília
const order = (over: Partial<ReportOrder> & { createdAt: Date }): ReportOrder => ({
  status: 'confirmado',
  total: 100,
  items: [{ productId: 'p1', productName: 'Camisa', quantity: 1, unitPrice: 90 }],
  ...over,
});

describe('parsePeriod', () => {
  it('aceita 7, 30 e 90; o resto vira 30', () => {
    expect(parsePeriod('7')).toBe(7);
    expect(parsePeriod(90)).toBe(90);
    expect(parsePeriod('15')).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
    expect(parsePeriod('abc')).toBe(30);
    expect(parsePeriod('-1')).toBe(30);
  });
});

describe('dayKey', () => {
  it('usa o dia de Brasília (23h de ontem em BRT ainda é ontem)', () => {
    expect(dayKey(new Date('2026-11-09T01:30:00Z'))).toBe('2026-11-08');
    expect(dayKey(new Date('2026-11-09T03:00:00Z'))).toBe('2026-11-09');
  });
});

describe('buildOverview', () => {
  it('soma só pedidos pagos e calcula ticket médio', () => {
    const o = buildOverview(
      [
        order({ createdAt: NOW, total: 100 }),
        order({ createdAt: NOW, status: 'enviado', total: 200 }),
        order({ createdAt: NOW, status: 'entregue', total: 300 }),
        order({ createdAt: NOW, status: 'pendente', total: 999 }),
        order({ createdAt: NOW, status: 'cancelado', total: 999 }),
      ],
      7,
      NOW,
    );
    expect(o.revenue).toBe(600);
    expect(o.paidOrders).toBe(3);
    expect(o.averageTicket).toBe(200);
    expect(o.pendingOrders).toBe(1);
    expect(o.cancelledOrders).toBe(1);
  });

  it('sem pedidos: zeros, sem divisão por zero e série completa', () => {
    const o = buildOverview([], 7, NOW);
    expect(o.revenue).toBe(0);
    expect(o.averageTicket).toBe(0);
    expect(o.series).toHaveLength(7);
    expect(o.series.every((p) => p.revenue === 0 && p.orders === 0)).toBe(true);
    expect(o.series[6].date).toBe('2026-11-09');
    expect(o.series[0].date).toBe('2026-11-03');
  });

  it('distribui a receita nos dias certos e ignora pedidos fora do período', () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    const old = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
    const o = buildOverview(
      [order({ createdAt: NOW, total: 50 }), order({ createdAt: yesterday, total: 70 }), order({ createdAt: old, total: 999 })],
      7,
      NOW,
    );
    expect(o.series[6]).toMatchObject({ date: '2026-11-09', revenue: 50, orders: 1 });
    expect(o.series[5]).toMatchObject({ date: '2026-11-08', revenue: 70, orders: 1 });
    expect(o.revenue).toBe(120);
  });

  it('ranking de produtos: por quantidade, depois receita, limitado a 5, só pedidos pagos', () => {
    const items = (id: string, q: number, price = 10) => [{ productId: id, productName: id, quantity: q, unitPrice: price }];
    const o = buildOverview(
      [
        order({ createdAt: NOW, items: items('a', 5) }),
        order({ createdAt: NOW, items: items('b', 5, 20) }),
        order({ createdAt: NOW, items: items('c', 1) }),
        order({ createdAt: NOW, items: items('d', 2) }),
        order({ createdAt: NOW, items: items('e', 3) }),
        order({ createdAt: NOW, items: items('f', 4) }),
        order({ createdAt: NOW, status: 'cancelado', items: items('z', 100) }),
      ],
      7,
      NOW,
    );
    expect(o.topProducts.map((p) => p.name)).toEqual(['b', 'a', 'f', 'e', 'd']);
    expect(o.topProducts[0]).toMatchObject({ quantity: 5, revenue: 100 });
  });

  it('agrupa produto apagado (sem id) pelo nome', () => {
    const it = { productId: null, productName: 'Antigo', quantity: 1, unitPrice: 10 };
    const o = buildOverview([order({ createdAt: NOW, items: [it] }), order({ createdAt: NOW, items: [it] })], 7, NOW);
    expect(o.topProducts).toEqual([{ productId: null, name: 'Antigo', quantity: 2, revenue: 20 }]);
  });
});

describe('buildLowStock', () => {
  const products = [
    { id: '1', name: 'Boné', sizes: [{ size: 'U', stock: 0 }] },
    { id: '2', name: 'Camisa', sizes: [{ size: 'P', stock: 2 }, { size: 'M', stock: 9 }, { size: 'G', stock: 0 }] },
    { id: '3', name: 'Calça', sizes: [{ size: '40', stock: 5 }, { size: '42', stock: 6 }] },
  ];
  it('lista esgotados e baixos (≤5), esgotados primeiro, e conta cada grupo', () => {
    const r = buildLowStock(products);
    expect(r.outOfStock).toBe(2);
    expect(r.lowStock).toBe(2);
    expect(r.items.map((e) => `${e.name}/${e.size}`)).toEqual(['Boné/U', 'Camisa/G', 'Camisa/P', 'Calça/40']);
  });
  it('respeita o limite máximo de itens e estoque saudável não entra', () => {
    expect(buildLowStock(products, 5, 2).items).toHaveLength(2);
    expect(buildLowStock([{ id: 'x', name: 'Ok', sizes: [{ size: 'M', stock: 50 }] }]).items).toEqual([]);
  });
});
