import request from 'supertest';
import { Prisma, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { FULL_EDIT, appWith, mockAccess, tokenFor } from '../test/helpers.js';

const prismaMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../db', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  prismaMock.current = mockDeep();
  return { prisma: prismaMock.current };
});

import { categoriesRouter } from './categories.js';

const prisma = () => prismaMock.current as ReturnType<typeof mockDeep<PrismaClient>>;
const app = appWith('/api/categories', categoriesRouter);
const admin = tokenFor('admin-1', true);

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'cat_camisas',
  key: 'camisas',
  slug: 'camisas',
  name: 'Camisas',
  intro: 'Frase',
  description: 'Descrição',
  image: '/placeholders/cat-camisas.jpg',
  order: 0,
  active: true,
  createdAt: new Date('2026-11-18'),
  updatedAt: new Date('2026-11-18'),
  ...over,
});

const sub = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'sub_basicas',
  categoryId: 'cat_camisas',
  slug: 'basicas',
  name: 'Básicas',
  order: 0,
  active: true,
  createdAt: new Date('2026-11-18'),
  updatedAt: new Date('2026-11-18'),
  ...over,
});

const notFound = () => new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '6' });
const unique = () => new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: '6' });

beforeEach(() => {
  mockReset(prisma());
  mockAccess(prisma(), 'admin-1', { permissions: FULL_EDIT });
});

describe('GET /api/categories (público)', () => {
  it('só ativas, em ordem, com as subcategorias ativas, sem dados internos', async () => {
    prisma().category.findMany.mockResolvedValue([{ ...row(), subcategories: [sub()] }] as never);
    const res = await request(app).get('/api/categories').expect(200);
    expect(prisma().category.findMany.mock.calls[0][0]).toEqual({
      where: { active: true },
      orderBy: { order: 'asc' },
      include: { subcategories: { where: { active: true }, orderBy: { order: 'asc' } } },
    });
    expect(res.body).toEqual([
      {
        id: 'cat_camisas', key: 'camisas', slug: 'camisas', name: 'Camisas', intro: 'Frase', description: 'Descrição',
        image: '/placeholders/cat-camisas.jpg', order: 0, active: true,
        subcategories: [{ id: 'sub_basicas', slug: 'basicas', name: 'Básicas' }],
      },
    ]);
  });
});

describe('GET /api/categories/all (painel)', () => {
  it('todas, com o número de peças de cada uma', async () => {
    prisma().category.findMany.mockResolvedValue([
      { ...row(), subcategories: [sub(), sub({ id: 'sub_est', slug: 'estampadas', name: 'Estampadas', order: 1, active: false })] },
      { ...row({ id: 'cat_bones', key: 'bonés', slug: 'bones', name: 'Bonés', active: false }), subcategories: [] },
    ] as never);
    // groupBy tem tipo genérico demais para o mock tipado: basta a forma do retorno.
    (prisma().product.groupBy as unknown as { mockImplementation: (f: (a: { by: string[] }) => unknown) => void }).mockImplementation(async (args) =>
      args.by[0] === 'category' ? [{ category: 'camisas', _count: { _all: 3 } }] : [{ subcategoryId: 'sub_basicas', _count: { _all: 2 } }],
    );
    const res = await request(app).get('/api/categories/all').set('Authorization', admin).expect(200);
    expect(res.body.map((c: { slug: string; productCount: number; active: boolean }) => [c.slug, c.productCount, c.active])).toEqual([
      ['camisas', 3, true],
      ['bones', 0, false],
    ]);
    expect(res.body[0].subcategories).toEqual([
      { id: 'sub_basicas', slug: 'basicas', name: 'Básicas', order: 0, active: true, productCount: 2 },
      { id: 'sub_est', slug: 'estampadas', name: 'Estampadas', order: 1, active: false, productCount: 0 },
    ]);
  });
  it('exige login e permissão de produtos', async () => {
    await request(app).get('/api/categories/all').expect(401);
    mockAccess(prisma(), 'admin-1', { permissions: { pedidos: 'edit' } });
    await request(app).get('/api/categories/all').set('Authorization', admin).expect(403);
  });
});

