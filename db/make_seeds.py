#!/usr/bin/env python3
# ==========================================================================
# db/make_seeds.py  -  Gera os CSVs normalizados (seed/) a partir dos dois
# arquivos-fonte do usuario:
#   import/tabela_liga.csv        (42 ligas oficiais escolhidas)
#   import/tabela_jogadores.csv   (base estilo FIFA, ~18,6k jogadores)
#
# Saidas em db/seed/:
#   confederations.csv  leagues.csv  clubs.csv  players.csv
#
# Regra: SO entram jogadores cujo league_name casa com uma das 42 ligas.
# Nada de dados ficticios. O league_id usado e o id real do FIFA (o id mais
# comum entre os jogadores daquela liga).
# ==========================================================================
import csv, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
# Os CSVs-fonte podem estar em /data/import (sandbox) ou em ../import (repo).
_cands = ['/data/import', os.path.normpath(os.path.join(HERE, '..', 'import')), os.path.normpath(os.path.join(HERE, 'import'))]
IMPORT = next((p for p in _cands if os.path.isfile(os.path.join(p, 'tabela_liga.csv'))), _cands[0])
SEED = os.path.join(HERE, 'seed')
os.makedirs(SEED, exist_ok=True)

LIGA_CSV = os.path.join(IMPORT, 'tabela_liga.csv')
JOG_CSV  = os.path.join(IMPORT, 'tabela_jogadores.csv')

def norm(s):
    return (s or '').strip()

def level_num(s):
    s = norm(s)
    for ch in s:
        if ch.isdigit():
            return int(ch)
    return 1

# ---- 1) Ler tabela_liga (BOM + ';') -------------------------------------
leagues_meta = {}   # league_name -> dict(country, confederation, level, most_titled, champion)
with open(LIGA_CSV, encoding='utf-8-sig', newline='') as f:
    rd = csv.DictReader(f, delimiter=';')
    for row in rd:
        name = norm(row.get('Liga'))
        if not name:
            continue
        leagues_meta[name] = {
            'country':       norm(row.get('Pa\u00eds')),
            'confederation': norm(row.get('Confedera\u00e7\u00e3o')),
            'level':         level_num(row.get('N\u00edvel')),
            'most_titled':   norm(row.get('Clube com mais t\u00edtulos')),
            'champion':      norm(row.get('Atual campe\u00e3o')),
        }
print('ligas na tabela_liga:', len(leagues_meta))

# ---- 2) Varrer jogadores p/ descobrir league_id real + clubes -----------
# league_name -> Counter(league_id)
lid_counter = collections.defaultdict(collections.Counter)
# club_team_id -> {name, league_name -> count}
club_name = {}
club_league_votes = collections.defaultdict(collections.Counter)
valid_names = set(leagues_meta.keys())

rows_players = []
with open(JOG_CSV, encoding='utf-8-sig', newline='') as f:
    rd = csv.DictReader(f, delimiter=';')
    for row in rd:
        lname = norm(row.get('league_name'))
        if lname not in valid_names:
            continue
        cid = norm(row.get('club_team_id'))
        if not cid:
            continue
        lid = norm(row.get('league_id'))
        if lid:
            lid_counter[lname][lid] += 1
        club_name[cid] = norm(row.get('club_name')) or club_name.get(cid, cid)
        club_league_votes[cid][lname] += 1
        rows_players.append(row)
print('jogadores casados:', len(rows_players), '| clubes:', len(club_name))

# league_name -> league_id final
league_id_of = {}
for lname, ctr in lid_counter.items():
    league_id_of[lname] = ctr.most_common(1)[0][0]
# ligas sem jogadores (sem id) recebem id sintetico negativo estavel
synth = -1
for lname in leagues_meta:
    if lname not in league_id_of:
        league_id_of[lname] = str(synth)
        synth -= 1

# ---- 3) confederations.csv ---------------------------------------------
confeds = []
seen = set()
for m in leagues_meta.values():
    c = m['confederation']
    if c and c not in seen:
        seen.add(c); confeds.append(c)
with open(os.path.join(SEED, 'confederations.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['code', 'name'])
    for c in confeds:
        w.writerow([c, c])
print('confederations:', len(confeds), confeds)

# ---- 4) leagues.csv -----------------------------------------------------
with open(os.path.join(SEED, 'leagues.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'name', 'country', 'confederation', 'level', 'most_titled', 'current_champion'])
    for lname, m in leagues_meta.items():
        w.writerow([league_id_of[lname], lname, m['country'], m['confederation'], m['level'], m['most_titled'], m['champion']])

# ---- 5) clubs.csv -------------------------------------------------------
# liga de cada clube = liga em que a maioria dos seus jogadores joga
with open(os.path.join(SEED, 'clubs.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'name', 'league_id'])
    nclubs = 0
    for cid, votes in club_league_votes.items():
        lname = votes.most_common(1)[0][0]
        w.writerow([cid, club_name.get(cid, cid), league_id_of[lname]])
        nclubs += 1
print('clubs:', nclubs)

# ---- 6) players.csv (colunas curadas) -----------------------------------
OUT_COLS = ['player_id','short_name','long_name','positions','main_position',
            'overall','potential','value_eur','wage_eur','age','dob',
            'height_cm','weight_kg','league_id','club_id','nationality',
            'preferred_foot','weak_foot','skill_moves','intl_reputation',
            'pace','shooting','passing','dribbling','defending','physic','face_url']

def pick(row, *keys):
    for k in keys:
        v = row.get(k)
        if v is not None and norm(v) != '':
            return norm(v)
    return ''

with open(os.path.join(SEED, 'players.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(OUT_COLS)
    n = 0
    for row in rows_players:
        positions = pick(row, 'player_positions')
        main_pos = positions.split(',')[0].strip() if positions else ''
        lname = norm(row.get('league_name'))
        w.writerow([
            pick(row,'player_id'), pick(row,'short_name'), pick(row,'long_name'),
            positions, main_pos,
            pick(row,'overall'), pick(row,'potential'), pick(row,'value_eur'),
            pick(row,'wage_eur'), pick(row,'age'), pick(row,'dob'),
            pick(row,'height_cm'), pick(row,'weight_kg'),
            league_id_of.get(lname,''), pick(row,'club_team_id'),
            pick(row,'nationality_name'), pick(row,'preferred_foot'),
            pick(row,'weak_foot'), pick(row,'skill_moves'),
            pick(row,'international_reputation'),
            pick(row,'pace'), pick(row,'shooting'), pick(row,'passing'),
            pick(row,'dribbling'), pick(row,'defending'), pick(row,'physic'),
            pick(row,'player_face_url'),
        ])
        n += 1
print('players:', n)
print('OK -> seeds em', SEED)
