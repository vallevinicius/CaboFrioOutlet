/** Dados fixos da loja física, reaproveitados no rodapé, na home e nas páginas institucionais. */
export const STORE_INFO = {
  yearsInBusiness: 10,
  city: 'Cabo Frio',
  addressLines: [
    'Avenida Júlia Kubitschek, nº 16',
    'Edifício Premier Center, lojas 3 e 4',
    'Centro – Cabo Frio/RJ',
  ],
  reference: 'Em frente à Prontomed',
  instagramUrl: 'https://www.instagram.com/cabofrio.outlet',
  instagramHandle: '@cabofrio.outlet',
} as const;

export const STORE_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('Edifício Premier Center, Avenida Júlia Kubitschek, 16, Centro, Cabo Frio - RJ');
