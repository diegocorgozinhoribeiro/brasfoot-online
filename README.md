# \u26bd Brasfoot Manager

Simulador de carreira como administrador de clube de futebol, inspirado no clássico **Brasfoot**. Projeto educativo, sem afiliação oficial.

> Código estruturado em camadas (núcleo / rede / interface), preparado para jogo **individual** e **online (party)**.

---

## \ud83d\ude80 Como jogar

### Individual (mais simples)
Basta abrir o arquivo **`index.html`** com dois cliques no navegador. Escolha **Série A** ou **Série B**, selecione um clube e comece a carreira.

### Online — modo Party (você + amigos)
O modo party usa `BroadcastChannel`. Para funcionar entre abas/dispositivos é preciso servir os arquivos por um servidor (não pelo `file://`):

```bash
cd brasfoot-manager
python3 -m http.server 8000
# abra http://localhost:8000 em cada aba/jogador
```

1. Um jogador cria a party (vira **anfitrião/host**) e recebe um **código** (ex.: `BR-7Q2KP`).
2. Os amigos entram com esse código.
3. Na aba **Party**, cada um **assume um clube** (Série A ou B).
4. O anfitrião controla o avanço das rodadas; o estado é sincronizado para todos.

> Para jogar pela internet (fora da mesma máquina), basta trocar o transporte `partyTransport` por um adaptador WebSocket — a interface de rede já está isolada em `src/net/`.

---

## \u2728 Funcionalidades

- **Duas divisões:** Série A e Série B (20 clubes cada). Ao fim de cada temporada, os **4 últimos da Série A** trocam de lugar com os **4 primeiros da Série B** (acesso e rebaixamento).
- **Partida ao vivo:** ao jogar, acompanhe a narração minuto a minuto, com placar, lances e a probabilidade de **azarão (zebra)**.
- **Escalação:** defina seus **11 titulares** e escolha a **tática** (Ofensivo, Equilibrado, Contra-ataque, Defensivo, Retranca) — cada uma altera o desempenho no motor de jogo.
- **Elenco:** veja atributos e **rescinda contratos** (pagando uma multa de ~30% do valor do jogador).
- **Transferências:** procure jogadores de qualquer clube/divisão, **envie propostas no seu valor**, receba **contrapropostas** e feche negócios. Os **clubes de IA também negociam entre si e podem fazer propostas pelos seus jogadores**.
- **Diretoria:** cada temporada tem uma **meta** (título, vaga na Libertadores, não cair, acesso, etc.). **Se você não cumprir, é demitido** e precisa procurar um novo clube.
- **Finanças apertadas:** a cada rodada o caixa paga a folha salarial e recebe pouca bilheteria — vender jogadores é essencial para equilibrar as contas.
- **O mundo segue para a IA:** todos os clubes jogam, movimentam o mercado e disputam as duas divisões a cada rodada.
- **Determinístico por semente:** o código da party gera exatamente o mesmo mundo para todos os jogadores (sem dessincronização).

---

## \ud83d\udcc1 Estrutura do projeto

```
brasfoot-manager/
├─ index.html              # Pagina principal e ordem de carregamento dos scripts
├─ assets/
│  └─ styles.css           # Tema escuro e estilos de todas as telas
├─ src/
│  ├─ data/
│  │  └─ clubs.js          # Clubes (Serie A e B), nomes e formacao base
│  ├─ core/                # LOGICA PURA (independente da interface)
│  │  ├─ rng.js            # Gerador aleatorio com semente (determinismo)
│  │  ├─ players.js        # Geracao de elencos
│  │  ├─ fixtures.js       # Tabela de jogos (turno e returno)
│  │  ├─ engine.js         # Motor de partida: gols, eventos, azarao, TATICAS
│  │  ├─ league.js         # Classificacao por divisao
│  │  ├─ transfers.js      # Negociacoes + mercado automatico da IA
│  │  └─ state.js          # Estado + REDUCER central (applyAction) + diretoria
│  ├─ net/                 # CAMADA DE REDE (abstrata e intercambiavel)
│  │  ├─ transport.js      # Interface/fabrica de transporte
│  │  ├─ localTransport.js # Modo individual (sem rede)
│  │  └─ partyTransport.js # Modo party (host-autoritativo via BroadcastChannel)
│  ├─ ui/                  # INTERFACE
│  │  ├─ components.js     # Helpers de render (badges, formatacao, etc.)
│  │  ├─ matchday.js       # Tela de partida ao vivo
│  │  └─ app.js            # Abas e renderizacao de todas as telas
│  └─ main.js              # Bootstrap, telas de inicio, dispatch e persistencia
└─ README.md
```

### Arquitetura
Toda mudança no jogo passa por um **reducer central** (`BF.core.applyAction(estado, acao)`), o que mantém o estado previsível e fácil de sincronizar no modo online. As ações disponíveis incluem:
`PLAY_ROUND`, `PLAY_ALL`, `NEXT_SEASON`, `CLAIM_CLUB`, `RELEASE_CLUB`, `SET_LINEUP`, `SET_TACTIC`, `RESCIND`, `OFFER_CREATE`, `OFFER_RESPOND`.

Isso torna trivial plugar um servidor WebSocket real: basta criar um novo transporte com a mesma interface de `src/net/`, sem mexer no motor (`core/`) nem na interface (`ui/`).

---

## \ud83d\udcbe Dados salvos
O progresso do modo individual é salvo automaticamente no `localStorage` do navegador (chave `brasfoot_mgr_v2`). Use **Reiniciar** para apagar.
