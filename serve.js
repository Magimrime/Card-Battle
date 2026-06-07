/* Static dev server for Card Prediction + a tiny in-memory multiplayer relay.
   Run:  node serve.js  → http://localhost:8080
   Multiplayer is "lockstep": each client runs the same deterministic battle and
   the server only relays the 4-char room key, the shuffled decks, and per-round moves. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg',
};

/* ---------------- multiplayer relay ---------------- */
const rooms = {};                                   // key -> { hostDeck, guestDeck, hostMoves, guestMoves, ts }
const KEY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newKey() { let k = ''; for (let i = 0; i < 4; i++) k += KEY_CHARS[Math.random() * KEY_CHARS.length | 0]; return rooms[k] ? newKey() : k; }
function prune() { const now = Date.now(); for (const k in rooms) if (now - rooms[k].ts > 1800000) delete rooms[k]; }
const sendJSON = (res, obj, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
function readBody(req, cb) { let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => { try { cb(JSON.parse(d || '{}')); } catch (e) { cb({}); } }); }

function handleMP(req, res, pathname, q) {
  prune();
  if (pathname === '/mp/host' && req.method === 'POST') {
    return readBody(req, (b) => { const key = newKey(); rooms[key] = { hostDeck: b.deck || [], guestDeck: null, hostMoves: {}, guestMoves: {}, ts: Date.now() }; sendJSON(res, { key }); });
  }
  if (pathname === '/mp/join' && req.method === 'POST') {
    return readBody(req, (b) => {
      const r = rooms[b.key];
      if (!r) return sendJSON(res, { ok: false, error: 'No game with that key.' });
      if (r.guestDeck) return sendJSON(res, { ok: false, error: 'That game is already full.' });
      r.guestDeck = b.deck || []; r.startAt = Date.now() + 2500; r.ts = Date.now(); // shared kickoff moment
      sendJSON(res, { ok: true, oppDeck: r.hostDeck, startAt: r.startAt });
    });
  }
  if (pathname === '/mp/joined') { const r = rooms[q.get('key')]; return sendJSON(res, r ? { joined: !!r.guestDeck, oppDeck: r.guestDeck, startAt: r.startAt } : { gone: true }); }
  if (pathname === '/mp/move' && req.method === 'POST') {
    return readBody(req, (b) => { const r = rooms[b.key]; if (!r) return sendJSON(res, { gone: true }); r[(b.role === 'host' ? 'host' : 'guest') + 'Moves'][b.round] = b.card; r.ts = Date.now(); sendJSON(res, { ok: true }); });
  }
  if (pathname === '/mp/move') {
    const r = rooms[q.get('key')]; if (!r) return sendJSON(res, { gone: true });
    const opp = q.get('role') === 'host' ? 'guest' : 'host';
    const card = r[opp + 'Moves'][q.get('round')];
    return sendJSON(res, { card: card == null ? null : card });
  }
  return sendJSON(res, { error: 'unknown' }, 404);
}

/* ---------------- server ---------------- */
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/mp/')) return handleMP(req, res, u.pathname, u.searchParams);

  let url = decodeURIComponent(u.pathname);
  if (url === '/') url = '/index.html';
  const file = path.join(ROOT, path.normalize(url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Card Prediction running on http://localhost:' + PORT));
