const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "aze.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  monitored_channel_id TEXT
);

CREATE TABLE IF NOT EXISTS aze_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  points INTEGER NOT NULL,
  msg_ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aze_guild_user ON aze_records(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_aze_guild_ts ON aze_records(guild_id, msg_ts);
`);

/**
 * @param {string} guildId
 * @param {string|null} channelId
 */
function setMonitoredChannel(guildId, channelId) {
  const stmt = db.prepare(`
    INSERT INTO guild_settings (guild_id, monitored_channel_id)
    VALUES (@guildId, @channelId)
    ON CONFLICT(guild_id) DO UPDATE SET monitored_channel_id = excluded.monitored_channel_id
  `);
  stmt.run({ guildId, channelId });
}

/** @param {string} guildId */
function getMonitoredChannel(guildId) {
  const row = db
    .prepare(`SELECT monitored_channel_id FROM guild_settings WHERE guild_id = ?`)
    .get(guildId);
  return row?.monitored_channel_id ?? null;
}

/**
 * @param {object} row
 */
function insertAzeRecord(row) {
  const stmt = db.prepare(`
    INSERT INTO aze_records (guild_id, channel_id, message_id, user_id, keyword, points, msg_ts)
    VALUES (@guild_id, @channel_id, @message_id, @user_id, @keyword, @points, @msg_ts)
  `);
  stmt.run(row);
}

/** @param {string} guildId */
function deleteAllRecordsForGuild(guildId) {
  db.prepare(`DELETE FROM aze_records WHERE guild_id = ?`).run(guildId);
}

/**
 * Remplace toutes les entrées d'une guilde (après scan).
 * @param {string} guildId
 * @param {Array<Record<string, unknown>>} rows
 */
function replaceGuildRecords(guildId, rows) {
  const del = db.prepare(`DELETE FROM aze_records WHERE guild_id = ?`);
  const ins = db.prepare(`
    INSERT INTO aze_records (guild_id, channel_id, message_id, user_id, keyword, points, msg_ts)
    VALUES (@guild_id, @channel_id, @message_id, @user_id, @keyword, @points, @msg_ts)
  `);
  const tx = db.transaction(() => {
    del.run(guildId);
    for (const row of rows) ins.run(row);
  });
  tx();
}

/** @returns {{ user_id: string, total_points: number, total_aze: number }[]} */
function getLeaderboard(guildId, limit = 10) {
  return db
    .prepare(
      `
    SELECT user_id,
           SUM(points) AS total_points,
           COUNT(*) AS total_aze
    FROM aze_records
    WHERE guild_id = ?
    GROUP BY user_id
    ORDER BY total_points DESC, total_aze DESC
    LIMIT ?
  `,
    )
    .all(guildId, limit);
}

/**
 * @param {string} guildId
 * @param {string} userId
 */
function getUserStats(guildId, userId) {
  const agg = db
    .prepare(
      `
    SELECT SUM(points) AS total_points, COUNT(*) AS total_aze
    FROM aze_records
    WHERE guild_id = ? AND user_id = ?
  `,
    )
    .get(guildId, userId);

  const totalPoints = agg?.total_points ?? 0;
  const totalAze = agg?.total_aze ?? 0;

  /** Rang par points totaux (1 = meilleur) */
  const rankRow = db
    .prepare(
      `
    WITH totals AS (
      SELECT user_id, SUM(points) AS tp
      FROM aze_records
      WHERE guild_id = ?
      GROUP BY user_id
    ),
    ranked AS (
      SELECT user_id,
             RANK() OVER (ORDER BY tp DESC) AS rnk
      FROM totals
    )
    SELECT rnk FROM ranked WHERE user_id = ?
  `,
    )
    .get(guildId, userId);

  return {
    totalPoints,
    totalAze,
    rank: rankRow?.rnk ?? null,
  };
}

/**
 * Stats globales + MVP du mois + MVP de la semaine
 * @param {string} guildId
 * @param {number} monthStartMs début du mois (UTC ou local — on utilise les ms passés)
 * @param {number} monthEndMs exclusif
 * @param {number} weekStartMs
 * @param {number} weekEndMs exclusif
 * @param {number} dayStartMs
 * @param {number} dayEndMs exclusif
 */
function getGlobalStats(
  guildId,
  monthStartMs,
  monthEndMs,
  weekStartMs,
  weekEndMs,
  dayStartMs,
  dayEndMs,
) {
  const totalAll = db
    .prepare(`SELECT COUNT(*) AS c FROM aze_records WHERE guild_id = ?`)
    .get(guildId).c;

  const totalToday = db
    .prepare(
      `SELECT COUNT(*) AS c FROM aze_records WHERE guild_id = ? AND msg_ts >= ? AND msg_ts < ?`,
    )
    .get(guildId, dayStartMs, dayEndMs).c;

  const totalMonth = db
    .prepare(
      `SELECT COUNT(*) AS c FROM aze_records WHERE guild_id = ? AND msg_ts >= ? AND msg_ts < ?`,
    )
    .get(guildId, monthStartMs, monthEndMs).c;

  const totalWeek = db
    .prepare(
      `SELECT COUNT(*) AS c FROM aze_records WHERE guild_id = ? AND msg_ts >= ? AND msg_ts < ?`,
    )
    .get(guildId, weekStartMs, weekEndMs).c;

  const mvp = db
    .prepare(
      `
    SELECT user_id, COUNT(*) AS cnt
    FROM aze_records
    WHERE guild_id = ? AND msg_ts >= ? AND msg_ts < ?
    GROUP BY user_id
    ORDER BY cnt DESC
    LIMIT 1
  `,
    )
    .get(guildId, monthStartMs, monthEndMs);

  const mvpWeek = db
    .prepare(
      `
    SELECT user_id, COUNT(*) AS cnt
    FROM aze_records
    WHERE guild_id = ? AND msg_ts >= ? AND msg_ts < ?
    GROUP BY user_id
    ORDER BY cnt DESC
    LIMIT 1
  `,
    )
    .get(guildId, weekStartMs, weekEndMs);

  return {
    totalAll,
    totalToday,
    totalWeek,
    totalMonth,
    mvpUserId: mvp?.user_id ?? null,
    mvpCount: mvp?.cnt ?? 0,
    mvpWeekUserId: mvpWeek?.user_id ?? null,
    mvpWeekCount: mvpWeek?.cnt ?? 0,
  };
}

module.exports = {
  db,
  setMonitoredChannel,
  getMonitoredChannel,
  insertAzeRecord,
  deleteAllRecordsForGuild,
  replaceGuildRecords,
  getLeaderboard,
  getUserStats,
  getGlobalStats,
};
