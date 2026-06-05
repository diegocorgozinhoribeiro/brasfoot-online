# Brasfoot Manager

Simulador de carreira como técnico de clube de futebol, inspirado no clássico Brasfoot. Projeto educativo, sem afiliação oficial.

## Como Jogar

### Individual

Abra o arquivo `index.html` no navegador, escolha Série A ou Série B, selecione um clube e comece a carreira.

### Party

O modo party usa `BroadcastChannel`. Para jogar entre abas ou dispositivos, sirva os arquivos por um servidor local:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000`, crie uma party, compartilhe o código e cada jogador assume um clube.

## Funcionalidades

- Série A e Série B com 20 clubes cada.
- Acesso e rebaixamento: os 4 últimos da Série A caem e os 4 primeiros da Série B sobem.
- Classificação para copas: G6 da Série A vai para Libertadores; 7º ao 12º vai para Sul-Americana.
- Copa do Brasil, CONMEBOL Libertadores e CONMEBOL Sul-Americana em mata-mata de jogo único.
- Campeões brasileiros de copas podem entrar na disputa por vaga na Libertadores seguinte.
- Escalação, táticas, elenco, rescisões, mercado com propostas e IA negociando.
- Diretoria com metas por porte/divisão e demissão se a meta não for cumprida.
- Histórico de campeões, artilheiros, acessos, rebaixamentos e copas.

## Estrutura

```text
index.html
assets/styles.css
src/data/clubs.js
src/core/
src/net/
src/ui/
src/main.js
```

Toda mudança de jogo passa por `BF.core.applyAction`, mantendo o estado previsível para o modo individual e para a party.
