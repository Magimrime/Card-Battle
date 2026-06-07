/* Card Prediction — multiplayer relay as a Netlify Function.
   Mirrors serve.js's /mp/* endpoints, but state lives in Netlify Blobs (serverless functions
   can't hold rooms in memory). Each blob is written by exactly one party, so there are no races:
     room:<key>            { hostDeck, ts }     — written once by the host
     guest:<key>           { guestDeck }        — written once by the guest
     mv:<key>:<role>:<rnd> "<cardId>"           — written once by that player, that round
   The browser client is unchanged: it still calls /mp/host, /mp/join, /mp/joined, /mp/move. */
import { getStore } from '@netlify/blobs';

const KEY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newKey = () => Array.from({ length: 4 }, () => KEY_CHARS[(Math.random() * KEY_CHARS.length) | 0]).join('');
const json = (obj, statusCode = 200) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  const store = getStore('cardprediction-mp');
  const q = event.queryStringParameters || {};
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

  // find which action this is, regardless of how Netlify rewrote the path
  const known = ['joined', 'host', 'join', 'move'];
  const action = event.path.split('/').filter(Boolean).reverse().find((p) => known.includes(p));
  const post = event.httpMethod === 'POST';

  if (action === 'host' && post) {
    const key = newKey();
    await store.setJSON('room:' + key, { hostDeck: body.deck || [], ts: Date.now() });
    return json({ key });
  }

  if (action === 'join' && post) {
    const room = await store.get('room:' + body.key, { type: 'json' });
    if (!room) return json({ ok: false, error: 'No game with that key.' });
    if (await store.get('guest:' + body.key)) return json({ ok: false, error: 'That game is already full.' });
    await store.setJSON('guest:' + body.key, { guestDeck: body.deck || [] });
    return json({ ok: true, oppDeck: room.hostDeck });
  }

  if (action === 'joined') {
    const room = await store.get('room:' + q.key, { type: 'json' });
    if (!room) return json({ gone: true });
    const g = await store.get('guest:' + q.key, { type: 'json' });
    return json({ joined: !!g, oppDeck: g ? g.guestDeck : null });
  }

  if (action === 'move' && post) {
    if (!(await store.get('room:' + body.key))) return json({ gone: true });
    await store.set(`mv:${body.key}:${body.role}:${body.round}`, String(body.card));
    return json({ ok: true });
  }

  if (action === 'move') {
    if (!(await store.get('room:' + q.key))) return json({ gone: true });
    const opp = q.role === 'host' ? 'guest' : 'host';
    const card = await store.get(`mv:${q.key}:${opp}:${q.round}`);
    return json({ card: card == null ? null : card });
  }

  return json({ error: 'unknown' }, 404);
};
