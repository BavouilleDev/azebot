/**
 * Bornes temporelles en heure locale du processus Node.
 * Définissez `TZ=Europe/Paris` (ou autre) dans l'environnement pour
 * que "aujourd'hui" et le mois correspondent à votre fuseau.
 */

/** @returns {number} */
function startOfLocalDayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Fin exclusive du jour local (minuit lendemain). */
function endOfLocalDayExclusiveMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** @returns {number} */
function startOfLocalMonthMs() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Fin exclusive du mois local (1er du mois suivant à 00:00). */
function endOfLocalMonthExclusiveMs() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

/** @returns {number} Début de la semaine locale (lundi 00:00). */
function startOfLocalWeekMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // JS: 0=dimanche..6=samedi. On veut lundi=0..dimanche=6
  const dayFromMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayFromMonday);
  return d.getTime();
}

/** Fin exclusive de la semaine locale (lundi suivant 00:00). */
function endOfLocalWeekExclusiveMs() {
  const start = startOfLocalWeekMs();
  return start + 7 * 24 * 60 * 60 * 1000;
}

module.exports = {
  startOfLocalDayMs,
  endOfLocalDayExclusiveMs,
  startOfLocalMonthMs,
  endOfLocalMonthExclusiveMs,
  startOfLocalWeekMs,
  endOfLocalWeekExclusiveMs,
};
