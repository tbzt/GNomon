"use strict";

/* ============================================================
   RUN STORE — l'état vivant du GN pendant qu'il se joue.
   ------------------------------------------------------------
   Tout ce que l'atelier a écrit devient ici des commandes. C'est le
   sens de tout le modèle depuis S2 : **les conclusions potentielles
   d'une situation sont les boutons qu'on presse en jeu.** On ne
   ressaisit rien, on ne double aucune vérité — on avance dedans.

       Run     { debut, heureFiction, pause, cumulPause }
       Fil     { trameId → { situationId, depuis, statut, porteurId } }
       Journal [ { id, ts, type, texte, trameId, situationId } ]

   ── LA MAIN COURANTE EST LA SEULE MÉMOIRE ──
   Le journal n'est pas un accessoire : c'est de lui qu'on **dérive**
   qui a joué quand, donc qui est délaissé depuis combien de temps.
   Tenir un second registre « dernière scène par joueur » créerait deux
   vérités qui divergeraient à la première correction manuelle. Une
   entrée de journal est un fait horodaté ; tout le reste se recalcule.

   ── L'HORLOGE DE FICTION ──
   Les situations portent des heures de fiction (20 h, 21 h 30…). La
   run, elle, démarre à un instant réel. `heureFiction` accorde les
   deux : à `debut` réel, il est `heureFiction` dans le jeu. Le tableau
   peut alors dire « dans 12 minutes » au lieu de « à 21 h », ce qui
   est la seule forme utile à 3 h du matin.

   Les pauses comptent : un GN s'arrête (repas, incident, météo), et
   l'heure de fiction ne doit pas continuer de courir pendant ce
   temps-là, sinon tout le planning ment.

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

export const STATUTS = Object.freeze({
  actif: "En jeu",
  bloque: "Bloqué",
  clos: "Clos",
});

export const TYPES_ENTREE = Object.freeze({
  note: "Note",
  bascule: "Bascule",
  incident: "Incident",
  lancement: "Lancement",
});

const VIDE = { run: null, fils: {}, journal: [] };

export const RunStore = {
  _key: "run",
  _data: null,
  _observers: new Set(),

  load() {
    const raw = Storage.get(this._key, null);
    this._data = {
      run: raw?.run || null,
      fils: raw && typeof raw.fils === "object" ? raw.fils : {},
      journal: Array.isArray(raw?.journal) ? raw.journal : [],
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
    return "j" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
        Debug.warn("run", "observateur échoué", { evt, error: e });
      }
    }
  },

  /* ================= La run ================= */

  run() {
    return this._d().run;
  },

  enCours() {
    const r = this._d().run;
    return !!r && !r.fin;
  },

  enPause() {
    const r = this._d().run;
    return !!r && !!r.pause;
  },

  demarrer(heureFiction = 20) {
    const d = this._d();
    d.run = {
      debut: Date.now(),
      heureFiction,
      pause: null,
      cumulPause: 0,
      fin: null,
    };
    this.save();
    this._noter({ type: "lancement", texte: "Début du jeu" });
    this._emit({ type: "run:demarrer" });
    return d.run;
  },

  basculerPause() {
    const r = this._d().run;
    if (!r || r.fin) return;
    if (r.pause) {
      r.cumulPause += Date.now() - r.pause;
      r.pause = null;
      this._noter({ type: "incident", texte: "Reprise" });
    } else {
      r.pause = Date.now();
      this._noter({ type: "incident", texte: "Pause" });
    }
    this.save();
    this._emit({ type: "run:pause" });
  },

  clore() {
    const r = this._d().run;
    if (!r) return;
    if (r.pause) {
      r.cumulPause += Date.now() - r.pause;
      r.pause = null;
    }
    r.fin = Date.now();
    this.save();
    this._noter({ type: "lancement", texte: "Fin du jeu" });
    this._emit({ type: "run:clore" });
  },

  /** Millisecondes de jeu écoulées, pauses déduites. */
  ecoule() {
    const r = this._d().run;
    if (!r) return 0;
    const fin = r.fin || (r.pause ? r.pause : Date.now());
    return Math.max(0, fin - r.debut - r.cumulPause);
  },

  /** L'heure de fiction courante, en heures décimales. */
  heureCourante() {
    const r = this._d().run;
    if (!r) return null;
    return r.heureFiction + this.ecoule() / 3600000;
  },

  /* ================= Les fils ================= */

  fils() {
    return this._d().fils;
  },

  fil(trameId) {
    return this._d().fils[trameId] || null;
  },

  /** Ouvre un fil sur une situation. C'est le seul point d'entrée dans
      le jeu : un fil qui n'est pas lancé n'existe pas au tableau. */
  lancer(trameId, situationId, titre = "") {
    const d = this._d();
    d.fils[trameId] = {
      situationId,
      depuis: Date.now(),
      statut: "actif",
      porteurId: null,
    };
    this.save();
    this._noter({ type: "lancement", texte: `Fil lancé : ${titre}`, trameId, situationId });
    this._emit({ type: "fil:lancer", trameId });
    return d.fils[trameId];
  },

  /** Suit une conclusion — LE geste du tableau. `vers` peut être `null`
      (conclusion sans suite écrite) : le fil se marque alors bloqué
      plutôt que de sauter dans le vide. Une conclusion orpheline en
      atelier est une question ouverte ; en jeu, c'est un cul-de-sac
      qu'il faut voir tout de suite. */
  bifurquer(trameId, { vers = null, texte = "", titreCible = "" } = {}) {
    const f = this._d().fils[trameId];
    if (!f) return null;
    if (vers) {
      f.situationId = vers;
      f.statut = "actif";
    } else {
      f.statut = "bloque";
    }
    f.depuis = Date.now();
    this.save();
    this._noter({
      type: "bascule",
      texte: vers ? `${texte} → ${titreCible}` : `${texte} → aucune suite écrite`,
      trameId,
      situationId: vers || f.situationId,
    });
    this._emit({ type: "fil:bifurquer", trameId });
    return f;
  },

  majFil(trameId, patch = {}) {
    const f = this._d().fils[trameId];
    if (!f) return null;
    if (patch.statut && !(patch.statut in STATUTS)) delete patch.statut;
    Object.assign(f, patch);
    if (patch.statut) f.depuis = Date.now();
    this.save();
    this._emit({ type: "fil:maj", trameId });
    return f;
  },

  retirerFil(trameId) {
    delete this._d().fils[trameId];
    this.save();
    this._emit({ type: "fil:retirer", trameId });
  },

  /* ================= La main courante ================= */

  /** La main courante, **du plus récent au plus ancien**.

      ── L'ORDRE EST UNE DONNÉE, PAS UNE POSITION DANS UN TABLEAU ──
      `_noter()` empile en tête, et `conduite.js` en dépend : il prend la
      PREMIÈRE entrée trouvée pour chaque personnage comme étant la plus
      récente. Tant que ce tableau ne bougeait que par cette porte, s'en
      remettre à l'ordre d'insertion suffisait.

      Un tour de synchronisation le recoud (`objets.recoudre` trie par
      identifiant croissant, donc du plus ANCIEN au plus récent) et
      inversait donc la main courante. Conséquence, la nuit du jeu :
      `dernier` retenait le plus vieil horodatage de chacun, et tout le
      monde passait pour délaissé depuis le début du GN.

      On trie donc ici, sur `ts`, qui est le fait. Le store tient son
      invariant plutôt que d'espérer que personne ne réordonne — c'est la
      règle du projet, et elle valait déjà pour la réciprocité des liens. */
  journal() {
    return [...this._d().journal].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  },

  _noter({ type = "note", texte = "", trameId = null, situationId = null }) {
    const e = {
      id: this._uid(),
      ts: Date.now(),
      heure: this.heureCourante(),
      type,
      texte,
      trameId,
      situationId,
    };
    this._d().journal.unshift(e);
    this.save();
    this._emit({ type: "journal:ajouter", id: e.id });
    return e;
  },

  /** Entrée écrite à la main par l'équipe. */
  noter(texte, { type = "note", trameId = null, situationId = null } = {}) {
    if (!String(texte || "").trim()) return null;
    return this._noter({ type, texte: texte.trim(), trameId, situationId });
  },

  retirerEntree(id) {
    const d = this._d();
    // Sur le tableau INTERNE, pas sur la copie triée de `journal()`.
    d.journal = d.journal.filter((e) => e.id !== id);
    this.save();
    this._emit({ type: "journal:retirer", id });
  },

  /* ================= Remise à zéro ================= */

  vider() {
    this._data = { run: null, fils: {}, journal: [] };
    this.save();
    this._emit({ type: "run:vider" });
  },
};
