import './env.js';
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';
import { SECTIONS } from './services/access.js';

const ADMIN_ROLE_ID = 'role-administrador';

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

  // Perfil de sistema "Administrador": editar em todas as telas. Idempotente.
  await prisma.role.upsert({
    where: { id: ADMIN_ROLE_ID },
    update: {},
    create: { id: ADMIN_ROLE_ID, name: 'Administrador', system: true },
  });
  for (const section of SECTIONS) {
    await prisma.rolePermission.upsert({
      where: { roleId_section: { roleId: ADMIN_ROLE_ID, section } },
      update: { level: 'EDIT' },
      create: { roleId: ADMIN_ROLE_ID, section, level: 'EDIT' },
    });
  }

  // O admin supremo é o usuário de ADMIN_EMAIL: criado aqui ou, se já existir, apenas promovido
  // (a senha dele nunca é tocada).
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@cabofriooutlet.com.br').toLowerCase();
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'caboadmin2026';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    await prisma.user.create({
      data: { name: 'Admin', email: adminEmail, passwordHash, isAdmin: true, isSuperAdmin: true, roleId: ADMIN_ROLE_ID },
    });
    console.log(`Admin supremo criado (${adminEmail}) com a senha definida em ADMIN_DEFAULT_PASSWORD.`);
  } else {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { isAdmin: true, isSuperAdmin: true, roleId: existingAdmin.roleId ?? ADMIN_ROLE_ID },
    });
    console.log(`Admin ${adminEmail} garantido como admin supremo (senha mantida).`);
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
