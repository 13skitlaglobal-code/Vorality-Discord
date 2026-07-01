// Vorality — "Pulse" Discord (AUTO-CONTENUTO via REST API).
// Non apre un secondo gateway: usa l'API REST col DISCORD_BOT_TOKEN per trovare il canale e postare.
// Va solo "richiesto" da index.js. Stessi pool del bot Telegram.
const fs = require('fs');
const path = require('path');
const { POOLS, CATEGORY_ORDER } = require('./rotation-messages.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const GID = process.env.DISCORD_GUILD_ID || '';
const NAMES = (process.env.BROADCAST_DISCORD_CHANNELS || 'generale,general')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const HOURS = parseFloat(process.env.BROADCAST_HOURS || '3');
const INTERVAL_MS = Math.max(0.05, HOURS) * 3600 * 1000;
const ENABLED = (process.env.BROADCAST_ENABLED || 'true').toLowerCase() === 'true';
const ON_START = (process.env.BROADCAST_ON_START || 'false').toLowerCase() === 'true';
const API = 'https://discord.com/api/v10';

let catIdx = 0; const itemIdx = {};
function newsItems() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'news.txt'), 'utf8');
    const lines = raw.split('\n').map((s) => s.trim()).filter((l) => l && !l.startsWith('#'));
    if (lines.length) return lines;
  } catch (e) {}
  return POOLS.news || [];
}
function nextMessage() {
  for (let k = 0; k < CATEGORY_ORDER.length; k++) {
    const cat = CATEGORY_ORDER[(catIdx + k) % CATEGORY_ORDER.length];
    const pool = cat === 'news' ? newsItems() : (POOLS[cat] || []);
    if (pool.length) {
      const i = (itemIdx[cat] || 0) % pool.length;
      itemIdx[cat] = i + 1;
      catIdx = (catIdx + k + 1) % CATEGORY_ORDER.length;
      return { cat, text: pool[i] };
    }
  }
  return null;
}
async function findChannelId() {
  const H = { authorization: `Bot ${TOKEN}` };
  let gid = GID;
  if (!gid) {
    const gr = await fetch(`${API}/users/@me/guilds`, { headers: H });
    const gs = await gr.json();
    if (Array.isArray(gs) && gs.length) gid = gs[0].id;
  }
  if (!gid) return null;
  const cr = await fetch(`${API}/guilds/${gid}/channels`, { headers: H });
  const chans = await cr.json();
  if (!Array.isArray(chans)) return null;
  for (const name of NAMES) {
    const ch = chans.find((c) => c.type === 0 && c.name.toLowerCase() === name);
    if (ch) return ch.id;
  }
  return null;
}
async function pulse() {
  if (!TOKEN) return;
  try {
    const m = nextMessage(); if (!m) return;
    const chId = await findChannelId();
    if (!chId) { console.warn('[Vorality-Pulse] canale Discord non trovato tra: #' + NAMES.join(', #')); return; }
    const r = await fetch(`${API}/channels/${chId}/messages`, {
      method: 'POST', headers: { authorization: `Bot ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ content: m.text })
    });
    console.log(r.ok ? `[Vorality-Pulse] Discord inviato [${m.cat}]` : `[Vorality-Pulse] Discord FAIL HTTP ${r.status}`);
  } catch (e) { console.error('[Vorality-Pulse] Discord errore:', e.message); }
}
if (!ENABLED) { console.log('[Vorality-Pulse] Discord disattivato (BROADCAST_ENABLED=false).'); }
else {
  console.log('[Vorality-Pulse] Discord attivo: ogni ' + HOURS + 'h su #' + NAMES.join(', #') + ' | on_start=' + ON_START);
  if (ON_START) setTimeout(pulse, 15000);
  setInterval(pulse, INTERVAL_MS);
}
module.exports = { pulse };
