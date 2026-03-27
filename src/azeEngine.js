const { AZE_KEYWORDS, SESSION_INACTIVITY_MS } = require("./config");

/**
 * @param {string} content
 */
function isExactKeyword(content) {
  const t = String(content ?? "")
    .trim()
    .toLowerCase();
  return AZE_KEYWORDS.has(t);
}

/**
 * Rang parmi les **premiers messages uniques** par utilisateur dans la session.
 * 1 → 5 pts, 2 → 3, 3 → 2, 4+ → 1
 * @param {number} rank
 */
function pointsForRank(rank) {
  if (rank === 1) return 5;
  if (rank === 2) return 3;
  if (rank === 3) return 2;
  return 1;
}

/**
 * Session expirée si délai > inactivité depuis le dernier aze valide,
 * ou depuis le message auto si aucun aze encore.
 * @param {number} messageTs
 * @param {number} sessionStartTs
 * @param {number} lastAzeTs 0 si aucun aze dans la session
 * @param {number} inactivityMs
 */
function isSessionExpired(messageTs, sessionStartTs, lastAzeTs, inactivityMs) {
  const ref = lastAzeTs > 0 ? lastAzeTs : sessionStartTs;
  return messageTs - ref > inactivityMs;
}

/**
 * Reconstruit la liste des enregistrements à partir d'un historique (scan).
 * Même logique que le suivi temps réel : session démarrée par message auto,
 * fin si expiration d'inactivité ou nouveau message auto (implicite au tour suivant).
 *
 * @param {import('discord.js').Message[]} messages
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} autoBotUserId
 * @param {number} [inactivityMs=SESSION_INACTIVITY_MS]
 * @returns {Array<{
 *   guild_id: string,
 *   channel_id: string,
 *   message_id: string,
 *   user_id: string,
 *   keyword: string,
 *   points: number,
 *   msg_ts: number
 * }>}
 */
function buildRecordsFromHistory(
  messages,
  guildId,
  channelId,
  autoBotUserId,
  inactivityMs = SESSION_INACTIVITY_MS,
) {
  if (!autoBotUserId) {
    throw new Error(
      "AUTO_BOT_USER_ID manquant : impossible de reconnaître les messages automatiques.",
    );
  }

  const sorted = [...messages].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp,
  );

  const out = [];
  let sessionActive = false;
  let sessionStartTs = 0;
  let lastAzeTs = 0;
  /** @type {Set<string>} */
  const seenUserIds = new Set();

  for (const msg of sorted) {
    const ts = msg.createdTimestamp;

    if (msg.author.id === autoBotUserId) {
      const m = msg.mentions;
      const hasPing = Boolean(
        m?.everyone || (m?.users && m.users.size > 0) || (m?.roles && m.roles.size > 0),
      );
      if (hasPing) {
        sessionActive = true;
        sessionStartTs = ts;
        lastAzeTs = 0;
        seenUserIds.clear();
      }
      continue;
    }

    if (!sessionActive) continue;

    if (isSessionExpired(ts, sessionStartTs, lastAzeTs, inactivityMs)) {
      sessionActive = false;
      seenUserIds.clear();
      lastAzeTs = 0;
      continue;
    }

    if (!isExactKeyword(msg.content)) continue;

    if (msg.author.bot) continue;

    if (seenUserIds.has(msg.author.id)) continue;
    seenUserIds.add(msg.author.id);

    const rank = seenUserIds.size;
    const points = pointsForRank(rank);
    const keyword = String(msg.content).trim().toLowerCase();

    out.push({
      guild_id: guildId,
      channel_id: channelId,
      message_id: msg.id,
      user_id: msg.author.id,
      keyword,
      points,
      msg_ts: ts,
    });

    lastAzeTs = ts;
  }

  return out;
}

module.exports = {
  isExactKeyword,
  pointsForRank,
  isSessionExpired,
  buildRecordsFromHistory,
};
