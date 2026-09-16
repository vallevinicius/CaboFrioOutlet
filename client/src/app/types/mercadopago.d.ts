// A SDK JS do Mercado Pago (carregada via <script> em runtime) não tem
// tipos oficiais para o pacote de Bricks — declarada aqui como `any` mínimo.
export {};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

export interface MercadoPagoInstance {
  bricks(): {
    create(
      type: 'payment',
      containerId: string,
      settings: Record<string, unknown>
    ): Promise<{ unmount(): void }>;
  };
}
