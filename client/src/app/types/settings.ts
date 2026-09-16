export interface StoreSettings {
  storeName: string;
  freeShippingThreshold: number;
  shippingFee: number;
  originCep: string;
  hasMelhorEnvioToken: boolean;
  melhorEnvioSandbox: boolean;
  announcementMessages: string[];
  brands: string[];
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Cabo Frio Outlet',
  freeShippingThreshold: 299,
  shippingFee: 19.9,
  originCep: '',
  hasMelhorEnvioToken: false,
  melhorEnvioSandbox: true,
  announcementMessages: [
    'Parcele em até 3x sem juros',
    'Troca grátis em até 30 dias',
    'Novidades toda semana',
  ],
  brands: ['Nike', 'Adidas', 'High'],
};
