const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("azeboard")
    .setDescription("Affiche le top 10 du classement Aze (points)"),

  new SlashCommandBuilder()
    .setName("azestat")
    .setDescription("Statistiques Aze d'un membre (vous par défaut)")
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("Membre à consulter")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("aze")
    .setDescription("Statistiques globales du serveur (Aze)"),

  new SlashCommandBuilder()
    .setName("azescan")
    .setDescription(
      "[Admin] Scanner l'historique d'un salon et activer la surveillance",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("azescaninfo")
    .setDescription(
      "[Admin] Voir le bot écouté et le salon surveillé",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

/**
 * Enregistre les commandes slash (guilde si GUILD_ID, sinon global).
 * @param {import('discord.js').Client} client
 */
async function registerSlashCommands(client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.warn("[AzeBot] DISCORD_TOKEN manquant — pas d'enregistrement des commandes.");
    return;
  }

  const clientId = process.env.DISCORD_CLIENT_ID || client.user?.id;
  if (!clientId) return;

  const rest = new REST({ version: "10" }).setToken(token);
  const body = commands.map((c) => c.toJSON());

  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
        { body },
      );
      console.log(
        `[AzeBot] Commandes enregistrées pour la guilde ${process.env.GUILD_ID}.`,
      );
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body });
      console.log("[AzeBot] Commandes globales enregistrées (propagation jusqu'à 1h).");
    }
  } catch (e) {
    console.error("[AzeBot] Échec de l'enregistrement des commandes :", e);
  }
}

module.exports = { registerSlashCommands, commands };
