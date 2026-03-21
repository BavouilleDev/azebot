require("dotenv").config();

const { Client, GatewayIntentBits, Events, ActivityType } = require("discord.js");
const { registerSlashCommands } = require("./src/registerCommands");
const { handleInteraction } = require("./src/interactions");
const { AzeSessionManager } = require("./src/sessionManager");
const { CUSTOM_AZE_EMOJI_ID } = require("./src/config");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const sessionManager = new AzeSessionManager(client, CUSTOM_AZE_EMOJI_ID);

client.on(Events.MessageCreate, (message) => {
  sessionManager.onPossibleAzeMessage(message).catch((err) => {
    console.error("[AzeBot] MessageCreate :", err.message);
  });
});

client.on(Events.InteractionCreate, (interaction) => {
  handleInteraction(interaction, client);
});

client.once(Events.ClientReady, async () => {
  console.log(`AzeBot connecté : ${client.user.tag}`);
  client.user.setActivity("répondre Aze", { type: ActivityType.Playing });
  await registerSlashCommands(client);
});

client.login(process.env.DISCORD_TOKEN);
