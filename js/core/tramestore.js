"use strict";

/* ============================================================
   TRAME STORE — les fils, les situations, les embranchements.
   ------------------------------------------------------------
   Une **trame** est un fil narratif : en GN, il y en a plusieurs en
   parallèle, portés par des PNJ ou des orgas, et non un arbre de
   décision unique. Une trame contient des **situations de jeu**, et
   chaque **conclusion potentielle** d'une situation est une arête
   sortante.

       Trame      { id, titre, porteurId, notes, epoqueId? }
       Situation  { id, trameId, epoqueId?, titre, pitch, pointDeVueId, castIds[],
                    requiertIds[], produitIds[],
                    espace, debut, fin, miseEnScene, materiel,
                    joueurParticulier, regles, terminale, x, y }
       Conclusion { id, de, vers, texte, type }

   Les champs de la situation sont ceux de la méthode eXpérience
   (annexe « caractéristiques à déterminer pour chaque situation de
   jeu »). Les quatre champs d'information — préliminaires, influence
   directe, influence latente, secondaires — ne sont pas des textes
   libres : ce sont des **références** à des objets `Information`
   (`InformationStore`), portées par `requiertIds` et `produitIds`.

   ── REQUIERT / PRODUIT, ET PAS UN SEUL LIEN ──
   eXpérience inverse le flux : « pensez d'abord à ce que vous voulez
   que les joueurs fassent, ensuite à ce que vous avez besoin de leur
   donner pour ça ». Une situation **requiert** ce qu'il faut savoir
   pour qu'elle arrive, et **produit** ce qui s'y apprend. Confondre les
   deux ferait d'une chaîne narrative un sac : on ne pourrait plus
   demander « qui doit savoir quoi AVANT le jeu ? », qui est exactement
   la question à laquelle sert le squelette de fiche.

   ── LA SCÈNE SAIT À QUELLE ÉPOQUE ELLE SE JOUE ──
   Un GN à deux moments caste les mêmes PERSONNES aux deux ; c'est la
   scène qui dit le moment. `epoqueId` se pose sur la trame — la nuit
   de 1965 est une trame — et une scène le reprend sans le redire ;
   elle peut le contredire. `epoqueDe(situationId)` fait la lecture.

   ── UNE CONCLUSION SANS CIBLE EST VALIDE ──
   `vers: null` n'est pas un état dégradé, c'est **le moteur de
   l'écriture**. eXpérience pose la question en contrôle qualité :
   « a-t-elle des suites envisageables ? Lesquelles ? Vous devriez alors
   trouver d'autres situations de jeu ». Une conclusion orpheline est
   cette question, en attente — et `creerSuite()` y répond en une fois.

   ── UNE CONCLUSION APPARTIENT À SA SITUATION D'ORIGINE ──
   Supprimer une situation emporte ses conclusions **sortantes**, mais
   les conclusions qui pointaient *vers* elle redeviennent orphelines
   au lieu d'être détruites. L'auteur les a écrites ; elles survivent à
   la disparition de leur cible, et la question « et après ? » se
   repose d'elle-même.

   ── LES RÉFÉRENCES AUX PERSONNAGES NE SONT JAMAIS PURGÉES ──
   Ce store ne connaît pas `ReseauStore` et ne s'y abonne pas. Un
   personnage supprimé laisse une référence morte, affichée comme telle
   — même convention que les puces de mention. C'est un choix : purger
   silencieusement détruirait du travail écrit et ne survivrait pas à
   l'annulation d'une suppression. Une référence cassée doit se voir.

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

/** Type d'une conclusion.

    · `normale` — une décision de jeu : ce que les joueurs peuvent
      faire de la scène.
    · `echappatoire` — la sortie de secours que Sly Flourish appelle
      « escape hatch » : le chemin qui rattrape une trame bloquée.
      Rendue en pointillé.
    · `narration` — ce que l'orga impose à heure fixe (la police entre,
      quelqu'un tombe). Ce n'est pas un choix du joueur, et l'atelier
      ne doit pas le laisser croire : une situation qui porte une
      narration ET une décision contraire ment à l'équipe.
    · `interrupteur` — une valeur que le jeu décide et que l'orga note
      sur la feuille de 2 h ; le reste du GN se joue dessus.

    Les deux derniers viennent de l'audit de jouabilité : le fil de
    l'histoire faisait cette distinction en prose, et l'archive
    contenait des branches que le fil interdisait. */
export const TYPES_CONCLUSION = Object.freeze({
  normale: "Conclusion",
  echappatoire: "Échappatoire",
  narration: "Narration",
  interrupteur: "Interrupteur",
});

const VIDE = { trames: [], situations: [], conclusions: [] };

