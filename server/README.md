# Brasfoot Manager — Servidor relay v2 (auth + saves na nuvem)

Servidor Node.js que faz duas coisas:

1. **HTTP API** para login / cadastro e listagem dos seus jogos.
2. **WebSocket** que sincroniza estado entre host e convidados **e salva no banco de dados** automaticamente.

O save é gravado em Postgres a cada mudança importante (com debounce de 3s e flush no disconnect). Quando você ou um convidado dá F5, **continua exatamente de onde parou**. Convidados só conseguem entrar quando o anfitrião está online.

---

## Passo 1 — Criar o banco no Neon (grátis, sem cartão)

[Neon](https://neon.tech) oferece Postgres serverless grátis (0.5 GB, suficiente pra milhares de saves).

1. Acesse <https://neon.tech> → **Sign up** (Google ou GitHub).
2. **Create project** → nome `brasfoot`, região mais próxima (ex.: `AWS us-east-1`).
3. Copie a **Connection string** mostrada na tela. Vai parecer com:

   ```
   postgresql://USER:PASS@ep-cool-name-12345.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

   Guarde — vai ser o `DATABASE_URL` no Render.

O schema (tabelas `users` e `games`) é criado automaticamente quando o servidor sobe pela primeira vez.

> **Alternativas:** qualquer Postgres serve — Supabase, Railway Postgres, Render Postgres, Postgres local, etc. Basta usar `sslmode=require` na string de conexão (o código detecta automaticamente).

---

## Passo 2 — Gerar um JWT_SECRET

No terminal (qualquer máquina):

```bash
openssl rand -hex 32
```

Copia a string gerada (64 caracteres hex). Vai ser o `JWT_SECRET` no Render.

Se não tiver `openssl`, use no Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Passo 3 — Deploy no Render (grátis)

Você provavelmente já tem o serviço `brasfoot-online` no Render do passo anterior. Vamos só ajustá-lo.

1. <https://dashboard.render.com> → abra o serviço `brasfoot-online`.
2. **Settings → Environment** → **Add Environment Variable**:

   | Key            | Value                                                    |
   |----------------|----------------------------------------------------------|
   | `DATABASE_URL` | (cole a connection string do Neon)                       |
   | `JWT_SECRET`   | (cole a string gerada no passo 2 — mínimo 16 chars)      |
   | `MAX_ROOMS`    | `500` (opcional)                                         |
   | `MAX_MEMBERS`  | `8` (opcional)                                           |

3. **Save Changes** (o Render vai disparar um redeploy automático).
4. Aguarde "**Live**" e abra a URL em outra aba — deve responder:

   ```json
   { "ok": true, "service": "brasfoot-relay", "rooms": 0, "uptimeSec": ... }
   ```

> Se o redeploy falhar com `npm install` não achando `pg`, vá em **Manual Deploy → Clear build cache & deploy**.

---

## Rodar local (opcional, para desenvolvimento)

```bash
cd server
cp env.example .env       # cria o .env
# edite .env: DATABASE_URL=postgresql://...neon.tech/...?sslmode=require
#             JWT_SECRET=...
npm install
npm start                 # ouve em :8080
```

O schema é criado automaticamente na primeira execução.

---

## Endpoints HTTP

| Método | Rota                  | Descrição                                                  |
|--------|-----------------------|------------------------------------------------------------|
| GET    | `/` `/health`         | status do servidor                                         |
| POST   | `/auth/register`      | `{ email, name, password }` → `{ token, user }`            |
| POST   | `/auth/login`         | `{ email, password }` → `{ token, user }`                  |
| GET    | `/auth/me`            | (Bearer) → `{ user }`                                      |
| GET    | `/games/mine`         | (Bearer) → `{ games: [...] }` — todos os seus saves        |
| DELETE | `/games/:code`        | (Bearer, só host) → `{ ok: true }`                         |

## WebSocket — protocolo

Cliente → servidor:

```js
{ t: 'hello', token, code, role: 'host'|'guest', mode: 'solo'|'party', state? }  // state só no 1º hello do host criando jogo novo
{ t: 'action', action }      // guest → host: reivindicar clube, escalar, propor, etc.
{ t: 'claim',  clubId, name }
{ t: 'state',  S }           // host → servidor: salva no DB e replica aos guests
```

Servidor → cliente:

```js
{ t: 'welcome',   as, code, mode, state?, members }  // state vem do DB ao retomar jogo
{ t: 'presence',  members }
{ t: 'join',      userId, name }   // só pro host
{ t: 'leave',     userId, name }   // só pro host
{ t: 'state',     S }              // broadcast do save
{ t: 'host-left' }                 // host caiu — guests são desconectados
{ t: 'error',     msg, fatal? }    // ex.: token inválido, host offline
```

## Banco — schema

```sql
users (id, email UNIQUE, pwd_hash, pwd_salt, name, created_at)
games (id, code UNIQUE, host_user_id, host_name, mode, state_json JSONB,
       members_json JSONB DEFAULT '[]', created_at, updated_at)
```

Índices em `host_user_id`, `updated_at` (DESC) e GIN em `members_json` (lookup rápido por usuário).

O `state_json` é o estado completo do jogo (clubes, jogadores, fixtures, escalações, etc.). Tamanho típico: 100–300 KB por jogo. 0.5 GB do Neon comporta ~2000 jogos.

## Segurança

- Senhas: **scrypt** (Node nativo, N=16384, r=8, p=1, 64 bytes) com salt aleatório por usuário.
- Sessão: **JWT HS256** (HMAC-SHA256), validade 30 dias. Sem dependências externas.
- WebSocket valida o token a cada conexão. Token inválido ou expirado → desconexão imediata com aviso.
- CORS aberto (`*`) por padrão; defina `CORS_ORIGIN=https://seu-dominio.vercel.app` em produção se quiser restringir.

## Variáveis de ambiente

| Variável         | Default | Obrigatória |
|------------------|---------|-------------|
| `DATABASE_URL`   | —       | ✅ sim       |
| `JWT_SECRET`     | —       | ✅ sim (≥16) |
| `PORT`           | 8080    | (Render seta) |
| `MAX_ROOMS`      | 500     |             |
| `MAX_MEMBERS`    | 8       |             |
| `PING_MS`        | 25000   |             |
| `STATE_SAVE_MS`  | 3000    | debounce do save |
| `JWT_TTL_SEC`    | 2592000 | 30 dias     |
| `CORS_ORIGIN`    | `*`     |             |

## Troubleshooting

- **`Servidor relay não configurado`** no cliente: faltou preencher o campo "Servidor relay" na tela de login.
- **`Sessão inválida. Faça login novamente.`**: token expirado ou `JWT_SECRET` mudou no servidor (todo mundo desloga).
- **`O anfitrião está offline. Peça para ele entrar primeiro.`**: comportamento intencional — convidado só entra com host online.
- **`Esse jogo é individual e não aceita convidados.`**: tentou entrar como guest em um jogo solo.
- **`getaddrinfo ENOTFOUND ...neon.tech`** no Render: `DATABASE_URL` digitado errado; copie de novo do painel do Neon.
- **Tabelas não criam**: cheque os logs do Render — geralmente é `sslmode=require` faltando na connection string.
