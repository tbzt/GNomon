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

/** ── LES CLÉS QUI COMPOSENT UN GN ──
    Celles-ci se rangent dans un **projet**, voyagent dans une archive,
    et monteront dans un espace partagé. Toute autre clé — le thème, la
    version de schéma, l'index des projets, la session distante — est
    une clé d'**appareil** : elle n'appartient à aucun GN, ne se
    préfixe pas, et ne s'exporte jamais. Recevoir le GN d'un collègue
    ne doit pas retourner son écran.

    La liste vit ici et non dans `archive.js` : savoir quelle clé
    appartient à quoi est le métier de ce module, et l'inverse ferait
    dépendre le socle de la couche qui l'utilise. */
export const CLES_PROJET = Object.freeze([
  "monde",
  "reseau",
  "trames",
  "informations",
  "casting",
  "derogations",
  "run",
  "suivi",
  "liens",
]);

export const Storage = {
  SCHEMA_VERSION: 3,
  _observers: [],
  _writeFailNotified: false,
  _signaler: null,
  _projet: null,

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

  /* ---- Échec d'écriture : un seul avertissement, réarmé au succès ----

     ── LE MESSAGE EXISTAIT, IL N'AVAIT PAS DE SORTIE ──
     L'original appelait `globalThis.toast`. Cette fonction est restée
     chez ShadowHerds : ici elle n'existe nulle part, donc l'entonnoir
     retombait sur `Debug.warn`, c'est-à-dire une console de navigateur
     que personne n'ouvre. Le message était écrit, soigné, exact — et
     n'atteignait personne. Pendant ce temps, le store mute sa copie en
     mémoire et émet comme si tout allait bien : l'écran affiche le
     texte, le disque ne l'a pas, et le rechargement le perd.

     On ne code pas le DOM ici pour autant. `Storage` est une feuille
     de couche 1, rejouable sans navigateur — c'est ce qui la rend
     testable. L'appelant dépose donc **où** dire les choses
     (`onEchec`), et `app.js` y branche le bandeau de statut.

     L'avertissement est posé une fois, et **retiré au premier succès** :
     un bandeau « pas enregistré » qui resterait après le rétablissement
     serait aussi menteur que pas de bandeau du tout. */

  /** Où signaler qu'une écriture a échoué — et, avec `null`, qu'elle
      est repassée. Posé une fois au démarrage. */
  onEchec(cb) {
    this._signaler = typeof cb === "function" ? cb : null;
  },

  _notifyWriteFailure(e) {
    if (this._writeFailNotified) return;
    this._writeFailNotified = true;
    const quota =
      !!e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
    const msg = quota
      ? "Stockage plein : cette modification n'est PAS enregistrée, et les suivantes ne le seront pas non plus. Exportez une archive maintenant, puis libérez de la place — les images embarquées sont presque toujours la cause."
      : "Échec d'enregistrement : cette modification n'est PAS enregistrée localement. N'écrivez rien de plus avant d'avoir exporté une archive.";
    Debug.warn("storage", msg, { error: e });
    if (this._signaler) this._signaler(msg, { quota });
  },

  /* ---- Clés, et le projet qui les porte ----

     ── POURQUOI LES CLÉS SONT PRÉFIXÉES ──
     Il n'y avait qu'un GN par navigateur, sous des clés nues
     (`gnomon_v1_reseau`). Une équipe qui prépare l'édition suivante
     pendant que la précédente n'est pas archivée devait exporter,
     vider, réimporter à chaque bascule — et rien, dans un espace
     partagé, n'aurait su désigner DE QUEL GN on parle.

     Un projet est donc un préfixe, et rien d'autre : `gnomon_v1_<projet>__<clé>`.
     Pas de table, pas de jointure, pas de migration à chaque ajout de
     clé. Basculer de projet, c'est déplacer une fenêtre de lecture.

     Sans projet actif — avant la migration v3, ou pendant qu'elle
     s'exécute — on retombe sur les clés nues. C'est ce qui permet à la
     migration de se lire elle-même. */

  projet() {
    return this._projet;
  },

  /** Déplace la fenêtre de lecture. **Les stores doivent se recharger
      après** : ce module ne connaît personne et ne préviendra pas. */
  poserProjet(id) {
    this._projet = id || null;
  },

  _key(key) {
    if (!this._projet || !CLES_PROJET.includes(key)) return PREFIX + key;
    return `${PREFIX}${this._projet}__${key}`;
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
      // Rétabli : on retire l'avertissement, sinon il survivrait à la
      // panne qu'il annonce.
      if (this._writeFailNotified && this._signaler) this._signaler(null);
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

  /** Les clés du projet actif, sous leur nom court. */
  keys() {
    return CLES_PROJET.filter((c) => localStorage.getItem(this._key(c)) !== null);
  },

  /** TOUTES les entrées GNomon de cette origine, projets confondus,
      avec leur poids brut. Le quota du `localStorage` se compte par
      origine et non par projet : un indicateur qui ne mesurerait que le
      GN ouvert annoncerait « rien à signaler » à deux doigts de la
      panne. Clé complète, telle qu'elle est stockée. */
  toutesLesEntrees() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX))
        out.push({ cle: k.slice(PREFIX.length), octets: (localStorage.getItem(k) || "").length });
    }
    return out;
  },

  /** Efface le projet actif. Les clés d'appareil survivent. */
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
        if (p.portrait === undefined) p.portrait = "";
        if (p.notes && !p.background) {
          p.background = p.notes;
          p.notes = "";
          bouges++;
        }
      }
      S.set("reseau", reseau);
      Debug.log("storage", "migration v2 : carnet → background", { bouges });
    },

    /* v2 → v3 — DONNER UNE IDENTITÉ AU PROJET.
       Les clés étaient nues : un seul GN par navigateur. On déplace
       l'existant dans un premier projet, en RENOMMANT les clés plutôt
       qu'en recopiant leur contenu — un GN chargé en images pèse
       plusieurs mégaoctets, et le dupliquer le temps d'une migration
       ferait sauter le quota juste avant de le libérer.

       Un projet vierge ne produit rien : c'est `Projets.init()` qui
       créera le premier au démarrage. Écrire ici un projet vide
       laisserait un « Sans titre » fantôme à qui ouvre l'outil pour la
       première fois. */
    (S) => {
      const nues = CLES_PROJET.filter((c) => localStorage.getItem(PREFIX + c) !== null);
      if (!nues.length) return;

      const id = "p" + Date.now().toString(36);
      for (const c of nues) {
        const brut = localStorage.getItem(PREFIX + c);
        localStorage.setItem(`${PREFIX}${id}__${c}`, brut);
        localStorage.removeItem(PREFIX + c);
      }

      // Le nom vient du monde s'il a été rempli : c'est le titre que
      // l'équipe a déjà écrit, et le redemander serait le demander deux fois.
      let nom = "";
      try {
        nom = (JSON.parse(localStorage.getItem(`${PREFIX}${id}__monde`)) || {}).titre || "";
      } catch {
        /* un monde illisible ne doit pas empêcher la migration */
      }
      const maintenant = Date.now();
      S.set("projets", [{ id, nom: nom || "Mon GN", cree: maintenant, ouvert: maintenant }]);
      S.set("projet_actif", id);
      Debug.log("storage", "migration v3 : projet créé", { id, cles: nues.length });
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
