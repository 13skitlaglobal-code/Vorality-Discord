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

const {
  Client, GatewayIntentBits, Partials, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits,
} = require('discord.js');

// --- Config (da variabili d'ambiente Railway) ---
const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const BETA_URL = (process.env.BETA_URL || 'https://vorality-beta-production.up.railway.app').replace(/\/+$/, '');
const BRIDGE_SECRET = process.env.DISCORD_BRIDGE_SECRET || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const VERIFY_CHANNEL_ID = process.env.DISCORD_VERIFY_CHANNEL_ID || '';
const VERIFIED_ROLE_ID = process.env.DISCORD_VERIFIED_ROLE_ID || '';

// --- Sistema TICKET (opzionale: se mancano gli ID, i ticket restano spenti) ---
const STAFF_ROLE_ID = process.env.DISCORD_STAFF_ROLE_ID || '';
const ASSIST_CHANNEL_ID = process.env.DISCORD_ASSIST_CHANNEL_ID || '';
const TICKET_CATEGORY_ID = process.env.DISCORD_TICKET_CATEGORY_ID || '';
const TICKETS_ENABLED = !!(STAFF_ROLE_ID && ASSIST_CHANNEL_ID && TICKET_CATEGORY_ID);

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

// testo del messaggio di benvenuto fissato in #verifica
const WELCOME_TEXT =
  '🧭 **Benvenuto in Vorality — il prediction market italiano**\n\n' +
  'Questo è il punto d\'ingresso. Un solo passo e sei dentro.\n\n' +
  '🎟️ **Come verificarti:**\n' +
  '1️⃣ Vai sul bot Telegram @Vorality_Play_bot\n' +
  '2️⃣ Scrivi /discord e copia il codice che ti dà\n' +
  '3️⃣ Incollalo qui sotto in questo canale\n\n' +
  'Il bot ti verificherà al volo e si apriranno tutti i canali della community.\n\n' +
  '⏱️ Il codice dura 15 minuti e vale una volta sola.\n' +
  '❓ Problemi? Apri un ticket nel canale assistenza.';

// "firma" per riconoscere il nostro messaggio di benvenuto tra i fissati
const WELCOME_TAG = 'Benvenuto in Vorality';

// pubblica e fissa il benvenuto SOLO se non è già presente tra i messaggi fissati
async function ensureWelcome() {
  try {
    const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    // controlla i messaggi già fissati: se il benvenuto c'è, non fare nulla
    const pinned = await channel.messages.fetchPinned().catch(() => null);
    if (pinned && pinned.some(m => (m.content || '').includes(WELCOME_TAG))) {
      console.log('[DISCORD] benvenuto già presente, non lo ripubblico.');
      return;
    }

    // non c'è: pubblica e fissa
    const sent = await channel.send(WELCOME_TEXT);
    await sent.pin().catch((e) => console.error('[DISCORD] non riesco a fissare il benvenuto:', e.message));
    console.log('[DISCORD] benvenuto pubblicato e fissato in #verifica.');
  } catch (e) {
    console.error('[DISCORD] errore pubblicazione benvenuto:', e.message);
  }
}

// ============================================================
//  SISTEMA TICKET
// ============================================================

const TICKET_PANEL_TAG = 'Hai bisogno di aiuto';

