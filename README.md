# Card Prediction — Weapon Duel

A web card game: an enhanced rock-paper-scissors where every card is a **weapon**.
Read your opponent, manage your **mana**, and exploit hard counters — with
Clash-Royale-style hand cycling, hearts, and a 15-second timer.

## Play
Just open **`index.html`** in any modern browser (double-click it). No build step, no server.

## Rules
- Each player has **3 hearts**. Reduce your opponent to 0 to win.
- Build a deck of **exactly 6 cards** (15 are available). You always hold **3**; play one and it cycles to the back.
- You have **5 mana**, regaining **+1 every round** (cap 5). Each card costs mana — some are **free**.
- Each round you have **15 seconds** to place a card **face-down**. Once both are down they **reveal instantly**.
- **Drag** a card onto your slot, or **tap** it to lift it then **tap the slot** to place it. (Keys `1/2/3` lift, `Enter` places, `S` shields.)

## The weapon web
Combat is decided by weapon **type**:

| Type | Beats | Loses to |
|------|-------|----------|
| **Projectile** 🏹 (bow, bomb, dart, boomerang, shuriken) | melee, hook | katana, reverse, shield |
| **Melee** ⚔️ (sword, axe, hammer, club, dagger) | katana, reverse, hook | projectile, shield |
| **Katana** 🗡️ (a melee that beats projectiles) | projectile, reverse, hook — **blocks the shot and cuts back ½❤** | melee, shield |
| **Uno Reverse** 🔄 | projectile — **deflects it back at the owner** | melee, katana, shield |
| **Shield** 🛡️ (always free, your whole turn) | melee, projectile, katana, reverse | the shield-breakers |
| **Hook** 🪝 (pure disabler, free) | **shield — disable it 1 turn** | every weapon |
| **Harpoon / R-Peg** 🔱📌 (**projectiles** that disable shields) | melee, hook, **shield (disable 2 / 3 turns)** | katana, reverse |

- **Same-type clashes are a stalemate**: both weapons still land. The **faster** card (**lower Speed**, 0–3 — lower is faster) deals its **full** damage; the slower one deals **half a heart less** (1.5→1, 1.0→0.5, 0.5→0). Equal speed = both reduced.
- **Battle Axe** is a melee that also **smashes a Shield for 3 turns** (like the shield-breakers).
- The **Shield** is an always-available ability (key `S`). Playing it is your *whole* turn — no other card. While disabled it can't be used.
- A Shield is an **absorption pool** (durability 2, regen +0.5/turn): it soaks damage up to its current durability. A hit bigger than that **breaks it** — the shield is **stunned 1 turn** and the **overflow damage gets through** to you.
- **Hook** costs **0 mana**, so you can always answer a turtling Shield. **Harpoon** and **R-Peg** behave as projectiles, so a **Katana blocks them** and an **Uno Reverse bounces them back** — and a blocked/reflected shield-breaker does **not** disable the shield.

## Project structure
```
Card Prediction/
├── index.html        # Markup + screens (Home / Deck / Battle)
├── README.md
├── css/
│   └── styles.css    # All styling: hearts, mana orbs, shield button, flip & timer animations
└── js/
    ├── cards.js      # Weapon data + the type-based combat resolution
    └── app.js        # Screens, deck builder, mana, shield, and the battle loop
```

Tips: keys **1/2/3** lift a hand card, **Enter** places it, **S** raises the Shield;
the **🔊** button toggles sound; your deck is saved in the browser.
