# Chef Carlos Jr · CJR Gastronomia — cardápio virtual

Cardápio virtual da **CJR Gastronomia** (experiências gastronômicas para eventos sociais e corporativos, com o Chef Carlos Junior), feito a partir do briefing oficial:

- **Visual premium**: verde-escuro e preto com detalhes em dourado, serifa clássica (Cormorant Garamond) + Manrope, logo oficial em assinatura.
- **Hero interativo no fundo da página** (WebGL, sem bibliotecas): "seda" verde em movimento com linhas douradas, pó dourado subindo, luz que segue o mouse e uma onda a cada clique. Fica fixo atrás da página inteira e escurece conforme a rolagem desce.
- **Paralaxe na rolagem**: rolagem suave (Lenis), folhas de palmeira desenhadas em código em várias profundidades (balançam com o mouse e se abrem ao rolar), retrato do chef em paralaxe, títulos que entram palavra por palavra, cartões em colunas com velocidades diferentes, faixa de eventos que acelera com a rolagem, "Como funciona" com passos que acendem, textos gigantes vazados que deslizam na horizontal e galeria horizontal presa (quando houver fotos).
- **Cardápio completo do briefing**: Coffee Corporativo, Mesa de Frios, Finger Foods (7 grupos), 6 Buffets, Sobremesas (com seleções prontas), Buffet de Risotos (com escolha de formato), Cook Show e "Aumente sua Experiência" (ativações).
- **Monte sua experiência**: o cliente marca pacotes e itens (fica salvo no aparelho), preenche o formulário do evento e o site abre o **WhatsApp com a mensagem organizada**. **Nenhum preço final é calculado** (como pede o briefing).
- **Painel da equipe** (`/admin/`): editar categorias, pacotes, itens, preços de referência, disponibilidade, fotos e todos os textos, ativar/desativar sem apagar, ordem, **histórico de versões com "restaurar"** e contas da equipe.
- Acessível (contraste, foco visível, teclado, "reduzir movimento" desliga as animações) e responsivo (celular, tablet e computador).

---

## ▶️ Rodar no computador

Precisa do **Node.js 22.13+** (recomendado: Node 24).

```bash
npm install
npm start
```

- Site: http://localhost:3000
- Painel: http://localhost:3000/admin/

### Primeiro acesso ao painel

Na primeira vez que o servidor liga, o terminal mostra um **código de configuração** (ex.: `ABCD-1234`). Abra `/admin/`, digite o código e crie usuário e senha (8+ caracteres, letras e números). O código vale só para a primeira conta; as outras são criadas em **Conta e equipe**.

> Também dá para criar a 1ª conta por variáveis de ambiente: `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

---

## 🧑‍🍳 Usando o painel

| Quero… | Onde |
|---|---|
| Colocar o **número do WhatsApp** que recebe os pedidos | **Contato e configurações** (55 + DDD + número) |
| Mudar nome, descrição, itens inclusos, **preço**, disponibilidade ou **foto** de um pacote/item | **Cardápio** → categoria → clique no item |
| Esconder algo sem apagar | Botão **Ativo/Oculto** |
| Adicionar item, grupo, categoria ou "seleção pronta" | Botões **+** dentro de **Cardápio** |
| Mostrar "a partir de R$ …" no site | **Contato e configurações** → Preços (desligado por padrão) |
| Trocar textos do topo, do Chef, "Como funciona", galeria, aviso de privacidade | **Textos do site** |
| Desfazer uma alteração | **Histórico** → Restaurar |
| Ver o que falta antes de divulgar | **Visão geral** (lista de pendências) |

Tudo o que você muda fica como **rascunho** até clicar em **Salvar e publicar** (a barra aparece embaixo).

---

## 🌐 Publicar

O projeto tem **duas partes**:

1. **Site** (`index.html`, `css/`, `js/`, `assets/`, `data/`) — funciona até no **GitHub Pages**. Sem servidor, o cardápio vem de `data/menu.json` e o orçamento vai pelo WhatsApp normalmente.
2. **Servidor** (`server/`) — necessário para o **painel** e o histórico. Precisa de um serviço que rode Node.js.

### Só GitHub Pages
Já está publicado em `https://carlosserra-a11y.github.io/CJR-Gastronomia/`. Para atualizar o cardápio dessa versão: no painel (rodando em algum servidor ou no computador), use **Conta e equipe → Baixar cardápio (menu.json)** e substitua `data/menu.json` no repositório.

### Site completo com painel (recomendado): Render, Railway, Fly.io ou VPS
1. Crie o serviço apontando para este repositório, com o comando `npm start`.
2. Variáveis de ambiente:

| Variável | Para quê | Exemplo |
|---|---|---|
| `PORT` | porta (a plataforma costuma definir sozinha) | `3000` |
| `DATA_DIR` | pasta **persistente** do banco e das fotos enviadas | `/data` |
| `TRUST_PROXY` | `1` quando estiver atrás do HTTPS da plataforma | `1` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | (opcional) cria a 1ª conta no primeiro start | — |

3. **Importante:** monte um **disco/volume persistente** em `DATA_DIR`. Sem isso, o banco é apagado a cada novo deploy.

---

## 🗂️ Estrutura

```
index.html               site (início, categorias, orçamento, privacidade)
admin/index.html         painel da equipe
css/site.css             identidade visual, topo, hero e página inicial
css/pages.css            páginas internas, formulário, diálogos
css/admin.css            painel
js/shared/menu.js        regras do cardápio (versão pública, preços, resumo de alterações)
js/shared/selection.js   "minha experiência" (seleção do cliente)
js/shared/quote.js       validação do formulário e mensagem do WhatsApp
js/site/main.js          rotas, transições e efeitos da página inicial
js/site/views.js         modelos das telas
js/site/motion.js        rolagem suave, laço único de animação, paralaxe e revelações
js/site/hero-bg.js       fundo interativo em WebGL
js/site/fronds.js        folhas de palmeira desenhadas em código
js/site/cursor.js        cursor dourado, botões magnéticos, cartões 3D
js/admin/*.js            painel: núcleo, cardápio, textos, histórico, conta
data/menu.json           cardápio inicial (do briefing) e versão do GitHub Pages
assets/img/              logo, foto do chef, ícone
server/                  Express + SQLite (node:sqlite): API, sessões, validação
tests/                   testes automáticos (npm test)
```

Endereços de teste: `?nointro` pula a abertura animada.

## 🔒 Segurança e privacidade

- **Dados dos clientes não são gravados no servidor**: a mensagem é montada no navegador e enviada pelo próprio cliente no WhatsApp. A seleção fica só no aparelho dele (há aviso de privacidade no site).
- Senhas com **scrypt** + sal; sessão em cookie `HttpOnly` + `SameSite=Strict`; proteção CSRF; limite de tentativas de login.
- Todo conteúdo é **escapado** antes de aparecer na tela e validado no servidor (fotos só de upload, `assets/img/` ou `https://`).
- Cabeçalhos de segurança (CSP sem script inline, nosniff, frame-ancestors) e lista branca de arquivos servidos.

## 🧪 Testes

```bash
npm test
```

Cobrem: versão pública do cardápio, regras de seleção (escolha única, limite, seleções prontas), validação do formulário, mensagem do WhatsApp (sem preço), primeiro acesso, login, CSRF, salvar/versões/conflito/restaurar, validação do cardápio e upload de imagens.

## ✅ Antes de divulgar (do briefing)

Valores, quantidades por pessoa, fichas técnicas, disponibilidade e condições comerciais devem ser **confirmados e inseridos pela CJR** antes da publicação. O painel mostra essas pendências em **Visão geral**.
