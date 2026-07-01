// Vorality — Pool messaggi per la rotazione automatica ("pulse").
// EDITA QUI. Italiano, on-brand. Vorality = prediction market italiano, in waitlist.
// REGOLE: nessun token esiste ora; punti virtuali (VP), zero soldi veri; gioco responsabile; anti-scam.
// Ordine: brand -> safety -> onboarding -> news (poi ripete). Le news possono stare in bot/news.txt.

const CATEGORY_ORDER = ["brand", "safety", "onboarding", "news"];

const POOLS = {
  brand: [
    "🧭 Vorality — il prediction market italiano. Metti alla prova le tue previsioni, non la fortuna.",
    "🧭 Qui conta la lettura, non il caso. Vorality trasforma la tua visione dei mercati in una sfida.",
    "🧭 Un'arena di previsioni fatta in Italia. Trasparente, dal vivo, senza promesse.",
    "🧭 Vorality: leggi il mercato, prendi posizione, confrontati con lo sciame di giocatori.",
    "🧭 Non prevediamo il futuro: lo mettiamo alla prova. Un pronostico alla volta."
  ],
  safety: [
    "🛡️ Vorality NON ha un token e non è in vendita nulla. Chiunque proponga un 'token Vorality', presale o airdrop è un truffatore.",
    "🛡️ Si gioca con punti virtuali (VP): zero soldi veri. Diffida di chi promette guadagni o 'rendimenti garantiti'.",
    "🛡️ Lo staff non ti scrive MAI per primo in DM e non chiede seed phrase, password o wallet. Bloccalo e segnala.",
    "🛡️ Link ufficiali solo dai messaggi fissati. Ogni altro link, 'verifica wallet' o 'bonus' è falso.",
    "🎯 Gioca responsabilmente: è intrattenimento e sfida di previsione, non un modo per fare soldi."
  ],
  onboarding: [
    "👋 Nuovo qui? Apri il bot @Vorality_Play_bot, premi /start e apri la Mini App per entrare in waitlist.",
    "🗺️ Curioso del progetto? Scrivi /sviluppi al bot per vedere la roadmap aggiornata.",
    "🔓 Per il Discord: prendi il codice usa-e-getta dal bot Telegram (/discord) e incollalo nel canale #verifica.",
    "💬 Unisciti allo sciame: canale Telegram + server Discord. Più giocatori, più sfida."
  ],
  news: [
    "📰 Vorality è in waitlist e costruzione: seguiamo tutto in chiaro. Ogni novità reale arriva dai messaggi fissati. 🧭",
    "📰 Nessun token, nessuna vendita: siamo in fase beta/waitlist. Le uniche fonti ufficiali sono i canali fissati. 🧭"
  ]
};

module.exports = { CATEGORY_ORDER, POOLS };
