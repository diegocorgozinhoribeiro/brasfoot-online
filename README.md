# Brasfoot Manager

Simulador de carreira como tecnico de clube de futebol, inspirado no classico Brasfoot. Projeto educativo, sem afiliacao oficial.

---

## 1. Rodar local (sem instalar nada)

### Opcao A - Abrir direto no navegador

Clique duas vezes em `index.html`. Funciona em modo individual. O `localStorage` salva o jogo no proprio navegador.

### Opcao B - Servidor local (recomendado)

Servir por HTTP libera o modo party (entre abas) e evita problemas de cache do `file://`.

```bash
# Python (qualquer SO com Python 3)
python -m http.server 8000

# Node (se tiver instalado)
npx serve -l 8000 .
# ou
npm start
```

Depois abra http://localhost:8000.

---

## 2. Hospedar online (sem build, sem backend)

O jogo eh 100% estatico: HTML + CSS + JS puro. **Nao tem build, nao tem servidor, nao tem banco.** Todo o estado mora no `localStorage` do navegador de cada jogador. Por isso voce pode subir a pasta inteira em qualquer host estatico e funciona na hora.

### Opcao 1 - Vercel (mais rapido, 1 minuto)

1. Acesse https://vercel.com/new
2. Faca login com GitHub/GitLab/Bitbucket OU clique em "Deploy" e arraste a pasta inteira.
3. Quando perguntar o framework, escolha **"Other"** (sem build).
4. Pronto. Vercel devolve uma URL `https://seu-projeto.vercel.app`.

O arquivo `vercel.json` ja esta configurado com cache headers.

### Opcao 2 - Netlify (drag & drop)

1. Acesse https://app.netlify.com/drop
2. Arraste a pasta inteira pra cima da area de upload.
3. Pronto. Recebe uma URL `https://NOME.netlify.app`.

O `netlify.toml` ja esta configurado.

### Opcao 3 - GitHub Pages (gratis e versionado)

1. Crie um repositorio no GitHub e suba o codigo:
   ```bash
   git init
   git add .
   git commit -m "Brasfoot Manager v7.2"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/brasfoot.git
   git push -u origin main
   ```
2. No GitHub: **Settings -> Pages -> Source: GitHub Actions**.
3. O workflow `.github/workflows/deploy.yml` ja esta pronto e faz o deploy a cada push.
4. URL final: `https://SEU-USUARIO.github.io/brasfoot/`.

> O arquivo `.nojekyll` ja existe para garantir que o Pages nao filtre arquivos.

### Opcao 4 - Cloudflare Pages

1. Acesse https://dash.cloudflare.com/?to=/:account/pages
2. "Create a project" -> Connect Git -> selecione o repositorio.
3. **Build command:** deixe vazio. **Build output:** `/`.
4. Deploy.

### Opcao 5 - Servidor proprio (Apache / Nginx / qualquer hospedagem cPanel)

Faca upload da pasta inteira via FTP/SFTP/painel para a `public_html` (ou equivalente). Acesse pelo dominio. Nao precisa configurar nada alem disso.

---

## 3. Multiplayer real entre dispositivos (WebSocket relay)

O jogo agora suporta **multiplayer real entre dispositivos pela internet** atraves de um servidor WebSocket de relay (em `server/`). O servidor nao executa logica do jogo, apenas retransmite mensagens entre os jogadores de uma sala. O **host (anfitriao) continua sendo a autoridade** do estado.

### Como usar

1. **Hospede o relay.** Em poucos minutos no plano gratis do Render, Railway ou Fly.io. Veja `server/README.md` para o passo-a-passo de cada provedor. Voce vai receber uma URL `wss://meu-relay.onrender.com`.
2. **Hospede o jogo** (Vercel, Netlify, GitHub Pages, etc. - veja secao 2).
3. **Anfitriao:** abre o jogo, vai em "Criar party", preenche o nome **e o campo "Servidor relay"** com a URL `wss://...`. O jogo gera um codigo (ex.: `BR-7K2D9`).
4. **Convidados:** abrem o jogo (no celular, no notebook, em qualquer lugar do mundo), vao em "Entrar na party", preenchem nome, codigo **e o mesmo servidor relay**. Pronto.

A URL do servidor fica salva no `localStorage` para nao precisar digitar de novo.

### Modos de multiplayer disponiveis

| Modo | Campo "Servidor relay" | Onde funciona |
|---|---|---|
| Party local (BroadcastChannel) | vazio | Abas do mesmo navegador, mesma origem |
| Multiplayer online (WebSocket) | `wss://seu-relay.com` | Qualquer dispositivo na internet |

