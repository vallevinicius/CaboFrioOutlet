export interface OpeningHoursRow {
  label: string;
  hours: string;
}

export interface StoreSettings {
  storeName: string;
  freeShippingThreshold: number;
  shippingFee: number;
  originCep: string;
  hasMelhorEnvioToken: boolean;
  melhorEnvioSandbox: boolean;
  announcementMessages: string[];
  brands: string[];
  /** Somente dígitos, com DDI (ex: 5522999991234). Vazio = não configurado. */
  whatsapp: string;
  contactEmail: string;
  openingHours: OpeningHoursRow[];
  googlePlaceId: string;
  /** Frases da faixa amarela da home. Vazio = faixa oculta. */
  tickerMessages: string[];
  storyTitle: string;
  /** Parágrafos separados por linha em branco. */
  storyBody: string;
  gaMeasurementId: string;
  metaPixelId: string;
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
  whatsapp: '',
  contactEmail: '',
  openingHours: [
    { label: 'Segunda a sábado', hours: '09h às 19h' },
    { label: 'Domingo', hours: '09h às 14h' },
  ],
  googlePlaceId: '',
  tickerMessages: [
    'Multimarcas',
    '10 anos em Cabo Frio',
    'Roupa de rua com preço de outlet',
    'Troca grátis em 30 dias',
  ],
  storyTitle: '10 anos vestindo Cabo Frio',
  gaMeasurementId: '',
  metaPixelId: '',
  storyBody:
    'A Cabo Frio Outlet começou como loja de bairro e cresceu junto com os clientes. Hoje reunimos as marcas que a rua usa, com preço de outlet e atendimento de quem entende do assunto.\n\nCompre pelo site ou passe na loja para experimentar as peças e levar o look na hora.',
};
