"use strict";

/* ============================================================
   MONDE STORE — l'histoire générale, celle que tout le monde partage.
   ------------------------------------------------------------
   ── UN MANQUE, ET IL ÉTAIT STRUCTUREL ──
   Tout l'outil a été bâti sur « la vérité racine est l'arête ». C'était
   le bon parti — un personnage de GN n'existe que par ses liens — mais
   il a laissé un trou : **les étapes 1 à 3 de la méthode eXpérience**
   n'existaient nulle part.

       Étape 1 — la prémisse    Étape 2 — le propos
       Étape 3 — la thématique et le contexte

   Or ce sont elles qu'on écrit en premier, et c'est d'elles que sort le
   **livret de contexte** remis à tout le monde. Un GN n'est pas qu'un
   réseau : il a un monde commun, et sans lui les quarante fiches ne
   tiennent ensemble par rien.

       Monde { titre, premisse, propos, thematique, contexte,
               intention, avertissements, securite[], securiteNote,
               pratique, costume, references, lieux[] }

   ── LA PRÉMISSE A UNE FORME, ET ON LA RAPPELLE ──
   eXpérience la donne littéralement : *[le héros] + va à + [action
   initiale] + et + [conséquence]*. Le champ porte cette forme en
   invite, parce qu'une prémisse floue produit un GN flou — et que la
   formule force à la rendre concrète.

   ── LA SÉCURITÉ ÉMOTIONNELLE N'EST PAS UNE OPTION ──
   Un livret de GN contemporain porte, en plus de la fiction : la **note
   d'intention** (ce que l'équipe veut faire vivre), les **avertissements
   de contenu** (les thèmes durs réellement présents), et les
   **mécaniques de sécurité** en usage — lignes et voiles, « coupez »,
   le regard baissé, un·e référent·e identifié·e.

   Ce n'est pas de la paperasse : ce sont les outils qui permettent de
   jouer des choses dures sans casser quelqu'un, et ils ne servent que
   si tout le monde les a lus AVANT. Les omettre d'un outil de 2026
   serait un vrai manque — cf. le guide « Pour un GN plus sécurisant »
   d'Electro-GN et le corpus nordique sur la calibration.

   Ces trois blocs sont donc portés par le monde, et **repris dans
   chaque livret et chaque consigne**, sans que l'auteur ait à y penser.

   ── LE CONTEXTE N'EST PAS UNE INFORMATION ──
   Ce qui est écrit ici est ce que **tout le monde** sait, sans qu'il
   faille l'inscrire quarante fois dans `InformationStore`. Ce dernier
   sert à l'asymétrie — qui sait ce que les autres ignorent. Le savoir
   commun n'est pas une asymétrie : c'est le sol. Le mélanger aux
   informations noierait les vraies divergences sous le décor.

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

const CHAMPS = {
  titre: "",
  premisse: "",
  propos: "",
  thematique: "",
  contexte: "",
  intention: "",
  avertissements: "",
  securiteNote: "",
  pratique: "",
  costume: "",
  references: "",
};

/** Les mécaniques de sécurité d'usage courant. La liste est fermée et
    pré-écrite : demander à chaque équipe de les reformuler produirait
    quarante variantes approximatives d'outils qui ne valent que s'ils
    sont dits de la même façon partout. `securiteNote` reste là pour ce
    qui est propre au GN. */
export const MECANIQUES = Object.freeze({
  lignesVoiles: {
    nom: "Lignes et voiles",
    texte:
      "Vos lignes (ce qui n'apparaîtra pas) et vos voiles (ce qui sera évoqué sans être montré) sont recueillis avant le jeu et respectés sans discussion.",
  },
  coupez: {
    nom: "« Coupez »",
    texte:
      "Dire « coupez », ou croiser les mains devant soi, arrête la scène immédiatement. Personne ne demande pourquoi.",
  },
  freinez: {
    nom: "« Freinez »",
    texte: "Dire « freinez » demande de ralentir ou d'adoucir sans interrompre la scène.",
  },
  regardBaisse: {
    nom: "Le regard baissé",
    texte:
      "Une main devant les yeux signifie que vous n'êtes pas dans le jeu : on ne vous voit pas, on ne vous adresse pas la parole.",
  },
  horsJeu: {
    nom: "« Hors-jeu »",
    texte:
      "Préfixer une phrase par « hors-jeu » permet de négocier une limite en pleine scène, sans en sortir.",
  },
  referent: {
    nom: "Un·e référent·e sécurité",
    texte:
      "Une personne de l'équipe est identifiée, joignable à tout moment, et n'a que ce rôle.",
  },
  debrief: {
    nom: "Un débriefing",
    texte: "Un temps de retour est prévu après le jeu, avant de se séparer.",
  },
});

