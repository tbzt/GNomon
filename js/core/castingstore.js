"use strict";

/* ============================================================
   CASTING STORE — les candidatures, les vœux, l'affectation.
   ------------------------------------------------------------
   ── LA LIGNE ROUGE : AUCUNE DONNÉE PERSONNELLE ──
   Une candidature de GN collecte de la donnée sensible au sens du
   RGPD — santé, allergies, régime, contact d'urgence, lignes et voiles,
   parfois des mineurs. GNomon est une application locale sans serveur,
   sans authentification et sans chiffrement : **ce n'est pas un endroit
   pour ça**, et le prétendre serait pire que de ne rien proposer.

   Alors ce store ne connaît qu'un **libellé** — ce que l'organisation
   veut bien y mettre, et l'import propose de le pseudonymiser d'un
   clic (« Joueur 1 », « Joueur 2 »…). La correspondance entre le
   libellé et la personne reste dans le tableur de l'organisation, qui
   est déjà l'endroit où elle vit.

       Candidature { id, label, preferences, vetos, arrivee, depart, notes }

   `preferences` associe un id de personnage à un rang 1..3.
   **L'absence vaut « rien d'exprimé »**, comme « ignore » dans
   `InformationStore` — un vœu non formulé n'est pas un vœu neutre
   qu'il faudrait stocker soixante fois par joueur.

   `arrivee` / `depart` sont des heures, et c'est la seule contrainte
   *structurée* du modèle. Elle est là parce qu'elle est vérifiable :
   attribuer à quelqu'un qui arrive à 22 h un personnage dont la
   scène-clé est à 20 h est un échec de casting que la frise sait déjà
   voir. Les contraintes en texte libre (« sait chanter », « n'a pas
   peur du noir ») ne sont **pas** modélisées : les apparier
   automatiquement à un questionnaire en texte libre donnerait un
   résultat faux avec l'air d'être juste.

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

/** Rangs d'un vœu. 3 = premier choix. */
export const RANGS = Object.freeze({
  3: "J'adore",
  2: "Volontiers",
  1: "J'accepte",
});

const VIDE = { candidatures: [], affectation: {}, dateAffectation: null };