// pubblica il pannello con il bottone "Apri ticket" in #assistenza (solo se non c'è già)
async function ensureTicketPanel() {
  if (!TICKETS_ENABLED) return;
  try {
    const channel = await client.channels.fetch(ASSIST_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    const pinned = await channel.messages.fetchPinned().catch(() => null);
    if (pinned && pinned.some(m => (m.content || '').includes(TICKET_PANEL_TAG))) {
      console.log('[DISCORD] pannello ticket già presente.');
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('apri_ticket')
        .setLabel('🎫 Apri ticket')
        .setStyle(ButtonStyle.Primary)
    );

    const sent = await channel.send({
      content:
        '🛟 **Hai bisogno di aiuto?**\n\n' +
        'Apri un ticket: si creerà un canale privato visibile solo a te e allo staff di Vorality.\n' +
        'Spiega lì il tuo problema e ti risponderemo al più presto.',
      components: [row],
    });
    await sent.pin().catch(() => {});
    console.log('[DISCORD] pannello ticket pubblicato in #assistenza.');
  } catch (e) {
    console.error('[DISCORD] errore pannello ticket:', e.message);
  }
}

// crea un canale-ticket privato per l'utente
async function apriTicket(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  // evita doppioni: se l'utente ha già un ticket aperto, lo segnaliamo
  const esistente = guild.channels.cache.find(
    c => c.parentId === TICKET_CATEGORY_ID && c.topic === 'ticket:' + user.id
  );
  if (esistente) {
    await interaction.reply({ content: 'Hai già un ticket aperto: ' + esistente.toString(), ephemeral: true });
    return;
  }

  // nome canale pulito (lettere/numeri dal nome utente)
  const safe = (user.username || 'utente').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'utente';

  const canale = await guild.channels.create({
    name: 'ticket-' + safe,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    topic: 'ticket:' + user.id, // serve a riconoscere il proprietario
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
    ],
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('chiudi_ticket').setLabel('🔒 Chiudi ticket').setStyle(ButtonStyle.Danger)
  );

  await canale.send({
    content: user.toString() + ' benvenuto nel tuo ticket.\n\n' +
      'Spiega qui il tuo problema: lo staff di Vorality ti risponderà appena possibile.\n' +
      'Quando hai finito, premi **Chiudi ticket**.',
    components: [row],
  });

  await interaction.reply({ content: 'Ticket creato: ' + canale.toString(), ephemeral: true });
}

// chiude (cancella) un canale-ticket
async function chiudiTicket(interaction) {
  const canale = interaction.channel;
  // sicurezza: si chiude solo dentro la categoria ticket
  if (canale.parentId !== TICKET_CATEGORY_ID) {
    await interaction.reply({ content: 'Questo comando funziona solo dentro un ticket.', ephemeral: true });
    return;
  }
  await interaction.reply({ content: 'Ticket in chiusura tra 5 secondi…' });
  setTimeout(() => { canale.delete().catch((e) => console.error('[DISCORD] errore chiusura ticket:', e.message)); }, 5000);
}

client.once(Events.ClientReady, async () => {
  console.log('[DISCORD] Bot di verifica online come ' + client.user.tag);
  console.log('[DISCORD] Ascolto il canale #verifica (' + VERIFY_CHANNEL_ID + ')');
  await ensureWelcome();
  await ensureTicketPanel();
  console.log('[DISCORD] Sistema ticket: ' + (TICKETS_ENABLED ? 'attivo' : 'spento (ID mancanti)'));
});

// gestione click sui bottoni
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'apri_ticket') {
      await apriTicket(interaction);
    } else if (interaction.customId === 'chiudi_ticket') {
      await chiudiTicket(interaction);
    }
  } catch (e) {
    console.error('[DISCORD] errore interazione:', e.message);
    if (interaction.isRepliable() && !interaction.replied) {
      interaction.reply({ content: 'Si è verificato un problema. Riprova.', ephemeral: true }).catch(() => {});
    }
  }
});


client.on(Events.MessageCreate, async (msg) => {
  try {
    // ignora i bot (incluso se stesso)
    if (msg.author.bot) return;
    // solo nel canale #verifica
    if (msg.channelId !== VERIFY_CHANNEL_ID) return;
    // solo nel server giusto (se configurato)
    if (GUILD_ID && msg.guildId !== GUILD_ID) return;
    // non toccare MAI i messaggi fissati (es. il benvenuto)
    if (msg.pinned) return;

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
    msg.delete().catch((e) => {
      console.error('[DISCORD] non riesco a cancellare il messaggio col codice:', e.message);
    });
  } catch (e) {
    console.error('[DISCORD] errore in messageCreate:', e.message);
  }
});

client.login(TOKEN).catch((e) => {
  console.error('[DISCORD] Login fallito:', e.message);
  process.exit(1);
});
