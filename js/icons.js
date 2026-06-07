/* ===========================================================================
   icons.js  —  every custom inline-SVG glyph (no stock emoji anywhere)
   ---------------------------------------------------------------------------
   ICON      — small UI symbols: damage, speed, beats/lose, result markers, heart
   WEAPON    — one glyph per card id (card faces, banners, card backs)
   CHROME    — chrome glyphs: home/quit buttons, mute toggle, result titles
   cardIcon  — glyph for a given card · TYPE_ICON — glyph per weapon family
   Exposed as globals (same pattern as cards.js → CARDS) so app.js can use them.
   ========================================================================= */

/* small UI symbols (inherit currentColor; sized via the .ic CSS rule) */
function svg(inner, cls) { return `<svg class="${cls || 'ic'}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`; }
const ICON = {
  dmg:     svg('<path d="M12 2l2.5 6.5L21 9l-5 4.3L17.7 21 12 17.2 6.3 21 8 13.3 3 9l6.5-.5z" fill="currentColor"/>', 'ic ic-dmg'),
  speed:   svg('<circle cx="12" cy="13.2" r="7.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 13.2V9M9.7 2.6h4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  up:      svg('<path d="M5 15l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  down:    svg('<path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  beat:    svg('<path d="M8 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  clash:   svg('<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  block:   svg('<path d="M12 2.5l7.5 2.8v5.7c0 4.6-3.2 8-7.5 10.5C7.7 19 4.5 15.6 4.5 11V5.3z" fill="none" stroke="currentColor" stroke-width="2"/>'),
  reverse: svg('<path d="M4.7 12a7.3 7.3 0 0 1 12.4-5.2M19.3 12a7.3 7.3 0 0 1-12.4 5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M17.5 3.4V7H14M6.5 20.6V17H10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  bolt:    svg('<path d="M13 2L5 13.5h5.2L9 22l9-12.5h-5.3z" fill="currentColor"/>'),
  heart:   svg('<path d="M12 21l-1.45-1.32C5.4 15 2 12 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.5-3.4 6.5-8.55 11.18z" fill="currentColor"/>', 'ic ic-h'),
  none:    svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.6 5.6l12.8 12.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  skull:   svg('<path d="M12 3c-3.9 0-6.4 2.6-6.4 6 0 2 .9 3.3 1.8 4.2.5.5.7.9.7 1.6V16a1 1 0 0 0 1 1h.4v1.6a.9.9 0 0 0 .9.9h.3V17h2.6v2.5h.3a.9.9 0 0 0 .9-.9V17H17a1 1 0 0 0 1-1v-1.2c0-.7.2-1.1.7-1.6.9-.9 1.8-2.2 1.8-4.2 0-3.4-2.5-6-6.5-6z" fill="currentColor"/><circle cx="9.4" cy="10.6" r="1.7" fill="#10162e"/><circle cx="14.6" cy="10.6" r="1.7" fill="#10162e"/>', 'ic'),
};

/* one custom glyph per card id (sized via the .wic CSS rule) */
function wsvg(inner) { return `<svg class="wic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`; }
const WEAPON = {
  sword:     wsvg('<path d="M12 2l1.7 3.6-.7 8h-2l-.7-8z" fill="currentColor" stroke="none"/><path d="M8 14h8M12 14v5M10.5 19.5h3"/>'),
  dagger:    wsvg('<path d="M12 5l1.5 2.8-.6 5.2h-1.8l-.6-5.2z" fill="currentColor" stroke="none"/><path d="M9.5 13h5M12 13v3.6M10.6 16.6h2.8"/>'),
  axe:       wsvg('<path d="M12 20.5V9.6" stroke-width="2.4"/><path d="M12 10c-3-.3-5.4-1.5-6.5-3.4C6.6 4.9 9 4 12 4s5.4.9 6.5 2.6C17.4 8.5 15 9.7 12 10z" fill="currentColor" stroke="none"/>'),
  hammer:    wsvg('<path d="M6.6 6.4c0-.9.7-1.6 1.6-1.6h7.6c.9 0 1.6.7 1.6 1.6v2.2c0 .9-.7 1.6-1.6 1.6H8.2c-.9 0-1.6-.7-1.6-1.6z" fill="currentColor" stroke="none"/><path d="M12 10.2V20" stroke-width="2"/>'),
  club:      wsvg('<path d="M12 2.8c1.6 0 2.8 1.4 3 3.4.3 2.8-.4 5.3-1.2 7.8-.6 2-.9 4-.9 6.5h-1.8c0-2.5-.3-4.5-.9-6.5-.8-2.5-1.5-5-1.2-7.8.2-2 1.4-3.4 3-3.4z" fill="currentColor" stroke="none"/><path d="M14.8 5.4 17.5 4.4 14.9 7.1z" fill="currentColor" stroke="none"/><path d="M9.2 5.4 6.5 4.4 9.1 7.1z" fill="currentColor" stroke="none"/><path d="M14.6 8.7 17.2 8.3 14.7 10.4z" fill="currentColor" stroke="none"/><path d="M9.4 8.7 6.8 8.3 9.3 10.4z" fill="currentColor" stroke="none"/>'),
  bow:       wsvg('<path d="M9 2.5C4.5 6 4.5 18 9 21.5" stroke-width="2.1"/><path d="M9 2.5c1.7.5 2.4 1.6 2.1 3.1M9 21.5c1.7-.5 2.4-1.6 2.1-3.1"/><path d="M9 2.9 9 21.1" opacity=".45"/><path d="M7.6 12H19"/><path d="M15 8.7 19 12l-4 3.3"/><path d="M7.6 10.4 6 12l1.6 1.6"/>'),
  boomerang: wsvg('<path d="M6 4.5l4.6 9.4L20 18" stroke-width="2.6"/>'),
  dart:      wsvg('<path d="M6 18 16 8" stroke-width="1.9"/><path d="M19 5 17.4 9.8 14.2 6.6z" fill="currentColor" stroke="none"/><path d="M4.6 16.4l3.6 3.6M6.6 14.4l3.6 3.6" stroke-width="1.6"/>'),
  bomb:      wsvg('<circle cx="11" cy="15" r="5.6" fill="currentColor" stroke="none"/><path d="M14.6 9.6c.8-2.6 2.1-3.9 4.1-3.9"/><path d="M18.6 4.5l1-.8M19.8 5.5l1-.1M19 6.6l.3 1.1" stroke-width="1.5"/>'),
  shuriken:  wsvg('<path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z" fill="currentColor" stroke="none"/>'),
  minigun:   wsvg('<rect x="3" y="9.4" width="7.6" height="6" rx="1.4" fill="currentColor" stroke="none"/><path d="M10.6 11h9.4M10.6 12.5h9.4M10.6 14h9.4" stroke-width="1.4"/><path d="M6 15.4 5 19"/>'),
  katana:    wsvg('<path d="M7 17C11 15 16 9 19.4 4.2"/><path d="M19.4 4.2l-3 .5.6 2.9"/><path d="M5.3 18.6l3.2-1.4" stroke-width="1.6"/><path d="M3.8 20.2 6.6 17.4" stroke-width="2.7"/>'),
  reverse:   wsvg('<path d="M4.7 12a7.3 7.3 0 0 1 12.4-5.2M19.3 12a7.3 7.3 0 0 1-12.4 5.2"/><path d="M17.6 3.4V7H14M6.4 20.6V17H10"/>'),
  hook:      wsvg('<path d="M13 4v8a3.5 3.5 0 1 1-3.5-3.5"/><path d="M11 4h4"/>'),
  harpoon:   wsvg('<path d="M12 21V7.2"/><path d="M12 7.2c-1.6 1-2.6 2.4-2.9 4M12 7.2c1.6 1 2.6 2.4 2.9 4"/><path d="M12 2.4l2.7 4.7H9.3z" fill="currentColor" stroke="none"/>'),
  rpeg:      wsvg('<g transform="rotate(-16 11 12)"><rect x="3.5" y="10" width="13" height="4.4" rx="2.2"/><path d="M15.6 10.2 15.6 14.2 20 12.2z" fill="currentColor" stroke="none"/><path d="M6.8 14.4 6.8 17.8" stroke-width="2"/><path d="M2.6 12.2 1.2 12M2.8 14 1.4 14.6" stroke-width="1.4"/></g>'),
  shield:    wsvg('<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="5.2" opacity=".5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
  back:      wsvg('<circle cx="3.4" cy="20.6" r="1.1" fill="currentColor" stroke="none"/><path d="M3.8 20.2 8 16" stroke-width="2.6"/><path d="M6 18.3 9.5 14.8" stroke-width="1.7"/><path d="M8 16 19.7 4.3"/><path d="M17.4 6.6 19.8 4.2 17.6 8.4z" fill="currentColor" stroke="none"/><circle cx="20.6" cy="20.6" r="1.1" fill="currentColor" stroke="none"/><path d="M20.2 20.2 16 16" stroke-width="2.6"/><path d="M18 18.3 14.5 14.8" stroke-width="1.7"/><path d="M16 16 4.3 4.3"/><path d="M6.6 6.6 4.2 4.2 6.4 8.4z" fill="currentColor" stroke="none"/>'),
  poison:    wsvg('<path d="M10 3h4M11 3.5v3.5L7.3 15.4A3 3 0 0 0 10 20h4a3 3 0 0 0 2.7-4.6L13 7V3.5"/><circle cx="11" cy="15.2" r="1" fill="currentColor" stroke="none"/><circle cx="13.8" cy="17" r=".8" fill="currentColor" stroke="none"/>'),
  heal:      wsvg('<rect x="4.5" y="4.5" width="15" height="15" rx="4"/><path d="M12 8.5v7M8.5 12h7" stroke-width="2.4"/>'),
  mana:      wsvg('<path d="M12 2.5 18.5 9 12 21.5 5.5 9z" fill="currentColor" fill-opacity=".18"/><path d="M12 2.5 18.5 9 12 21.5 5.5 9z"/><path d="M5.5 9h13M12 2.5 9.5 9l2.5 12.5M12 2.5 14.5 9 12 21.5"/>'),
  speed:     wsvg('<path d="M13 2.5 5.5 13.5H10l-1 8 8.5-12H13z" fill="currentColor" stroke="none"/>'),
  strength:  wsvg('<path d="M7 6.5v11M4.5 9v6M17 6.5v11M19.5 9v6M7 12h10"/>'),
  damage:    wsvg('<path d="M11 3l1.5 5.2 5.2 1.5-5.2 1.5L11 16.5 9.5 11.3 4.3 9.8 9.5 8.3z" fill="currentColor" stroke="none"/><path d="M17 13.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" fill="currentColor" stroke="none"/>'),
};
function cardIcon(card) { return card.id === 'none' ? ICON.none : (WEAPON[card.id] || ''); }
const TYPE_ICON = { melee: WEAPON.sword, projectile: WEAPON.bow, katana: WEAPON.katana, reverse: WEAPON.reverse, shield: WEAPON.shield, disabler: WEAPON.hook };

/* chrome glyphs: buttons, mute toggle, result titles */
const CHROME = {
  battle: WEAPON.sword,
  deck:   wsvg('<rect x="4" y="6" width="9" height="13" rx="1.6" transform="rotate(-9 8.5 12.5)"/><rect x="10.5" y="5" width="9" height="13" rx="1.6" transform="rotate(9 15 11.5)"/>'),
  help:   wsvg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.4 2.4 0 1 1 3.4 2.3c-.9.4-1.3 .9-1.3 1.9"/><circle cx="11.7" cy="16.8" r=".7" fill="currentColor" stroke="none"/>'),
  quit:   wsvg('<path d="M13 4H6.2A1.7 1.7 0 0 0 4.5 5.7v12.6A1.7 1.7 0 0 0 6.2 20H13"/><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5"/>'),
  sndon:  wsvg('<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z" fill="currentColor" stroke="none"/><path d="M16 9.2a4.3 4.3 0 0 1 0 5.6M18.6 6.6a8 8 0 0 1 0 10.8"/>'),
  sndoff: wsvg('<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z" fill="currentColor" stroke="none"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>'),
  win:    wsvg('<path d="M7 4h10v3a5 5 0 0 1-10 0z" fill="currentColor" stroke="none"/><path d="M7 5H4.5v1A3.5 3.5 0 0 0 8 9.5M17 5h2.5v1A3.5 3.5 0 0 1 16 9.5"/><path d="M12 12v3.5M8.5 20h7M9.6 20l.5-4.4h3.8l.5 4.4"/>'),
  lose:   wsvg('<path d="M5 11a7 7 0 0 1 14 0v2.6a2.4 2.4 0 0 1-1.7 2.3V19a1 1 0 0 1-1 1H7.7a1 1 0 0 1-1-1v-2.1A2.4 2.4 0 0 1 5 13.6z"/><circle cx="9.3" cy="11.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.7" cy="11.6" r="1.5" fill="currentColor" stroke="none"/><path d="M9.5 20v-1.8M12 20v-1.8M14.5 20v-1.8"/>'),
  draw:   wsvg('<path d="M4 9.5h16M4 14.5h16"/>'),
  online: wsvg('<circle cx="8.5" cy="8" r="2.6"/><circle cx="15.5" cy="8" r="2.6"/><path d="M3.5 18.4c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6M13 18.4c.1-2.8 2.3-4.6 5-4.6 1.1 0 2.1.3 2.9.8"/>'),
};
