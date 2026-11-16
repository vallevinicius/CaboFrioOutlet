# Admin: perfis de acesso e redesign liquid glass

Data: 2026-11-16 · Branch: `feat/admin-perfis-de-acesso-liquid-glass` · Tamanho: projeto

## Intenção e porquê

Hoje o painel `/admin` tem um único nível de acesso: `User.isAdmin` (sim/não). Todo admin vê e altera tudo, e qualquer admin pode promover outro.
O dono da loja quer colocar pessoas da equipe no painel sem dar acesso total (por exemplo, um estoquista que não vê Configurações).
Para isso é preciso um **admin supremo** que cria usuários da equipe e **perfis de acesso**, e um painel redesenhado, mais agradável de usar, em liquid glass.

## Objetivos

1. O admin supremo cria, edita e remove **perfis** (nome + acesso por tela).
2. O admin supremo cria usuários da equipe (nome, e-mail, senha provisória, perfil), troca o perfil e remove o acesso.
3. Cada perfil define, para cada tela do painel, **Nenhum**, **Ver** ou **Editar**.
4. O servidor impõe as permissões em toda rota administrativa. A interface só reflete o que o servidor já decide.
5. Painel redesenhado: menu na **esquerda**, liquid glass, fundo escuro em degradê com a **logo da loja borrada** ao fundo.

## Fora de escopo

- Permissões por ação ("reembolsar", "excluir produto"). O nível é por tela, com ver ou editar.
- Convite por e-mail e recuperação de senha por e-mail.
- Login com 2FA, log de auditoria e histórico de quem alterou o quê.
- Alterar o visual da loja pública.
- Mais de um admin supremo pela interface (ver "Decisões").

## Anti-objetivos (seria fracasso mesmo funcionando)

- Quem só pode **Ver** conseguir gravar chamando a API direto.
- Um usuário comum (cliente) ou um perfil sem acesso enxergar dados de outra tela.
- Um perfil alterado continuar valendo com token antigo.
- Algum admin atual perder acesso no deploy.
- O admin supremo conseguir se trancar para fora (ser rebaixado ou removido).

## Abordagens consideradas

Como guardar os perfis:

1. **Tabelas `Role` e `RolePermission` (uma linha por tela e nível).** Consistência garantida pelo banco, consulta direta de "quem edita Pedidos". Custa duas tabelas e mais código. **Escolhida pelo dono, por segurança.**
2. Tabela `Role` com coluna JSON de permissões. Menos código, mas o banco não impede chave inválida. Recomendada por mim, **recusada** pelo dono.
3. Permissões direto no usuário, sem perfis. Não atende o pedido.

## Design

### Telas e permissões

Telas do painel (chave estável usada no banco, na API e no front):

| Chave | Tela | Rotas protegidas |
|---|---|---|
| `inicio` | Visão geral | `GET /api/reports/overview` |
| `banners` | Banners | `POST/PUT/PATCH/DELETE /api/hero-slides` |
| `produtos` | Produtos | `POST/PUT/DELETE /api/products`, `PUT /api/products/:id/stock`, `POST /api/upload` |
| `estoque` | Estoque | `PUT /api/products/:id/stock` |
| `pedidos` | Pedidos | `GET /api/orders`, `PATCH /api/orders/:id/status` |
| `atacado` | Atacado | `GET /api/wholesale/quotes`, `PATCH /api/wholesale/quotes/:id` |
| `clientes` | Clientes | `GET /api/users` (somente leitura) |
| `configuracoes` | Configurações | `PUT /api/settings` |

- **Ver** libera as rotas de leitura da tela. **Editar** libera leitura e escrita. **Nenhum** (sem linha em `RolePermission`) bloqueia tudo.
- Rotas que servem a loja pública (listar produtos, banners, configurações) continuam públicas.
- `PUT /api/products/:id/stock` aceita `estoque:edit` ou `produtos:edit`. `POST /api/upload` aceita `produtos:edit` ou `banners:edit` ou `configuracoes:edit`.
- A tela **Equipe** não é uma permissão: só o admin supremo acessa.

