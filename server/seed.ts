import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

/**
 * Bootstrap mínimo do banco: configurações padrão da loja e o usuário admin.
 * O catálogo de produtos (fotos, preços, estoque) é cadastrado pelo painel /admin,
 * não por seed — este banco é o banco real da loja, não um ambiente de exemplo.
 */
async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: 'Cabo Frio Outlet',
      freeShippingThreshold: 299,
      shippingFee: 19.9,
      announcementMessages: JSON.stringify([
        'Parcele em até 3x sem juros',
        'Troca grátis em até 30 dias',
        'Novidades toda semana',
      ]),
      brands: JSON.stringify(['Nike', 'Adidas', 'High']),
    },
  });
  console.log('Configurações padrão da loja garantidas.');

  const existingSlide = await prisma.heroSlide.findFirst();
  if (!existingSlide) {
    await prisma.heroSlide.create({
      data: {
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1600&auto=format&fit=crop&q=80',
        eyebrow: 'Nova Coleção',
        title: 'Estilo urbano que fala mais alto que',
        highlight: 'palavras.',
        subtitle:
          'Bermudas, calças, camisas e bonés pensados para quem vive a cidade no seu próprio ritmo. Peças com atitude, conforto e caimento impecável.',
        ctaLabel: 'Ver Coleção',
        order: 0,
      },
    });
    console.log('Banner inicial do hero criado.');
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@cabofriooutlet.com.br').toLowerCase();
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'caboadmin2026';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    await prisma.user.create({
      data: { name: 'Admin', email: adminEmail, passwordHash, isAdmin: true },
    });
    console.log(`Admin criado (${adminEmail}) com a senha definida em ADMIN_DEFAULT_PASSWORD.`);
  } else {
    console.log('Admin já existe, seed de admin ignorado.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
