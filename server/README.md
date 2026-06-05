# Brasfoot Relay (servidor WebSocket)

Servidor leve que faz **apenas o repasse de mensagens** entre os jogadores de uma sala. Toda a logica do jogo continua no navegador do host (anfitriao). O servidor nao guarda estado em disco, nao precisa de banco, nao precisa de domino proprio.

- **Stack:** Node.js 18+ + `ws` (~30 KB instalado).
- **Memoria:** ~30 MB por instancia, suporta facilmente 100 salas simultaneas no plano gratis.
- **Protocolo:** texto JSON sobre WebSocket. Veja `relay.js` para os tipos de mensagem.

---

## Rodar local

```bash
cd server
npm install
npm start            # ouve em 0.0.0.0:8080
```

No jogo, em "Criar party" / "Entrar na party", preencha **Servidor relay** com:

```
ws://localhost:8080
```

---

## Hospedar gratis na internet

Todas as opcoes abaixo aceitam WebSocket no plano gratis e demoram poucos minutos.

### Opcao 1 - Render (mais simples)

1. Crie conta em https://render.com (com GitHub).
2. Suba este projeto para um repositorio Git.
3. Em Render: **New +** -> **Blueprint** -> aponte para o repositorio. O arquivo `server/render.yaml` ja faz toda a configuracao.
4. Aguarde o build (~2 min). Render entrega uma URL `https://brasfoot-relay-XXXX.onrender.com`.
5. No jogo, use **`wss://brasfoot-relay-XXXX.onrender.com`** como Servidor relay.

> O plano gratis do Render hiberna apos 15 min sem trafego. A primeira conexao apos a hibernacao demora ~30s. Para evitar, use um cron externo de ping (uptimerobot.com gratis) batendo em `/health` a cada 10 min, ou suba o plano para Starter ($7/mes).

### Opcao 2 - Railway

1. https://railway.app -> **New Project** -> **Deploy from GitHub repo**.
2. Selecione este repositorio.
3. **Settings -> Root Directory:** `server`.
4. Railway detecta Node.js, instala e roda `npm start` automaticamente.
5. **Settings -> Networking -> Generate Domain.** Pegue a URL `xxxxx.up.railway.app`.
6. No jogo, use **`wss://xxxxx.up.railway.app`**.

### Opcao 3 - Fly.io (mais robusto, mantem instancia acordada)

```bash
brew install flyctl              # ou ver https://fly.io/docs/hands-on/install-flyctl/
fly auth signup                  # ou fly auth login
cd server
fly launch --copy-config --no-deploy
# Confirme o nome do app (ou edite fly.toml) e a regiao (gru = Sao Paulo).
fly deploy
```

A URL fica `https://SEU-APP.fly.dev`. Use **`wss://SEU-APP.fly.dev`** no jogo.

### Opcao 4 - Glitch / Replit (sem comando)

1. Crie um projeto Node em https://glitch.com ou https://replit.com.
2. Suba `relay.js` e `package.json` (sem a pasta `server/`, jogue direto na raiz do projeto).
3. Aperte Run. Pega a URL do projeto e use **`wss://SEU-PROJETO.glitch.me`**.

### Opcao 5 - VPS proprio (DigitalOcean, Hetzner, Oracle Cloud Free Tier)

Qualquer VPS Linux com Node 18+ basta. Exemplo Ubuntu:

```bash
sudo apt update && sudo apt install -y nodejs npm
git clone https://github.com/SEU-USUARIO/brasfoot.git
cd brasfoot/server
npm install
# rodar em segundo plano via systemd (recomendado) ou pm2:
sudo npm i -g pm2
pm2 start relay.js --name brasfoot-relay
pm2 save && pm2 startup
```

Coloque um Nginx ou Caddy na frente para HTTPS (necessario se o site do jogo estiver em HTTPS - o navegador bloqueia `ws://` a partir de `https://`).

Exemplo Caddy (cria HTTPS automatico com Let's Encrypt):

```
relay.meudominio.com {
  reverse_proxy localhost:8080
}
```

No jogo: **`wss://relay.meudominio.com`**.

---

## Variaveis de ambiente

| Var | Default | O que faz |
|---|---|---|
| `PORT` | `8080` | Porta TCP |
| `MAX_ROOMS` | `500` | Limite de salas simultaneas |
| `MAX_MEMBERS` | `8` | Limite de jogadores por sala |
| `PING_MS` | `25000` | Keep-alive (derruba conexoes mortas) |

---

## Como o navegador escolhe ws:// ou wss://

- Se voce digitar **`wss://...`** ou **`ws://...`**, vale o que voce escreveu.
- Se voce digitar so o host (ex.: `meu-relay.onrender.com`), o cliente infere:
  - `https://` -> `wss://`
  - `http://` -> `ws://`
- **Regra de ouro:** se seu jogo esta em HTTPS (Vercel, Netlify, GitHub Pages, etc.), o relay TEM que estar em `wss://`. Render/Railway/Fly.io fazem isso automatico.

---

## Como saber se esta funcionando

1. Abra `https://SEU-RELAY/health` no navegador. Deve retornar `{ok:true,...}`.
2. Crie uma party em um navegador e entre em outro (ou no celular). O contador de membros na aba **Party** do jogo deve refletir os dois jogadores.
3. Logs do servidor mostram cada conexao/desconexao.
