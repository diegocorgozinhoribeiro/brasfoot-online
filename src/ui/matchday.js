// ==========================================================================
// ui/matchday.js  -  Partida AO VIVO: pre-jogo, narracao minuto a minuto,
// pausas (com tatica + substituicao) e escolha do batedor de penalti.
// ==========================================================================
window.BF = window.BF || {};
BF.ui = BF.ui || {};

BF.ui.playMatch = function (match, S, onDone) {
  const C = BF.core, U = BF.ui, D = BF.data;
  const home = C.clubById(S, match.homeId), away = C.clubById(S, match.awayId);
  const myId = BF.me.clubId;
  const mySide = (myId === match.homeId) ? 'home' : (myId === match.awayId ? 'away' : null);
  const events = match.events.slice();
  let hg = 0, ag = 0, minute = 0, idx = 0, timer = null;
  let paused = false, halfPaused = false;

  function compTag() {
    if (match.cupName) return '<span class="md-comp cup">' + U.esc(match.cupName) + (match.stageName ? ' \u2022 ' + U.esc(match.stageName) : '') + '</span>';
    return '<span class="md-comp league">Brasileirão \u2022 ' + (match.div === 2 ? 'Série B' : 'Série A') + '</span>';
  }

  // ---------- modal generico ----------
  function modal(html, cls) {
    const m = document.createElement('div');
    m.className = 'overlay';
    m.innerHTML = '<div class="modal ' + (cls || 'small') + '">' + html + '</div>';
    document.body.appendChild(m);
    return m;
  }

  // ---------- bloco de tatica (reaproveitado na pre-partida e nas pausas) ----------
  function tacticBlock(clubId) {
    const cur = (S.tactics && S.tactics[clubId]) || 'equilibrado';
    return '<div class="tac-grid sm">' + C.TACTIC_KEYS.map(function (k) {
      const t = C.TACTICS[k];
      return '<button class="tac ' + (k === cur ? 'sel' : '') + '" data-tac="' + k + '"><b>' + t.label + '</b><span>' + t.desc + '</span></button>';
    }).join('') + '</div>';
  }
  function bindTactic(box, clubId, after) {
    box.querySelectorAll('.tac').forEach(function (b) {
      b.onclick = function () {
        BF.dispatch({ type: 'SET_TACTIC', clubId: clubId, tactic: b.dataset.tac });
        box.querySelectorAll('.tac').forEach(function (x) { x.classList.toggle('sel', x === b); });
        if (after) after(b.dataset.tac);
      };
    });
  }

  // ---------- PRE-PARTIDA ----------
  function showPreMatch(go) {
    if (!mySide) { go(); return; } // nao controla nenhum dos dois: vai direto
    const formKey = (S.formations && S.formations[myId]) || '4-4-2';
    const form = D.FORMATIONS[formKey] || D.FORMATIONS['4-4-2'];
    const xi = C.lineupOf(S, myId);
    const xiById = {}; xi.forEach(function (p) { xiById[p.id] = p; });
    const bench = C.benchOf(S, myId);
    const me = C.clubById(S, myId);
    const opp = mySide === 'home' ? away : home;

    // monta o campo por linhas da formacao
    let si = 0;
    const pitch = form.lines.map(function (line) {
      const cells = line.map(function (pos) {
        const p = xi[si++];
        return '<div class="pm-slot">' + U.ptag(pos) + (p ? '<span class="pm-nm">' + U.esc(p.name) + '</span><b>' + p.ovr + '</b><i class="pm-en" style="width:' + C.energyOf(p) + '%"></i>' : '') + '</div>';
      }).join('');
      return '<div class="pm-line">' + cells + '</div>';
    }).reverse().join(''); // ataque em cima

    const benchHtml = bench.slice(0, 7).map(function (p) {
      return '<span class="pm-bench">' + U.ptag(p.pos) + ' ' + U.esc(p.name) + ' <b>' + p.ovr + '</b></span>';
    }).join('') || '<span class="muted">Sem reservas disponíveis</span>';

    const box = modal(
      '<div class="pm-head">' + compTag() + '<h1>' + me.name + ' x ' + opp.name + '</h1>' +
      '<p class="sub">' + (mySide === 'home' ? 'Mando: ' + U.esc(home.stadium) : 'Visitante em ' + U.esc(home.stadium)) + ' \u2022 Formação <b>' + form.label + '</b> \u2022 Força do XI <b>' + Math.round(C.teamStrength(S, myId)) + '</b></p></div>' +
      '<div class="pm-field">' + pitch + '</div>' +
      '<div class="pm-sec"><h3>Banco de reservas</h3><div class="pm-benchlist">' + benchHtml + '</div></div>' +
      '<div class="pm-sec"><h3>Estilo de jogo</h3>' + tacticBlock(myId) + '</div>' +
      '<div class="md-actions"><button class="btn" id="pmLineup">Ajustar escalação</button><button class="btn primary" id="pmGo">\u25b6 Iniciar partida</button></div>',
      'matchday');
    bindTactic(box, myId);
    box.querySelector('#pmLineup').onclick = function () {
      document.body.removeChild(box);
      if (onDone) onDone(); // volta para a aba; o usuario abre Escalacao
      BF.ui.setTab('lineup');
    };
    box.querySelector('#pmGo').onclick = function () { document.body.removeChild(box); go(); };
  }

  // ---------- narracao ----------
  function commentary(ev) {
    const club = ev.side === 'home' ? home : away;
    const who = U.esc(ev.player || '');
    if (ev.type === 'goal')  return "<b style='color:var(--green)'>GOOOL do " + club.name + "!</b> " + who + " balanca a rede!";
    if (ev.type === 'penalty_goal') return "<b style='color:var(--green)'>GOOOL de penalti do " + club.name + "!</b> " + who + " bateu firme.";
    if (ev.type === 'chance') return club.name + " chega com perigo com " + who + "...";
    if (ev.type === 'save')   return "Que defesaca! O goleiro evita o gol de " + who + " (" + club.name + ").";
    if (ev.type === 'card')   return "Cartao amarelo para " + who + " (" + club.name + ").";
    if (ev.type === 'injury') return "Atendimento no gramado para " + who + " (" + club.name + ").";
    return '';
  }
  function matchStats() {
    const st = match.stats || {};
    return '<div class="md-stats">' +
      '<div><b>' + (st.homePoss || 50) + '%</b><span>posse</span><b>' + (st.awayPoss || 50) + '%</b></div>' +
      '<div><b>' + (st.homeShots || '-') + '</b><span>chutes</span><b>' + (st.awayShots || '-') + '</b></div>' +
      '<div><b>' + (st.xgHome || '-') + '</b><span>xG</span><b>' + (st.xgAway || '-') + '</b></div>' +
    '</div>';
  }

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML =
    '<div class="modal matchday">' +
      '<div class="md-top">' + compTag() + '</div>' +
      '<div class="md-score">' + U.badge(home, 'lg') +
        '<div class="md-sc"><span id="mdH">0</span> - <span id="mdA">0</span></div>' +
        U.badge(away, 'lg') + '</div>' +
      '<div class="md-names"><span>' + home.name + '</span>' +
        '<span class="md-clock" id="mdClock">0\'</span>' +
        '<span>' + away.name + '</span></div>' +
      matchStats() +
      '<div class="md-bar"><i id="mdBar"></i></div>' +
      '<div class="md-feed" id="mdFeed"></div>' +
      '<div class="md-actions">' + (mySide ? '<button class="btn" id="mdPause">Pausar (tática/substituir)</button>' : '') +
        '<button class="btn" id="mdSkip">Pular para o fim</button>' +
        '<button class="btn primary hidden" id="mdClose">Continuar</button></div>' +
    '</div>';

  const feed = ov.querySelector ? null : null;
  function start() {
    document.body.appendChild(ov);
    line("<span class='md-min'>0'</span> Bola rolando no " + U.esc(home.stadium) + "!");
    startTimer();
  }
  function feedEl() { return ov.querySelector('#mdFeed'); }

  function line(html, cls) {
    const d = document.createElement('div');
    d.className = 'md-line ' + (cls || '');
    d.innerHTML = html;
    const f = feedEl(); f.appendChild(d); f.scrollTop = f.scrollHeight;
  }
  function finish() {
    clearInterval(timer);
    while (idx < events.length) { const ev = events[idx++]; if (ev.type === 'goal' || ev.type === 'penalty_goal') { if (ev.side === 'home') hg++; else ag++; } }
    ov.querySelector('#mdH').textContent = match.hg;
    ov.querySelector('#mdA').textContent = match.ag;
    ov.querySelector('#mdClock').textContent = 'FIM';
    ov.querySelector('#mdBar').style.width = '100%';
    let verdict = match.hg > match.ag ? (home.name + ' venceu') : (match.hg < match.ag ? (away.name + ' venceu') : 'Empate');
    if (match.penalty && match.winnerId) verdict = (C.clubById(S, match.winnerId).name) + ' venceu nos pênaltis';
    if (match.upset) verdict += ' \u2014 ZEBRA!';
    line('<b>Fim de jogo: ' + match.hg + ' x ' + match.ag + ' \u2014 ' + verdict + '</b>', 'md-end');
    ov.querySelector('#mdSkip').classList.add('hidden');
    const pb = ov.querySelector('#mdPause'); if (pb) pb.classList.add('hidden');
    ov.querySelector('#mdClose').classList.remove('hidden');
  }
  // -------- PAUSA: mini-escalação reduzida com drag & drop e tática --------
  function openSubPanel(title) {
    paused = true;
    clearInterval(timer);
    const clubId = myId;
    // v10.5: sempre ler do BF.G.S (o S capturado fica desatualizado entre pausas)
    S = BF.G.S || S;
    const sq = C.squad(S, clubId);
    if (!clubId || !sq.length || !mySide) {
      line('<b>' + title + '</b> Sem clube controlado nesta partida.');
      paused = false; startTimer();
      return;
    }
    let formKey = (S.formations && S.formations[clubId]) || '4-4-2';
    let form = D.FORMATIONS[formKey] || D.FORMATIONS['4-4-2'];
    const slotsPos0 = form.slots;
    // estado original ANTES das mudancas (para detectar quem saiu)
    const origLineup = (S.lineups && S.lineups[clubId]) ? S.lineups[clubId].slice() : C.autoLineup(sq, form.need).map(function (p) { return p.id; });
    const baseIds0 = origLineup.filter(function (id) { return sq.find(function (x) { return x.id === id; }); });
    let sel = (BF._buildSlotAligned ? BF._buildSlotAligned(slotsPos0, sq, baseIds0) : baseIds0.slice());
    let dragId = 0, dragSrc = null;

    function benchPlayers() {
      const onIds = sel.filter(Boolean);
      return sq.filter(function (p) { return onIds.indexOf(p.id) < 0; })
        .sort(function (a, b) { return D.POS_ORDER.indexOf(a.pos) - D.POS_ORDER.indexOf(b.pos) || b.ovr - a.ovr; });
    }

    function pitchHtml() {
      let __si = 0;
      return '<div class="pitch lines" id="pPitch">' + form.lines.map(function (line) {
        const cells = line.map(function (pos) {
          const i = __si++;
          const p = sel[i] ? sq.find(function (x) { return x.id === sel[i]; }) : null;
          return '<div class="slot" data-slot="' + i + '" data-pos="' + pos + '"><span class="slot-pos">' + pos + '</span>' +
            (p ? '<button draggable="true" class="player-chip" data-id="' + p.id + '">' + U.esc(p.name) + '<b>' + p.ovr + '</b><i class="chip-en" style="width:' + C.energyOf(p) + '%"></i></button>'
               : '<em>vazio</em>') + '</div>';
        }).join('');
        return '<div class="pitch-line">' + cells + '</div>';
      }).reverse().join('') + '</div>';
    }
    function benchHtml() {
      const bench = benchPlayers();
      if (!bench.length) return '<div class="empty" style="padding:8px">Sem reservas disponíveis.</div>';
      return bench.map(function (p) {
        return '<label class="pick-row" draggable="true" data-id="' + p.id + '">' +
          '<span class="ovr ' + U.ovrClass(p.ovr) + '">' + p.ovr + '</span>' + U.ptag(p.pos) +
          '<span class="pn">' + U.esc(p.name) + '</span>' +
          '<span class="en-mini" title="Energia ' + C.energyOf(p) + '"><i style="width:' + C.energyOf(p) + '%;background:' + (C.energyOf(p) > 60 ? '#22c55e' : C.energyOf(p) > 30 ? '#f59e0b' : '#ef4444') + '"></i></span>' +
          '<span class="pa muted">' + p.age + ' anos</span></label>';
      }).join('');
    }
    function formHtml() {
      return Object.keys(D.FORMATIONS).map(function (k) {
        return '<button class="formBtn ' + (k === formKey ? 'active' : '') + '" data-form="' + k + '">' + D.FORMATIONS[k].label + '</button>';
      }).join('');
    }

    const box = modal('<div class="pause-panel"><h1>' + title + '</h1>' +
      '<p class="sub">Toque num jogador e depois em outro para trocar. No desktop, também pode arrastar (drag &amp; drop). Pode confirmar sem trocar ninguém.</p>' +
      '<p class="sub" id="subHint" style="min-height:18px;color:#22c55e"></p>' +
      '<div class="pause-grid">' +
        '<div>' +
          '<h3 class="mini-h">Formação</h3>' +
          '<div class="formation-switch" id="pForm">' + formHtml() + '</div>' +
          '<div id="pPitchWrap">' + pitchHtml() + '</div>' +
        '</div>' +
        '<div>' +
          '<h3 class="mini-h">Estilo de jogo</h3>' + tacticBlock(clubId) +
          '<h3 class="mini-h">Banco de reservas</h3>' +
          '<div class="pause-bench" id="pBench">' + benchHtml() + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="md-actions"><button class="btn" id="subCancel">Voltar ao jogo</button><button class="btn primary" id="subSave">Confirmar e seguir</button></div>' +
    '</div>', 'big');

    bindTactic(box, clubId);
    bindFormation();
    bindDrag();

    function rerenderPitch() {
      box.querySelector('#pPitchWrap').innerHTML = pitchHtml();
      box.querySelector('#pBench').innerHTML = benchHtml();
      bindDrag();
    }
    function bindFormation() {
      box.querySelectorAll('#pForm .formBtn').forEach(function (b) {
        b.onclick = function () {
          const k = b.dataset.form;
          if (k === formKey) return;
          formKey = k;
          form = D.FORMATIONS[k];
          const baseIds = sel.filter(Boolean);
          sel = (BF._buildSlotAligned ? BF._buildSlotAligned(form.slots, sq, baseIds) : baseIds.slice());
          box.querySelectorAll('#pForm .formBtn').forEach(function (x) { x.classList.toggle('active', x === b); });
          rerenderPitch();
        };
      });
    }
    // Estado de selecao para SWAP por CLIQUE (mobile-friendly).
    // Fluxo: clica num jogador (campo OU banco) -> marca como 'picked'.
    // Clica num segundo jogador -> faz a substituicao.
    //   - bench -> pitch slot: reserva entra naquele slot
    //   - pitch -> pitch:      troca de posicao entre os dois titulares
    //   - bench -> bench:      apenas re-seleciona o segundo
    let pickedId = 0, pickedSrc = null, pickedSlotIdx = -1;
    function clearPicked() {
      pickedId = 0; pickedSrc = null; pickedSlotIdx = -1;
      box.querySelectorAll('.picked').forEach(function (el) { el.classList.remove('picked'); });
      const hint = box.querySelector('#subHint'); if (hint) hint.textContent = '';
    }
    function setPicked(id, src, slotIdx, el) {
      pickedId = id; pickedSrc = src; pickedSlotIdx = (slotIdx == null ? -1 : slotIdx);
      box.querySelectorAll('.picked').forEach(function (x) { x.classList.remove('picked'); });
      if (el) el.classList.add('picked');
      const p = sq.find(function (x) { return x.id === id; });
      const hint = box.querySelector('#subHint');
      if (hint && p) hint.textContent = 'Selecionado: ' + p.name + ' \u2014 toque em quem entra/sai no lugar.';
    }
    function performSwap(targetSlotIdx, targetId) {
      // pickedId == quem ja estava selecionado; o usuario tocou agora num
      // titular (targetSlotIdx, targetId) OU num reserva (targetSlotIdx=-1).
      if (!pickedId) return;
      const fromIdx = sel.indexOf(pickedId);
      // bench -> pitch: entra no slot do alvo (sai o titular do slot)
      if (pickedSrc === 'bench' && targetSlotIdx >= 0) {
        sel[targetSlotIdx] = pickedId;
      }
      // pitch -> bench (clicou num reserva apos selecionar titular): tira do XI
      else if (pickedSrc === 'pitch' && targetSlotIdx < 0) {
        if (fromIdx >= 0) sel[fromIdx] = pickedId === sel[fromIdx] ? 0 : sel[fromIdx];
        // o reserva alvo entra no slot que ficou vazio
        if (fromIdx >= 0) sel[fromIdx] = targetId;
      }
      // pitch -> pitch: swap entre dois titulares
      else if (pickedSrc === 'pitch' && targetSlotIdx >= 0) {
        if (fromIdx < 0) { clearPicked(); return; }
        const tmp = sel[targetSlotIdx]; sel[targetSlotIdx] = pickedId; sel[fromIdx] = tmp;
      }
      // bench -> bench: apenas re-seleciona
      else if (pickedSrc === 'bench' && targetSlotIdx < 0) {
        clearPicked();
        return;
      }
      clearPicked();
      rerenderPitch();
    }

    function bindDrag() {
      // chips do campo: drag (desktop) + click (mobile/touch)
      box.querySelectorAll('#pPitch .player-chip').forEach(function (b) {
        b.ondragstart = function (e) { dragId = +b.dataset.id; dragSrc = 'pitch'; try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (er) {} };
        b.ondragend = function () { dragId = 0; dragSrc = null; };
        b.onclick = function (e) {
          e.preventDefault(); e.stopPropagation();
          const id = +b.dataset.id;
          const slot = b.closest('.slot');
          const slotIdx = slot ? +slot.dataset.slot : -1;
          if (!pickedId) { setPicked(id, 'pitch', slotIdx, b); return; }
          if (pickedId === id) { clearPicked(); return; }
          performSwap(slotIdx, id);
        };
      });
      // pick-rows do banco: drag + click
      box.querySelectorAll('#pBench .pick-row').forEach(function (r) {
        r.ondragstart = function (e) { dragId = +r.dataset.id; dragSrc = 'bench'; try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (er) {} };
        r.ondragend = function () { dragId = 0; dragSrc = null; };
        r.onclick = function (e) {
          e.preventDefault(); e.stopPropagation();
          const id = +r.dataset.id;
          if (!pickedId) { setPicked(id, 'bench', -1, r); return; }
          if (pickedId === id) { clearPicked(); return; }
          // se quem estava selecionado eh do banco, troca a selecao
          if (pickedSrc === 'bench') { setPicked(id, 'bench', -1, r); return; }
          // titular selecionado + reserva clicado: faz a substituicao
          performSwap(-1, id);
        };
      });
      // slots aceitam drop (desktop) E click vazio (mobile, para entrar num slot vazio)
      box.querySelectorAll('#pPitch .slot').forEach(function (slot) {
        slot.ondragover = function (e) { e.preventDefault(); slot.classList.add('drop-ok'); };
        slot.ondragleave = function () { slot.classList.remove('drop-ok'); };
        slot.ondrop = function (e) {
          e.preventDefault(); slot.classList.remove('drop-ok');
          const slotIdx = +slot.dataset.slot;
          const dropped = dragId || +(e.dataTransfer.getData('text/plain') || 0);
          if (!dropped) return;
          if (dragSrc === 'bench') {
            sel[slotIdx] = dropped;
          } else {
            const fromIdx = sel.indexOf(dropped);
            if (fromIdx < 0) return;
            const tmp = sel[slotIdx]; sel[slotIdx] = dropped; sel[fromIdx] = tmp;
          }
          rerenderPitch();
        };
        // click em slot VAZIO completa swap a partir do banco
        slot.onclick = function (e) {
          if (e.target.closest('.player-chip')) return; // o handler do chip cuida
          if (!pickedId) return;
          const slotIdx = +slot.dataset.slot;
          if (pickedSrc === 'bench') { sel[slotIdx] = pickedId; clearPicked(); rerenderPitch(); }
        };
      });
    }

    box.querySelector('#subCancel').onclick = function () {
      document.body.removeChild(box); paused = false; startTimer();
    };
    box.querySelector('#subSave').onclick = function () {
      // salva formação (se mudou) e a escalação atualizada (apenas titulares ocupados)
      const orig = (S.formations && S.formations[clubId]) || '4-4-2';
      const formChanged = (formKey !== orig);
      if (formChanged) BF.dispatch({ type: 'SET_FORMATION', clubId: clubId, formation: formKey });
      const lineup = sel.filter(Boolean);
      let subsApplied = 0;
      if (lineup.length) {
        BF.dispatch({ type: 'SET_LINEUP', clubId: clubId, lineup: lineup });
        // v10.5: aplica substituicoes na PARTIDA ATUAL.
        // Identifica jogadores que SAIRAM (estavam em origLineup mas nao em lineup)
        // e quem ENTROU (esta em lineup mas nao em origLineup). Eventos futuros
        // do jogador que saiu sao remapeados para o jogador que entrou.
        const wentOut = origLineup.filter(function (id) { return lineup.indexOf(id) < 0; });
        const cameIn  = lineup.filter(function (id) { return origLineup.indexOf(id) < 0; });
        if (wentOut.length && cameIn.length) {
          // mapa: outId -> inId (mesmo índice; se sobrar/faltar, cicla)
          const remap = {};
          wentOut.forEach(function (outId, i) {
            const inId = cameIn[i % cameIn.length];
            remap[outId] = inId;
          });
          // re-aponta playerId/assistId de eventos a partir do minuto atual
          for (let k = idx; k < events.length; k++) {
            const ev = events[k];
            if (ev.side !== mySide) continue;
            if (ev.playerId && remap[ev.playerId]) {
              const np = sq.find(function (x) { return x.id === remap[ev.playerId]; });
              if (np) { ev.playerId = np.id; ev.player = np.name; }
            }
            if (ev.assistId && remap[ev.assistId]) {
              const np = sq.find(function (x) { return x.id === remap[ev.assistId]; });
              if (np) { ev.assistId = np.id; ev.assist = np.name; }
            }
          }
          subsApplied = wentOut.length;
          // narra cada substituicao no feed da partida
          wentOut.forEach(function (outId, i) {
            const inId = cameIn[i % cameIn.length];
            const pOut = sq.find(function (x) { return x.id === outId; });
            const pIn  = sq.find(function (x) { return x.id === inId; });
            if (pOut && pIn) {
              line("<span class='md-min'>" + minute + "'</span> \ud83d\udd04 Substitui\u00e7\u00e3o em " + U.esc(C.clubById(BF.G.S, clubId).name) + ": entra <b>" + U.esc(pIn.name) + "</b>, sai <b>" + U.esc(pOut.name) + "</b>.", 'md-sub');
            }
          });
        }
      }
      if (formChanged) {
        line("<span class='md-min'>" + minute + "'</span> \ud83d\udcdc Mudan\u00e7a de forma\u00e7\u00e3o para <b>" + formKey + "</b>.", 'md-sub');
      }
      if (!subsApplied && !formChanged) {
        line('<b>Nenhuma altera\u00e7\u00e3o feita.</b>', 'md-sub');
      }
      document.body.removeChild(box); paused = false; startTimer();
    };
  }
  function openPenalty(ev) {
    const clubId = ev.side === 'home' ? match.homeId : match.awayId;
    if (clubId !== myId) return false;
    paused = true;
    clearInterval(timer);
    const takers = C.lineupOf(S, clubId).filter(function (p) { return p.pos !== 'GOL'; }).sort(function (a, b) { return b.ovr - a.ovr; });
    const box = modal('<h1>Penalti para o seu time</h1><p class="sub">Escolha o batedor.</p>' +
      '<label class="fld">Batedor<select id="penTaker">' + takers.map(function (p) { return '<option value="' + p.id + '">' + U.esc(p.name) + ' (' + p.pos + ' ' + p.ovr + ')</option>'; }).join('') + '</select></label>' +
      '<div class="md-actions"><button class="btn primary" id="penSave">Bater</button></div>');
    box.querySelector('#penSave').onclick = function () {
      const id = +box.querySelector('#penTaker').value;
      const p = takers.find(function (x) { return x.id === id; });
      if (p) { ev.player = p.name; ev.playerId = p.id; }
      document.body.removeChild(box);
      paused = false;
      processEvent(ev);
      startTimer();
    };
    return true;
  }
  function processEvent(ev) {
    if (ev.type === 'goal' || ev.type === 'penalty_goal') {
      if (ev.side === 'home') hg++; else ag++;
      ov.querySelector('#mdH').textContent = hg;
      ov.querySelector('#mdA').textContent = ag;
    }
    line("<span class='md-min'>" + ev.minute + "'</span> " + commentary(ev), (ev.type === 'goal' || ev.type === 'penalty_goal') ? 'md-goal' : '');
  }
  function startTimer() { clearInterval(timer); timer = setInterval(tick, 230); }
  function tick() {
    if (paused) return;
    minute += 2;
    if (minute >= 45 && !halfPaused) {
      minute = 45; halfPaused = true;
      ov.querySelector('#mdClock').textContent = "45'";
      ov.querySelector('#mdBar').style.width = '50%';
      line("<span class='md-min'>45'</span> Intervalo. Hora de ajustar o time.", 'md-sub');
      if (mySide) { openSubPanel('Intervalo (45\')'); return; }
    }
    if (minute >= 90) { finish(); return; }
    ov.querySelector('#mdClock').textContent = minute + "'";
    ov.querySelector('#mdBar').style.width = (minute / 90 * 100) + '%';
    while (idx < events.length && events[idx].minute <= minute) {
      const ev = events[idx++];
      if (ev.type === 'penalty_goal' && openPenalty(ev)) return;
      processEvent(ev);
    }
  }

  ov.querySelector('#mdSkip').onclick = finish;
  const pauseBtn = ov.querySelector('#mdPause'); if (pauseBtn) pauseBtn.onclick = function () { openSubPanel('Pausa técnica'); };
  ov.querySelector('#mdClose').onclick = function () { document.body.removeChild(ov); if (onDone) onDone(); };

  // A pré-partida da rodada agora é mostrada antes da simulação (Pré-Iniciar),
  // então aqui vão direto para a narração ao vivo. Quem não controla nenhum
  // dos dois lados também vai direto.
  start();
  // showPreMatch(start); // desativado em v4 — evita confusão após simulação
};
