import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Token JWT devolvido por POST /api/auth/login (validade de 7 dias).',
});

// ───────────────────────── Schemas (DTOs — nunca entidades do banco) ─────────────────────────

const Id = z.string().openapi({ example: 'cmu4stwin0000nknffustupxu' });
const Category = z.enum(['camisas', 'calças', 'bermudas', 'bonés']);
const OrderStatus = z.enum(['pendente', 'confirmado', 'enviado', 'entregue', 'cancelado']);

export const ErrorSchema = registry.register('Erro', z.object({ error: z.string().openapi({ example: 'Mensagem explicando o problema.' }) }));

const Product = registry.register(
  'Produto',
  z.object({
    id: Id,
    name: z.string().openapi({ example: 'Camisa Oversized' }),
    price: z.number().openapi({ example: 99.9 }),
    category: Category,
    brand: z.string().optional().openapi({ example: 'Marca' }),
    image: z.string().openapi({ description: 'Foto de capa', example: '/uploads/capa.jpg' }),
    images: z.array(z.string()).openapi({ description: 'Fotos adicionais (até 8)' }),
    description: z.string(),
    isNew: z.boolean(),
    discountPercent: z.number().optional(),
    sizes: z.array(z.string()).openapi({ example: ['P', 'M', 'G'] }),
    stock: z.record(z.string(), z.number().int()).openapi({ description: 'Quantidade por tamanho', example: { P: 3, M: 5, G: 0 } }),
  }),
);

const ProductInput = registry.register(
  'ProdutoEntrada',
  z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    category: Category,
    brand: z.string().optional(),
    image: z.string().min(1),
    images: z.array(z.string()).max(8).optional().openapi({ description: 'Caminhos /uploads/... ou URLs http(s)' }),
    description: z.string().optional(),
    sizes: z.array(z.string()).min(1),
    stock: z.record(z.string(), z.number().int().min(0)),
    discountPercent: z.number().optional(),
    isNew: z.boolean().optional(),
  }),
);

const OpeningHours = z.object({ label: z.string().openapi({ example: 'Segunda a sábado' }), hours: z.string().openapi({ example: '09h às 19h' }) });

const Settings = registry.register(
  'Configuracoes',
  z.object({
    storeName: z.string(),
    freeShippingThreshold: z.number(),
    shippingFee: z.number(),
    originCep: z.string(),
    hasMelhorEnvioToken: z.boolean().openapi({ description: 'O token em si nunca é devolvido.' }),
    melhorEnvioSandbox: z.boolean(),
    announcementMessages: z.array(z.string()),
    brands: z.array(z.string()),
    whatsapp: z.string().openapi({ description: 'Só dígitos, com DDI', example: '5522999999999' }),
    contactEmail: z.string(),
    openingHours: z.array(OpeningHours),
    googlePlaceId: z.string(),
    tickerMessages: z.array(z.string()),
    storyTitle: z.string(),
    storyBody: z.string(),
    gaMeasurementId: z.string().openapi({ example: 'G-XXXXXXXXXX' }),
    metaPixelId: z.string(),
  }),
);

const SettingsUpdate = registry.register(
  'ConfiguracoesEntrada',
  z
    .object({
      storeName: z.string(),
      freeShippingThreshold: z.number().positive(),
      shippingFee: z.number().min(0),
      originCep: z.string(),
      melhorEnvioToken: z.string().openapi({ description: 'Só é atualizado se vier preenchido.' }),
      melhorEnvioSandbox: z.boolean(),
      announcementMessages: z.array(z.string()),
      brands: z.array(z.string()),
      whatsapp: z.string().openapi({ description: 'DDD + número; vazio apaga.' }),
      contactEmail: z.string(),
      openingHours: z.array(OpeningHours).max(7),
      googlePlaceId: z.string(),
      tickerMessages: z.array(z.string().max(60)).max(8),
      storyTitle: z.string().max(80),
      storyBody: z.string().max(1200),
      gaMeasurementId: z.string().openapi({ example: 'G-XXXXXXXXXX' }),
      metaPixelId: z.string().openapi({ example: '1234567890' }),
    })
    .partial(),
);

