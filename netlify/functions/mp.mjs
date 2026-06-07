/* Card Prediction — multiplayer relay (Netlify Functions v2).
   v2 (export default / Request-Response) runs in the runtime that auto-injects the Netlify Blobs
   context, so getStore() works with no manual siteID/token. State lives in Blobs; each blob is
   written by exactly one party, so there are no races:
     room:<key>            { hostDeck, ts }     — written once by the host
     guest:<key>           { guestDeck }        — written once by the guest
     mv:<key>:<role>:<rnd> "<cardId>"           — written once by that player, that round
   The browser client is unchanged: /mp/host, /mp/join, /mp/joined, /mp/move (+ /mp/health self-test). */
import { getStore } from '@netlify/blobs';

const KEY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newKey = () => Array.from({ length: 4 }, () => KEY_CHARS[(Math.random() * KEY_CHARS.length) | 0]).join('');
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export default async (req) => {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const known = ['joined', 'host', 'join', 'move', 'health'];
    const action = url.pathname.split('/').filter(Boolean).reverse().find((p) => known.includes(p));
    const post = req.method === 'POST';
    let body = {};
    if (post) { try { body = await req.json(); } catch (e) { body = {}; } }

    const store = getStore('cardprediction-mp');

    if (action === 'health') {
      await store.setJSON('health', { ts: Date.now() });
      const v = await store.get('health', { type: 'json' });
      return json({ ok: true, blobs: !!v });
    }

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
      const room = await store.get('room:' + q.get('key'), { type: 'json' });
      if (!room) return json({ gone: true });
      const g = await store.get('guest:' + q.get('key'), { type: 'json' });
      return json({ joined: !!g, oppDeck: g ? g.guestDeck : null });
    }

    if (action === 'move' && post) {
      if (!(await store.get('room:' + body.key))) return json({ gone: true });
      await store.set(`mv:${body.key}:${body.role}:${body.round}`, String(body.card));
      return json({ ok: true });
    }

    if (action === 'move') {
      if (!(await store.get('room:' + q.get('key')))) return json({ gone: true });
      const opp = q.get('role') === 'host' ? 'guest' : 'host';
      const card = await store.get(`mv:${q.get('key')}:${opp}:${q.get('round')}`);
      return json({ card: card == null ? null : card });
    }

    return json({ error: 'unknown action', path: url.pathname }, 404);
  } catch (e) {
    return json({ error: 'server', detail: String((e && e.message) || e) }, 500);
  }
};
