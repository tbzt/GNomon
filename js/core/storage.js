"use strict";

/* ============================================================
   STORAGE — abstraction localStorage, unique dépositaire.

   Repris de ShadowHerds (copie assumée, cf. ARCHITECTURE § 1) et
   **dé-éditionné** : GNomon n'a pas d'éditions de règles, donc pas de
   préfixe par édition. Une seule famille de clés :

       gnomon_v1_<clé>

   Ce qui est conservé de l'original, parce que c'est du vécu :
   - `subscribe()` — observation des écritures (base de la future synchro
     d'équipe ; l'abonné filtre les clés qui l'intéressent) ;
   - **l'entonnoir d'échec d'écriture** — un quota dépassé était jadis
     signalé au seul `console.warn`, donc invisible : l'auteur croyait sa
     fiche enregistrée. Un seul avertissement tant qu'aucune écriture n'a
     réussi depuis ; réarmé au premier `set()` qui aboutit ;
   - le versionnement de schéma + migrations, vide au départ mais en
     place — c'est moins cher que de le rétro-ajouter.

   Rien d'autre ne touche `localStorage`.
   ============================================================ */
import { Debug } from "./debug.js";

const PREFIX = "gnomon_v1_";

export const Storage = {
  SCHEMA_VERSION: 2,
  _observers: [],
  _writeFailNotified: false,

  /* ---- Observation ---- */

  /** Observe les écritures persistées (clé complète en argument). */
  subscribe(cb) {
    if (typeof cb === "function") this._observers.push(cb);
  },

  _notify(fullKey) {
    for (const cb of this._observers) {
      try {
        cb(fullKey);
      } catch (e) {
        Debug.warn("storage", "observateur échoué", { error: e });
      }
    }
  },

  /* ---- Échec d'écriture : un seul avertissement, réarmé au succès ---- */

  _notifyWriteFailure(e) {
    if (this._writeFailNotified) return;
    this._writeFailNotified = true;
    const quota =
      !!e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
    const msg = quota
      ? "Stockage plein : cette modification n'est PAS enregistrée. Exportez une sauvegarde, puis libérez de la place."
      : "Échec d'enregistrement : cette modification n'est PAS enregistrée localement.";
    if (typeof globalThis.toast === "function") globalThis.toast(msg, "danger", 6000);
    else Debug.warn("storage", msg, { error: e });
  },

  /* ---- Clés ---- */

  _key(key) {
    return PREFIX + key;
  },

  /* ---- Lecture / écriture ---- */

  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this._key(key));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      Debug.warn("storage", "lecture échouée", { key, error: e });
      return fallback;
    }
  },

  /** Renvoie `true` si l'écriture a abouti. Les appelants n'ont pas à le
      tester : l'échec est signalé ici, à l'unique entonnoir. */
  set(key, value) {
    const full = this._key(key);
    try {
      localStorage.setItem(full, JSON.stringify(value));
      this._writeFailNotified = false;
      Debug.log("storage", "set", { key });
      this._notify(full);
      return true;
    } catch (e) {
      Debug.warn("storage", "écriture échouée", { key, error: e });
      this._notifyWriteFailure(e);
      return false;
    }
  },

  remove(key) {
    const full = this._key(key);
    try {
      localStorage.removeItem(full);
      this._notify(full);
      return true;
    } catch (e) {
      Debug.warn("storage", "suppression échouée", { key, error: e });
      return false;
    }
  },

  /** Toutes les clés GNomon présentes, sans le préfixe. */
  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
    return out;
  },

  clearAll() {
    for (const k of this.keys()) this.remove(k);
  },

  /* ---- Migrations de schéma ----
     Une migration par version : `_MIGRATIONS[n]` fait passer de la
     version n à n+1. Tableau vide au départ, mais la boucle existe :
     le jour où le modèle bouge, on ajoute une entrée et rien d'autre. */

  _MIGRATIONS: [
    // v0 → v1 : rien, la v1 est l'origine.
    null,

    /* v1 → v2 — SÉPARER LE CARNET DE L'AUTEUR DU TEXTE REMIS.
       Jusqu'ici, `notes` servait aux deux : l'auteur y écrivait ses
       remarques ET le livret le publiait. Un auteur qui notait « à
       révéler plus tard » l'envoyait donc au joueur. On migre le
       contenu existant vers `background` — c'est lui qui était publié,
       il reste publié, aucun changement de comportement — et `notes`
       redevient ce que son nom dit : privé. */
    (S) => {
      const reseau = S.get("reseau", null);
      if (!reseau || !Array.isArray(reseau.personnages)) return;
      let bouges = 0;
      for (const p of reseau.personnages) {
        if (!p) continue;
        if (p.background === undefined) p.background = "";
        if (p.style === undefined) p.style = "";
        if (!Array.isArray(p.images)) p.images = [];
        if (p.notes && !p.background) {
          p.background = p.notes;
          p.notes = "";
          bouges++;
        }
      }
      S.set("reseau", reseau);
      Debug.log("storage", "migration v2 : carnet → background", { bouges });
    },
  ],

  runMigrations() {
    const from = this.get("schema_version", 0);
    if (from >= this.SCHEMA_VERSION) return;
    for (let v = from; v < this.SCHEMA_VERSION; v++) {
      const step = this._MIGRATIONS[v];
      if (typeof step !== "function") continue;
      try {
        step(this);
        Debug.log("storage", "migration appliquée", { de: v, vers: v + 1 });
      } catch (e) {
        Debug.warn("storage", "migration échouée", { de: v, error: e });
        return;
      }
    }
    this.set("schema_version", this.SCHEMA_VERSION);
  },
};
