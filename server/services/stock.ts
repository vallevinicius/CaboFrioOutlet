import { prisma } from '../db';

// Restaura o estoque reservado na criação do pedido quando ele é
// recusado/cancelado/expirado.
export async function restoreStockForOrder(orderId: string) {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (!item.productId) continue;
    await prisma.productSize.updateMany({
      where: { productId: item.productId, size: item.size },
      data: { stock: { increment: item.quantity } },
    });
  }
}

const PENDING_ORDER_TTL_HOURS = 24;

// Pedidos com pagamento pendente (ex: Pix não pago) há mais de 24h são
// cancelados automaticamente e o estoque reservado é devolvido — evita
// carrinho abandonado prender estoque pra sempre.
export async function expireStaleOrders() {
  const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_HOURS * 60 * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: { status: 'pendente', createdAt: { lt: cutoff } },
    select: { id: true },
  });

  for (const { id } of stale) {
    const updated = await prisma.order.updateMany({
      where: { id, status: 'pendente' },
      data: { status: 'cancelado', paymentStatus: 'expired' },
    });
    if (updated.count > 0) {
      await restoreStockForOrder(id);
    }
  }
}