const HeroSlide = registry.register(
  'Banner',
  z.object({
    id: Id,
    image: z.string(),
    eyebrow: z.string(),
    title: z.string(),
    highlight: z.string(),
    subtitle: z.string(),
    ctaLabel: z.string(),
    order: z.number().int(),
    createdAt: z.string().datetime(),
  }),
);
const HeroSlideInput = registry.register(
  'BannerEntrada',
  z.object({
    image: z.string().min(1),
    title: z.string().min(1),
    eyebrow: z.string().optional(),
    highlight: z.string().optional(),
    subtitle: z.string().optional(),
    ctaLabel: z.string().optional(),
  }),
);

const OrderItem = z.object({
  id: Id,
  productId: Id.nullable(),
  productName: z.string(),
  image: z.string(),
  size: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
});
const Order = registry.register(
  'Pedido',
  z.object({
    id: Id,
    createdAt: z.string().datetime(),
    customerName: z.string(),
    customerContact: z.string().openapi({ description: 'E-mail do cliente' }),
    items: z.array(OrderItem),
    total: z.number(),
    shippingCost: z.number(),
    shippingService: z.string().nullable(),
    status: OrderStatus,
    paymentStatus: z.string().nullable(),
    paymentMethod: z.string().nullable(),
    installments: z.number().int().nullable(),
  }),
);

