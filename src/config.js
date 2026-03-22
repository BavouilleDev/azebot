/**
 * Configuration centrale — modifiez CUSTOM_AZE_EMOJI_ID (ID Discord de l'emoji serveur)
 * ou utilisez la variable d'environnement du même nom.
 */
require("dotenv").config();

/** @type {string} ID Discord du bot qui envoie les messages automatiques (début de session) */
const AUTO_BOT_USER_ID = process.env.AUTO_BOT_USER_ID || "";

/**
 * ID de l'emoji custom à utiliser pour les réponses classées 4e et suivantes.
 * Éditable ici ou via CUSTOM_AZE_EMOJI_ID dans .env
 */
const CUSTOM_AZE_EMOJI_ID =
  process.env.CUSTOM_AZE_EMOJI_ID || "REMPLACER_PAR_ID_EMOJI_SERVEUR";

/** Délai d'inactivité (ms) après le dernier message "aze" valide avant fin de session (2 h) */
const SESSION_INACTIVITY_MS = 2 * 60 * 60 * 1000;

/** Mots-clés exacts (comparaison insensible à la casse, trim) */
const AZE_KEYWORDS = new Set(["aze", "eza", "bvaze"]);

module.exports = {
  AUTO_BOT_USER_ID,
  CUSTOM_AZE_EMOJI_ID,
  SESSION_INACTIVITY_MS,
  AZE_KEYWORDS,
};