### Modelo de dados (Prisma + migration versionada)

```
model Role {
  id          String           @id @default(cuid())
  name        String           @unique
  system      Boolean          @default(false)   // "Administrador": não pode ser editado nem removido
  permissions RolePermission[]
  users       User[]
  createdAt   DateTime         @default(now())
}

model RolePermission {
  roleId  String
  section String          // uma das chaves da tabela acima
  level   PermissionLevel // VIEW | EDIT
  role    Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@id([roleId, section])
}

enum PermissionLevel { VIEW EDIT }

User: + isSuperAdmin Boolean @default(false), + roleId String? (FK Role, onDelete Restrict)
```

- `User.isAdmin` continua existindo e passa a significar **"pertence à equipe e entra no painel"**. Invariante: `isSuperAdmin ⇒ isAdmin`; `isAdmin && !isSuperAdmin ⇒ roleId != null`. Uma função única (`staffAccess(user)`) concentra a regra.
- Perfil em uso não pode ser removido (409). `@@index` em `User.roleId`.

### Migração dos dados existentes

Dentro da migration, em SQL:
1. Cria o perfil de sistema **"Administrador"** com `EDIT` em todas as telas.
2. Todo `User` com `isAdmin = true` recebe esse `roleId`. Ninguém perde acesso.
3. A migration **não** escolhe o supremo (ela não enxerga o `ADMIN_EMAIL`).
4. **O admin supremo é o usuário criado pelo `npm run db:seed`** (e-mail de `ADMIN_EMAIL`). O `seed.ts` passa a: garantir o perfil "Administrador"; criar o admin inicial já como supremo; e, se esse usuário **já existir** (caso de produção), marcá-lo como `isSuperAdmin = true` sem mexer na senha. O seed é idempotente.
5. Rollout: depois do `migrate deploy`, rodar `npm run db:seed` uma vez. Até lá ninguém é supremo (a tela Equipe fica indisponível), mas o painel segue funcionando para todos os admins atuais.

### API (documentada em OpenAPI, Zod como fonte do schema)

Todas exigem admin supremo, exceto `GET /api/auth/me`.

- `GET/POST /api/roles`, `GET/PUT/DELETE /api/roles/:id`. Corpo: `{ name, permissions: [{ section, level }] }`, `section` validada contra a lista fixa.
- `GET/POST /api/staff`, `PATCH /api/staff/:id` (perfil, nome, redefinir senha), `DELETE /api/staff/:id` (remove o acesso à equipe: `isAdmin=false`, `roleId=null`; a conta de cliente continua).
- Respostas são DTOs sem `passwordHash`. Erros: 400, 401, 403, 404, 409 (e-mail duplicado, perfil em uso), 422.
- `GET /api/auth/me` passa a devolver `{ ..., isSuperAdmin, permissions: { [section]: 'view' | 'edit' } }`.
- `PATCH /api/users/:id/admin` e o botão de promoção da tela Clientes são **removidos**. Promover passa a ser só pela tela Equipe.
- Senha provisória: mínimo de 8 caracteres, guardada com bcrypt como as demais. Não é devolvida em nenhuma resposta.

### Autorização no servidor

- Novo middleware `requirePermission(section, level)` (e `requireAnyPermission([...])` para as rotas compartilhadas) e `requireSuperAdmin`. Substituem `requireAdmin` em todas as rotas listadas.
- O token JWT continua carregando só `sub`. A cada requisição administrativa o servidor lê do banco `isAdmin`, `isSuperAdmin` e as permissões do perfil. Mudança de perfil vale na hora, e remover o acesso derruba o usuário imediatamente.
- Proteções: o supremo não pode ser alterado, removido ou ter o perfil trocado por `/api/staff`; não se remove o único supremo; o perfil "Administrador" é imutável.

### Front-end (Angular)

