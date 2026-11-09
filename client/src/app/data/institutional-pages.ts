import { STORE_INFO } from './store-info';

export type PageBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'faq'; items: { question: string; answer: string }[] }
  | { type: 'table'; caption: string; head: string[]; rows: string[][] }
  | { type: 'highlights'; items: { value: string; label: string }[] }
  | { type: 'location' };

export interface InstitutionalPageContent {
  slug: string;
  title: string;
  eyebrow: string;
  intro: string;
  blocks: PageBlock[];
}

export const INSTITUTIONAL_PAGES: InstitutionalPageContent[] = [
  {
    slug: 'sobre-nos',
    title: 'Sobre nós',
    eyebrow: 'Institucional',
    intro: `Há ${STORE_INFO.yearsInBusiness} anos vestindo quem vive a rua em ${STORE_INFO.city}.`,
    blocks: [
      {
        type: 'highlights',
        items: [
          { value: `${STORE_INFO.yearsInBusiness} anos`, label: `de história em ${STORE_INFO.city}` },
          { value: 'Urbano', label: 'moda de rua com atitude' },
          { value: 'Outlet', label: 'preço justo, estilo de verdade' },
        ],
      },
      { type: 'heading', text: 'Nossa história' },
      {
        type: 'paragraph',
        text: `A Cabo Frio Outlet nasceu no coração de ${STORE_INFO.city} e, há ${STORE_INFO.yearsInBusiness} anos, é parada certa de quem busca vestuário urbano com preço de outlet. Começamos como uma loja de bairro e crescemos junto com os nossos clientes.`,
      },
      {
        type: 'paragraph',
        text: 'Trabalhamos com camisas, calças, bermudas e bonés das marcas que a rua usa, sempre com novidades chegando e atendimento de quem entende do assunto.',
      },
      { type: 'heading', text: 'Venha nos conhecer pessoalmente' },
      {
        type: 'paragraph',
        text: 'Compre online ou passe na loja: experimente as peças, tire dúvidas e leve o seu look na hora.',
      },
      { type: 'location' },
    ],
  },
  {
    slug: 'contato',
    title: 'Contato',
    eyebrow: 'Institucional',
    intro: 'Fale com a gente pelas redes ou venha experimentar as peças na loja.',
    blocks: [
      { type: 'heading', text: 'Onde estamos' },
      { type: 'location' },
      { type: 'heading', text: 'Redes sociais' },
      {
        type: 'paragraph',
        text: `Chame no Instagram ${STORE_INFO.instagramHandle} para tirar dúvidas, ver novidades e conferir a disponibilidade das peças.`,
      },
    ],
  },
  {
    slug: 'trabalhe-conosco',
    title: 'Trabalhe conosco',
    eyebrow: 'Institucional',
    intro: 'Quer fazer parte do time da Cabo Frio Outlet?',
    blocks: [
      {
        type: 'paragraph',
        text: 'Estamos sempre de olho em pessoas com energia, boa comunicação e gosto por moda urbana. Se você se identifica, queremos te conhecer.',
      },
      { type: 'heading', text: 'Como se candidatar' },
      {
        type: 'list',
        items: [
          'Leve seu currículo impresso até a loja, no Centro de Cabo Frio.',
          `Ou envie uma mensagem direta no Instagram ${STORE_INFO.instagramHandle} contando um pouco sobre você.`,
        ],
      },
      { type: 'location' },
    ],
  },
  {
    slug: 'trocas-e-devolucoes',
    title: 'Trocas e devoluções',
    eyebrow: 'Ajuda',
    intro: 'Comprou e não serviu ou não gostou? A gente resolve.',
    blocks: [
      { type: 'heading', text: 'Prazo para troca' },
      {
        type: 'paragraph',
        text: 'A primeira troca é grátis em até 30 dias após o recebimento da peça.',
      },
      { type: 'heading', text: 'Condições' },
      {
        type: 'list',
        items: [
          'A peça deve estar sem uso, sem lavagem e com as etiquetas originais.',
          'Guarde o cupom fiscal ou o comprovante do pedido.',
          'Trocas podem ser feitas diretamente na loja física ou combinadas pelo Instagram.',
        ],
      },
      { type: 'heading', text: 'Direito de arrependimento' },
      {
        type: 'paragraph',
        text: 'Em compras online, você tem até 7 dias corridos após o recebimento para desistir da compra, conforme o Código de Defesa do Consumidor (art. 49).',
      },
      { type: 'heading', text: 'Como solicitar' },
      {
        type: 'list',
        items: [
          `Chame a loja no Instagram ${STORE_INFO.instagramHandle} informando o número do pedido.`,
          'Combine a troca presencialmente na loja ou o envio da peça.',
        ],
      },
    ],
  },
  {
    slug: 'perguntas-frequentes',
    title: 'Perguntas frequentes',
    eyebrow: 'Ajuda',
    intro: 'As dúvidas mais comuns sobre compras, envio e trocas.',
    blocks: [
      {
        type: 'faq',
        items: [
          {
            question: 'Vocês têm loja física?',
            answer: `Sim! Estamos há ${STORE_INFO.yearsInBusiness} anos no Centro de Cabo Frio, na Avenida Júlia Kubitschek, 16, Edifício Premier Center, lojas 3 e 4, em frente à Prontomed.`,
          },
          {
            question: 'Quais formas de pagamento são aceitas?',
            answer: 'No site você paga pelo checkout seguro do Mercado Pago. Há opção de parcelamento sem juros em até 3x.',
          },
          {
            question: 'Como é calculado o frete?',
            answer: 'O frete é calculado no carrinho a partir do seu CEP. Pedidos acima do valor mínimo da loja têm frete grátis.',
          },
          {
            question: 'Posso trocar uma peça?',
            answer: 'Pode. A primeira troca é grátis em até 30 dias. Veja os detalhes em Trocas e devoluções.',
          },
          {
            question: 'Como sei o meu tamanho?',
            answer: 'Consulte o nosso Guia de medidas. Se ainda tiver dúvida, chame a gente no Instagram ou passe na loja para experimentar.',
          },
          {
            question: 'Posso retirar o pedido na loja?',
            answer: `Fale com a gente pelo Instagram ${STORE_INFO.instagramHandle} para combinar a retirada.`,
          },
        ],
      },
    ],
  },
  {
    slug: 'guia-de-medidas',
    title: 'Guia de medidas',
    eyebrow: 'Ajuda',
    intro: 'Meça-se com uma fita métrica e compare com as tabelas abaixo. As medidas são aproximadas e podem variar entre marcas.',
    blocks: [
      {
        type: 'table',
        caption: 'Camisas (cm)',
        head: ['Tamanho', 'Peito', 'Comprimento'],
        rows: [
          ['P', '88 – 94', '68'],
          ['M', '94 – 100', '70'],
          ['G', '100 – 106', '72'],
          ['GG', '106 – 112', '74'],
        ],
      },
      {
        type: 'table',
        caption: 'Calças e bermudas (cm)',
        head: ['Tamanho', 'Cintura', 'Quadril'],
        rows: [
          ['38', '76', '94'],
          ['40', '80', '98'],
          ['42', '84', '102'],
          ['44', '88', '106'],
          ['46', '92', '110'],
        ],
      },
      {
        type: 'table',
        caption: 'Bonés',
        head: ['Modelo', 'Ajuste'],
        rows: [
          ['Aba curva / reta com regulagem', 'Tamanho único, ajustável'],
          ['Fechado', 'Consulte a etiqueta ou fale com a loja'],
        ],
      },
      { type: 'heading', text: 'Como medir' },
      {
        type: 'list',
        items: [
          'Peito: contorne a parte mais larga do tórax, passando sob as axilas.',
          'Cintura: meça na altura do umbigo, sem apertar a fita.',
          'Quadril: contorne a parte mais larga, na altura do bumbum.',
        ],
      },
    ],
  },
];

export function findInstitutionalPage(slug: string | undefined): InstitutionalPageContent | undefined {
  return INSTITUTIONAL_PAGES.find((p) => p.slug === slug);
}
