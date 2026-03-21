const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require("discord.js");
const {
  getLeaderboard,
  getUserStats,
  getGlobalStats,
  setMonitoredChannel,
  replaceGuildRecords,
} = require("./database");
const { buildRecordsFromHistory } = require("./azeEngine");
const { fetchAllChannelMessages } = require("./fetchMessages");
const { AUTO_BOT_USER_ID } = require("./config");
const {
  startOfLocalDayMs,
  endOfLocalDayExclusiveMs,
  startOfLocalMonthMs,
  endOfLocalMonthExclusiveMs,
} = require("./timeUtils");

const SNOWFLAKE_RE = /^\d{17,20}$/;

/**
 * @param {import('discord.js').Client} client
 * @param {string} userId
 */
async function formatUserLabel(client, userId) {
  try {
    const u = await client.users.fetch(userId);
    return u.tag;
  } catch {
    return `<@${userId}>`;
  }
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleAzeboard(interaction, client) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "Cette commande ne fonctionne qu'en serveur.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const rows = getLeaderboard(guildId, 10);
  if (rows.length === 0) {
    await interaction.editReply({
      content: "Aucune donnée pour ce serveur. Utilisez `/azescan` pour initialiser.",
    });
    return;
  }

  const lines = [];
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const label = await formatUserLabel(client, r.user_id);
    lines.push(
      `**${i + 1}.** ${label} — **${r.total_points}** pts (${r.total_aze} msg.)`,
    );
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Leaderboard Aze — Top 10")
    .setDescription(lines.join("\n"))
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleAzestat(interaction, client) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "Cette commande ne fonctionne qu'en serveur.",
      ephemeral: true,
    });
    return;
  }

  const target = interaction.options.getUser("membre") ?? interaction.user;
  await interaction.deferReply();

  const stats = getUserStats(guildId, target.id);
  const label = await formatUserLabel(client, target.id);

  const rankText =
    stats.rank != null ? `**#${stats.rank}**` : "_Pas encore classé_";

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`Stats Aze — ${label}`)
    .addFields(
      { name: "Rang", value: rankText, inline: true },
      {
        name: "Points (total)",
        value: String(stats.totalPoints),
        inline: true,
      },
      {
        name: 'Messages "aze" comptés',
        value: String(stats.totalAze),
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleAzeGlobal(interaction, client) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "Cette commande ne fonctionne qu'en serveur.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const dayStart = startOfLocalDayMs();
  const dayEnd = endOfLocalDayExclusiveMs();
  const monthStart = startOfLocalMonthMs();
  const monthEnd = endOfLocalMonthExclusiveMs();

  const g = getGlobalStats(guildId, monthStart, monthEnd, dayStart, dayEnd);

  let mvpLine = "_Aucun MVP ce mois-ci._";
  if (g.mvpUserId && g.mvpCount > 0) {
    const tag = await formatUserLabel(client, g.mvpUserId);
    mvpLine = `**${tag}** — ${g.mvpCount} message(s) ce mois-ci`;
  }

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("Statistiques globales — Aze")
    .addFields(
      { name: "Total historique (messages comptés)", value: String(g.totalAll) },
      { name: "Aujourd'hui", value: String(g.totalToday) },
      { name: "Mois en cours", value: String(g.totalMonth) },
      { name: "MVP du mois", value: mvpLine },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleAzescanCommand(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "Réservé aux administrateurs.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("Scan de l'historique Aze")
    .setDescription(
      "Cette opération peut être longue et **remplace** les données existantes pour ce serveur.\n\n" +
        "1. Cliquez sur **Confirmer**.\n" +
        "2. Entrez l'**ID du salon** à analyser dans le formulaire.\n" +
        "3. Le salon scanné deviendra le salon **surveillé** en temps réel.",
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("azescan_confirm")
      .setLabel("Confirmer")
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleAzescanButton(interaction) {
  if (interaction.customId !== "azescan_confirm") return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "Permission refusée.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("azescan_modal")
    .setTitle("ID du salon à scanner");

  const input = new TextInputBuilder()
    .setCustomId("azescan_channel_input")
    .setLabel("Identifiant du salon (mode développeur)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(17)
    .setMaxLength(22);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleAzescanModal(interaction) {
  if (interaction.customId !== "azescan_modal") return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "Permission refusée.",
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "Serveur introuvable.",
      ephemeral: true,
    });
    return;
  }

  const raw = interaction.fields.getTextInputValue("azescan_channel_input").trim();
  if (!SNOWFLAKE_RE.test(raw)) {
    await interaction.reply({
      content: "ID de salon invalide (attendu : identifiant numérique Discord).",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  let channel;
  try {
    channel = await guild.channels.fetch(raw);
  } catch (err) {
    console.error("[AzeBot] Impossible de récupérer le salon :", err.message);
    await interaction.editReply({
      content:
        "Salon introuvable ou inaccessible. Vérifiez l'ID et les permissions du bot sur ce salon.",
    });
    return;
  }

  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: "Ce salon n'est pas un salon texte valide.",
    });
    return;
  }

  if (!AUTO_BOT_USER_ID) {
    await interaction.editReply({
      content:
        "Variable **AUTO_BOT_USER_ID** non définie dans `.env` : impossible de détecter les messages automatiques.",
    });
    return;
  }

  await interaction.editReply({
    content: "Récupération de l'historique des messages… (cela peut prendre plusieurs minutes)",
  });

  let messages;
  try {
    messages = await fetchAllChannelMessages(channel);
  } catch (err) {
    console.error("[AzeBot] Échec du fetch massif :", err);
    await interaction.editReply({
      content: `Échec lors de la récupération des messages : ${err.message}`,
    });
    return;
  }

  let records;
  try {
    records = buildRecordsFromHistory(
      messages,
      guild.id,
      channel.id,
      AUTO_BOT_USER_ID,
    );
  } catch (err) {
    console.error("[AzeBot] Erreur reconstruction :", err);
    await interaction.editReply({
      content: `Erreur lors de l'analyse : ${err.message}`,
    });
    return;
  }

  try {
    replaceGuildRecords(guild.id, records);
    setMonitoredChannel(guild.id, channel.id);
  } catch (err) {
    console.error("[AzeBot] Erreur SQLite :", err);
    await interaction.editReply({
      content: `Erreur base de données : ${err.message}`,
    });
    return;
  }

  await interaction.editReply({
    content:
      `Scan terminé.\n` +
      `• Messages parcourus : **${messages.length}**\n` +
      `• Entrées enregistrées : **${records.length}**\n` +
      `• Salon surveillé : <#${channel.id}>`,
  });
}

/**
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').Client} client
 */
async function handleInteraction(interaction, client) {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case "azeboard":
          await handleAzeboard(interaction, client);
          return;
        case "azestat":
          await handleAzestat(interaction, client);
          return;
        case "aze":
          await handleAzeGlobal(interaction, client);
          return;
        case "azescan":
          await handleAzescanCommand(interaction);
          return;
        default:
          return;
      }
    }

    if (interaction.isButton()) {
      await handleAzescanButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleAzescanModal(interaction);
    }
  } catch (err) {
    console.error("[AzeBot] Erreur interaction :", err);
    const msg =
      "Une erreur est survenue. Consultez la console du bot.";
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: msg });
      } else if (interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch {
      /* ignore */
    }
  }
}

module.exports = { handleInteraction };