### Arquitetura

```
[Navegador A - HOST]  <----WebSocket---->  [Relay Node.js]  <----WebSocket---->  [Navegador B - GUEST]
        |                                                                                  |
        +-- mantem BF.G.S (estado autoritativo)                                              |
        +-- recebe acoes dos guests via servidor                                             |
        +-- envia broadcastState para todos via servidor              <--- recebe estado <---+
```

O contrato do transport (em `src/net/transport.js`) eh o mesmo para os tres modos (`solo`, `party` local, `ws`). Para criar novos tipos de transport (ex.: WebRTC peer-to-peer), basta implementar a mesma interface.

> **HTTPS obrigatorio:** se o site do jogo esta em HTTPS, o relay tem que estar em `wss://` (TLS). Os hosts recomendados (Render, Railway, Fly.io) ja entregam TLS automatico.

---

## 4. Funcionalidades

- Serie A e Serie B com 20 clubes cada (elencos reais da Serie A 2026 importados do bases.csv).
- Acesso e rebaixamento: os 4 ultimos da Serie A caem e os 4 primeiros da Serie B sobem.
- Classificacao para copas: G6 da Serie A vai para Libertadores; 7o ao 12o vai para Sul-Americana.
- Copa do Brasil, Libertadores e Sul-Americana com fase de grupos (32 times, 8 grupos de 4) + mata-mata.
- Campeoes de copas podem entrar na disputa por vaga na Libertadores seguinte.
- Escalacao agrupada por posicao (goleiros, defesa, meio, ataque), taticas, formacoes 4-4-2 / 4-3-3 / 3-5-2 etc.
- Mercado de transferencias com propostas, contra-propostas e IA negociando. Aceitar uma proposta cancela todas as outras pendentes pelo mesmo jogador.
- Jogadores vendidos chegam ao novo clube "resetados" (fora da lista de negociacao, energia cheia).
- Time so entra em campo com 11 jogadores escalados.
- Diretoria com metas por porte/divisao e demissao se a meta nao for cumprida.
- Historico de campeoes, artilheiros, acessos, rebaixamentos e copas.

---

## 5. Estrutura

```text
index.html              <- entrada
assets/
  styles.css            <- estilos base + overlay + modais
  v5.css                <- estilos do match-day e tela de espera
src/
  data/
    clubs.js            <- 40 clubes brasileiros + continentais
    realPlayers.js      <- 495 jogadores reais da Serie A 2026
  core/
    rng.js              <- gerador deterministico
    players.js          <- pool de jogadores por clube
    fixtures.js         <- gerador de tabelas turno-returno
    engine.js           <- simulacao de partida
    league.js           <- pontos corridos, acesso/rebaixamento
    cups.js             <- Copa do Brasil + Libertadores + Sul-Americana
    transfers.js        <- mercado e negociacoes
    state.js            <- reducer central (BF.core.applyAction)
  net/
    transport.js        <- contrato dos transports (factory)
    localTransport.js   <- modo solo
    partyTransport.js   <- party local (BroadcastChannel)
    wsPartyTransport.js <- multiplayer online (WebSocket)
  ui/
    components.js       <- helpers de render
    matchday.js         <- narracao ao vivo + pausa + substituicao
    app.js              <- tabs (tabela, elenco, mercado, etc.)
  main.js               <- bootstrap, dispatch, save/load (KEY=brasfoot_mgr_v7)
server/
  relay.js              <- servidor WebSocket relay (Node.js + ws)
  package.json          <- dependencias do servidor
  Dockerfile            <- container para Fly.io / VPS
  render.yaml           <- blueprint do Render.com
  fly.toml              <- config do Fly.io
  README.md             <- guia de deploy do servidor
vercel.json             <- config Vercel (site)
netlify.toml            <- config Netlify (site)
package.json            <- script `npm start` (npx serve, local)
.github/workflows/      <- deploy automatico no GitHub Pages
.nojekyll               <- compatibilidade GitHub Pages
```

Toda mudanca de jogo passa por `BF.core.applyAction`, mantendo o estado previsivel e serializavel (JSON).

---

## 6. Save game

O progresso fica em `localStorage` na chave `brasfoot_mgr_v7`. Para zerar:

```js
localStorage.removeItem('brasfoot_mgr_v7')
location.reload()
```

Ou use o botao "Reiniciar" no proprio jogo.
