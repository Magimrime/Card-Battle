/* ===========================================================================
   app.js  —  screens, deck builder, and the battle loop for "Card Prediction"
   ========================================================================= */
(function () {
  'use strict';

  const ALL = CARDS.list;
  const DEFAULT_DECK = ['sword', 'bow', 'katana', 'axe', 'hook', 'reverse'];
  const ROUND_TIME = 15; // seconds
  const MANA_MAX   = 5;  // you start full and regen +1 each round

  /* ------------------------------- state ------------------------------- */
  const State = {
    deck: loadDeck(),
    muted: loadMuted(),
    difficulty: loadDifficulty(),   // 1 reckless · 2 tracker · 3 predictor
  };
  let B = null;             // active battle, or null
  let timers = [];          // pending setTimeouts (so we can cancel on quit)
  let countdownInt = null;  // the 15s ticker

  const $  = (s) => document.querySelector(s);
  const el = (id) => document.getElementById(id);

  /* ----------------------------- persistence --------------------------- */
  function loadDeck() {
    try {
      const raw = JSON.parse(localStorage.getItem('cardprediction_deck') || localStorage.getItem('cardbattle_deck') || localStorage.getItem('brps_deck'));
      const spellT = ['spell', 'poison', 'damage'];
      const spells = Array.isArray(raw) ? raw.filter((id) => CARDS.byId(id) && spellT.indexOf(CARDS.byId(id).type) >= 0).length : 9;
      if (Array.isArray(raw) && raw.length === 6 && raw.every((id) => CARDS.byId(id) && id !== 'shield') && spells <= 2) {
        return raw.slice();
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_DECK.slice();
  }
  function saveDeckToStore(deck) {
    try { localStorage.setItem('cardprediction_deck', JSON.stringify(deck)); } catch (e) {}
  }
  function loadMuted() {
    try { return (localStorage.getItem('cardprediction_muted') || localStorage.getItem('cardbattle_muted') || localStorage.getItem('brps_muted')) === '1'; } catch (e) { return false; }
  }
  function loadDifficulty() {
    try { const d = +(localStorage.getItem('cardprediction_diff') || localStorage.getItem('cardbattle_diff') || localStorage.getItem('brps_diff')); return d >= 1 && d <= 3 ? d : 1; } catch (e) { return 1; }
  }
  function saveDifficulty() {
    try { localStorage.setItem('cardprediction_diff', String(State.difficulty)); } catch (e) {}
  }

  /* ------------------------------- sound ------------------------------- */
  let actx = null;
  function beep(freq, dur, type, vol) {
    if (State.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.value = vol == null ? 0.05 : vol;
      o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  const sndPlace  = () => beep(440, 0.12, 'triangle', 0.06);
  const sndReveal = () => { beep(660, 0.12, 'sine', 0.05); setTimeout(() => beep(880, 0.14, 'sine', 0.05), 90); };
  const sndHit    = () => beep(150, 0.22, 'sawtooth', 0.07);
  const sndBlock  = () => beep(320, 0.18, 'square', 0.05);
  const sndWin    = () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'triangle', 0.06), i * 130)); };
  const sndLose   = () => { [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.28, 'sawtooth', 0.06), i * 160)); };

  /* ----------------------------- helpers ------------------------------- */
  function setTO(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() {
    timers.forEach(clearTimeout); timers = [];
    if (countdownInt) { clearInterval(countdownInt); countdownInt = null; }
    if (mpMoveInt) { clearInterval(mpMoveInt); mpMoveInt = null; }
  }
  const rand   = (a, b) => a + Math.random() * (b - a);
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function showScreen(name) {
    if (name !== 'battle') { clearTimers(); B = null; }
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    el('screen-' + name).classList.add('active');
  }

  /* Custom SVG glyphs (ICON / WEAPON / CHROME / cardIcon / TYPE_ICON) live in js/icons.js. */

  /* --------------------------- card rendering -------------------------- */
  function heartsRow(value, count, dmg) {
    let h = '';
    for (let k = 0; k < count; k++) {
      const f = Math.max(0, Math.min(1, value - k)) * 100;
      h += `<span class="heart"><span class="heart-bg"></span><span class="heart-fill" style="height:${f}%"></span></span>`;
    }
    return `<span class="${dmg ? 'dmg-hearts' : ''}">${h}</span>`;
  }

  function manaPips(cost) {
    if (cost === 0) return `<span class="mana-cost free">FREE</span>`;
    let pips = '';
    for (let k = 0; k < cost; k++) pips += '<span class="pip"></span>';
    return `<span class="mana-cost">${pips}</span>`;
  }

  function cardHTML(card, opts) {
    opts = opts || {};
    const cls      = 'card type-' + card.type + (opts.extraClass ? ' ' + opts.extraClass : '');
    const badge    = opts.badge != null ? `<div class="order-badge">${opts.badge}</div>` : '';
    const desc     = opts.desc     ? `<div class="cdesc">${card.desc}</div>` : '';
    const key      = opts.key      ? `<span class="key">${opts.key}</span>`  : '';
    const cost     = (opts.cost !== false && card.mana > 0) ? `<div class="cost-badge">${manaPips(card.mana)}</div>` : '';
    const counters = opts.counters ? counterRowHTML(card) : '';
    const dmgLine  = card.damage > 0
      ? `<div class="dmg-line">${ICON.dmg} ${card.damage.toFixed(2)} ${heartsRow(card.damage, 3, true)}</div>`
      : `<div class="dmg-line subtle">${ICON.none} no damage</div>`;
    const spdTxt   = card.double ? '1.2s + 2.2s' : `${card.speed.toFixed(1)}s`;
    const spdLine  = `<div class="spd-line">${ICON.speed} ${spdTxt} <span class="spd-hint">lower = faster</span></div>`;
    return `<div class="${cls}" style="--c1:${card.c1};--c2:${card.c2}">
        ${badge}${key}${cost}
        <div class="emoji">${cardIcon(card)}</div>
        <div class="cname">${card.name}</div>
        ${desc}
        ${dmgLine}
        ${spdLine}
        ${counters}
      </div>`;
  }

  function counterRowHTML(card) {
    const ic = (t) => TYPE_ICON[t] || '';
    const strong = CARDS.strongVs(card), weak = CARDS.weakVs(card);
    const beats = strong.length
      ? `<div class="counter-row beats"><span class="ctag">${ICON.up}Beats</span><span class="cicons">${strong.map(ic).join('')}</span></div>`
      : '';   // utility spells beat nothing — show only the Lose row
    const loses = `<div class="counter-row loses"><span class="ctag">${ICON.down}Lose</span><span class="cicons">${weak.map(ic).join('') || '—'}</span></div>`;
    return `<div class="counters">${beats}${loses}</div>`;
  }

  /* ============================ DECK BUILDER =========================== */
  let editDeck = [];

  function openDeck() {
    editDeck = State.deck.slice();
    renderDeckGrid();
    showScreen('deck');
  }

  function renderDeckGrid() {
    const grid = el('deck-grid');
    grid.innerHTML = '';
    const spellsChosen = editDeck.filter((x) => isSpell(CARDS.byId(x))).length;
    ALL.forEach((card) => {
      const pos = editDeck.indexOf(card.id);
      const capLocked = pos < 0 && isSpell(card) && spellsChosen >= MAX_SPELLS; // spell cap reached
      const holder = document.createElement('div');
      holder.innerHTML = cardHTML(card, {
        desc: true, counters: true,
        extraClass: 'deck-card' + (pos >= 0 ? ' selected' : '') + (capLocked ? ' unaffordable' : ''),
        badge: pos >= 0 ? pos + 1 : null,
      });
      const cardEl = holder.firstElementChild;
      cardEl.addEventListener('click', () => toggleCard(card.id));
      grid.appendChild(cardEl);
    });
    updateDeckStatus();
  }

  function toggleCard(id) {
    const i = editDeck.indexOf(id);
    if (i >= 0) { editDeck.splice(i, 1); renderDeckGrid(); return; }
    if (editDeck.length >= 6) { flashMsg('Deck is full — remove a card first (max 6).', 'err'); return; }
    if (isSpell(CARDS.byId(id)) && editDeck.filter((x) => isSpell(CARDS.byId(x))).length >= MAX_SPELLS) {
      flashMsg(`A deck can hold at most ${MAX_SPELLS} spells.`, 'err'); return;
    }
    editDeck.push(id);
    renderDeckGrid();
  }

  function updateDeckStatus() {
    el('deck-count').textContent = editDeck.length;
    const ok = editDeck.length === 6;
    el('btn-save-deck').disabled = !ok;
    const msg = el('deck-msg');
    if (editDeck.length < 6) { msg.textContent = `Add ${6 - editDeck.length} more card${6 - editDeck.length === 1 ? '' : 's'}.`; msg.className = 'deck-msg'; }
    else { msg.textContent = 'Ready! Exactly 6 cards.'; msg.className = 'deck-msg ok'; }
  }

  function flashMsg(text, cls) {
    const msg = el('deck-msg');
    msg.textContent = text; msg.className = 'deck-msg ' + (cls || '');
    setTimeout(updateDeckStatus, 1600);
  }

  function saveDeck() {
    if (editDeck.length !== 6) { flashMsg('A deck must be exactly 6 cards.', 'err'); return; }
    State.deck = editDeck.slice();
    saveDeckToStore(State.deck);
    flashMsg('Deck saved!', 'ok');
  }

  /* ============================== BATTLE ============================== */
  function startBattle(mp) {
    if (mp && mp.type) mp = null;                        // ignore DOM events from button listeners
    if (!mp && State.deck.length !== 6) { openDeck(); flashMsg('Build a 6-card deck before battling.', 'err'); return; }
    el('overlay').classList.remove('show');
    el('btn-rematch').style.display = '';
    // Tracker/Predictor bots pick a play style (and a deck to match) + a pace; Reckless stays generic.
    const cStyle = (!mp && State.difficulty >= 2) ? choice(['commit', 'scout', 'tempo']) : 'reckless';
    const cPace  = (!mp && State.difficulty >= 2 && Math.random() < 0.5) ? 'slow' : 'fast';
    B = {
      pDeck: mp ? mp.myDeck.slice() : shuffle(State.deck), // player's cycle order (already shuffled in MP)
      cDeck: mp ? mp.oppDeck.slice() : buildCpuDeck(cStyle), // opponent's deck — the remote human's in MP
      mp: mp || null,                                      // { role:'host'|'guest', key } when online
      cStyle, cPace, cCommitFailed: false,                 // bot strategy state
      pLast: null, pShieldStreak: 0,                       // tracking the player for counter-play
      pHP: 5, cHP: 5,
      pMana: MANA_MAX, cMana: MANA_MAX,
      pShieldOff: 0, cShieldOff: 0,                      // turns each shield stays stunned (after a break)
      pShieldHP: 2, cShieldHP: 2,                        // shield durability (cracks at 0.5, breaks at 0)
      pAbsorb: 0, cAbsorb: 0,                            // golden absorption hearts (from Heal at full HP)
      pManaAbsorb: 0, cManaAbsorb: 0,                    // dark-blue absorption mana (from Mana at full)
      pPoison: 0, cPoison: 0,                            // poison ticks remaining (0.5 each)
      pSpeedBuff: false, cSpeedBuff: false,              // next card +1 speed (Speed spell)
      pDmgBuff: false, cDmgBuff: false,                  // next card +1 damage (Strength spell)
      round: 0, difficulty: State.difficulty,
      phase: 'idle', pCard: null, cCard: null,
      pDone: false, cDone: false, resolved: false,
      raised: null,                                      // hand card lifted, awaiting placement
      pendingOnP: [], pendingOnC: [],                    // in-flight boomerangs returning later
      pSeen: new Set(),                                  // player cards the CPU has watched reveal
      cPrev: null,                                       // CPU's previous move (to avoid shield-spam)
      minigunArmed: false,                               // Minigun deployed (first use), now charging in hand
      minigunCharge: 0,                                  // stored Minigun damage (+0.5 per turn held)
      cMinigunArmed: false, cMinigunCharge: 0,           // opponent's Minigun (used in online play)
    };
    showScreen('battle');
    renderHP(); renderMana();
    setTO(startRound, 400);
  }

  // The opponent runs a preset deck (only the draw ORDER is shuffled). Tracker/Predictor bots pick a
  // play STYLE at battle start and use the matching deck, so each plan actually has its tools:
  //   commit — lead with a shield-breaker and press; turtle up if the opener gets punished
  //   scout  — shield turn 1 to read the foe, then counter with the right answer
  //   tempo  — fast strikes + katana/reverse counter-predicts
  const CPU_DECK = ['sword', 'axe', 'bow', 'katana', 'reverse', 'poison']; // L1 (reckless) generic
  const STYLE_DECKS = {
    commit: ['axe', 'harpoon', 'hook', 'hammer', 'bow', 'katana'],
    scout:  ['katana', 'reverse', 'poison', 'sword', 'bow', 'axe'],
    tempo:  ['dart', 'dagger', 'katana', 'reverse', 'bow', 'sword'],
  };
  const BREAKERS = ['axe', 'hook', 'harpoon', 'rpeg']; // cards that disable / pierce a shield
  function buildCpuDeck(style) { return shuffle(STYLE_DECKS[style] || CPU_DECK); }

  function startRound() {
    if (!B) return;
    B.round++;
    if (B.round > 1) {                                   // regenerate mana each round after the first
      B.pMana = Math.min(MANA_MAX, B.pMana + 1);
      B.cMana = Math.min(MANA_MAX, B.cMana + 1);
    }
    if (B.pShieldOff === 0) B.pShieldHP = Math.min(2, B.pShieldHP + 0.5); // shields heal +0.5/turn unless stunned
    if (B.cShieldOff === 0) B.cShieldHP = Math.min(2, B.cShieldHP + 0.5);
    if (B.minigunArmed) B.minigunCharge += 0.5;   // a deployed Minigun gains +0.5 each turn it's held in hand
    if (B.cMinigunArmed) B.cMinigunCharge += 0.5; // (opponent's, online)
    B.phase = 'choosing'; B.pCard = B.cCard = null;
    B.pDone = B.cDone = B.resolved = false; B.raised = null;

    // reset slots
    slotEmpty('cpu', 'Waiting…');
    slotEmpty('player', 'Drop or tap a card here');
    el('player-slot').classList.add('lit');
    el('banner').className = 'banner';
    el('banner').innerHTML = '';

    renderHP(); renderMana();
    renderHand();
    renderShieldBtn();
    startCountdown();
    if (B.mp) mpPollMove(); else scheduleCPU();   // online: the opponent's move arrives over the relay
  }

  /* --------- hand & next --------- */
  function handIds(deck) { return deck.slice(0, 3); }
  const affordable = (card, mana) => mana >= card.mana;
  const WEAPON_TYPES = ['melee', 'projectile', 'katana', 'reverse', 'disabler'];
  const isWeapon = (card) => WEAPON_TYPES.indexOf(card.type) >= 0;  // Speed/Strength only affect (and are spent by) weapons
  const isSpell  = (card) => card.type === 'spell' || card.type === 'poison' || card.type === 'damage';
  const MAX_SPELLS = 2;

  function renderHand() {
    const hand = el('hand');
    hand.className = 'hand';
    hand.innerHTML = '';
    handIds(B.pDeck).forEach((id, i) => {
      let card = CARDS.byId(id);
      if (id === 'minigun') card = Object.assign({}, card, { damage: B.minigunArmed ? +B.minigunCharge.toFixed(2) : 0 }); // deploy = 0, then stored charge
      const canPlay = affordable(card, B.pMana + B.pManaAbsorb);
      const node = document.createElement('div');
      node.innerHTML = cardHTML(card, { key: i + 1, counters: true, extraClass: canPlay ? '' : 'unaffordable' });
      const cardEl = node.firstElementChild;
      cardEl.dataset.cardId = id;
      cardEl.draggable = canPlay;
      const weapon = isWeapon(card);
      if (weapon && B.pSpeedBuff) { cardEl.classList.add('charged'); cardEl.insertAdjacentHTML('beforeend', `<span class="charge-bolt">${ICON.bolt}</span>`); }       // Speed (cyan)
      if (weapon && B.pDmgBuff)   { cardEl.classList.add('strengthened'); cardEl.insertAdjacentHTML('beforeend', `<span class="str-badge">${WEAPON.strength}</span>`); } // Strength (red)
      if (id === 'minigun') cardEl.insertAdjacentHTML('beforeend', B.minigunArmed ? `<span class="charge-amt">${ICON.bolt}${B.minigunCharge}</span>` : `<span class="charge-amt">deploy</span>`); // deploy / stored charge

      cardEl.addEventListener('click', () => raiseCard(id));
      cardEl.addEventListener('dragstart', (e) => {
        if (!affordable(CARDS.byId(id), B.pMana + B.pManaAbsorb) || B.pDone) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        cardEl.classList.add('dragging');
        el('player-slot').classList.add('drop-ready');
      });
      cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging');
        el('player-slot').classList.remove('drop-ready', 'drop-hover');
      });

      hand.appendChild(cardEl);
    });
    const nextId = B.pDeck[3];
    el('next').innerHTML = nextId ? cardHTML(CARDS.byId(nextId), { cost: false }) : '';
  }

  // lift a card up (does NOT play it — you must drop it / tap the slot)
  function raiseCard(id) {
    if (!B || B.phase !== 'choosing' || B.pDone) return;
    const card = CARDS.byId(id);
    if (!affordable(card, B.pMana + B.pManaAbsorb)) { bumpUnaffordable(id); return; }
    B.raised = (B.raised === id) ? null : id;
    [...el('hand').children].forEach((c) => c.classList.toggle('raised', c.dataset.cardId === B.raised));
    el('player-slot').classList.toggle('drop-ready', !!B.raised);
    if (B.raised) el('player-ph').textContent = 'Tap here to place ↓';
    else el('player-ph').textContent = 'Drop or tap a card here';
  }

  function bumpUnaffordable(id) {
    [...el('hand').children].forEach((c) => {
      if (c.dataset.cardId === id) { c.classList.remove('shake-no'); void c.offsetWidth; c.classList.add('shake-no'); }
    });
    beep(180, 0.1, 'square', 0.04);
  }

  /* --------- timer --------- */
  const RING_LEN = 2 * Math.PI * 44;
  function setRing(frac) {
    const fg = el('ring-fg');
    fg.style.strokeDasharray = RING_LEN;
    fg.style.strokeDashoffset = RING_LEN * (1 - frac);
    fg.style.stroke = frac > 0.5 ? '#4fe08a' : frac > 0.25 ? '#ffce4f' : '#ff5a6e';
  }
  function startCountdown() {
    if (countdownInt) clearInterval(countdownInt);
    const start = Date.now();
    setRing(1); el('timer-num').textContent = ROUND_TIME;
    countdownInt = setInterval(() => {
      const left = Math.max(0, ROUND_TIME - (Date.now() - start) / 1000);
      setRing(left / ROUND_TIME);
      el('timer-num').textContent = Math.ceil(left);
      if (left <= 0) {
        clearInterval(countdownInt); countdownInt = null;
        if (B && !B.pDone) autoPlayPlayer();                              // you didn't pick → empty slot
        if (B && !B.mp && B.phase === 'choosing' && !B.cDone) commitCPU(); // offline: force the CPU at time-up (online waits for the remote move)
      }
    }, 80);
  }

  // timer ran out with no selection → play nothing; the slot stays empty and the opponent gets a free hit
  function autoPlayPlayer() {
    commitPlayer('none');
  }

  /* --------- CPU --------- */
  function scheduleCPU() {
    const delay = rand(1400, 8000);
    setTO(() => { if (B && B.phase === 'choosing' && !B.cDone) commitCPU(); }, delay);
  }
  // the moves the CPU can actually make this round
  function cpuCandidates() {
    const ids = handIds(B.cDeck).filter((id) => affordable(CARDS.byId(id), B.cMana + B.cManaAbsorb));
    if (B.cShieldOff === 0) ids.push('shield');
    return ids;
  }

  // value to the CPU of answering player-card pId with cpu-card cId (higher = better)
  function cpuEval(pId, cId) {
    const r = CARDS.resolve(CARDS.byId(pId), CARDS.byId(cId), B.pShieldOff > 0, B.cShieldOff > 0);
    let ev = r.pTake - r.cTake;              // hurt them, don't get hurt
    ev += (r.cPoison - r.pPoison) * 0.4;     // poisoning them is good; getting poisoned is bad
    ev += (r.pShieldHit - r.cShieldHit) * 0.22; // cracking the player's shield is good
    return ev;
  }

  // what the CPU thinks the player might play (depends on how much it can "see")
  function cpuPredict(level) {
    const hand = handIds(B.pDeck);
    // L3 sees the whole hand; L2 only the cards it has already watched reveal (cycle tracking)
    let known = level >= 3 ? hand.slice() : hand.filter((id) => B.pSeen.has(id));
    // L3 also tracks your mana — it knows which cards you can actually afford right now
    if (level >= 3) known = known.filter((id) => affordable(CARDS.byId(id), B.pMana + B.pManaAbsorb));
    const opts = known.map((id) => {
      const c = CARDS.byId(id);
      const threat = c.damage + ((c.type === 'katana' || c.type === 'reverse') ? 0.6 : 0) + 0.25;
      return { id, w: threat };
    });
    if (B.pShieldOff === 0) opts.push({ id: 'shield', w: (opts.length ? 0.5 : 2) * (1 + (B.pShieldStreak || 0) * 0.8) }); // turtlers keep shielding
    else if (level >= 3 && !opts.length) opts.push({ id: 'none', w: 1 });           // out of mana & shield stunned → exposed!
    if (!opts.length) opts.push({ id: 'sword', w: 1 });                             // total blind → assume a generic hit
    const tot = opts.reduce((s, o) => s + o.w, 0);
    return opts.map((o) => ({ id: o.id, p: o.w / tot }));
  }

  // level 1 — reckless: lean on raw damage, favor flashy katana/reverse, little thought
  function cpuReckless(cands) {
    let best = cands[0], bw = -Infinity;
    cands.forEach((id) => {
      const c = CARDS.byId(id);
      let w;
      if (id === 'shield') { w = Math.max(0.1, 0.8 - B.cMana * 0.14); if (B.cPrev === 'shield') w *= 0.35; } // don't turtle with spare mana
      else { w = Math.pow(c.damage + 0.4, 1.5) + Math.random() * 1.1; if (c.type === 'katana' || c.type === 'reverse') w += 0.9; }
      if (w > bw) { bw = w; best = id; }
    });
    return best;
  }

  function cpuChooseMove() {
    const cands = cpuCandidates();
    if (!cands.length) return 'none';                  // nothing affordable & shield stunned → exposed
    const lvl = B.difficulty || 1;
    if (lvl === 1) return cpuReckless(cands);
    return cpuStrategic(cands, lvl);                   // Tracker / Predictor play with a strategy
  }

  // Tracker (L2) & Predictor (L3): score every move, then bend it toward the chosen play style,
  // the read on the player (turtling / out of mana), and the pace (fast = punish now, slow = wait).
  function cpuStrategic(cands, lvl) {
    const has = (id) => cands.indexOf(id) >= 0;
    const playerMana = B.pMana + B.pManaAbsorb;
    const playerStuck = handIds(B.pDeck).every((id) => !affordable(CARDS.byId(id), playerMana));
    const playerLowMana = playerMana < 2;             // can barely act → likely to shield
    const turtling = B.pShieldStreak >= 1;            // shielded last turn (or more)
    const exposed = playerStuck || playerLowMana || turtling;
    const dist = cpuPredict(lvl);
    const chanceOf = (test) => dist.filter((o) => test(CARDS.byId(o.id))).reduce((s, o) => s + o.p, 0);
    const projChance = chanceOf((k) => k.type === 'projectile');
    const slowChance = chanceOf((k) => !k.spell && k.type !== 'shield' && k.speed >= 1.8);

    // ---- opening moves by style ----
    if (B.round === 1 && !B.cCommitFailed) {
      if (B.cStyle === 'commit') { const op = BREAKERS.find(has); if (op) return op; }    // lead with a shield-breaker
      if (B.cStyle === 'scout' && has('shield') && B.cShieldOff === 0) return 'shield';   // shield turn 1 to read them
      // tempo: never katana/reverse on the first play (penalised below)
    }

    const exploit = lvl >= 3 && playerStuck;                 // player can't attack → press the advantage
    const manaPenalty = (lvl >= 3 && !exploit) ? 0.18 : 0;   // each saved mana point is worth something

    let best = cands[0], bestScore = -Infinity;
    cands.forEach((cc) => {
      const c = CARDS.byId(cc);
      const isAttack = cc !== 'shield' && cc !== 'none' && !c.spell;   // anything that pressures the foe
      let score = 0;
      dist.forEach((po) => { score += po.p * cpuEval(po.id, cc); });

      score -= c.mana * manaPenalty;                                   // bank mana rather than dump it
      if (manaPenalty && B.cMana - c.mana < 1) score -= 0.3;
      if (cc === 'shield') { score -= B.cMana * 0.14; if (B.cPrev === 'shield') score -= 0.7; } // don't turtle with spare mana / repeat

      // shield-breakers: punish a turtle, and disable the shield of a foe with no mana to attack
      if (BREAKERS.indexOf(cc) >= 0) {
        if (turtling)      score += 1.3;
        if (playerLowMana) score += 1.0;
        if (B.cStyle === 'commit' && !B.cCommitFailed) score += 0.5;
      }
      // katana / reverse: counter-predict a projectile — but never on the first play
      if (cc === 'katana' || cc === 'reverse') {
        score += projChance * 1.4;
        if (B.round === 1) score -= 1.6;
        if (B.cStyle === 'tempo') score += projChance * 0.5;
      }
      // fast strikes punish a predicted slow card (dart / dagger)
      if (isAttack && c.speed <= 0.9) score += slowChance * 0.9;

      // pace: fast presses immediately; slow waits for a 2nd mistake, striking only once they're exposed
      if (B.cPace === 'slow' && !exposed) {
        if (cc === 'shield' && B.cShieldOff === 0 && B.cPrev !== 'shield') score += 0.6;
        if (isAttack) score -= 0.4;
      } else if (isAttack) {
        score += 0.4;
      }
      // commit that got punished → batten down
      if (B.cStyle === 'commit' && B.cCommitFailed && cc === 'shield' && B.cShieldOff === 0) score += 0.8;

      score += (Math.random() - 0.4) * (lvl === 3 ? 0.6 : 0.4);        // takes chances (more at L3)
      if (score > bestScore) { bestScore = score; best = cc; }
    });
    return best;
  }

  /* --------- commit --------- */
  function commitPlayer(id, force) {
    if (!B || B.phase !== 'choosing' || B.pDone) return;
    const card = CARDS.byId(id);
    if (!force && id !== 'shield' && !affordable(card, B.pMana + B.pManaAbsorb)) { bumpUnaffordable(id); return; }
    if (id === 'shield' && B.pShieldOff > 0) return; // can't shield while disabled

    B.pDone = true; B.pCard = id; B.raised = null;
    spendMana('p', card.mana);
    if (B.mp) mpSendMove(id);   // relay our move to the remote player
    // NOTE: the round timer keeps running until the opponent also commits
    el('player-slot').classList.remove('lit', 'drop-ready', 'drop-hover');
    el('hand').classList.add('locked');
    [...el('hand').children].forEach((c) => { c.classList.toggle('chosen', c.dataset.cardId === id); c.classList.remove('raised'); });
    el('btn-shield').classList.toggle('chosen', id === 'shield');
    el('btn-shield').disabled = true;
    slotFacedown('player', id);
    renderMana();
    sndPlace();
    tryResolve();
  }
  // commit the opponent's move — the CPU's pick offline, or the relayed card online
  function commitOpponent(card) {
    if (!B || B.cDone) return;
    B.cDone = true; B.cCard = card;
    spendMana('c', CARDS.byId(card).mana);
    slotFacedown('cpu', card);
    sndPlace();
    tryResolve();
  }
  function commitCPU() { if (B && !B.cDone) commitOpponent(cpuChooseMove()); }

  /* --------- online multiplayer (lockstep over the relay) --------- */
  let mpMoveInt = null, mpJoinInt = null;
  const MP_POPUPS = ['mp-modal', 'mp-host-modal', 'mp-join-modal'];
  const mpJSON = (path, opts) => fetch(path, opts).then((r) => r.json());
  const mpStat = (id, t, cls) => { const s = el(id); if (s) { s.textContent = t || ''; s.className = 'mp-status ' + (cls || ''); } };

  function mpCloseAll() {                                  // hide every MP popup and stop any host polling
    if (mpJoinInt) { clearInterval(mpJoinInt); mpJoinInt = null; }
    MP_POPUPS.forEach((id) => el(id).classList.remove('show'));
  }
  function mpOpen(id) { mpCloseAll(); el(id).classList.add('show'); }

  // first popup: only Host / Join
  function openMP() {
    if (State.deck.length !== 6) { openDeck(); flashMsg('Build a 6-card deck before going online.', 'err'); return; }
    mpOpen('mp-modal');
  }

  // second popup (Join): a key field
  function mpOpenJoin() {
    el('mp-key-input').value = ''; mpStat('mp-status', '');
    mpOpen('mp-join-modal');
    setTimeout(() => el('mp-key-input').focus(), 30);
  }

  // second popup (Host): create a room, show the key, wait for the opponent
  function mpHost() {
    const deck = shuffle(State.deck);
    el('mp-key').textContent = '····'; mpStat('mp-host-status', 'Creating game…');
    mpOpen('mp-host-modal');
    mpJSON('/mp/host', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deck }) })
      .then((d) => {
        if (!d || !d.key) { mpStat('mp-host-status', d && d.detail ? ('Server error: ' + d.detail) : (d && d.error) || 'Server did not return a key.', 'err'); return; }
        const key = d.key;
        el('mp-key').textContent = key; mpStat('mp-host-status', '');
        mpJoinInt = setInterval(() => {
          mpJSON('/mp/joined?key=' + key).then((d) => {
            if (d.gone) { clearInterval(mpJoinInt); mpJoinInt = null; mpStat('mp-host-status', 'Game expired — exit and try again.', 'err'); return; }
            if (d.joined) { mpCloseAll(); startBattle({ role: 'host', key, myDeck: deck, oppDeck: d.oppDeck }); }
          }).catch(() => {});
        }, 900);
      })
      .catch(() => mpStat('mp-host-status', 'Could not reach the server.', 'err'));
  }

  function mpJoin() {
    const key = (el('mp-key-input').value || '').trim().toUpperCase();
    if (key.length < 4) { mpStat('mp-status', 'Enter the 4-character key.', 'err'); return; }
    const deck = shuffle(State.deck);
    mpStat('mp-status', 'Joining…');
    mpJSON('/mp/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, deck }) })
      .then((d) => {
        if (!d.ok) { mpStat('mp-status', d.error || 'Could not join.', 'err'); return; }
        mpCloseAll();
        startBattle({ role: 'guest', key, myDeck: deck, oppDeck: d.oppDeck });
      })
      .catch(() => mpStat('mp-status', 'Could not reach the server.', 'err'));
  }

  function mpSendMove(card) {
    mpJSON('/mp/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: B.mp.key, role: B.mp.role, round: B.round, card }) }).catch(() => {});
  }

  // poll the relay for the remote player's move for this round, then resolve in lockstep
  function mpPollMove() {
    const round = B.round;
    if (mpMoveInt) clearInterval(mpMoveInt);
    mpMoveInt = setInterval(() => {
      if (!B || !B.mp || B.round !== round || B.cDone) { clearInterval(mpMoveInt); mpMoveInt = null; return; }
      mpJSON(`/mp/move?key=${B.mp.key}&role=${B.mp.role}&round=${round}`).then((d) => {
        if (!B || !B.mp || B.round !== round || B.cDone) return;
        if (d.gone) { clearInterval(mpMoveInt); mpMoveInt = null; mpLeft(); return; }
        if (d.card != null) { clearInterval(mpMoveInt); mpMoveInt = null; commitOpponent(d.card); }
      }).catch(() => {});
    }, 600);
  }

  function mpLeft() {
    clearTimers();
    if (!B) return;
    B.phase = 'over';
    el('result-title').textContent = 'Opponent left';
    el('result-sub').textContent = 'The other player disconnected.';
    el('btn-rematch').style.display = 'none';
    el('overlay').classList.add('show');
  }

  function tryResolve() {
    if (B && B.pDone && B.cDone && !B.resolved) {
      B.resolved = true; B.phase = 'reveal';
      if (countdownInt) { clearInterval(countdownInt); countdownInt = null; } // both locked in → stop the clock
      setTO(reveal, 520);
    }
  }

  /* --------- slot rendering --------- */
  function slotEmpty(side, text) {
    el(side + '-flip').hidden = true;
    el(side + '-ph').hidden = false;
    el(side + '-ph').textContent = text;
    el(side + '-flip').querySelector('.flip-inner').classList.remove('revealed');
  }
  function slotFacedown(side, cardId) {
    const flip = el(side + '-flip');
    el(side + '-ph').hidden = true;
    flip.hidden = false;
    flip.querySelector('.flip-front').innerHTML = `<div class="card-back"><span>${WEAPON.back}</span></div>`;
    flip.querySelector('.flip-back').innerHTML = (cardId === 'none')
      ? `<div class="card empty-card"><div class="emoji">${ICON.none}</div><div class="cname">No card</div><div class="ec-sub">Exposed!</div></div>`
      : cardHTML(CARDS.byId(cardId), { cost: false });
    flip.querySelector('.flip-inner').classList.remove('revealed');
  }
  function revealSlot(side) { el(side + '-flip').querySelector('.flip-inner').classList.add('revealed'); }

  /* --------- resolve --------- */
  function reveal() {
    if (!B) return;
    revealSlot('player'); revealSlot('cpu');
    sndReveal();
    setTO(applyOutcome, 720);
  }

  // deal damage to a side — golden absorption hearts soak it first, then real HP
  function hurt(side, amt) {
    amt = +amt; if (!(amt > 0)) return;
    const absKey = side === 'p' ? 'pAbsorb' : 'cAbsorb', hpKey = side === 'p' ? 'pHP' : 'cHP';
    const soaked = Math.min(B[absKey], amt);
    B[absKey] = +(B[absKey] - soaked).toFixed(2);
    B[hpKey] = Math.max(0, +(B[hpKey] - (amt - soaked)).toFixed(2));
  }
  // pay a card's mana — regular mana first, then dark-blue absorption mana
  function spendMana(side, cost) {
    const mKey = side === 'p' ? 'pMana' : 'cMana', aKey = side === 'p' ? 'pManaAbsorb' : 'cManaAbsorb';
    const fromReg = Math.min(B[mKey], cost);
    B[mKey] = +(B[mKey] - fromReg).toFixed(2);
    B[aKey] = Math.max(0, +(B[aKey] - (cost - fromReg)).toFixed(2));
  }
  // apply a utility spell's effect to its caster
  function applySpell(spell, side) {
    if (!spell) return;
    const hp = side === 'p' ? 'pHP' : 'cHP', ab = side === 'p' ? 'pAbsorb' : 'cAbsorb';
    if (spell === 'heal') {
      if (B[hp] < 5) B[hp] = Math.min(5, B[hp] + 1);
      else B[ab] = Math.min(5, +(B[ab] + 0.5).toFixed(2));   // golden absorption when already full
    } else if (spell === 'mana') {
      const m = side === 'p' ? 'pMana' : 'cMana', mab = side === 'p' ? 'pManaAbsorb' : 'cManaAbsorb';
      if (B[m] < MANA_MAX) B[m] = Math.min(MANA_MAX, B[m] + 1);
      else B[mab] = Math.min(5, +(B[mab] + 0.5).toFixed(2));   // dark-blue absorption mana when already full
    } else if (spell === 'speed') {
      if (side === 'p') B.pSpeedBuff = true; else B.cSpeedBuff = true;
    } else if (spell === 'strength') {
      if (side === 'p') B.pDmgBuff = true; else B.cDmgBuff = true;
    }
  }

  function applyOutcome() {
    if (!B) return;
    let p = CARDS.byId(B.pCard); let c = CARDS.byId(B.cCard);
    const minigunArm   = (B.pCard === 'minigun' && !B.minigunArmed);    // first use: deploy, no damage, stays in hand
    const minigunFire  = (B.pCard === 'minigun' && B.minigunArmed);     // second use: fire the stored charge
    const cMinigunArm  = (B.cCard === 'minigun' && !B.cMinigunArmed);   // (opponent's, online)
    const cMinigunFire = (B.cCard === 'minigun' && B.cMinigunArmed);
    if (minigunArm)   p = Object.assign({}, p, { damage: 0, type: 'broken' });   // deploying = defenseless, weak to anything
    if (minigunFire)  p = Object.assign({}, p, { damage: +B.minigunCharge.toFixed(2) });  // firing = a real projectile
    if (cMinigunArm)  c = Object.assign({}, c, { damage: 0, type: 'broken' });
    if (cMinigunFire) c = Object.assign({}, c, { damage: +B.cMinigunCharge.toFixed(2) });
    const pWeapon = isWeapon(p), cWeapon = isWeapon(c);
    const mods = { pSpd: (pWeapon && B.pSpeedBuff) ? 1 : 0, cSpd: (cWeapon && B.cSpeedBuff) ? 1 : 0, pDmg: (pWeapon && B.pDmgBuff) ? 1 : 0, cDmg: (cWeapon && B.cDmgBuff) ? 1 : 0, pShieldHP: B.pShieldHP, cShieldHP: B.cShieldHP };
    const r = CARDS.resolve(p, c, B.pShieldOff > 0, B.cShieldOff > 0, mods);
    if (minigunArm)   { B.minigunArmed = true;  B.minigunCharge = 0; }
    if (minigunFire)  { B.minigunArmed = false; B.minigunCharge = 0; }  // charge spent (even if blocked/reflected)
    if (cMinigunArm)  { B.cMinigunArmed = true;  B.cMinigunCharge = 0; }
    if (cMinigunFire) { B.cMinigunArmed = false; B.cMinigunCharge = 0; }
    if (B.pCard !== 'shield' && B.pCard !== 'none') B.pSeen.add(B.pCard); // CPU now "knows" this card
    if (B.pCard === 'shield') B.pShieldStreak++; else B.pShieldStreak = 0; // is the player turtling?
    B.pLast = B.pCard;
    if (B.cStyle === 'commit' && !B.cCommitFailed && B.round <= 2 && r.cTake > 0) B.cCommitFailed = true; // opener punished → go defensive
    B.cPrev = B.cCard;                                                    // remember CPU's move (anti shield-spam)
    if (pWeapon) { B.pSpeedBuff = false; B.pDmgBuff = false; }            // only a weapon uses & spends the buffs
    if (cWeapon) { B.cSpeedBuff = false; B.cDmgBuff = false; }            // (spells/shield keep them for the next weapon)

    const oHP = { p: B.pHP, c: B.cHP }, oAb = { p: B.pAbsorb, c: B.cAbsorb }; // for the heart-loss animation
    hurt('p', r.pTake); hurt('c', r.cTake);

    // boomerang returns + poison ticks land now
    const back = { p: 0, c: 0 }, dot = { p: 0, c: 0 };
    B.pendingOnP = maturePending(B.pendingOnP, (amt) => { hurt('p', amt); back.p += amt; });
    B.pendingOnC = maturePending(B.pendingOnC, (amt) => { hurt('c', amt); back.c += amt; });
    if (B.pPoison > 0) { hurt('p', 0.5); B.pPoison--; dot.p = 0.5; }
    if (B.cPoison > 0) { hurt('c', 0.5); B.cPoison--; dot.c = 0.5; }

    // schedule new effects from this round
    const threw = (p.id === 'boomerang' && r.cTake > 0) || (c.id === 'boomerang' && r.pTake > 0);
    if (p.id === 'boomerang' && r.cTake > 0) B.pendingOnC.push({ amount: 0.5, left: 1 });
    if (c.id === 'boomerang' && r.pTake > 0) B.pendingOnP.push({ amount: 0.5, left: 1 });
    if (r.cPoison) B.cPoison += r.cPoison;
    if (r.pPoison) B.pPoison += r.pPoison;
    applySpell(r.pSpell, 'p'); applySpell(r.cSpell, 'c');

    // shield durability cracks from the blow; wear off any stun; a shield at 0 breaks → stunned 1 turn
    if (r.pShieldHit) B.pShieldHP = +(B.pShieldHP - r.pShieldHit).toFixed(2);
    if (r.cShieldHit) B.cShieldHP = +(B.cShieldHP - r.cShieldHit).toFixed(2);
    B.pShieldOff = Math.max(0, B.pShieldOff - 1);
    B.cShieldOff = Math.max(0, B.cShieldOff - 1);
    if (r.pShieldHit && B.pShieldHP <= 0) { B.pShieldHP = 0; B.pShieldOff = 1; r.broke = 'p'; }
    if (r.cShieldHit && B.cShieldHP <= 0) { B.cShieldHP = 0; B.cShieldOff = 1; r.broke = 'c'; }
    if (r.pShieldStun) { B.pShieldHP = 0; B.pShieldOff = r.pShieldStun; r.broke = 'p'; } // Battle Axe pierces & stuns
    if (r.cShieldStun) { B.cShieldHP = 0; B.cShieldOff = r.cShieldStun; r.broke = 'c'; }

    paintBanner(p, c, r);
    if (minigunArm) {   // first use just deploys it
      el('banner').className = 'banner show';
      el('banner').innerHTML = `<div class="b-main">${WEAPON.minigun}</div><div class="b-sub dmg">deployed — charging…${r.pTake > 0 ? ` · you −${r.pTake.toFixed(1)}${ICON.heart}` : ''}</div>`;
    } else if (cMinigunArm) {
      el('banner').className = 'banner show';
      el('banner').innerHTML = `<div class="b-main">${WEAPON.minigun}</div><div class="b-sub dmg">opponent deployed${r.cTake > 0 ? ` · opp −${r.cTake.toFixed(1)}${ICON.heart}` : ''}</div>`;
    }
    const ex = [];
    if (back.c > 0) ex.push(`${WEAPON.boomerang} Opp −${back.c.toFixed(1)}${ICON.heart}`);
    if (back.p > 0) ex.push(`${WEAPON.boomerang} You −${back.p.toFixed(1)}${ICON.heart}`);
    if (ex.length) el('banner').innerHTML += `<div class="b-extra dmg">${ex.join(' · ')}</div>`;
    if (threw) el('banner').innerHTML += `<div class="b-extra spd-hint">${WEAPON.boomerang} returns next round</div>`;

    const tookP = r.pTake > 0 || back.p > 0 || dot.p > 0, tookC = r.cTake > 0 || back.c > 0 || dot.c > 0;
    if (tookC) el('cpu-slot').classList.add('hit');
    if (tookP) el('player-slot').classList.add('hit');
    if (tookP || tookC) sndHit(); else sndBlock();

    // animate the heart loss: shuriken hits twice (−0.5 each), poison shakes green
    animateSide('player', oHP.p, oAb.p, B.pHP, B.pAbsorb, dot.p > 0 ? 'poison' : 'normal', c.id === 'shuriken');
    animateSide('cpu',    oHP.c, oAb.c, B.cHP, B.cAbsorb, dot.c > 0 ? 'poison' : 'normal', p.id === 'shuriken');
    renderMana();
    // spell / poison flourishes
    if (r.pSpell === 'heal') floatFx('player', '+', 'fx-heal', 3);
    if (r.cSpell === 'heal') floatFx('cpu', '+', 'fx-heal', 3);
    if (dot.p > 0) floatFx('player', ICON.skull, 'fx-pois', 3);
    if (dot.c > 0) floatFx('cpu', ICON.skull, 'fx-pois', 3);
    setTO(() => { el('cpu-slot').classList.remove('hit'); el('player-slot').classList.remove('hit'); }, 520);

    const over = B.pHP <= 0 || B.cHP <= 0;
    setTO(() => {
      if (!B) return;
      if (!minigunArm) cycle(B.pDeck, B.pCard);    // a deployed Minigun stays in hand; everything else cycles
      if (!cMinigunArm) cycle(B.cDeck, B.cCard);
      if (over) endBattle(decideResult());
      else startRound();
    }, 2000);
  }

  // who wins at battle's end — a double-KO is broken by weapon SPEED (faster lives); identical weapon = draw
  function decideResult() {
    if (B.pHP <= 0 && B.cHP <= 0) {
      const ps = CARDS.byId(B.pCard).speed, cs = CARDS.byId(B.cCard).speed;
      if (B.pCard === B.cCard || ps === cs) return 'draw';
      return ps < cs ? 'win' : 'lose';
    }
    return B.cHP <= 0 ? 'win' : 'lose';
  }

  // terse, symbol-driven result: a main line of icons and a short damage sub-line
  function paintBanner(p, c, r) {
    const banner = el('banner');
    let cls = 'banner show', main = '', sub = '';
    const dmg = (n) => `−${n.toFixed(1)}${ICON.heart}`;
    const ep = (card) => cardIcon(card);

    // offensive spells (Poison / Damage)
    if (p.type === 'poison' || p.type === 'damage' || c.type === 'poison' || c.type === 'damage') {
      if (r.winner === 'p') cls += ' win'; else if (r.winner === 'c') cls += ' lose';
      const m = r.winner === 'c' ? `${ep(c)} ${ICON.beat} ${ep(p)}`
              : r.winner === 'tie' ? `${ep(p)} ${ICON.clash} ${ep(c)}`
              : `${ep(p)} ${ICON.beat} ${ep(c)}`;
      const bits = [];
      if (r.cTake > 0) bits.push(`opp ${dmg(r.cTake)}`);
      if (r.pTake > 0) bits.push(`you ${dmg(r.pTake)}`);
      banner.className = cls;
      banner.innerHTML = `<div class="b-main">${m}</div>` + (bits.length ? `<div class="b-sub dmg">${bits.join(' · ')}</div>` : '');
      return;
    }
    // utility spells (Heal / Mana / Speed / Strength)
    if (r.pSpell || r.cSpell) {
      const LBL = { heal: '+1 heart', mana: '+1 mana', speed: 'next +1 speed', strength: 'next +1 dmg' };
      if (r.pTake > 0) cls += ' lose'; else if (r.cTake > 0) cls += ' win';
      const bits = [];
      if (r.pSpell) bits.push(LBL[r.pSpell]);
      if (r.cSpell) bits.push('opp ' + LBL[r.cSpell]);
      if (r.pTake > 0) bits.push(`you ${dmg(r.pTake)}`);
      if (r.cTake > 0) bits.push(`opp ${dmg(r.cTake)}`);
      banner.className = cls; banner.innerHTML = `<div class="b-main">${ep(p)} ${ICON.clash} ${ep(c)}</div><div class="b-sub dmg">${bits.join(' · ')}</div>`;
      return;
    }

    if (r.pShieldHit > 0 || r.cShieldHit > 0 || r.pShieldStun || r.cShieldStun) {   // a shield took the blow
      if (r.cShieldStun)        { cls += ' win';  main = `${ep(p)} ${ICON.bolt} ${WEAPON.shield}`; sub = `cleaved! ${dmg(r.cTake)} · stunned`; }
      else if (r.pShieldStun)   { cls += ' lose'; main = `${ep(c)} ${ICON.bolt} ${WEAPON.shield}`; sub = `cleaved! ${dmg(r.pTake)} · stunned`; }
      else if (r.broke === 'p') { cls += ' lose'; main = `${ep(c)} ${ICON.bolt} ${WEAPON.shield}`; sub = `shield broke!${r.pTake > 0 ? ' ' + dmg(r.pTake) : ''} · stunned`; }
      else if (r.broke === 'c') { cls += ' win';  main = `${ep(p)} ${ICON.bolt} ${WEAPON.shield}`; sub = `shield broke!${r.cTake > 0 ? ' ' + dmg(r.cTake) : ''} · stunned`; }
      else { const ps = r.pShieldHit > 0; main = `${ps ? ep(c) : ep(p)} ${ICON.block} ${WEAPON.shield}`; sub = `blocked · shield ${(ps ? B.pShieldHP : B.cShieldHP)}/2`; }
    }
    else if (r.reflect === 'p')  { cls += ' win';  main = `${ICON.reverse} ${ep(c)}`; sub = dmg(r.cTake); }
    else if (r.reflect === 'c')  { cls += ' lose'; main = `${ICON.reverse} ${ep(p)}`; sub = dmg(r.pTake); }
    else if (r.pTake === 0 && r.cTake === 0) {
      main = `${ep(p)} ${ICON.block} ${ep(c)}`;
      sub = (p.type === 'shield' || c.type === 'shield') ? 'blocked' : 'stalemate';
    } else if (r.winner === 'tie') {
      main = `${ep(p)}${r.faster === 'p' ? ICON.bolt : ''} ${ICON.clash} ${r.faster === 'c' ? ICON.bolt : ''}${ep(c)}`;
      sub  = `You ${dmg(r.pTake)} · Opp ${dmg(r.cTake)}`;
    } else if (r.winner === 'p') { cls += ' win';  main = `${ep(p)} ${ICON.beat} ${ep(c)}`;              sub = dmg(r.cTake); }
    else                         { cls += ' lose'; main = `${ep(c)} ${ICON.beat} ${ep(p)}`;              sub = dmg(r.pTake); }

    banner.className = cls;
    banner.innerHTML = `<div class="b-main">${main}</div><div class="b-sub dmg">${sub}</div>`;
  }

  function cycle(deck, id) {
    const i = deck.indexOf(id);
    if (i >= 0) { deck.splice(i, 1); deck.push(id); }
  }

  // count down in-flight boomerangs; fire (and drop) the ones that mature this round
  function maturePending(arr, applyFn) {
    const keep = [];
    arr.forEach((it) => { it.left -= 1; if (it.left <= 0) applyFn(it.amount); else keep.push(it); });
    return keep;
  }

  /* --------- HUD --------- */
  // golden absorption hearts, drawn as an overlay literally on top of the first real hearts
  function goldHearts(v) {
    if (!(v > 0)) return '';
    let h = '';
    for (let k = 0; k < Math.ceil(v); k++) {
      const f = Math.max(0, Math.min(1, v - k)) * 100;
      h += `<span class="heart gold"><span class="heart-fill" style="height:${f}%"></span></span>`;
    }
    return `<span class="absorb-row">${h}</span>`;
  }
  function paintHearts(side, hp, abs) {
    el(side + '-hp').innerHTML = heartsRow(hp, 5, false) + goldHearts(abs);
  }
  function renderHP() { paintHearts('player', B.pHP, B.pAbsorb); paintHearts('cpu', B.cHP, B.cAbsorb); }

  /* --------- play effects --------- */
  function shakeHearts(side, kind) {
    const e = el(side + '-hp'), c = kind === 'poison' ? 'fx-poison' : 'fx-hit';
    e.classList.remove('fx-hit', 'fx-poison'); void e.offsetWidth; e.classList.add(c);
    setTO(() => e.classList.remove(c), 460);
  }
  function floatFx(side, html, cls, n) {
    const host = el(side + '-slot'); if (!host) return;
    let layer = host.querySelector('.fx-layer');
    if (!layer) { layer = document.createElement('div'); layer.className = 'fx-layer'; host.appendChild(layer); }
    for (let i = 0; i < (n || 1); i++) {
      const f = document.createElement('div');
      f.className = 'fx-float ' + cls; f.innerHTML = html;
      f.style.left = (28 + Math.random() * 44) + '%';
      f.style.top = (40 + Math.random() * 24) + '%';
      f.style.animationDelay = (i * 0.12) + 's';
      layer.appendChild(f);
      setTO(() => f.remove(), 1250 + i * 130);
    }
  }
  // remove `amt` from (hp, abs), depleting absorption first → [hp, abs]
  function subHP(hp, abs, amt) { const a = Math.min(abs, amt); abs = +(abs - a).toFixed(2); amt -= a; return [Math.max(0, +(hp - amt).toFixed(2)), abs]; }
  // crumble a heart fragment off a slot, filled to `pct` (so a lost half-heart drops a half, not a full)
  function crumbleHeart(side, index, gold, pct) {
    const h = Math.max(0, Math.min(100, pct == null ? 100 : pct));
    if (h <= 0) return;
    const f = document.createElement('span');
    f.className = 'fx-crumble';
    f.innerHTML = `<span class="heart${gold ? ' gold' : ''}"><span class="heart-bg"></span><span class="heart-fill" style="height:${h}%"></span></span>`;
    f.style.left = (Math.max(0, index) * 32 + 1) + 'px';
    el(side + '-hp').appendChild(f);
    setTO(() => f.remove(), 840);
  }
  // how much fill (%) the heart at `idx` lost going from `from` → `to`
  function lostFill(from, to, idx) {
    const o = Math.max(0, Math.min(1, from - idx)), n = Math.max(0, Math.min(1, to - idx));
    return Math.max(0, o - n) * 100;
  }
  // animate a side losing HP: shuriken splits into two 0.5 hits; poison shakes green; the lost heart crumbles from its own slot
  function animateSide(side, oHP, oAb, nHP, nAb, kind, dbl) {
    const totalLost = (oHP + oAb) - (nHP + nAb);
    if (totalLost <= 0) { paintHearts(side, nHP, nAb); return; }
    const step = (fHP, fAb, tHP, tAb) => {
      paintHearts(side, tHP, tAb); shakeHearts(side, kind);
      if (fAb - tAb > 0) { const i = Math.ceil(fAb) - 1; crumbleHeart(side, i, true,  lostFill(fAb, tAb, i)); }   // golden absorb heart (from the left)
      if (fHP - tHP > 0) { const i = Math.ceil(fHP) - 1; crumbleHeart(side, i, false, lostFill(fHP, tHP, i)); }   // real heart at its slot
    };
    if (dbl && totalLost > 0.5) {
      const [mHP, mAb] = subHP(oHP, oAb, 0.5);
      step(oHP, oAb, mHP, mAb);
      setTO(() => step(mHP, mAb, nHP, nAb), 650);
    } else {
      step(oHP, oAb, nHP, nAb);
    }
  }
  function sideStatus(s) {
    const off = s === 'c' ? B.cShieldOff : B.pShieldOff;
    const pois = s === 'c' ? B.cPoison : B.pPoison;
    const boom = (s === 'c' ? B.pendingOnC : B.pendingOnP).reduce((t, it) => t + it.amount, 0);
    let h = '';
    if (off > 0)  h += `<span class="stat stun">${WEAPON.shield}${off}</span>`;
    if (pois > 0) h += `<span class="stat pois">${ICON.skull}${pois}</span>`;
    if (boom > 0) h += `<span class="stat boom">${WEAPON.boomerang}${boom.toFixed(1)}</span>`;
    return h;
  }
  function renderStatus() {
    el('cpu-shield-status').innerHTML = sideStatus('c');
    el('player-status').innerHTML = sideStatus('p');
  }
  function manaBar(value, absorb) {
    let h = '';
    for (let k = 0; k < MANA_MAX; k++) h += `<span class="orb${k < value ? ' on' : ''}"></span>`;
    for (let k = 0; k < Math.round((absorb || 0) / 0.5); k++) h += `<span class="orb absorb on"></span>`; // one dark-blue orb per 0.5
    const num = value + (absorb > 0 ? `+${absorb}` : '');
    return `<span class="mana-label">MANA</span><span class="mana-orbs">${h}</span><span class="mana-num">${num}</span>`;
  }
  function renderMana() {
    el('player-mana').innerHTML = manaBar(B.pMana, B.pManaAbsorb);
    el('cpu-mana').innerHTML    = manaBar(B.cMana, B.cManaAbsorb);
    renderStatus();
  }
  // a round shield that gains crack lines as its durability drops (2 → 0)
  function shieldGlyph(hp) {
    const cracks = Math.min(4, Math.round((2 - hp) / 0.5));
    const cp = ['M12 3.5 11 9 13 12', 'M20.5 12 15 11 12.5 13.5', 'M12 20.5 13 15 11 12.5', 'M3.5 12 9 13 11.5 11'];
    let cr = '';
    for (let i = 0; i < cracks; i++) cr += `<path d="${cp[i]}" fill="none" stroke="currentColor" stroke-width="1" opacity=".7"/>`;
    return `<svg class="wic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="5.4" opacity=".45"/>${cr}</svg>`;
  }
  function renderShieldBtn() {
    const btn = el('btn-shield');
    const stunned = B.pShieldOff > 0;
    btn.classList.remove('chosen');
    btn.classList.toggle('stunned', stunned);
    btn.disabled = stunned || B.pDone;
    btn.innerHTML = stunned
      ? `<span class="sh-emoji">${shieldGlyph(0)}</span><span class="sh-stun">Stunned</span><span class="sh-dur">${B.pShieldOff} turn${B.pShieldOff === 1 ? '' : 's'}</span>`
      : `<span class="sh-emoji">${shieldGlyph(B.pShieldHP)}</span><span class="sh-label">Shield</span><span class="sh-cost">${B.pShieldHP}/2</span>`;
  }

  function endBattle(result) {
    B.phase = 'over';
    clearTimers();
    el('btn-rematch').style.display = B.mp ? 'none' : ''; // online rematch needs a fresh key — go Home instead
    const doubleKO = B.pHP <= 0 && B.cHP <= 0;
    const ov = el('overlay');
    if (result === 'win')  { el('result-title').innerHTML = `${CHROME.win} Victory!`;  el('result-sub').textContent = doubleKO ? 'Both fell — your faster weapon struck first!' : 'You knocked the opponent down to 0 hearts.'; sndWin(); }
    else if (result === 'lose') { el('result-title').innerHTML = `${CHROME.lose} Defeat`; el('result-sub').textContent = doubleKO ? 'Both fell — their weapon was faster.' : 'Your hearts ran out. Regroup and try again.'; sndLose(); }
    else { el('result-title').innerHTML = `${CHROME.draw} Draw`; el('result-sub').textContent = 'You both fell with the same weapon!'; }
    ov.classList.add('show');
  }

  /* ============================== WIRING ============================== */
  function init() {
    // home
    el('btn-battle').addEventListener('click', () => startBattle());
    el('btn-deck').addEventListener('click', openDeck);
    el('btn-help').addEventListener('click', () => el('help-modal').classList.add('show'));
    el('btn-help-close').addEventListener('click', () => el('help-modal').classList.remove('show'));

    // multiplayer
    el('btn-mp').addEventListener('click', openMP);
    el('btn-mp-host').addEventListener('click', mpHost);
    el('btn-mp-joinview').addEventListener('click', mpOpenJoin);
    el('btn-mp-join').addEventListener('click', mpJoin);
    el('btn-mp-choice-exit').addEventListener('click', mpCloseAll);
    el('btn-mp-host-exit').addEventListener('click', mpCloseAll);
    el('btn-mp-join-exit').addEventListener('click', mpCloseAll);
    el('mp-key-input').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
    el('mp-key-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') mpJoin(); });
    MP_POPUPS.forEach((id) => el(id).addEventListener('click', (e) => { if (e.target === el(id)) mpCloseAll(); })); // click backdrop to close

    // custom glyphs on the chrome buttons (no emoji)
    el('btn-battle').innerHTML = `${CHROME.battle} Battle`;
    el('btn-deck').innerHTML = `${CHROME.deck} Deck`;
    el('btn-mp').innerHTML = `${CHROME.online || ''} Multiplayer`;
    el('btn-help').innerHTML = `${CHROME.help} How to Play`;
    el('btn-battle-quit').innerHTML = `${CHROME.quit} Quit`;

    // opponent difficulty picker
    const diffWrap = el('diff-pick');
    const paintDiff = () => diffWrap.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('active', +b.dataset.lvl === State.difficulty));
    paintDiff();
    diffWrap.querySelectorAll('.diff-btn').forEach((b) => b.addEventListener('click', () => {
      State.difficulty = +b.dataset.lvl; saveDifficulty(); paintDiff();
    }));

    // deck
    el('btn-deck-back').addEventListener('click', () => showScreen('home'));
    el('btn-save-deck').addEventListener('click', saveDeck);

    // battle / overlay
    el('btn-battle-quit').addEventListener('click', () => { showScreen('home'); });
    el('btn-rematch').addEventListener('click', () => { if (B && B.mp) { el('overlay').classList.remove('show'); showScreen('home'); } else startBattle(); });
    el('btn-home').addEventListener('click', () => { el('overlay').classList.remove('show'); showScreen('home'); });

    // shield ability
    el('btn-shield').addEventListener('click', () => { if (B) commitPlayer('shield'); });

    // placement: drop a card onto the slot, or tap the slot with a raised card
    const slot = el('player-slot');
    slot.addEventListener('dragover', (e) => {
      if (!B || B.pDone) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move'; slot.classList.add('drop-hover');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-hover'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault(); slot.classList.remove('drop-hover', 'drop-ready');
      const id = e.dataTransfer.getData('text/plain');
      if (id) commitPlayer(id);
    });
    slot.addEventListener('click', () => { if (B && B.raised) commitPlayer(B.raised); });

    // mute
    const muteBtn = el('btn-mute');
    const paintMute = () => { muteBtn.innerHTML = State.muted ? CHROME.sndoff : CHROME.sndon; };
    paintMute();
    muteBtn.addEventListener('click', () => {
      State.muted = !State.muted; paintMute();
      try { localStorage.setItem('cardprediction_muted', State.muted ? '1' : '0'); } catch (e) {}
    });

    // keyboard: 1/2/3 raise a card (press again or Enter to place); S/4 = shield
    document.addEventListener('keydown', (e) => {
      if (!el('screen-battle').classList.contains('active') || !B || B.phase !== 'choosing' || B.pDone) return;
      if (e.key >= '1' && e.key <= '3') {
        const id = handIds(B.pDeck)[+e.key - 1];
        if (B.raised === id) commitPlayer(id); else raiseCard(id);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (B.raised) { e.preventDefault(); commitPlayer(B.raised); }
      } else if (e.key === 's' || e.key === 'S' || e.key === '4') {
        commitPlayer('shield');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