export const MondeStore = {
  _key: "monde",
  _data: null,
  _observers: new Set(),

  load() {
    const raw = Storage.get(this._key, null);
    this._data = {
      ...CHAMPS,
      ...(raw && typeof raw === "object" ? raw : {}),
      lieux: Array.isArray(raw?.lieux) ? raw.lieux : [],
      securite: Array.isArray(raw?.securite) ? raw.securite : Object.keys(MECANIQUES),
    };
    return this._data;
  },

  save() {
    Storage.set(this._key, this._data || { ...CHAMPS, lieux: [], securite: [] });
  },

  _d() {
    if (!this._data) this.load();
    return this._data;
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
        Debug.warn("monde", "observateur échoué", { evt, error: e });
      }
    }
  },

  /* ================= Lecture / écriture ================= */

  monde() {
    return this._d();
  },

  maj(patch = {}) {
    const d = this._d();
    delete patch.lieux; // les lieux ont leur porte
    delete patch.securite; // les mécaniques aussi
    for (const k of Object.keys(patch)) if (!(k in CHAMPS)) delete patch[k];
    Object.assign(d, patch);
    this.save();
    this._emit({ type: "monde:maj" });
    return d;
  },

  /** Renseigné ou non : sert à savoir s'il faut proposer de commencer
      par là plutôt que de laisser l'auteur devant un réseau nu. */
  amorce() {
    const d = this._d();
    return !!(d.titre || d.premisse || d.propos || d.contexte);
  },

  /* ================= Sécurité =================
     Toutes actives par défaut : le défaut sûr est celui qui protège.
     Une équipe qui en retire une le fait sciemment. */

  securite() {
    return this._d().securite;
  },

  basculerMecanique(cle) {
    if (!(cle in MECANIQUES)) return;
    const d = this._d();
    d.securite = d.securite.includes(cle)
      ? d.securite.filter((x) => x !== cle)
      : [...d.securite, cle];
    this.save();
    this._emit({ type: "monde:securite" });
  },

  /** Les mécaniques actives, prêtes à être imprimées. */
  mecaniquesActives() {
    return this._d().securite.filter((c) => c in MECANIQUES).map((c) => MECANIQUES[c]);
  },

  /* ================= Lieux =================
     Les lieux existent déjà en texte libre sur chaque situation
     (`espaceDédié`). Ici on tient la liste de référence — celle qu'on
     imprime dans le livret et qu'on affiche à l'équipe. Aucune des deux
     n'est autorité sur l'autre : la situation dit où ELLE se joue, le
     monde dit ce que le site COMPORTE. */

  lieux() {
    return this._d().lieux;
  },

  ajouterLieu(nom = "", note = "") {
    const l = {
      id: "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nom,
      note,
    };
    this._d().lieux.push(l);
    this.save();
    this._emit({ type: "lieu:creer", id: l.id });
    return l;
  },

  majLieu(id, patch = {}) {
    const l = this._d().lieux.find((x) => x && x.id === id);
    if (!l) return null;
    Object.assign(l, patch, { id: l.id });
    this.save();
    this._emit({ type: "lieu:maj", id });
    return l;
  },

  supprimerLieu(id) {
    const d = this._d();
    d.lieux = d.lieux.filter((x) => x && x.id !== id);
    this.save();
    this._emit({ type: "lieu:supprimer", id });
  },

  vider() {
    this._data = { ...CHAMPS, lieux: [], securite: Object.keys(MECANIQUES) };
    this.save();
    this._emit({ type: "monde:vider" });
  },
};
