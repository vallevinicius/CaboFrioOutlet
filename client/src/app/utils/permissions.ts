export type Section =
  | 'inicio'
  | 'banners'
  | 'produtos'
  | 'estoque'
  | 'pedidos'
  | 'atacado'
  | 'clientes'
  | 'configuracoes';
export type Level = 'view' | 'edit';
export type Permissions = Partial<Record<Section, Level>>;

/** Telas do painel, na ordem do menu. Mesma lista do servidor (`server/services/access.ts`). */
export const SECTIONS: { key: Section; label: string }[] = [
  { key: 'inicio', label: 'Visão geral' },
  { key: 'banners', label: 'Banners' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'atacado', label: 'Atacado' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'configuracoes', label: 'Configurações' },
];

/** "edit" inclui "view". Só espelha o que o servidor já decide: a segurança real está na API. */
export function canAccess(permissions: Permissions | undefined, section: Section, level: Level): boolean {
  const granted = permissions?.[section];
  if (!granted) return false;
  return level === 'view' || granted === 'edit';
}