describe('POST /api/categories', () => {
  it('cria com endereço gerado do nome, no fim da ordem', async () => {
    prisma().category.findFirst.mockResolvedValue(row({ order: 3 }) as never);
    prisma().category.create.mockImplementation((async (args: { data: object }) => row({ id: 'novo', ...args.data })) as never);
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', admin)
      .send({ name: '  Jaquetas de Couro ', intro: 'Para o inverno.', image: '/uploads/j.jpg' })
      .expect(201);
    expect(prisma().category.create.mock.calls[0][0].data).toEqual({
      key: 'jaquetas-de-couro',
      slug: 'jaquetas-de-couro',
      name: 'Jaquetas de Couro',
      intro: 'Para o inverno.',
      description: '',
      image: '/uploads/j.jpg',
      order: 4,
      active: true,
    });
    expect(res.body.slug).toBe('jaquetas-de-couro');
  });
  it('nome vazio → 400', async () => {
    const res = await request(app).post('/api/categories').set('Authorization', admin).send({ name: '   ' }).expect(400);
    expect(res.body.error).toBe('Informe o nome da categoria.');
  });
  it('nome sem letras nem números → 400', async () => {
    const res = await request(app).post('/api/categories').set('Authorization', admin).send({ name: '!!!' }).expect(400);
    expect(res.body.error).toBe('Escolha um nome com letras ou números.');
  });
  it('endereço de outra página do site → 400', async () => {
    const res = await request(app).post('/api/categories').set('Authorization', admin).send({ name: 'Contato' }).expect(400);
    expect(res.body.error).toContain('/contato já é usado');
  });
  it('endereço repetido → 409', async () => {
    prisma().category.findFirst.mockResolvedValue(null);
    prisma().category.create.mockRejectedValue(unique());
    const res = await request(app).post('/api/categories').set('Authorization', admin).send({ name: 'Camisas' }).expect(409);
    expect(res.body.error).toBe('Já existe uma categoria com o endereço /camisas.');
  });
  it('exige permissão de editar produtos', async () => {
    mockAccess(prisma(), 'admin-1', { permissions: { produtos: 'view' } });
    await request(app).post('/api/categories').set('Authorization', admin).send({ name: 'Jaquetas' }).expect(403);
  });
});

describe('PUT /api/categories/:id', () => {
  it('atualiza nome, textos, foto e ativa — nunca key nem slug', async () => {
    prisma().category.update.mockResolvedValue(row({ name: 'Camisetas', active: false }) as never);
    await request(app)
      .put('/api/categories/cat_camisas')
      .set('Authorization', admin)
      .send({ name: 'Camisetas', intro: 'i', description: 'd', image: '/uploads/x.jpg', active: false, slug: 'hack', key: 'hack' })
      .expect(200);
    expect(prisma().category.update.mock.calls[0][0]).toEqual({
      where: { id: 'cat_camisas' },
      data: { name: 'Camisetas', intro: 'i', description: 'd', image: '/uploads/x.jpg', active: false },
    });
  });
  it('categoria que não existe → 404', async () => {
    prisma().category.update.mockRejectedValue(notFound());
    await request(app).put('/api/categories/nao').set('Authorization', admin).send({ name: 'X', active: true }).expect(404);
  });
});

describe('PATCH /api/categories/:id/move', () => {
  it('troca a ordem com a vizinha', async () => {
    const a = row({ id: 'a', order: 0 });
    const b = row({ id: 'b', order: 1, slug: 'b', key: 'b' });
    prisma().category.findMany.mockResolvedValue([a, b] as never);
    prisma().$transaction.mockResolvedValue([] as never);
    await request(app).patch('/api/categories/b/move').set('Authorization', admin).send({ direction: 'up' }).expect(200);
    expect(prisma().category.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: 'b' }, data: { order: 0 } },
      { where: { id: 'a' }, data: { order: 1 } },
    ]);
  });
  it('direção inválida → 400', async () => {
    await request(app).patch('/api/categories/a/move').set('Authorization', admin).send({ direction: 'lado' }).expect(400);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('com peças → 409 explicando o que fazer', async () => {
    prisma().category.findUnique.mockResolvedValue(row() as never);
    prisma().product.count.mockResolvedValue(2);
    const res = await request(app).delete('/api/categories/cat_camisas').set('Authorization', admin).expect(409);
    expect(res.body.error).toBe('Esta categoria tem 2 produto(s). Mova os produtos para outra categoria ou oculte a categoria.');
    expect(prisma().category.delete).not.toHaveBeenCalled();
  });
  it('sem peças → apaga junto as subcategorias (204)', async () => {
    prisma().category.findUnique.mockResolvedValue(row() as never);
    prisma().product.count.mockResolvedValue(0);
    prisma().$transaction.mockResolvedValue([] as never);
    await request(app).delete('/api/categories/cat_camisas').set('Authorization', admin).expect(204);
    expect(prisma().product.count.mock.calls[0][0]).toEqual({ where: { category: 'camisas' } });
    expect(prisma().subcategory.deleteMany.mock.calls[0][0]).toEqual({ where: { categoryId: 'cat_camisas' } });
    expect(prisma().category.delete.mock.calls[0][0]).toEqual({ where: { id: 'cat_camisas' } });
    expect(prisma().$transaction).toHaveBeenCalled();
  });
  it('não existe → 404', async () => {
    prisma().category.findUnique.mockResolvedValue(null);
    await request(app).delete('/api/categories/nao').set('Authorization', admin).expect(404);
  });
});

