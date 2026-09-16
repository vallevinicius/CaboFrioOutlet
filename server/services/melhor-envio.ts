import { prisma } from '../db';

const PRODUCTION_BASE = 'https://melhorenvio.com.br';
const SANDBOX_BASE = 'https://sandbox.melhorenvio.com.br';

export interface ShippingPackageInput {
  productId: string;
  weightKg: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  quantity: number;
  unitPrice: number;
}

export interface ShippingOption {
  id: number;
  name: string;
  price: number;
  deliveryTime: number | null;
  company: string;
}

interface MeProductEntry {
  id: string;
  width: number;
  height: number;
  length: number;
  weight: number;
  insurance_value: number;
  quantity: number;
}

interface MeCalculateResponseItem {
  id: number;
  name: string;
  price?: string;
  error?: string;
  delivery_time?: number | null;
  company?: { id: number; name: string };
}

// Retorna null quando a Melhor Envio não está configurada (sem token/CEP de
// origem) — quem chamar deve usar o frete fixo (Settings.shippingFee) como
// alternativa, para a loja nunca ficar sem conseguir vender por falta de config.
export async function calculateShippingOptions(
  destinationCep: string,
  packages: ShippingPackageInput[]
): Promise<ShippingOption[] | null> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.melhorEnvioToken || !settings.originCep) {
    return null;
  }

  const base = settings.melhorEnvioSandbox ? SANDBOX_BASE : PRODUCTION_BASE;
  const products: MeProductEntry[] = packages.map((p) => ({
    id: p.productId,
    // A Melhor Envio/Correios exige dimensões mínimas por pacote.
    width: Math.max(11, Math.round(p.widthCm)),
    height: Math.max(2, Math.round(p.heightCm)),
    length: Math.max(16, Math.round(p.lengthCm)),
    weight: p.weightKg,
    insurance_value: p.unitPrice,
    quantity: p.quantity,
  }));

  const res = await fetch(`${base}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.melhorEnvioToken}`,
      'User-Agent': `Cabo Frio Outlet (${process.env.ADMIN_EMAIL ?? 'contato@cabofriooutlet.com.br'})`,
    },
    body: JSON.stringify({
      from: { postal_code: settings.originCep.replace(/\D/g, '') },
      to: { postal_code: destinationCep.replace(/\D/g, '') },
      products,
      options: { receipt: false, own_hand: false },
    }),
  });

  if (!res.ok) {
    console.error('Erro ao calcular frete na Melhor Envio:', res.status, await res.text().catch(() => ''));
    return null;
  }

  const data = (await res.json()) as MeCalculateResponseItem[];
  return data
    .filter((item) => !item.error && item.price)
    .map((item) => ({
      id: item.id,
      name: item.company?.name ? `${item.company.name} ${item.name}` : item.name,
      price: parseFloat(item.price as string),
      deliveryTime: item.delivery_time ?? null,
      company: item.company?.name ?? '',
    }))
    .sort((a, b) => a.price - b.price);
}