export const CastingStore = {
  _key: "casting",
  _data: null,
  _observers: new Set(),

  load() {
    const raw = Storage.get(this._key, null);
    this._data = {
      candidatures: Array.isArray(raw?.candidatures) ? raw.candidatures : [],
      affectation: raw && typeof raw.affectation === "object" ? raw.affectation : {},
      dateAffectation: raw?.dateAffectation || null,
    };
    return this._data;
  },

  save() {
    Storage.set(this._key, this._data || VIDE);
  },

  _d() {
    if (!this._data) this.load();
    return this._data;
  },

  _uid() {
    return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  subscribe(cb) {
    if (typeof cb === "function") this._observers.add(cb);
    return () => this._observers.delete(cb);
  },

  _emit(evt) {
    for (const cb of this._observers) {
      try {
        cb(evt);
      } catch (e) {
        Debug.warn("casting", "observateur échoué", { evt, error: e });
      }
    }
  },

  /* ================= Candidatures ================= */

  candidatures() {
    return this._d().candidatures;
  },

  candidature(id) {
    return this._d().candidatures.find((c) => c && c.id === id) || null;
  },

  creer({ label = "", arrivee = null, depart = null, notes = "" } = {}) {
    const c = {
      id: this._uid(),
      label: label || `Joueur ${this._d().candidatures.length + 1}`,
      preferences: {},
      vetos: [],
      arrivee,
      depart,
      notes,
    };
    this._d().candidatures.push(c);
    this.save();
    this._emit({ type: "candidature:creer", id: c.id });
    return c;
  },

  maj(id, patch = {}) {
    const c = this.candidature(id);
    if (!c) return null;
    // `preferences` et `vetos` ont leur porte (`voeu`), qui tient
    // l'invariant « rien d'exprimé = absence ».
    delete patch.preferences;
    delete patch.vetos;
    Object.assign(c, patch, { id: c.id });
    this.save();
    this._emit({ type: "candidature:maj", id });
    return c;
  },

  supprimer(id) {
    const d = this._d();
    const i = d.candidatures.findIndex((c) => c && c.id === id);
    if (i < 0) return null;
    const c = d.candidatures.splice(i, 1)[0];
    delete d.affectation[id];
    this.save();
    this._emit({ type: "candidature:supprimer", id });
    return c;
  },

  /* ================= Vœux ================= */

  /** `3|2|1` = rang · `"veto"` = surtout pas · `0`/`null` = rien
      d'exprimé, et l'entrée est alors **retirée**. */
  voeu(candidatureId, personnageId, valeur) {
    const c = this.candidature(candidatureId);
    if (!c || !personnageId) return null;
    c.vetos = (c.vetos || []).filter((x) => x !== personnageId);
    delete c.preferences[personnageId];
    if (valeur === "veto") c.vetos.push(personnageId);
    else if (valeur >= 1 && valeur <= 3) c.preferences[personnageId] = valeur;
    this.save();
    this._emit({ type: "voeu", id: candidatureId, personnageId });
    return c;
  },

  /** L'état d'un vœu : `3|2|1`, `"veto"`, ou `0`. */
  etatVoeu(candidatureId, personnageId) {
    const c = this.candidature(candidatureId);
    if (!c) return 0;
    if ((c.vetos || []).includes(personnageId)) return "veto";
    return c.preferences[personnageId] || 0;
  },

  /** Fait tourner : rien → 3 → 2 → 1 → veto → rien. */
  cycler(candidatureId, personnageId) {
    const suite = { 0: 3, 3: 2, 2: 1, 1: "veto", veto: 0 };
    return this.voeu(candidatureId, personnageId, suite[this.etatVoeu(candidatureId, personnageId)]);
  },

  /* ================= Affectation ================= */

  affectation() {
    return this._d().affectation;
  },

  dateAffectation() {
    return this._d().dateAffectation;
  },

  /** Le personnage attribué à cette candidature, ou `null`. */
  roleDe(candidatureId) {
    return this._d().affectation[candidatureId] || null;
  },

  /** La candidature qui tient ce personnage, ou `null`. */
  titulaireDe(personnageId) {
    const a = this._d().affectation;
    return Object.keys(a).find((k) => a[k] === personnageId) || null;
  },

  /** Remplace l'affectation entière. On n'écrit jamais une affectation
      partielle par-dessus une autre : deux moitiés de deux castings
      différents ne forment pas un casting. */
  poserAffectation(map) {
    const d = this._d();
    d.affectation = { ...map };
    d.dateAffectation = new Date().toISOString().slice(0, 16).replace("T", " ");
    this.save();
    this._emit({ type: "affectation:poser" });
  },

  /** Épingle ou libère un appariement à la main. L'organisation a
      toujours le dernier mot sur l'algorithme. */
  attribuer(candidatureId, personnageId) {
    const d = this._d();
    if (!personnageId) delete d.affectation[candidatureId];
    else {
      // Un personnage ne se joue qu'une fois : on libère l'ancien
      // titulaire plutôt que de laisser deux joueurs sur un même rôle.
      const ancien = this.titulaireDe(personnageId);
      if (ancien) delete d.affectation[ancien];
      d.affectation[candidatureId] = personnageId;
    }
    this.save();
    this._emit({ type: "affectation:manuelle", id: candidatureId });
  },

  effacerAffectation() {
    const d = this._d();
    d.affectation = {};
    d.dateAffectation = null;
    this.save();
    this._emit({ type: "affectation:effacer" });
  },

  /* ================= Import ================= */

  /** Importe un feuillet CSV/TSV. **Seule la colonne de libellé est
      lue** — tout le reste est ignoré et n'entre jamais dans le store.
      `pseudonymiser` remplace le libellé par « Joueur n ». */
  importer(texte, { colonne = 0, entete = true, pseudonymiser = false } = {}) {
    const lignes = String(texte || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (entete) lignes.shift();
    const sep = (texte.match(/\t/g) || []).length > (texte.match(/;/g) || []).length ? "\t" : /[;,]/;
    let n = this._d().candidatures.length;
    let poses = 0;
    for (const ligne of lignes) {
      const cases = ligne.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
      const brut = cases[colonne] || "";
      if (!brut) continue;
      n++;
      this.creer({ label: pseudonymiser ? `Joueur ${n}` : brut });
      poses++;
    }
    return poses;
  },

  /** Aperçu des premières lignes, pour choisir la colonne SANS rien
      écrire dans le store. */
  apercu(texte, { entete = true } = {}) {
    const lignes = String(texte || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const sep = (texte.match(/\t/g) || []).length > (texte.match(/;/g) || []).length ? "\t" : /[;,]/;
    const table = lignes.slice(0, 4).map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
    return { entetes: entete ? table[0] || [] : [], lignes: entete ? table.slice(1) : table };
  },

  vider() {
    this._data = { candidatures: [], affectation: {}, dateAffectation: null };
    this.save();
    this._emit({ type: "casting:vider" });
  },
};
