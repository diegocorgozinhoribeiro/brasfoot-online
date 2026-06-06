# Banco de dados (Postgres / Neon) — jogadores reais

O jogo agora roda **somente com dados reais**. Não existem mais clubes ou
jogadores fictícios no código. As ligas, clubes e jogadores vêm de um banco
Postgres (Neon), e o front consome via API do servidor (`/api/regions` e
`/api/world`).

Mapeamento de domínio:

- **Região = país** (uma ou duas divisões jogáveis, conforme o nível da liga).
- **Continental = confederação** (adversários das copas continentais e alvos
  do mercado). Ex.: CONMEBOL → Libertadores/Sul-Americana, UEFA → Champions/
  Europa League.

## 1. Gerar os seeds a partir dos CSVs

Coloque `tabela_liga.csv` e `tabela_jogadores.csv` em `data/import/` (ou
`db/import/`) e rode:

```bash
python3 db/make_seeds.py
```

Isso cria `db/seed/{confederations,leagues,clubs,players}.csv`.

## 2. Criar e popular as tabelas no Neon

No Windows (CMD):

```cmd
set "DATABASE_URL=postgresql://USUARIO:SENHA@HOST/neondb?sslmode=require"
node db/import.mjs
```

No macOS/Linux:

```bash
export DATABASE_URL="postgresql://USUARIO:SENHA@HOST/neondb?sslmode=require"
node db/import.mjs
```

`import.mjs` roda `schema.sql` (idempotente: `CREATE TABLE IF NOT EXISTS`) e
insere os seeds com `ON CONFLICT DO UPDATE` (pode rodar quantas vezes quiser).
O SSL é detectado automaticamente para Neon/Render/AWS.

> Use a connection string **DEV** para testes e a **PROD** no deploy. A mesma
> `DATABASE_URL` precisa estar configurada no servidor (Render) para que as
> rotas `/api/regions` e `/api/world` respondam.

## 3. Esquema das tabelas

- `confederations(code PK, name)`
- `leagues(id PK, name, country, confederation FK, level, most_titled, current_champion)`
- `clubs(id PK, name, league_id FK)`
- `players(player_id PK, short_name, long_name, positions, main_position,
  overall, potential, ..., league_id FK, club_id FK)`

Apenas ligas com `level <= 2` são jogáveis (viram Série A/B da região).

## 4. Validação offline (sem internet)

Para testar o pipeline localmente sem o Postgres, há um harness que lê os
seeds direto e roda uma temporada completa:

```bash
node db/sim-harness.mjs Brasil
node db/sim-harness.mjs Espanha
```

Ele monta o mundo (clubes + jogadores reais), confere que nenhum clube fica
sem elenco, valida os rótulos de copa da confederação e simula a temporada
inteira + a virada de temporada.

## 5. Como a economia é calibrada

Identidade dos jogadores é 100% real (nome, posição, overall, idade,
nacionalidade, potencial). Já **valor de mercado** e **salário** são derivados
do overall/idade pela fórmula do próprio jogo — os euros reais (ex.: 180M) não
são usados, para preservar a escala econômica jogável (orçamentos de 8–220
"mi", valores de 0,3–25 "mi").
