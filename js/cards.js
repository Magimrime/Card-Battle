/* ===========================================================================
   cards.js  —  Weapon data + combat resolution for "Card Prediction"
   ---------------------------------------------------------------------------
   Every card is a WEAPON. Combat is decided by weapon TYPE, in an extended
   rock-paper-scissors web:

       Projectile  beats  Melee        (you get shot before you close in)
       Melee       beats  Katana       (a katana misplayed into a melee loses)
       Katana      beats  Projectile   (it blocks the shot and cuts back)
       Reverse     beats  Projectile   (it deflects the shot back at the owner)
       Shield      blocks Melee/Projectile/Katana/Reverse  (no damage either way)
       Hook/Harpoon/R-Peg (disablers)  beat  Shield  (and disable it for 1/2/3 turns)

   The three attackers (melee / projectile / katana) lose to a Shield, but the
   Shield loses to the disablers. Disablers lose to every attacker. Same-type
   clashes are STALEMATES: both weapons land, but for HALF a heart less
   (1.5 -> 1, 1.0 -> 0.5, 0.5 -> 0).

   Damage is measured in hearts. Each card also costs MANA to play (0-3).
   ========================================================================= */
const CARDS = (function () {

  /* ---- the deckable weapons (Shield is a separate always-on ability) ---- */
  const list = [
    /* ----- MELEE ----- */
    { id: 'sword',  name: 'Sword',      emoji: '⚔️', type: 'melee', damage: 1.5,  mana: 2, speed: 1.2, c1: '#a9c0de', c2: '#33507f',
      desc: 'A reliable blade. Closes in and cuts down archers.' },
    { id: 'dagger', name: 'Dagger',     emoji: '🔪', type: 'melee', damage: 1.0,  mana: 1, speed: 0.8, c1: '#b0bcd0', c2: '#4a5a78',
      desc: 'Quick and cheap — the fastest blade in melee.' },
    { id: 'axe',    name: 'Battle Axe', emoji: '🪓', type: 'melee', damage: 2.5,  mana: 3, speed: 2.5, disableTurns: 3, pierceStun: 3, c1: '#ff9a4d', c2: '#d63420',
      desc: 'Heavy chops. Against a Shield it cleaves through for full damage (−0.5) and stuns it 3 turns.' },
    { id: 'hammer', name: 'Warhammer',  emoji: '🔨', type: 'melee', damage: 2.5,  mana: 2, speed: 2.6, c1: '#d0b184', c2: '#6f4f28',
      desc: 'Slow but devastating — the hardest hit (tied).' },
    { id: 'club',   name: 'Club',       emoji: '🏏', type: 'melee', damage: 1.5,  mana: 1, speed: 1.8, c1: '#cdd86f', c2: '#6f7a23',
      desc: 'Crude but cheap — a solid swing for little mana.' },

    /* ----- PROJECTILE ----- */
    { id: 'bow',       name: 'Bow',          emoji: '🏹', type: 'projectile', damage: 1.0,  mana: 2, speed: 1.2, c1: '#86e08a', c2: '#1f7a3c',
      desc: 'Strikes from range — melee never reaches you.' },
    { id: 'boomerang', name: 'Boomerang',    emoji: '🪃', type: 'projectile', damage: 0.5,  mana: 1, speed: 1.2, c1: '#f0b85a', c2: '#a85f1c',
      desc: 'Cheap thrown weapon. Returns next round for an extra 0.5 — cancelled if outsped.' },
    { id: 'dart',      name: 'Dart',         emoji: '🎯', type: 'projectile', damage: 0.5,  mana: 1, speed: 0.1, c1: '#86e3ff', c2: '#2a73b3',
      desc: 'A fast, light dart. Pokes for a little.' },
    { id: 'bomb',      name: 'Bomb',         emoji: '💣', type: 'projectile', damage: 1.5,  mana: 3, speed: 2.3, c1: '#ff8a8a', c2: '#8e1414',
      desc: 'A lobbed explosive. Biggest ranged blast, slow lob.' },
    { id: 'shuriken',  name: 'Shuriken',     emoji: '✴️', type: 'projectile', damage: 1.0,  mana: 1, speed: 1.2, double: true, c1: '#b0e0c0', c2: '#2f7a5c',
      desc: 'Spinning steel — a double strike: 0.5 at speed 1.2, then 0.5 at speed 2.2 (same round).' },
    { id: 'minigun',   name: 'Minigun',      emoji: '🔫', type: 'projectile', damage: 0.5,  mana: 3, speed: 1.5, charges: true, c1: '#9aa0b8', c2: '#3a3f57',
      desc: 'First use deploys it — no damage and you are defenseless that turn (weak to anything). It stays in your hand gaining +0.5 damage each turn; play it again to fire it all as a projectile. Blocked/reflected = wasted.' },

    /* ----- SPECIAL ----- */
    { id: 'katana',  name: 'Katana',      emoji: '🗡️', type: 'katana',   damage: 0.5,  mana: 2, speed: 0.9, c1: '#ff7a7a', c2: '#7a1414',
      desc: 'Blocks any projectile and cuts back for ½ ❤. But a real melee beats it.' },
    { id: 'reverse', name: 'Uno Reverse', emoji: '🔄', type: 'reverse',  damage: 0,    mana: 3, speed: 0, c1: '#ffd23d', c2: '#d63420',
      desc: 'Infinitely fast. Deflects an enemy projectile back at them. Useless against melee.' },
    { id: 'hook',    name: 'Hook',        emoji: '🪝', type: 'disabler',   damage: 0.5,  mana: 0, speed: 0, disableTurns: 1, c1: '#9fb0c8', c2: '#46566f',
      desc: 'Free! Rips through a Shield and disables it for 1 turn. Loses to any weapon.' },
    { id: 'harpoon', name: 'Harpoon',     emoji: '🔱', type: 'projectile', damage: 1.0,  mana: 2, speed: 1.7, disableTurns: 2, c1: '#7fd0a8', c2: '#1f6b4a',
      desc: 'A thrown projectile that pierces a Shield and disables it for 2 turns.' },
    { id: 'rpeg',    name: 'R-Peg',       emoji: '📌', type: 'projectile', damage: 1.5,  mana: 3, speed: 2.6, disableTurns: 3, c1: '#86c4e3', c2: '#2a5fb3',
      desc: 'A launched projectile that pins a Shield and disables it for 3 turns.' },

    /* ----- SPELL (speed 0 = infinite/fastest) ----- */
    { id: 'poison',   name: 'Poison',   emoji: '☠️', type: 'poison', damage: 0.5, ticks: 4, mana: 3, speed: 0, c1: '#9be36b', c2: '#3a6b1f',
      desc: 'Poison cloud: 0.5/turn for 4 turns. Trades vs melee/projectile; bypasses shields & hooks; loses to katana (−1) & reverse.' },
    { id: 'damage',   name: 'Damage',   emoji: '✨', type: 'damage', damage: 1.5, mana: 3, speed: 0, c1: '#ff7ad0', c2: '#7a1466',
      desc: 'Bolt of 1.5. Trades vs melee/projectile; bypasses shields & hooks. Katana blocks (−1); Reverse bounces for 2.' },
    { id: 'heal',     name: 'Heal',     emoji: '💚', type: 'spell', spell: 'heal',     damage: 0, mana: 1, speed: 0, c1: '#7be0a0', c2: '#1f7a4a',
      desc: '+1 heart. At full HP it adds a 0.5 golden absorption heart (max 5). Defenseless this turn.' },
    { id: 'mana',     name: 'Mana',     emoji: '🔷', type: 'spell', spell: 'mana',     damage: 0, mana: 0, speed: 0, c1: '#7fb0ff', c2: '#2a3fa0',
      desc: 'Free. Grants +1 mana. Uses your whole turn, so any weapon hits you.' },
    { id: 'speed',    name: 'Speed',    emoji: '⚡', type: 'spell', spell: 'speed',    damage: 0, mana: 1, speed: 0, c1: '#ffe27a', c2: '#b9821c',
      desc: 'Your next card is 1 speed faster. Defenseless this turn.' },
    { id: 'strength', name: 'Strength', emoji: '💪', type: 'spell', spell: 'strength', damage: 0, mana: 1, speed: 0, c1: '#ff9f6b', c2: '#a8431c',
      desc: 'Your next card deals +1 damage. Defenseless this turn.' },
  ];

  /* ---- the Shield: an always-available ability, never in the deck ---- */
  const SHIELD = { id: 'shield', name: 'Shield', emoji: '🛡️', type: 'shield', damage: 0, mana: 0, speed: 2.0,
    c1: '#88dbd4', c2: '#236d70', desc: 'Absorbs damage up to its durability; a bigger hit breaks it and the overflow hits you. Using it is your whole turn.' };

  /* ---- an empty slot: played when you can afford nothing & your shield is stunned ---- */
  const NONE = { id: 'none', name: 'No card', emoji: '✕', type: 'broken', damage: 0, mana: 0, speed: 9,
    c1: '#3a4060', c2: '#222742', desc: 'Empty slot — fully exposed.' };

  const idx = {};
  list.forEach((c, i) => { c.index = i; idx[c.id] = c; });
  idx[SHIELD.id] = SHIELD;
  idx[NONE.id] = NONE;

  function byId(id) { return idx[id]; }

  /* ---- type-level rock-paper-scissors web ---- */
  const TYPE_EMOJI = {
    melee: '⚔️', projectile: '🏹', katana: '🗡️',
    reverse: '🔄', shield: '🛡️', disabler: '🪝',
  };
  // what each type beats (different-type matchups)
  const WINS = {
    projectile: ['melee', 'disabler'],
    melee:      ['katana', 'reverse', 'disabler'],
    katana:     ['projectile', 'reverse', 'disabler'],
    reverse:    ['projectile'],
    shield:     ['melee', 'projectile', 'katana', 'reverse'],
    disabler:   ['shield'],
    broken:     [], // a Shield that has been disabled — defends nothing
  };

  function typeBeats(t1, t2) {
    if (t2 === 'broken') return t1 === 'melee' || t1 === 'projectile' || t1 === 'katana' || t1 === 'disabler';
    return !!(WINS[t1] && WINS[t1].indexOf(t2) >= 0);
  }

  const reduce = (d) => Math.max(0, +(d - 0.5).toFixed(2)); // a reduced hit: half a heart less

  // a card's strikes as [damage, speed] pairs — Shuriken strikes twice (0.5@0.8, then 0.5@1.8)
  function strikesOf(card, bonus) { bonus = bonus || 0; return card.double ? [[0.5 + bonus, 1.2], [0.5, 2.2]] : [[card.damage + bonus, card.speed]]; }
  function repSpeed(card)  { return card.double ? 1.2 : card.speed; }   // the card's fastest strike
  // one strike vs the opponent's speed (lower speed = faster): faster lands full, ≥1 slower is avoided
  function strikeDmg(sStrike, sOpp, d) {
    const gap = +(sStrike - sOpp).toFixed(2);  // > 0 means this strike is the slower one
    if (gap >= 1) return 0;                     // a full point slower → fully avoided
    if (gap >= 0.5) return reduce(d);           // 0.5–1 slower → reduced ½ ❤
    return d;                                   // faster, tied, or < 0.5 slower → full damage
  }

  /* ---------------------------------------------------------------------
     resolve(p, c, pShieldDead, cShieldDead)
     p = player's card, c = cpu's card. The two booleans mark a Shield that
     was already disabled (so it shields nothing this turn).

     Returns, from the PLAYER's point of view:
       pTake / cTake   — hearts of damage taken by player / cpu
       pShieldHit      — durability the PLAYER's shield lost this turn (it blocked, 0 HP)
       cShieldHit      — durability the CPU's shield lost this turn
       winner          — 'p' | 'c' | 'tie'
       reflect         — 'p' | 'c' | null   (a reverse bounced a projectile)
       broke           — 'p' | 'c' | null   (whose shield got smashed this turn)
  --------------------------------------------------------------------- */
  function resolve(p, c, pShieldDead, cShieldDead, mods) {
    mods = mods || {};
    const pSpd = mods.pSpd || 0, cSpd = mods.cSpd || 0, pDmg = mods.pDmg || 0, cDmg = mods.cDmg || 0;
    const pShieldHP = mods.pShieldHP != null ? mods.pShieldHP : 2; // current shield durability (for absorption overflow)
    const cShieldHP = mods.cShieldHP != null ? mods.cShieldHP : 2;

    // effective types: a disabled Shield or any utility spell is "broken" (defenseless this turn)
    let pt = (p.type === 'shield' && pShieldDead) ? 'broken' : p.type;
    let ct = (c.type === 'shield' && cShieldDead) ? 'broken' : c.type;
    if (p.spell) pt = 'broken';
    if (c.spell) ct = 'broken';

    const out = {
      pTake: 0, cTake: 0, winner: 'tie', reflect: null, broke: null, faster: null,
      pShieldHit: 0, cShieldHit: 0, pShieldStun: 0, cShieldStun: 0,
      pPoison: 0, cPoison: 0, pSpell: p.spell || null, cSpell: c.spell || null,
    };

    // ---------- OFFENSIVE SPELLS: Poison (damage-over-time) & Damage (burst) ----------
    const pOff = pt === 'poison' || pt === 'damage';
    const cOff = ct === 'poison' || ct === 'damage';
    if (pOff || cOff) {
      const payload = (sp, casterIsP, bonus) => {       // land the spell's payload on the OTHER side
        if (sp.type === 'poison') { if (casterIsP) out.cPoison = sp.ticks; else out.pPoison = sp.ticks; }
        else { if (casterIsP) out.cTake += sp.damage + bonus; else out.pTake += sp.damage + bonus; }
      };
      const take = (amt, casterIsP) => { if (casterIsP) out.pTake += amt; else out.cTake += amt; }; // caster takes
      const reflectSelf = (sp, casterIsP) => { if (sp.type === 'poison') { if (casterIsP) out.pPoison = sp.ticks; else out.cPoison = sp.ticks; } };

      if (pOff && cOff) {                                // mirror: both land their payload
        payload(p, true, pDmg); payload(c, false, cDmg); out.winner = 'tie';
      } else {
        const casterIsP = pOff, sp = pOff ? p : c, oppCard = pOff ? c : p, opp = pOff ? ct : pt;
        const myDmg = casterIsP ? pDmg : cDmg, oppDmg = casterIsP ? cDmg : pDmg;
        if (opp === 'katana')          { take(1, casterIsP); out.winner = casterIsP ? 'c' : 'p'; }       // katana blocks, cuts 1
        else if (opp === 'reverse')    {                                                                  // bounced back
          if (sp.type === 'damage') take(2, casterIsP);
          else { reflectSelf(sp, casterIsP); take(0.5, casterIsP); }                                      // poison reflected + 0.5 now
          out.winner = casterIsP ? 'c' : 'p';
        }
        else if (opp === 'projectile') { payload(sp, casterIsP, myDmg); take(oppCard.damage + oppDmg, casterIsP); out.winner = 'tie'; }              // trade (full)
        else if (opp === 'melee')      { payload(sp, casterIsP, myDmg); take(Math.max(0, oppCard.damage + oppDmg - 1), casterIsP); out.winner = 'tie'; } // trade (melee −1)
        else                           { payload(sp, casterIsP, myDmg); out.winner = casterIsP ? 'p' : 'c'; }                                        // shield/hook/broken/spell
      }
      out.pTake = +out.pTake.toFixed(2); out.cTake = +out.cTake.toFixed(2);
      return out;
    }

    // ---------- SHIELD: an absorption pool ----------
    // It soaks damage up to its current durability; anything beyond breaks it and the OVERFLOW
    // is dealt to the player. Returns [durabilityLost, overflow]. Reverse/spells don't touch it;
    // disablers chip durability (then a 0-durability shield breaks → stunned).
    const shieldAbsorb = (card, buff, sh) => {
      if (card.disableTurns) return [card.disableTurns, 0];            // hook 1 · harpoon 2 · r-peg 3
      if (card.type === 'reverse' || card.type === 'shield' || card.spell || card.id === 'none') return [0, 0];
      const dmg = card.damage + (buff || 0);                          // melee/projectile/katana
      const soak = Math.min(dmg, sh);
      return [soak, +(dmg - soak).toFixed(2)];
    };
    if (pt === 'shield' || ct === 'shield') {
      out.winner = 'tie';
      if (pt === 'shield' && ct !== 'shield') {
        if (c.pierceStun) { out.pTake = Math.max(0, +(c.damage + cDmg - 0.5).toFixed(2)); out.pShieldStun = c.pierceStun; out.winner = 'c'; } // axe cleaves through
        else { const [hit, over] = shieldAbsorb(c, cDmg, pShieldHP); out.pShieldHit = hit; out.pTake = over; if (over > 0) out.winner = 'c'; }
      } else if (ct === 'shield' && pt !== 'shield') {
        if (p.pierceStun) { out.cTake = Math.max(0, +(p.damage + pDmg - 0.5).toFixed(2)); out.cShieldStun = p.pierceStun; out.winner = 'p'; }
        else { const [hit, over] = shieldAbsorb(p, pDmg, cShieldHP); out.cShieldHit = hit; out.cTake = over; if (over > 0) out.winner = 'p'; }
      }
      return out;
    }

    // ---------- weapon vs weapon ----------
    const pDmgEff = p.damage + pDmg, cDmgEff = c.damage + cDmg;
    if (typeBeats(pt, ct)) {                                 // player's weapon wins
      out.winner = 'p';
      if (pt === 'reverse' && ct === 'projectile') { out.cTake = cDmgEff; out.reflect = 'p'; }
      else out.cTake = pDmgEff;
    } else if (typeBeats(ct, pt)) {                          // cpu's weapon wins
      out.winner = 'c';
      if (ct === 'reverse' && pt === 'projectile') { out.pTake = pDmgEff; out.reflect = 'c'; }
      else out.pTake = cDmgEff;
    } else {                                                 // stalemate — speed decides: ≥1 faster fully avoids the slower hit
      const pRep = repSpeed(p) - pSpd, cRep = repSpeed(c) - cSpd;
      out.cTake = strikesOf(p, pDmg).reduce((s, st) => s + strikeDmg(st[1] - pSpd, cRep, st[0]), 0);
      out.pTake = strikesOf(c, cDmg).reduce((s, st) => s + strikeDmg(st[1] - cSpd, pRep, st[0]), 0);
      out.faster = pRep < cRep ? 'p' : (cRep < pRep ? 'c' : null);
    }
    out.pTake = +out.pTake.toFixed(2); out.cTake = +out.cTake.toFixed(2);
    return out;
  }

  /* ---- helpers for the deck builder / hand cards ---- */
  // Shield-breakers beat the Shield regardless of their base type, so fold
  // that into the displayed strong/weak lists.
  function strongVs(card) {
    if (card.type === 'poison' || card.type === 'damage') return ['projectile', 'melee', 'shield', 'disabler'];
    if (card.type === 'spell')  return [];                  // utility spells beat nothing
    const out = Object.keys(WINS).filter((t) => t !== 'broken' && typeBeats(card.type, t));
    if (card.disableTurns && out.indexOf('shield') < 0) out.push('shield');
    return out;
  }
  function weakVs(card) {
    if (card.type === 'poison' || card.type === 'damage') return ['katana', 'reverse', 'projectile'];
    if (card.type === 'spell')  return ['melee', 'projectile', 'katana', 'reverse', 'shield', 'disabler'];
    let out = Object.keys(WINS).filter((t) => t !== 'broken' && typeBeats(t, card.type));
    if (card.disableTurns) out = out.filter((t) => t !== 'shield');
    return out;
  }

  return { list, SHIELD, byId, typeBeats, resolve, reduce, strongVs, weakVs, TYPE_EMOJI };
})();
