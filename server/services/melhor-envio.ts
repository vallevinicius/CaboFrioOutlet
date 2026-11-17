import { prisma } from '../db.js';
import { getAccessToken, refreshAccessToken } from './melhor-envio-auth.js';

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

interface MeCalculateResponseItem {
  id: number;
  name: string;
  price?: string;
  error?: string;
  delivery_time?: number | null;
  company?: { id: number; name: string };
}

export interface CombinedPackage {
  weightKg: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  insuranceValue: number;
}

/**
 * Embalagem única: o carrinho inteiro vai numa caixa só (como a loja realmente envia), em vez de
 * cotar cada peça separada, o que encarece o frete. Peso e valor somam; as peças ficam empilhadas
 * (soma das alturas) e a caixa tem a maior largura e o maior comprimento entre elas.
 */
export function combinePackages(packages: ShippingPackageInput[]): CombinedPackage {
  return packages.reduce<CombinedPackage>(
    (box, p) => ({
      weightKg: box.weightKg + p.weightKg * p.quantity,
      heightCm: box.heightCm + p.heightCm * p.quantity,
      widthCm: Math.max(box.widthCm, p.widthCm),
      lengthCm: Math.max(box.lengthCm, p.lengthCm),
      insuranceValue: box.insuranceValue + p.unitPrice * p.quantity,
    }),
    { weightKg: 0, heightCm: 0, widthCm: 0, lengthCm: 0, insuranceValue: 0 },
  );
}

// Retorna null quando a Melhor Envio não está configurada (sem CEP de origem ou sem conexão) — quem
// chamar deve usar o frete fixo (Settings.shippingFee) como alternativa, para a loja nunca ficar sem
// conseguir vender por falta de configuração.
export async function calculateShippingOptions(
  destinationCep: string,
  packages: ShippingPackageInput[],
): Promise<ShippingOption[] | null> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.originCep) return null;

  let token = await getAccessToken();
  if (!token) return null;

  const box = combinePackages(packages);
  const base = settings.melhorEnvioSandbox ? SANDBOX_BASE : PRODUCTION_BASE;
  const body = JSON.stringify({
    from: { postal_code: settings.originCep.replace(/\D/g, '') },
    to: { postal_code: destinationCep.replace(/\D/g, '') },
    products: [
      {
        id: 'pedido',
        // A Melhor Envio/Correios exige dimensões mínimas por pacote.
        width: Math.max(11, Math.round(box.widthCm)),
        height: Math.max(2, Math.round(box.heightCm)),
        length: Math.max(16, Math.round(box.lengthCm)),
        weight: box.weightKg,
        insurance_value: box.insuranceValue,
        quantity: 1,
      },
    ],
    options: { receipt: false, own_hand: false },
  });

  const call = (accessToken: string) =>
    fetch(`${base}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        // A API exige o nome da aplicação e um e-mail de contato.
        'User-Agent': `Cabo Frio Outlet (${process.env.ADMIN_EMAIL ?? 'contato@cabofriooutlet.com.br'})`,
      },
      body,
    });

  let res = await call(token);
  if (res.status === 401) {
    // Token vencido ou revogado: renova uma vez e repete (se não der, o frete fixo cobre).
    token = await refreshAccessToken();
    if (!token) {
      console.error('[frete] Melhor Envio recusou o token e a renovação falhou: reconecte a conta no painel.');
      return null;
    }
    res = await call(token);
  }

  if (!res.ok) {
    console.error('Erro ao calcular frete na Melhor Envio:', res.status, await res.text().catch(() => ''));
    return null;
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return null;
  return (data as MeCalculateResponseItem[])
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
