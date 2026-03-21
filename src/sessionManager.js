const {
  insertAzeRecord,
  getMonitoredChannel,
} = require("./database");
const {
  isExactKeyword,
  pointsForRank,
  isSessionExpired,
} = require("./azeEngine");
const { SESSION_INACTIVITY_MS, AUTO_BOT_USER_ID } = require("./config");

/**
 * État d'une session "Aze" pour un salon (un salon surveillé par guilde).
 */
class ChannelSessionState {
  constructor() {
    this.active = false;
    /** @type {number} */
    this.sessionStartTs = 0;
    /** @type {number} dernier message aze valide */
    this.lastAzeTs = 0;
    /** @type {Set<string>} */
    this.seenUserIds = new Set();
  }

  resetFromAuto(ts) {
    this.active = true;
    this.sessionStartTs = ts;
    this.lastAzeTs = 0;
    this.seenUserIds.clear();
  }

  close() {
    this.active = false;
    this.sessionStartTs = 0;
    this.lastAzeTs = 0;
    this.seenUserIds.clear();
  }
}

/**
 * Gère les sessions en temps réel + réactions sur les messages.
 */
class AzeSessionManager {
  /**
   * @param {import('discord.js').Client} client
   * @param {string} customEmojiId
   */
  constructor(client, customEmojiId) {
    this.client = client;
    this.customEmojiId = customEmojiId;
    /** @type {Map<string, ChannelSessionState>} clé = channelId */
    this._byChannel = new Map();
  }

  /**
   * @param {string} channelId
   * @private
   */
  _getOrCreate(channelId) {
    if (!this._byChannel.has(channelId)) {
      this._byChannel.set(channelId, new ChannelSessionState());
    }
    return this._byChannel.get(channelId);
  }

  /**
   * Un message automatique (autre bot) démarre une nouvelle session.
   * @param {import('discord.js').Message} message
   */
  onAutoMessage(message) {
    const st = this._getOrCreate(message.channel.id);
    st.resetFromAuto(message.createdTimestamp);
  }

  /**
   * @param {import('discord.js').Message} message
   */
  async onPossibleAzeMessage(message) {
    const guildId = message.guildId;
    if (!guildId) return;

    const monitored = getMonitoredChannel(guildId);
    if (!monitored || message.channel.id !== monitored) return;

    if (message.author.id === this.client.user.id) return;

    if (!AUTO_BOT_USER_ID) return;

    if (message.author.id === AUTO_BOT_USER_ID) {
      this.onAutoMessage(message);
      return;
    }

    const st = this._getOrCreate(message.channel.id);

    if (!st.active) return;

    const ts = message.createdTimestamp;

    if (isSessionExpired(ts, st.sessionStartTs, st.lastAzeTs, SESSION_INACTIVITY_MS)) {
      st.close();
      return;
    }

    if (!isExactKeyword(message.content)) return;

    if (message.author.bot) return;

    if (st.seenUserIds.has(message.author.id)) return;
    st.seenUserIds.add(message.author.id);

    const rank = st.seenUserIds.size;
    const points = pointsForRank(rank);
    const keyword = String(message.content).trim().toLowerCase();

    insertAzeRecord({
      guild_id: guildId,
      channel_id: message.channel.id,
      message_id: message.id,
      user_id: message.author.id,
      keyword,
      points,
      msg_ts: ts,
    });

    st.lastAzeTs = ts;

    await this._addMedalReactions(message, rank, message.guild);
  }

  /**
   * @param {import('discord.js').Message} message
   * @param {number} rank
   * @param {import('discord.js').Guild|null} guild
   * @private
   */
  async _addMedalReactions(message, rank, guild) {
    try {
      if (rank === 1) {
        await message.react("🥇");
        return;
      }
      if (rank === 2) {
        await message.react("🥈");
        return;
      }
      if (rank === 3) {
        await message.react("🥉");
        return;
      }

      const id = this.customEmojiId;
      if (!id || id === "REMPLACER_PAR_ID_EMOJI_SERVEUR") {
        await message.react("✨").catch(() => {});
        return;
      }

      if (guild) {
        const custom =
          guild.emojis.cache.get(id) ??
          (await guild.emojis.fetch(id).catch(() => null));
        if (custom) {
          await message.react(custom);
          return;
        }
      }

      await message
        .react({ id, name: "aze" })
        .catch(() => message.react("✨").catch(() => {}));
    } catch (err) {
      console.error(
        `[AzeBot] Réaction impossible sur le message ${message.id} :`,
        err.message,
      );
    }
  }
}

module.exports = { AzeSessionManager };
