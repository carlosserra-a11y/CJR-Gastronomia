# Chef Carlos Jr · CJR Gastronomia — cardápio virtual

Cardápio virtual da **CJR Gastronomia** (alta gastronomia itinerante para eventos sociais e corporativos, com o Chef Carlos Junior, em Florianópolis e região), feito a partir do briefing oficial:

- **Visual "cozinha do chef"**: fundo claro de linho e mármore, grafite, cobre das panelas e inox nos detalhes; serifa clássica (Cormorant Garamond) + Manrope; logo oficial em assinatura.
- **Objetos 3D no topo** (three.js): faca, garfo, colher, tomates, manjericão, alecrim, limão e grãos de pimenta e sal em inox e materiais realistas. Giram com o mouse, se espalham ao rolar e "pulam" com um toque. No celular ficam só nas bordas, para não cobrir o texto. O pacote 3D só é baixado na página inicial e não roda com "reduzir movimento".
- **Portfólio interativo** com 59 fotos reais (Drive + Instagram do Chef): anel 3D que gira sozinho, com a rolagem e ao arrastar; grade com filtros, "ver mais", "Surpreenda-me" e cartões que inclinam com o mouse; visualizador em tela cheia com troca automática, toque nas laterais, arrastar para baixo para fechar e botão "Quero algo assim" (WhatsApp).
- **Calculadora de convidados**: número de convidados, perfil do evento (leve, normal, farto) e o que servir (coffee, mesa de frios, finger food, buffet de risoto, sobremesas) → gramas por pessoa, quantidade total e **faixa de valor aproximada**, com envio da simulação pelo WhatsApp. Gramas e valores de referência são editáveis no painel.
- **Avaliações de clientes**: nota e total no Google com link para ler todas, destaques e carrossel de depoimentos (cadastrados pela equipe no painel, com autorização dos clientes).
- **Botão do WhatsApp sempre no canto direito**, em todas as telas (sobe quando a barra de seleção aparece no celular).
- **Pensado para o celular primeiro**: alvos de toque grandes, resumo fixo da calculadora, carrosséis que deslizam no dedo.
- **Paralaxe na rolagem**: rolagem suave (Lenis), títulos que entram palavra por palavra, cartões em colunas com velocidades diferentes, faixa de eventos que acelera com a rolagem, "Como funciona" com passos que acendem e textos gigantes vazados ao fundo.
- **Cardápio completo do briefing**: Coffee Corporativo, Mesa de Frios, Finger Foods (7 grupos), 6 Buffets, Sobremesas (com seleções prontas), Buffet de Risotos (com escolha de formato), Cook Show e "Aumente sua Experiência" (ativações).
- **Monte sua experiência**: o cliente marca pacotes e itens (fica salvo no aparelho), preenche o formulário do evento e o site abre o **WhatsApp com a mensagem organizada**. **Nenhum preço final é calculado** (como pede o briefing): a calculadora mostra só uma faixa aproximada, e o orçamento é sempre feito pela equipe.
- **Painel da equipe** (`/admin/`): editar categorias, pacotes, itens, preços de referência, disponibilidade, fotos e todos os textos, ativar/desativar sem apagar, ordem, **histórico de versões com "restaurar"** e contas da equipe.
- Acessível (contraste, foco visível, teclado, "reduzir movimento" desliga as animações) e responsivo (celular, tablet e computador).
- **Contato do Chef**: WhatsApp (48) 99683-5439 · Instagram [@chefcarlosjr_gastronomia](https://www.instagram.com/chefcarlosjr_gastronomia/) · Florianópolis e região. Tudo editável no painel.

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
| Trocar textos do topo, do Chef, "Como funciona", aviso de privacidade | **Textos do site** |
| Adicionar, reordenar ou tirar **fotos do portfólio** (com categoria e legenda) | **Textos do site** → Portfólio |
| Ajustar **gramas por pessoa e valores aproximados** da calculadora | **Textos do site** → Calculadora de convidados |
| Atualizar **nota/total do Google** ou cadastrar **depoimentos** | **Textos do site** → Avaliações de clientes |
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
4. Ao iniciar, o servidor acrescenta a um banco já existente os campos de conteúdo de recursos novos (ex.: calculadora, avaliações) que ainda não existam nele, como uma nova versão do histórico. Nada do que a equipe editou é alterado; fotos novas do portfólio, porém, precisam ser adicionadas pelo painel.

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
js/site/portfolio.js     portfólio: anel 3D, grade com filtros e visualizador
js/site/calculator.js    calculadora de convidados (tela)
js/site/reviews.js       avaliações de clientes
js/shared/calculator.js  contas da calculadora (site, painel, servidor e testes)
css/features.css         calculadora, avaliações, botão do WhatsApp, extras do portfólio
js/site/kitchen3d.js     cena 3D do topo já empacotada (gerada — não editar à mão)
src/3d/kitchen.js        código-fonte da cena 3D (three.js)
js/site/cursor.js        cursor, botões magnéticos, cartões com inclinação
js/admin/*.js            painel: núcleo, cardápio, textos, histórico, conta
data/menu.json           cardápio inicial (do briefing) e versão do GitHub Pages
assets/img/              logo (clara e escura), foto do chef, mármore, ícone
assets/img/portfolio/    fotos dos eventos (versão grande e miniatura -sm)
server/                  Express + SQLite (node:sqlite): API, sessões, validação
tests/                   testes automáticos (npm test)
```

Endereços de teste: `?nointro` pula a abertura animada.

### Alterar a cena 3D ou atualizar bibliotecas

O site não tem etapa de build para rodar: os arquivos gerados já estão no repositório. Só é preciso gerar de novo ao mexer em `src/3d/kitchen.js` ou atualizar three.js/Lenis:

```bash
npm run build      # = build:3d (cena 3D) + build:vendor (Lenis)
```

## 🔒 Segurança e privacidade

- **Dados dos clientes não são gravados no servidor**: a mensagem é montada no navegador e enviada pelo próprio cliente no WhatsApp. A seleção fica só no aparelho dele (há aviso de privacidade no site).
- Senhas com **scrypt** + sal; sessão em cookie `HttpOnly` + `SameSite=Strict`; proteção CSRF; limite de tentativas de login.
- Todo conteúdo é **escapado** antes de aparecer na tela e validado no servidor (fotos só de upload, `assets/img/` ou `https://`).
- Cabeçalhos de segurança (CSP sem script inline, nosniff, frame-ancestors) e lista branca de arquivos servidos.

## 🧪 Testes

```bash
npm test
```

Cobrem: versão pública do cardápio (sem itens ocultos nem preços escondidos), regras de seleção (escolha única, limite, seleções prontas), validação do formulário, mensagem do WhatsApp (sem preço), primeiro acesso, login, CSRF, salvar/versões/conflito/restaurar, ETag do cardápio, validação do cardápio, do portfólio, da calculadora e das avaliações, contas da calculadora, atualização de bancos antigos com os campos novos e upload de imagens.

## ✅ Antes de divulgar (do briefing)

Valores, quantidades por pessoa, fichas técnicas, disponibilidade e condições comerciais devem ser **confirmados e inseridos pela CJR** antes da publicação. O painel mostra essas pendências em **Visão geral**.
