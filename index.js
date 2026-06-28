// ============================================================
//  index.js — Bot Discord di verifica di Vorality
//  ------------------------------------------------------------
//  RUOLO: nel canale #verifica, l'utente scrive il codice usa-e-getta
//  ottenuto dal bot gioco Telegram (comando /discord, formato VRLT-XXXX).
//  Il bot verifica il codice chiamando il Beta (/api/discord-verify):
//   - se valido -> assegna il ruolo "Verificato" -> sblocca i canali
//   - se non valido -> messaggio d'errore appropriato
//  Per pulizia, cancella il messaggio col codice (così non resta visibile).
//
//  SICUREZZA:
//   - parla col Beta tramite segreto condiviso (DISCORD_BRIDGE_SECRET).
//   - agisce solo nel canale #verifica e solo sul server configurato.
//   - se manca il token o la config, non parte ma logga chiaramente.
// ============================================================

const { Client, GatewayIntentBits, Partials } = require('discord.js');

// --- Config (da variabili d'ambiente Railway) ---
const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const BETA_URL = (process.env.BETA_URL || 'https://vorality-beta-production.up.railway.app').replace(/\/+$/, '');
const BRIDGE_SECRET = process.env.DISCORD_BRIDGE_SECRET || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const VERIFY_CHANNEL_ID = process.env.DISCORD_VERIFY_CHANNEL_ID || '';
const VERIFIED_ROLE_ID = process.env.DISCORD_VERIFIED_ROLE_ID || '';

// controllo di configurazione minima
const missing = [];
if (!TOKEN) missing.push('DISCORD_BOT_TOKEN');
if (!BRIDGE_SECRET) missing.push('DISCORD_BRIDGE_SECRET');
if (!VERIFY_CHANNEL_ID) missing.push('DISCORD_VERIFY_CHANNEL_ID');
if (!VERIFIED_ROLE_ID) missing.push('DISCORD_VERIFIED_ROLE_ID');
if (missing.length) {
  console.error('[DISCORD] Configurazione mancante:', missing.join(', '));
  console.error('[DISCORD] Imposta le variabili su Railway. Bot NON avviato.');
  process.exit(1);
}

// formato del codice: VRLT- seguito da 8 caratteri (lettere/numeri)
const CODE_RE = /VRLT-[A-Z0-9]{4,12}/i;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// chiama il Beta per verificare e bruciare il codice
async function verifyCode(code, discordUser) {
  const res = await fetch(BETA_URL + '/api/discord-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_SECRET },
    body: JSON.stringify({ code, discordUser }),
  });
  // il Beta risponde sempre JSON
  let data = {};
  try { data = await res.json(); } catch (_) {}
  return { httpOk: res.ok, status: res.status, data };
}

client.once('ready', () => {
  console.log('[DISCORD] Bot di verifica online come ' + client.user.tag);
  console.log('[DISCORD] Ascolto il canale #verifica (' + VERIFY_CHANNEL_ID + ')');
});

client.on('messageCreate', async (msg) => {
  try {
    // ignora i bot (incluso se stesso)
    if (msg.author.bot) return;
    // solo nel canale #verifica
    if (msg.channelId !== VERIFY_CHANNEL_ID) return;
    // solo nel server giusto (se configurato)
    if (GUILD_ID && msg.guildId !== GUILD_ID) return;

    const match = (msg.content || '').match(CODE_RE);
    if (!match) {
      // non sembra un codice: diamo un aiuto gentile e puliamo
      const hint = await msg.reply('Per verificarti, incolla qui il codice che hai ottenuto dal bot Telegram con /discord (formato VRLT-XXXX).');
      // cancella l'aiuto dopo 8 secondi per tenere pulito il canale
      setTimeout(() => { hint.delete().catch(() => {}); }, 8000);
      msg.delete().catch(() => {});
      return;
    }

    const code = match[0].toUpperCase();
    const discordUser = msg.author.id;

    // verifica col Beta
    let result;
    try {
      result = await verifyCode(code, discordUser);
    } catch (e) {
      console.error('[DISCORD] errore chiamata Beta:', e.message);
      const m = await msg.reply('Verifica non disponibile in questo momento. Riprova tra poco.');
      setTimeout(() => { m.delete().catch(() => {}); }, 8000);
      msg.delete().catch(() => {});
      return;
    }

    const d = result.data || {};

    if (d.ok) {
      // assegna il ruolo Verificato
      try {
        const member = await msg.guild.members.fetch(msg.author.id);
        await member.roles.add(VERIFIED_ROLE_ID, 'Verifica Vorality completata (UID ' + (d.uid || '?') + ')');
        const ok = await msg.reply('✅ Verificato! Benvenuto nella community di Vorality. I canali sono sbloccati.');
        setTimeout(() => { ok.delete().catch(() => {}); }, 10000);
      } catch (e) {
        console.error('[DISCORD] errore assegnazione ruolo:', e.message);
        const m = await msg.reply('Codice valido, ma non riesco ad assegnarti il ruolo. Avvisa un admin (il bot deve stare sopra il ruolo "Verificato").');
        setTimeout(() => { m.delete().catch(() => {}); }, 12000);
      }
    } else {
      // codice non valido: messaggio specifico
      let testo;
      switch (d.reason) {
        case 'not_found':    testo = 'Codice non valido. Controlla di averlo copiato bene, oppure generane uno nuovo con /discord sul bot Telegram.'; break;
        case 'already_used': testo = 'Questo codice è già stato usato. Generane uno nuovo con /discord sul bot Telegram.'; break;
        case 'expired':      testo = 'Codice scaduto (valido 15 minuti). Generane uno nuovo con /discord sul bot Telegram.'; break;
        case 'not_enabled':  testo = 'Il tuo account non risulta abilitato a giocare. Completa prima i passaggi sul bot Telegram.'; break;
        default:             testo = 'Verifica non riuscita. Riprova o genera un nuovo codice con /discord.';
      }
      const m = await msg.reply('❌ ' + testo);
      setTimeout(() => { m.delete().catch(() => {}); }, 12000);
    }

    // pulizia: cancella il messaggio col codice (così altri non lo vedono)
    msg.delete().catch(() => {});
  } catch (e) {
    console.error('[DISCORD] errore in messageCreate:', e.message);
  }
});

client.login(TOKEN).catch((e) => {
  console.error('[DISCORD] Login fallito:', e.message);
  process.exit(1);
});