describe('subcategorias', () => {
  it('cria dentro da categoria, com endereço gerado do nome e no fim da ordem', async () => {
    prisma().category.findUnique.mockResolvedValue(row() as never);
    prisma().subcategory.findFirst.mockResolvedValue(sub({ order: 1 }) as never);
    prisma().subcategory.create.mockImplementation((async (args: { data: object }) => sub({ id: 'novo', ...args.data })) as never);
    const res = await request(app).post('/api/categories/cat_camisas/subcategories').set('Authorization', admin).send({ name: ' Camisa Estampada ' }).expect(201);
    expect(prisma().subcategory.findFirst.mock.calls[0][0]).toEqual({ where: { categoryId: 'cat_camisas' }, orderBy: { order: 'desc' } });
    expect(prisma().subcategory.create.mock.calls[0][0].data).toEqual({ categoryId: 'cat_camisas', slug: 'camisa-estampada', name: 'Camisa Estampada', order: 2, active: true });
    expect(res.body).toEqual({ id: 'novo', slug: 'camisa-estampada', name: 'Camisa Estampada', order: 2, active: true });
  });
  it('nome sem letras nem números → 400; categoria inexistente → 404', async () => {
    prisma().category.findUnique.mockResolvedValue(row() as never);
    const r = await request(app).post('/api/categories/cat_camisas/subcategories').set('Authorization', admin).send({ name: '!!!' }).expect(400);
    expect(r.body.error).toBe('Escolha um nome com letras ou números.');
    prisma().category.findUnique.mockResolvedValue(null);
    await request(app).post('/api/categories/nao/subcategories').set('Authorization', admin).send({ name: 'Básicas' }).expect(404);
  });
  it('nome repetido na mesma categoria → 409', async () => {
    prisma().category.findUnique.mockResolvedValue(row() as never);
    prisma().subcategory.findFirst.mockResolvedValue(null);
    prisma().subcategory.create.mockRejectedValue(unique());
    const r = await request(app).post('/api/categories/cat_camisas/subcategories').set('Authorization', admin).send({ name: 'Básicas' }).expect(409);
    expect(r.body.error).toBe('Já existe a subcategoria "Básicas" em Camisas.');
  });
  it('renomeia e oculta, sem mexer no endereço', async () => {
    prisma().subcategory.update.mockResolvedValue(sub({ name: 'Lisas', active: false }) as never);
    await request(app).put('/api/categories/subcategories/sub_basicas').set('Authorization', admin).send({ name: 'Lisas', active: false, slug: 'hack' }).expect(200);
    expect(prisma().subcategory.update.mock.calls[0][0]).toEqual({ where: { id: 'sub_basicas' }, data: { name: 'Lisas', active: false } });
    prisma().subcategory.update.mockRejectedValue(notFound());
    await request(app).put('/api/categories/subcategories/nao').set('Authorization', admin).send({ name: 'X', active: true }).expect(404);
  });
  it('move dentro da própria categoria', async () => {
    prisma().subcategory.findUnique.mockResolvedValue(sub({ id: 'b', order: 1 }) as never);
    prisma().subcategory.findMany.mockResolvedValue([sub({ id: 'a', order: 0 }), sub({ id: 'b', order: 1 })] as never);
    prisma().$transaction.mockResolvedValue([] as never);
    await request(app).patch('/api/categories/subcategories/b/move').set('Authorization', admin).send({ direction: 'up' }).expect(200);
    expect(prisma().subcategory.findMany.mock.calls[0][0]).toEqual({ where: { categoryId: 'cat_camisas' }, orderBy: { order: 'asc' } });
    expect(prisma().subcategory.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: 'b' }, data: { order: 0 } },
      { where: { id: 'a' }, data: { order: 1 } },
    ]);
  });
  it('apagar com peças → 409; sem peças → 204', async () => {
    prisma().subcategory.findUnique.mockResolvedValue(sub() as never);
    prisma().product.count.mockResolvedValue(3);
    const r = await request(app).delete('/api/categories/subcategories/sub_basicas').set('Authorization', admin).expect(409);
    expect(r.body.error).toBe('Esta subcategoria tem 3 produto(s). Mova os produtos ou oculte a subcategoria.');
    expect(prisma().product.count.mock.calls[0][0]).toEqual({ where: { subcategoryId: 'sub_basicas' } });
    prisma().product.count.mockResolvedValue(0);
    await request(app).delete('/api/categories/subcategories/sub_basicas').set('Authorization', admin).expect(204);
    expect(prisma().subcategory.delete.mock.calls[0][0]).toEqual({ where: { id: 'sub_basicas' } });
  });
  it('gravar exige permissão de editar produtos', async () => {
    mockAccess(prisma(), 'admin-1', { permissions: { produtos: 'view' } });
    await request(app).post('/api/categories/cat_camisas/subcategories').set('Authorization', admin).send({ name: 'X' }).expect(403);
    await request(app).delete('/api/categories/subcategories/sub_basicas').set('Authorization', admin).expect(403);
  });
});
