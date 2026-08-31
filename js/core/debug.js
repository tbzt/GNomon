"use strict";

/* ============================================================
   DEBUG
   Journalisation par canaux, filtrable et activable au runtime.
   Feuille de couche 1 : aucune dépendance sortante, tout le monde
   peut l'appeler.

   Par défaut tous les canaux sont allumés (outil de debug perso, pas de
   build de prod) : les sondes émettent sans rien avoir à taper. Pour
   restreindre : ?debug=reseau,storage dans l'URL ; pour tout couper :
   ?debug=off. Réglable aussi à chaud depuis la console : Debug.on("reseau"),
   Debug.off(), Debug.only("storage"). Canal éteint => l'appel sort
   immédiatement (coût quasi nul), les sondes restent donc en place à
   demeure sans nettoyage avant commit.

     Debug.channels()            liste les canaux et leur état
     Debug.on("reseau")          allume un canal
     Debug.only("storage")       n'allume que celui-là
     Debug.off() / Debug.off("reseau")   éteint tout / un canal
     Debug.level("warn")         seuil global (debug<info<warn<error)

   Dans le code métier :
     Debug.log("reseau", "lien posé", { de, vers });
     Debug.warn("storage", "clé absente", key);
   ============================================================ */
export const Debug = {
  // Canaux connus + couleur d'affichage. Étendre cette table pour en
  // déclarer un nouveau ; un canal ad hoc passé à on() marche aussi
  // (couleur neutre par défaut).
  _channels: {
    reseau: "#4ea1ff",
    storage: "#ff9f43",
    trame: "#2ecc71",
    information: "#c678dd",
    conscience: "#f7c948",
    // Ces cinq-là étaient APPELÉS sans être déclarés : `_emit` filtre
    // sur `_active`, que `all()` ne remplit que depuis cette table. Les
    // échecs d'observateur de `monde`, `casting`, `run`, `besoins` et
    // `liens` disparaissaient donc sans laisser de trace, y compris
    // quand on avait explicitement tout allumé pour les chercher.
    monde: "#e59f5a",
    casting: "#6bd4c4",
    run: "#f2a93b",
    besoins: "#9ec46b",
    liens: "#8aa0c9",
    espace: "#d16ba5",
  },

  _levels: ["debug", "info", "warn", "error"],
  _level: "debug", // seuil global : rien sous ce niveau n'est affiché
  _active: new Set(), // canaux actuellement allumés

  /** Applique l'état initial depuis ?debug=... dans l'URL.
      Absent => tous les canaux allumés ; "off"/"none" => tout coupé ;
      liste => seuls ces canaux. Appelé une fois au chargement. */
  init() {
    const p = new URLSearchParams(location.search).get("debug");
    if (p === null) return this.all();
    if (p === "off" || p === "none" || p === "0") return;
    if (p === "all" || p === "*") return this.all();
    p.split(",").forEach((c) => this.on(c.trim()));
  },

  on(channel) {
    this._active.add(channel);
    return this._state();
  },

  off(channel) {
    if (channel) this._active.delete(channel);
    else this._active.clear();
    return this._state();
  },

  only(channel) {
    this._active.clear();
    return this.on(channel);
  },

  all() {
    Object.keys(this._channels).forEach((c) => this._active.add(c));
    return this._state();
  },

  level(name) {
    if (this._levels.includes(name)) this._level = name;
    return this._level;
  },

  /** Canaux connus + état actif, pour explorer depuis la console. */
  channels() {
    return Object.keys(this._channels).map((c) => ({
      channel: c,
      active: this._active.has(c),
    }));
  },

  isOn(channel) {
    return this._active.has(channel);
  },

  log(channel, ...args) {
    this._emit("debug", channel, args);
  },
  info(channel, ...args) {
    this._emit("info", channel, args);
  },
  warn(channel, ...args) {
    this._emit("warn", channel, args);
  },
  error(channel, ...args) {
    this._emit("error", channel, args);
  },

  /* ---- interne ---- */

  _emit(level, channel, args) {
    if (!this._active.has(channel)) return;
    if (this._levels.indexOf(level) < this._levels.indexOf(this._level)) return;
    const color = this._channels[channel] || "#888";
    const time = new Date().toLocaleTimeString("fr-FR", { hour12: false });
    const method = level === "debug" ? "log" : level;
    console[method](
      `%c${channel}%c ${time}`,
      `color:${color};font-weight:bold`,
      "color:#888",
      ...args
    );
  },

  _state() {
    return [...this._active];
  },
};

Debug.init();

// Export explicite pour un accès direct et l'autocomplétion depuis la
// console du navigateur (tape `Debug.` puis Tab).
window.Debug = Debug;