- `AuthService` guarda `permissions` e `isSuperAdmin` a partir de `/auth/me`. Helpers `can(section, level)`.
- `adminGuard` passa a exigir `isAdmin`. O menu mostra só as telas com ao menos **Ver**. Telas com só **Ver** ficam com campos e botões de gravação desativados (os componentes de aba recebem `readonly`).
- Nova aba **Equipe** (lista de usuários, formulário de novo usuário, lista e matriz de perfis com Nenhum/Ver/Editar por tela).
- Se a API devolver 403, o front mostra aviso e não quebra a tela.

### Visual (decidido pelo dono)

- Menu fixo à esquerda dentro de um painel de vidro; seção "Administração" com **Equipe** (só supremo); usuário e perfil atual no rodapé do menu.
- Fundo **escuro**: degradê (marrom-âmbar para quase preto) com a **logo da loja grande e borrada**. Cartões, tabelas e menu em vidro (`backdrop-filter: blur` + saturação, borda clara, brilho interno). Acento amarelo da marca `#FFC700`.
- Mockup aprovado em direção: dois exemplos (Pedidos e Equipe), versão escura.
- Em telas estreitas o menu vira gaveta (ícone de menu no topo).
- Contraste de texto em AA sobre o vidro. Navegação e matriz de permissões acessíveis por teclado (`aria-pressed`/`aria-current`). `prefers-reduced-motion` e navegadores sem `backdrop-filter` caem para fundo sólido translúcido.

## Decisões do dono

- Acesso por **tela, com Ver ou Editar** (não por ação).
- **Tabelas separadas** (`Role` + `RolePermission`).
- Fundo **escuro**, menu à **esquerda**, logo borrada ao fundo.

## Minhas decisões (marcadas para conferência)

- Telas: as 8 atuais viram 8 chaves de permissão; **Equipe** é exclusiva do supremo.
- Um único supremo por enquanto; sem interface para criar outro.
- Admins atuais ficam com o perfil de sistema "Administrador" (editar em tudo). O supremo é o usuário do seed (`ADMIN_EMAIL`), por decisão do dono.
- Todo membro da equipe tem **e-mail obrigatório e único**, que é o login dele (a tela Equipe mostra o e-mail de cada um).
- Senha provisória definida pelo supremo, sem e-mail de convite.
- Permissões lidas do banco a cada requisição (não vão no token).
- `isAdmin` mantido como "é da equipe" para reduzir o risco do deploy; pode ser removido numa limpeza futura.
- Botão de promover admin removido da tela Clientes.

## Testes

Seguindo o padrão do projeto (Vitest + Supertest, Prisma mockado, sem banco real):
- `requirePermission`: sem token (401), cliente comum (403), perfil sem a tela (403), **Ver** bloqueando escrita (403), **Editar** permitindo, mudança de perfil refletida na próxima requisição, usuário com acesso removido (403).
- Rotas `/api/roles` e `/api/staff`: só supremo (403 para os outros), validação (seção inválida, e-mail duplicado → 409, senha curta → 422), perfil em uso não removível, supremo e "Administrador" protegidos, resposta sem `passwordHash`.
- Rotas existentes (pedidos, produtos, banners, atacado, configurações, relatórios, upload): ajustar os testes para o novo middleware, sem enfraquecer nenhum.
- OpenAPI: `spec.test.ts` cobre os novos endpoints.
- Front: testes do `can()` e do `adminGuard`.

## Documentação e rollout

- ADR em `docs/adr/` registrando a decisão de perfis em tabelas e permissão por tela (a estrutura `docs/` ainda não existe no repositório; criar só com confirmação do dono, ou deixar a ADR para depois).
- `CHANGELOG.md` com entrada em `[Unreleased]`, se o dono aceitar criar a estrutura.
- Deploy em produção: `git pull && npm ci && npm run build && npx prisma migrate deploy && npm run db:seed && pm2 restart cabofrio-backend`. Conferir quem ficou como supremo.

## O que fica para quem constrói

Nomes exatos de arquivos e componentes, a estrutura interna da aba Equipe, os ícones do menu, os textos de erro e os detalhes de CSS do vidro.
