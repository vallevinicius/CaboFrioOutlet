import { MercadoPagoConfig, Payment } from 'mercadopago';

const accessToken = process.env.MP_ACCESS_TOKEN;
const publicKey = process.env.MP_PUBLIC_KEY;

if (!accessToken) {
  throw new Error('MP_ACCESS_TOKEN não definido no .env');
}
if (!publicKey) {
  throw new Error('MP_PUBLIC_KEY não definido no .env');
}

export const MP_PUBLIC_KEY: string = publicKey;

const client = new MercadoPagoConfig({ accessToken });

export const mpPayment = new Payment(client);
