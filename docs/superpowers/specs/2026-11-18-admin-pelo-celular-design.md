# Login e cadastro de produto pelo celular — design

Data: 2026-11-18 · Tamanho: mudança pequena

## Por quê

As fotos das peças são tiradas no celular. O Vinicius quer entrar como admin pelo celular e cadastrar um produto ali mesmo, sem passar as fotos para o computador. Hoje isso é impossível: no celular não existe nenhum caminho para fazer login.

## Situação atual

- **Navbar:** o botão "Entrar"/conta (`hidden sm:block`) e o link "Painel Admin" (`hidden sm:flex`) somem abaixo de 640px. O menu do celular só tem Início, categorias e Atacado. Os clientes também não conseguem entrar nem criar conta pelo celular.
- **Painel admin:** já é responsivo (menu lateral vira gaveta, o formulário de produto ocupa a tela). O campo de foto (`accept="image/*"`) já oferece câmera e galeria.
- **Upload (`server/routes/upload.ts`):**
  - o limite é 8 MB, e foto de celular costuma passar disso;
  - o erro do multer cai no handler global e vira 500 com "File too large" (em inglês);
  - o `sharp` não aplica a orientação EXIF, então foto tirada em pé pode ficar deitada.
  - Se o Nginx de produção barrar antes, o front mostra só "Erro 413".

## Objetivos

1. Login, "Minha conta" e "Painel Admin" acessíveis no celular.
2. Foto de celular aceita até 20 MB e salva na orientação certa.
3. Quando a foto não puder ser enviada, uma mensagem clara em português dizendo o motivo e o que fazer.

**Fora do escopo:** redesenhar o painel para o celular, comprimir a foto no navegador (opção A, descartada pelo Vinicius) e configurar o Nginx de produção.

## Abordagens consideradas

- **A) Comprimir a foto no navegador antes de enviar:** envio rápido no 4G e nunca bate em limite. Descartada pelo Vinicius.
- **B) Aumentar o limite do servidor e corrigir a orientação (escolhida):** mais simples. O custo é o envio mais lento no 4G e a possibilidade de o Nginx barrar antes. Por isso o erro precisa ser claro.

## Design

**Navbar (celular):**
- Ícone de pessoa no topo, ao lado da sacola, visível só abaixo de `sm`. Deslogado, abre o mesmo painel "Entrar" do computador (e-mail, senha, "Criar conta"). Logado, leva a "Minha conta".
- O menu do celular ganha "Minha conta"/"Entrar" e, para admin, "Painel Admin".

**Upload (servidor):**
- Limite de 20 MB.
- `.rotate()` antes do `resize`, para respeitar a orientação EXIF.
- Arquivo grande demais → **413** com: "A foto tem mais de 20 MB. Tire a foto em resolução menor ou escolha outra imagem."
- Arquivo que não é imagem → **400** com a mensagem atual ("Envie apenas arquivos de imagem.").
- Erros do multer tratados na própria rota, não no handler global.

**Upload (front, `product-form`):**
- Antes de enviar, se o arquivo tiver mais de 20 MB, não envia e mostra: "A foto tem X MB e o limite é 20 MB."
- Resposta 413 sem mensagem da API (barrada pelo Nginx) → "A foto é grande demais para o servidor (X MB). Avise o responsável pelo site para aumentar o limite de upload (client_max_body_size do Nginx)."
- Falha de rede → "Não foi possível enviar a foto. Verifique a internet e tente de novo."
- Fotos extras: se uma falhar, o aviso diz qual (nome do arquivo) e as já enviadas continuam.

## Fica a critério de quem implementa

- O ícone exato e o espaçamento no topo, seguindo o visual atual da navbar.
- Onde fica a função de mensagem de erro (de preferência pura, em `utils/`, com teste).

## Verificação

- Testes do servidor: 413 com a mensagem certa acima de 20 MB; a orientação EXIF é aplicada.
- Testes do client: a função de mensagem de erro cobre tamanho, 413 do Nginx e rede.
- Chrome com emulação de celular (390px): login visível, menu com "Painel Admin" para admin.