export const TrameStore = {
  _key: "trames",
  _data: null,
  _observers: new Set(),

  /* ================= Persistance ================= */

  load() {
    const raw = Storage.get(this._key, null);
    this._data = {
      trames: Array.isArray(raw?.trames) ? raw.trames : [],
      situations: Array.isArray(raw?.situations) ? raw.situations : [],
      conclusions: Array.isArray(raw?.conclusions) ? raw.conclusions : [],
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

  _uid(p) {
    return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
        Debug.warn("trame", "observateur échoué", { evt, error: e });
      }
    }
  },

  /* ================= Trames ================= */

  trames() {
    return this._d().trames;
  },

  trame(id) {
    return this._d().trames.find((t) => t && t.id === id) || null;
  },

  creerTrame({ titre = "Nouvelle trame", porteurId = null, notes = "", epoqueId = null } = {}) {
    const t = { id: this._uid("t"), titre, porteurId, notes, epoqueId };
    this._d().trames.push(t);
    this.save();
    this._emit({ type: "trame:creer", id: t.id });
    return t;
  },

  majTrame(id, patch = {}) {
    const t = this.trame(id);
    if (!t) return null;
    Object.assign(t, patch, { id: t.id });
    this.save();
    this._emit({ type: "trame:maj", id });
    return t;
  },

  /** Supprime une trame ET ses situations (donc leurs conclusions). */
  supprimerTrame(id) {
    const d = this._d();
    const i = d.trames.findIndex((t) => t && t.id === id);
    if (i < 0) return null;
    for (const s of this.situations(id).slice()) this.supprimerSituation(s.id);
    const t = d.trames.splice(i, 1)[0];
    this.save();
    this._emit({ type: "trame:supprimer", id });
    return t;
  },

  /* ================= Situations ================= */

  /** Toutes, ou celles d'une trame. */
  situations(trameId = null) {
    const all = this._d().situations;
    return trameId == null ? all : all.filter((s) => s && s.trameId === trameId);
  },

  situation(id) {
    return this._d().situations.find((s) => s && s.id === id) || null;
  },

  /** L'époque d'une scène : la sienne, sinon celle de sa trame. */
  epoqueDe(situationId) {
    const s = this.situation(situationId);
    if (!s) return null;
    if (s.epoqueId) return s.epoqueId;
    const t = this.trame(s.trameId);
    return (t && t.epoqueId) || null;
  },

  creerSituation(trameId, { titre = "", pitch = "", ...champs } = {}) {
    const s = {
      id: this._uid("s"),
      trameId,
      titre,
      pitch,
      pointDeVueId: null,
      castIds: [],
      requiertIds: [],
      produitIds: [],
      espace: "",
      debut: null,
      fin: null,
      miseEnScene: "",
      materiel: "",
      joueurParticulier: "",
      regles: "",
      terminale: false,
      x: 0,
      y: 0,
      ...champs,
    };
    this._d().situations.push(s);
    this.save();
    this._emit({ type: "situation:creer", id: s.id, trameId });
    return s;
  },

  majSituation(id, patch = {}) {
    const s = this.situation(id);
    if (!s) return null;
    Object.assign(s, patch, { id: s.id });
    this.save();
    this._emit({ type: "situation:maj", id });
    return s;
  },

  /** Position d'auteur : écrite sans émettre (le glisser en émettrait
      des dizaines par seconde, et re-projeterait le graphe sous le
      doigt). Persistée, mais silencieuse. */
  poserSituation(id, x, y) {
    const s = this.situation(id);
    if (!s) return;
    s.x = x;
    s.y = y;
    this.save();
  },

  /** Supprime une situation. Ses conclusions SORTANTES partent avec
      elle ; les conclusions ENTRANTES redeviennent orphelines. */
  supprimerSituation(id) {
    const d = this._d();
    const i = d.situations.findIndex((s) => s && s.id === id);
    if (i < 0) return null;
    const situation = d.situations.splice(i, 1)[0];
    const sortantes = d.conclusions.filter((c) => c && c.de === id);
    d.conclusions = d.conclusions.filter((c) => c && c.de !== id);
    let orphelinees = 0;
    for (const c of d.conclusions)
      if (c && c.vers === id) {
        c.vers = null;
        orphelinees++;
      }
    this.save();
    this._emit({ type: "situation:supprimer", id, orphelinees });
    return { situation, conclusions: sortantes, orphelinees };
  },

  /** Une situation « ébauche » n'a que son amorce — titre, pitch, point
      de vue. C'est un état VALIDE : eXpérience écrit la scène avant de
      savoir ce qu'il faudra pour qu'elle arrive. */
  estEbauche(s) {
    if (!s) return false;
    return !s.espace && !s.miseEnScene && s.debut == null && !s.castIds.length;
  },

  /* ================= Informations liées =================
     Les listes sont lues défensivement (`|| []`) : le champ est
     purement additif, une situation écrite avant S3 le lit `undefined`.
     Une migration pour ça coûterait plus cher qu'elle ne rapporte. */

  /** Ce qu'il faut savoir pour que la situation puisse arriver. */
  requiert(situationId) {
    const s = this.situation(situationId);
    return (s && s.requiertIds) || [];
  },

  /** Ce qui s'y apprend. */
  produit(situationId) {
    const s = this.situation(situationId);
    return (s && s.produitIds) || [];
  },

  /** Lie une information à une situation, dans l'un des deux sens.
      Idempotent. `sens` vaut `"requiert"` ou `"produit"`. */
  lierInformation(situationId, informationId, sens = "requiert") {
    const s = this.situation(situationId);
    if (!s || !informationId) return null;
    const cle = sens === "produit" ? "produitIds" : "requiertIds";
    const liste = s[cle] || (s[cle] = []);
    if (!liste.includes(informationId)) liste.push(informationId);
    this.save();
    this._emit({ type: "situation:maj", id: situationId, sens });
    return s;
  },

  delierInformation(situationId, informationId, sens = "requiert") {
    const s = this.situation(situationId);
    if (!s) return null;
    const cle = sens === "produit" ? "produitIds" : "requiertIds";
    s[cle] = (s[cle] || []).filter((x) => x !== informationId);
    this.save();
    this._emit({ type: "situation:maj", id: situationId, sens });
    return s;
  },

  /** Recherche inverse : où cette information sert-elle ? */
  situationsAvec(informationId) {
    const out = { requiert: [], produit: [] };
    for (const s of this._d().situations) {
      if ((s.requiertIds || []).includes(informationId)) out.requiert.push(s);
      if ((s.produitIds || []).includes(informationId)) out.produit.push(s);
    }
    return out;
  },

  /* ================= Conclusions ================= */

  conclusions() {
    return this._d().conclusions;
  },

  conclusion(id) {
    return this._d().conclusions.find((c) => c && c.id === id) || null;
  },

  conclusionsDe(situationId) {
    return this._d().conclusions.filter((c) => c && c.de === situationId);
  },

  conclusionsVers(situationId) {
    return this._d().conclusions.filter((c) => c && c.vers === situationId);
  },

  /** Les questions ouvertes : conclusions écrites dont la suite n'existe
      pas encore. C'est la file de travail de l'auteur. */
  orphelines(trameId = null) {
    const d = this._d();
    return d.conclusions.filter((c) => {
      if (!c || c.vers) return false;
      if (trameId == null) return true;
      const s = this.situation(c.de);
      return s && s.trameId === trameId;
    });
  },

  ajouterConclusion(situationId, { texte = "", type = "normale", vers = null } = {}) {
    if (!this.situation(situationId)) return null;
    if (!(type in TYPES_CONCLUSION)) {
      Debug.warn("trame", "type de conclusion inconnu, refusé", { type });
      return null;
    }
    const c = { id: this._uid("c"), de: situationId, vers, texte, type };
    this._d().conclusions.push(c);
    this.save();
    this._emit({ type: "conclusion:creer", id: c.id, de: situationId });
    return c;
  },

  majConclusion(id, patch = {}) {
    const c = this.conclusion(id);
    if (!c) return null;
    if (patch.type && !(patch.type in TYPES_CONCLUSION)) {
      Debug.warn("trame", "type de conclusion inconnu, refusé", { type: patch.type });
      delete patch.type;
    }
    Object.assign(c, patch, { id: c.id, de: c.de });
    this.save();
    this._emit({ type: "conclusion:maj", id });
    return c;
  },

  supprimerConclusion(id) {
    const d = this._d();
    const i = d.conclusions.findIndex((c) => c && c.id === id);
    if (i < 0) return null;
    const c = d.conclusions.splice(i, 1)[0];
    this.save();
    this._emit({ type: "conclusion:supprimer", id, de: c.de });
    return c;
  },

  /** ── LA BOUCLE « ET APRÈS ? » ──
      Répond à une conclusion orpheline en créant la situation suivante
      et en la reliant, d'un seul geste. La nouvelle situation naît dans
      la même trame et se pose à droite de la précédente, pour que le
      fil se lise de gauche à droite sans qu'on ait à ranger.

      C'est le contrôle qualité d'eXpérience transformé en interaction :
      la question « et après ? » ne se lit pas dans une checklist qu'on
      oublie — elle est posée par l'outil, et y répondre fait avancer
      l'écriture. */
  creerSuite(conclusionId, { titre = "", pitch = "" } = {}) {
    const c = this.conclusion(conclusionId);
    if (!c || c.vers) return null;
    const source = this.situation(c.de);
    if (!source) return null;
    const suite = this.creerSituation(source.trameId, {
      titre: titre || "Sans titre",
      pitch,
      x: (source.x || 0) + 240,
      y: (source.y || 0) + (this.conclusionsDe(c.de).indexOf(c) - 0.5) * 130,
    });
    c.vers = suite.id;
    this.save();
    this._emit({ type: "conclusion:maj", id: c.id, resolue: suite.id });
    return suite;
  },

  /** Relie une conclusion orpheline à une situation DÉJÀ écrite — les
      fils d'un GN se rejoignent souvent, ils ne font pas que diverger. */
  relierConclusion(conclusionId, versSituationId) {
    const c = this.conclusion(conclusionId);
    if (!c || !this.situation(versSituationId)) return null;
    c.vers = versSituationId;
    this.save();
    this._emit({ type: "conclusion:maj", id: c.id, resolue: versSituationId });
    return c;
  },

  /* ================= Remise à zéro ================= */

  vider() {
    this._data = { trames: [], situations: [], conclusions: [] };
    this.save();
    this._emit({ type: "trames:vider" });
  },
};