const ShippingAddress = z.object({
  cep: z.string().openapi({ example: '28905-000' }),
  street: z.string(),
  number: z.string(),
  complement: z.string().optional(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string().length(2).openapi({ example: 'RJ' }),
});
const OrderCreate = registry.register(
  'PedidoEntrada',
  z.object({
    customerName: z.string(),
    customerContact: z.string().openapi({ description: 'E-mail', example: 'cliente@exemplo.com' }),
    items: z
      .array(z.object({ productId: Id, size: z.string(), quantity: z.number().int().positive() }))
      .min(1)
      .openapi({ description: 'Os preços NÃO são enviados: o servidor usa o catálogo.' }),
    shippingAddress: ShippingAddress,
    shippingOptionId: z.number().int().optional(),
  }),
);

const User = registry.register(
  'Usuario',
  z.object({
    id: Id,
    name: z.string(),
    email: z.string(),
    cpf: z.string(),
    phone: z.string(),
    cep: z.string(),
    street: z.string(),
    number: z.string(),
    complement: z.string().nullable(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string(),
    isAdmin: z.boolean(),
    createdAt: z.string().datetime(),
  }),
);
const RegisterInput = registry.register(
  'CadastroEntrada',
  z.object({
    name: z.string(),
    email: z.string().openapi({ example: 'cliente@exemplo.com' }),
    password: z.string().min(6),
    cpf: z.string().openapi({ example: '000.000.000-00' }),
    phone: z.string(),
    cep: z.string(),
    street: z.string(),
    number: z.string(),
    complement: z.string().optional(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string().length(2),
  }),
);
const ProfileInput = registry.register('PerfilEntrada', RegisterInput.omit({ password: true, cpf: true }).partial());
const LoginInput = registry.register('LoginEntrada', z.object({ email: z.string(), password: z.string() }));
const AuthResponse = registry.register('AuthResposta', z.object({ token: z.string(), user: User }));

const ProductIds = registry.register('FavoritosLista', z.object({ productIds: z.array(Id) }));

const ReviewsResponse = registry.register(
  'Avaliacoes',
  z.object({
    configured: z.boolean(),
    rating: z.number().nullable(),
    total: z.number().int(),
    mapsUrl: z.string().nullable(),
    reviews: z.array(z.object({ author: z.string(), rating: z.number().int().min(1).max(5), text: z.string(), relativeTime: z.string() })),
  }),
);

const Overview = registry.register(
  'RelatorioVisaoGeral',
  z.object({
    overview: z.object({
      periodDays: z.number().int(),
      revenue: z.number(),
      paidOrders: z.number().int(),
      averageTicket: z.number(),
      pendingOrders: z.number().int(),
      cancelledOrders: z.number().int(),
      series: z.array(z.object({ date: z.string().openapi({ example: '2026-11-09' }), revenue: z.number(), orders: z.number().int() })),
      topProducts: z.array(z.object({ productId: Id.nullable(), name: z.string(), quantity: z.number().int(), revenue: z.number() })),
    }),
    lowStock: z.object({
      outOfStock: z.number().int(),
      lowStock: z.number().int(),
      items: z.array(z.object({ productId: Id, name: z.string(), size: z.string(), stock: z.number().int() })),
    }),
  }),
);

const ShippingCalculateInput = registry.register(
  'FreteEntrada',
  z.object({ cep: z.string().openapi({ example: '28905-000' }), items: z.array(z.object({ productId: Id, quantity: z.number().int().positive() })).min(1) }),
);
const ShippingOptions = registry.register(
  'FreteOpcoes',
  z.object({
    options: z.array(z.object({ id: z.number().int(), name: z.string(), price: z.number(), deliveryTime: z.number().nullable(), company: z.string() })),
    usedFallback: z.boolean().openapi({ description: 'true quando a Melhor Envio não respondeu e foi usado o frete fixo.' }),
  }),
);

const PayInput = registry.register(
  'PagamentoEntrada',
  z.object({
    orderId: Id,
    payment_method_id: z.string().openapi({ example: 'pix' }),
    selectedPaymentMethod: z.string().optional().openapi({ example: 'bank_transfer' }),
    token: z.string().optional().openapi({ description: 'Token do cartão (Mercado Pago).' }),
    issuer_id: z.string().optional(),
    installments: z.number().int().optional(),
    payer: z.object({ email: z.string().optional(), identification: z.object({ type: z.string(), number: z.string() }).optional() }).optional(),
  }),
);
const PayResult = registry.register(
  'PagamentoResposta',
  z.object({
    status: z.string().optional(),
    statusDetail: z.string().optional(),
    orderId: Id,
    orderStatus: OrderStatus,
    paymentId: z.string().optional(),
    qrCode: z.string().optional(),
    qrCodeBase64: z.string().optional(),
    ticketUrl: z.string().optional(),
  }),
);

// ───────────────────────── Helpers de rota ─────────────────────────

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Access = 'public' | 'auth' | 'admin';

interface RouteDoc {
  method: Method;
  path: string; // formato OpenAPI: /api/x/{id}
  tag: string;
  summary: string;
  access?: Access;
  params?: z.ZodObject<z.ZodRawShape>;
  query?: z.ZodObject<z.ZodRawShape>;
  body?: z.ZodType;
  bodyContent?: 'json' | 'multipart';
  ok: { status?: number; schema?: z.ZodType; description: string };
  errors?: number[];
}

const ERROR_TEXT: Record<number, string> = {
  400: 'Dados inválidos',
  401: 'Não autenticado',
  403: 'Sem permissão',
  404: 'Não encontrado',
  409: 'Conflito',
  422: 'Não processável',
  429: 'Muitas tentativas',
};

function doc(r: RouteDoc): void {
  const access = r.access ?? 'public';
  const errors = new Set(r.errors ?? []);
  if (access !== 'public') errors.add(401);
  if (access === 'admin') errors.add(403);
  const responses: Record<string, { description: string; content?: Record<string, { schema: z.ZodType }> }> = {
    [String(r.ok.status ?? 200)]: {
      description: r.ok.description,
      ...(r.ok.schema ? { content: { 'application/json': { schema: r.ok.schema } } } : {}),
    },
  };
  for (const code of errors) responses[String(code)] = { description: ERROR_TEXT[code] ?? 'Erro', content: { 'application/json': { schema: ErrorSchema } } };

  registry.registerPath({
    method: r.method,
    path: r.path,
    tags: [r.tag],
    summary: r.summary,
    ...(access !== 'public' ? { security: [{ bearerAuth: [] }] } : {}),
    request: {
      ...(r.params ? { params: r.params } : {}),
      ...(r.query ? { query: r.query } : {}),
      ...(r.body
        ? { body: { required: true, content: { [r.bodyContent === 'multipart' ? 'multipart/form-data' : 'application/json']: { schema: r.body } } } }
        : {}),
    },
    responses,
  });
}

const idParam = z.object({ id: Id });
const productIdParam = z.object({ productId: Id });

// ───────────────────────── Rotas ─────────────────────────

doc({ method: 'get', path: '/api/products', tag: 'Produtos', summary: 'Lista o catálogo', ok: { schema: z.array(Product), description: 'Produtos com estoque por tamanho' } });
doc({ method: 'post', path: '/api/products', tag: 'Produtos', summary: 'Cria um produto', access: 'admin', body: ProductInput, ok: { status: 201, schema: Product, description: 'Produto criado' }, errors: [400] });
doc({ method: 'put', path: '/api/products/{id}', tag: 'Produtos', summary: 'Edita um produto', access: 'admin', params: idParam, body: ProductInput, ok: { schema: Product, description: 'Produto atualizado' }, errors: [400, 404] });
doc({ method: 'put', path: '/api/products/{id}/stock', tag: 'Produtos', summary: 'Ajusta o estoque de um tamanho', access: 'admin', params: idParam, body: z.object({ size: z.string(), quantity: z.number().int().min(0) }), ok: { schema: Product, description: 'Produto atualizado' }, errors: [400, 404] });
doc({ method: 'delete', path: '/api/products/{id}', tag: 'Produtos', summary: 'Apaga um produto', access: 'admin', params: idParam, ok: { status: 204, description: 'Apagado' }, errors: [404] });

doc({ method: 'get', path: '/api/settings', tag: 'Configurações', summary: 'Configurações públicas da loja', ok: { schema: Settings, description: 'Configurações (sem segredos)' } });
doc({ method: 'put', path: '/api/settings', tag: 'Configurações', summary: 'Atualiza as configurações', access: 'admin', body: SettingsUpdate, ok: { schema: Settings, description: 'Configurações atualizadas' }, errors: [400] });

doc({ method: 'get', path: '/api/hero-slides', tag: 'Banners', summary: 'Lista os banners da home', ok: { schema: z.array(HeroSlide), description: 'Banners em ordem' } });
doc({ method: 'post', path: '/api/hero-slides', tag: 'Banners', summary: 'Cria um banner', access: 'admin', body: HeroSlideInput, ok: { status: 201, schema: HeroSlide, description: 'Banner criado' }, errors: [400] });
doc({ method: 'put', path: '/api/hero-slides/{id}', tag: 'Banners', summary: 'Edita um banner', access: 'admin', params: idParam, body: HeroSlideInput, ok: { schema: HeroSlide, description: 'Banner atualizado' }, errors: [400, 404] });
doc({ method: 'patch', path: '/api/hero-slides/{id}/move', tag: 'Banners', summary: 'Sobe ou desce um banner na ordem', access: 'admin', params: idParam, body: z.object({ direction: z.enum(['up', 'down']) }), ok: { schema: z.array(HeroSlide), description: 'Nova ordem' }, errors: [400, 404] });
doc({ method: 'delete', path: '/api/hero-slides/{id}', tag: 'Banners', summary: 'Apaga um banner', access: 'admin', params: idParam, ok: { status: 204, description: 'Apagado' }, errors: [404] });

doc({ method: 'get', path: '/api/orders', tag: 'Pedidos', summary: 'Lista todos os pedidos', access: 'admin', ok: { schema: z.array(Order), description: 'Pedidos' } });
doc({ method: 'get', path: '/api/orders/mine', tag: 'Pedidos', summary: 'Pedidos do cliente logado', access: 'auth', ok: { schema: z.array(Order), description: 'Pedidos do usuário do token' } });
doc({ method: 'post', path: '/api/orders', tag: 'Pedidos', summary: 'Cria um pedido e reserva o estoque', body: OrderCreate, ok: { status: 201, schema: Order, description: 'Pedido pendente de pagamento' }, errors: [400] });
doc({ method: 'patch', path: '/api/orders/{id}/status', tag: 'Pedidos', summary: 'Muda o status de um pedido', access: 'admin', params: idParam, body: z.object({ status: OrderStatus }), ok: { schema: Order, description: 'Pedido atualizado' }, errors: [400, 404] });

doc({ method: 'get', path: '/api/checkout/config', tag: 'Checkout', summary: 'Chave pública do Mercado Pago', ok: { schema: z.object({ publicKey: z.string() }), description: 'Chave pública' } });
doc({ method: 'post', path: '/api/checkout/pay', tag: 'Checkout', summary: 'Paga um pedido pendente', body: PayInput, ok: { schema: PayResult, description: 'Resultado do pagamento' }, errors: [400, 404] });
doc({ method: 'get', path: '/api/checkout/orders/{id}/status', tag: 'Checkout', summary: 'Status público do pedido (usado no polling do Pix)', params: idParam, ok: { schema: z.object({ id: Id, status: OrderStatus, paymentStatus: z.string().nullable(), total: z.number() }), description: 'Status' }, errors: [404] });
doc({ method: 'post', path: '/api/checkout/webhook', tag: 'Checkout', summary: 'Notificação do Mercado Pago', body: z.object({ type: z.string().optional(), data: z.object({ id: z.string() }).optional() }), ok: { description: 'Sempre 200 (evita reenvio em loop)' } });

doc({ method: 'post', path: '/api/shipping/calculate', tag: 'Frete', summary: 'Cotação de frete por CEP', body: ShippingCalculateInput, ok: { schema: ShippingOptions, description: 'Opções de frete' }, errors: [400] });

doc({ method: 'post', path: '/api/auth/register', tag: 'Conta', summary: 'Cria uma conta de cliente', body: RegisterInput, ok: { status: 201, schema: AuthResponse, description: 'Conta criada' }, errors: [400, 409, 429] });
doc({ method: 'post', path: '/api/auth/login', tag: 'Conta', summary: 'Entra na conta', body: LoginInput, ok: { schema: AuthResponse, description: 'Token e usuário' }, errors: [400, 401, 429] });
doc({ method: 'get', path: '/api/auth/me', tag: 'Conta', summary: 'Dados do usuário logado', access: 'auth', ok: { schema: z.object({ user: User }), description: 'Usuário' } });
doc({ method: 'put', path: '/api/auth/me', tag: 'Conta', summary: 'Atualiza o perfil', access: 'auth', body: ProfileInput, ok: { schema: z.object({ user: User }), description: 'Usuário atualizado' }, errors: [400, 409] });

doc({ method: 'get', path: '/api/users', tag: 'Clientes', summary: 'Lista os clientes', access: 'admin', ok: { schema: z.array(User), description: 'Usuários' } });
doc({ method: 'patch', path: '/api/users/{id}/admin', tag: 'Clientes', summary: 'Concede ou retira acesso de administrador', access: 'admin', params: idParam, body: z.object({ isAdmin: z.boolean() }), ok: { schema: User, description: 'Usuário atualizado' }, errors: [400] });

doc({ method: 'post', path: '/api/upload', tag: 'Upload', summary: 'Envia uma imagem (convertida para JPEG, até 8 MB)', access: 'admin', bodyContent: 'multipart', body: z.object({ image: z.string().openapi({ type: 'string', format: 'binary' }) }), ok: { status: 201, schema: z.object({ url: z.string().openapi({ example: '/uploads/uuid.jpg' }) }), description: 'URL da imagem' }, errors: [400] });

doc({ method: 'get', path: '/api/favorites', tag: 'Favoritos', summary: 'Favoritos do usuário logado', access: 'auth', ok: { schema: ProductIds, description: 'Ids dos produtos' } });
doc({ method: 'post', path: '/api/favorites/merge', tag: 'Favoritos', summary: 'Soma os favoritos do navegador aos da conta', access: 'auth', body: ProductIds, ok: { schema: ProductIds, description: 'Lista final' }, errors: [400] });
doc({ method: 'put', path: '/api/favorites/{productId}', tag: 'Favoritos', summary: 'Favorita um produto (idempotente)', access: 'auth', params: productIdParam, ok: { status: 204, description: 'Salvo' }, errors: [400, 404, 409] });
doc({ method: 'delete', path: '/api/favorites/{productId}', tag: 'Favoritos', summary: 'Remove dos favoritos', access: 'auth', params: productIdParam, ok: { status: 204, description: 'Removido' }, errors: [400] });

doc({ method: 'get', path: '/api/reviews', tag: 'Avaliações', summary: 'Avaliações do Google (cache de 6 h)', ok: { schema: ReviewsResponse, description: 'Vazio quando não configurado' } });

doc({ method: 'get', path: '/api/reports/overview', tag: 'Relatórios', summary: 'Vendas e estoque baixo', access: 'admin', query: z.object({ days: z.enum(['7', '30', '90']).optional().openapi({ description: 'Padrão 30' }) }), ok: { schema: Overview, description: 'Resumo do período' } });

doc({ method: 'get', path: '/api/health', tag: 'Sistema', summary: 'Verificação de saúde', ok: { schema: z.object({ ok: z.boolean() }), description: 'Servidor no ar' } });
registry.registerPath({ method: 'get', path: '/robots.txt', tags: ['Sistema'], summary: 'robots.txt', responses: { 200: { description: 'Texto', content: { 'text/plain': { schema: z.string() } } } } });
registry.registerPath({ method: 'get', path: '/sitemap.xml', tags: ['Sistema'], summary: 'sitemap.xml com home, páginas e produtos', responses: { 200: { description: 'XML', content: { 'application/xml': { schema: z.string() } } } } });

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'API da Cabo Frio Outlet',
      version: '1.0.0',
      description:
        'API da loja. Rotas marcadas com cadeado exigem `Authorization: Bearer <token>`; as de administração exigem um usuário admin. Os exemplos usam dados fictícios.',
    },
    servers: [{ url: '/' }],
  });
}
