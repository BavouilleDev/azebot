/**
 * Récupère tout l'historique d'un salon texte (paquets de 100),
 * du plus récent au plus ancien, avec nouvelles tentatives en cas d'erreur API.
 *
 * @param {import('discord.js').TextBasedChannel} channel
 * @returns {Promise<import('discord.js').Message[]>}
 */
async function fetchAllChannelMessages(channel) {
  const all = [];
  /** @type {string|undefined} */
  let before = undefined;
  const maxRetries = 5;

  for (;;) {
    let batch;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        batch = await channel.messages.fetch({ limit: 100, before });
        break;
      } catch (err) {
        attempts += 1;
        console.error(
          `[AzeBot] Erreur fetch messages (${attempts}/${maxRetries}) :`,
          err.message,
        );
        if (attempts >= maxRetries) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }

    if (!batch || batch.size === 0) {
      break;
    }

    all.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) {
      break;
    }
  }

  return all;
}

module.exports = { fetchAllChannelMessages };
