"use strict";

/* ============================================================
   RÉSEAU STORE — la vérité racine de GNomon.
   ------------------------------------------------------------
   En JdR, la vérité racine est la scène : le MJ tient la trame, les PJ
   la traversent. **En GN, le joueur EST la trame** — et toute la
   littérature converge là-dessus (Kröger : « aucun contact pertinent »
   est le premier symptôme d'un mauvais personnage ; méthode eXpérience :
   « créer un réseau plutôt qu'une somme d'individualités »).

   Donc ici, la vérité racine est **l'arête**. Ce store la détient, avec
   ses deux bouts.

       Personnage { id, nom, role, pj, groupeId,
                    fonction, moral, desir, besoin, faiblesse,
                    pouvoirs, transformation, archetype, surprise,
                    notes, objectifs[], possede[], pressions[] }
       Lien       { id, de, vers, nature, enonce, tonalite, importance, miroir }

   ── CE QU'IL A, ET CE QUI LE PRESSE ──
   `objectifs` dit ce qu'il cherche. `possede` dit ce qu'il a sur lui
   — un objet, un papier, une somme, une clé — et `pressions` ce qui
   tombe si rien n'est fait avant une heure. Trois listes de phrases,
   pas des objets : c'est ce que le livret imprime, et c'est ce qui
   manquait pour qu'un joueur joue une journée plutôt qu'un souvenir.
   L'audit de jouabilité (septembre 2026) a compté vingt-quatre objets
   qui faisaient tout le jeu d'un GN et n'avaient de détenteur nulle
   part.

   ── LE LIEN A DEUX TEXTES, COMME L'INFORMATION ──
   `nature` est la carte de l'auteur : « Le premier des cinq à qui
   l'offre est faite ». `enonce` est ce que le joueur lit, à la
   deuxième personne. Tant qu'il n'y avait qu'un texte, le livret
   imprimait la nature — et disait au joueur ce que son personnage
   ignore. Même leçon que `contenu` / `enonce` sur l'information.
       Groupe     { id, nom }

   Les huit champs narratifs du personnage sont ceux de la méthode
   eXpérience (annexe « caractéristiques à déterminer »). Ils ne sont
   jamais obligatoires : un personnage à un seul nom est valide.

   ── `notes` ET `background` NE SONT PAS LA MÊME CHOSE ──
   `background` est le texte **remis au joueur** — long, en pages, avec
   ses images et ses indications de style. `notes` est le carnet de
   l'auteur, qui ne sort **jamais**. La distinction n'est pas du confort :
   sans elle, un « à révéler plus tard » griffonné dans le carnet part
   dans le livret. Migration `storage.js` v2.

   ── LE LIEN EST ORIENTÉ, et c'est un choix, pas une facilité ──
   Kröger pose la question du contact-miroir en deux temps : « qui est le
   personnage le plus important pour le tien ? » puis **« ton personnage
   est-il aussi important pour lui ? »**. Cette seconde question n'est
   vérifiable que si les deux sens existent séparément. Une arête non
   orientée écraserait l'asymétrie — or l'asymétrie est le matériau.

   Un lien symétrique s'écrit donc en deux liens (`upsertPaire` le fait
   d'un coup). La réciprocité se **dérive** (`reciproque`), elle ne se
   stocke pas : deux vérités pour un même fait, c'est une divergence
   garantie.

   ── INVARIANTS TENUS ICI ──
   1. `tonalite` et `importance` sont des énumérations fermées. Une
      valeur inconnue est refusée, jamais stockée en douce : le jour où
      un validateur compte les contacts positifs, il ne doit pas
      découvrir un « positif  » avec une espace.
   2. **Un seul contact-miroir par personnage.** Poser un nouveau miroir
      retire le précédent — sinon la règle « personne n'est laissé seul »
      se compte deux fois.
   3. Supprimer un personnage purge ses liens (et renvoie les liens
      retirés, pour un undo côté appelant).

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

/** Tonalité d'un lien — Kröger, « tone of the contact ». */
export const TONALITES = Object.freeze({
  positif: "Positif",
  negatif: "Négatif",
  neutre: "Neutre",
  complique: "Compliqué",
});

/** Importance d'un lien — Kröger, « primary / secondary / nice to have ». */
export const IMPORTANCES = Object.freeze({
  primaire: "Primaire",
  secondaire: "Secondaire",
  confort: "Confort",
});

/** Fonctions narratives — méthode eXpérience, étape 5. */
export const FONCTIONS = Object.freeze({
  heros: "Héros",
  adversaire: "Adversaire",
  allie: "Allié",
  fauxAllie: "Faux allié / adversaire",
  fauxAdversaire: "Faux adversaire / allié",
  secondaire: "Personnage secondaire",
});

const VIDE = { personnages: [], liens: [], groupes: [], sieges: [] };

export const ReseauStore = {
  _key: "reseau",
  _data: null,
  _observers: new Set(),

  /* ================= Persistance ================= */

  load() {
    const raw = Storage.get(this._key, null);
    this._data = {
      personnages: Array.isArray(raw?.personnages) ? raw.personnages : [],
      liens: Array.isArray(raw?.liens) ? raw.liens : [],
      groupes: Array.isArray(raw?.groupes) ? raw.groupes : [],
      sieges: Array.isArray(raw?.sieges) ? raw.sieges : [],
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

  _uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  /* ================= Émission sémantique =================
     On émet CE QUI a changé, pas « quelque chose a changé » : une
     lentille ouverte doit pouvoir re-projeter le seul nœud touché
     plutôt que de tout redessiner — sinon on écrase l'état de l'écran
     sous le curseur de l'auteur. */

  subscribe(cb) {
    if (typeof cb === "function") this._observers.add(cb);
    return () => this._observers.delete(cb);
  },

  _emit(evt) {
    for (const cb of this._observers) {
      try {
        cb(evt);
      } catch (e) {
        Debug.warn("reseau", "observateur échoué", { evt, error: e });
      }
    }
  },

  /* ================= Personnages ================= */

  personnages() {
    return this._d().personnages;
  },

  personnage(id) {
    return this._d().personnages.find((p) => p && p.id === id) || null;
  },

  /** Les PJ seuls — la plupart des validateurs ne portent que sur eux. */
  pj() {
    return this._d().personnages.filter((p) => p && p.pj);
  },

  /** Les PNJ seuls — porteurs de trame, et sujets à une charge. */
  pnj() {
    return this._d().personnages.filter((p) => p && !p.pj);
  },

  creerPersonnage({ nom = "", pj = true, groupeId = null, ...champs } = {}) {
    const p = {
      id: this._uid("p"),
      nom,
      role: "",
      pj: !!pj,
      groupeId,
      /* Une incarnation appartient à un rôle et se situe à une époque.
         Par défaut elle est son propre rôle et n'a pas d'époque : c'est
         le cas d'un GN à un seul moment, et il ne doit rien écrire. */
      roleId: null,
      epoqueId: null,
      fonction: null,
      moral: "",
      desir: "",
      besoin: "",
      faiblesse: "",
      pouvoirs: "",
      transformation: "",
      archetype: "",
      surprise: false,
      notes: "",
      background: "",
      style: "",
      objectifs: [],
      possede: [],
      pressions: [],
      portrait: "",
      images: [],
      x: null,
      y: null,
      ...champs,
    };
    this._d().personnages.push(p);
    this.save();
    this._emit({ type: "personnage:creer", id: p.id });
    return p;
  },

  majPersonnage(id, patch = {}) {
    const p = this.personnage(id);
    if (!p) return null;
    Object.assign(p, patch, { id: p.id });
    this.save();
    this._emit({ type: "personnage:maj", id });
    return p;
  },

  /** Supprime un personnage ET purge ses liens. Renvoie
      `{ personnage, liens }` — de quoi annuler l'opération. */
  supprimerPersonnage(id) {
    const d = this._d();
    const i = d.personnages.findIndex((p) => p && p.id === id);
    if (i < 0) return null;
    const personnage = d.personnages.splice(i, 1)[0];
    const liens = d.liens.filter((l) => l && (l.de === id || l.vers === id));
    if (liens.length) d.liens = d.liens.filter((l) => l && l.de !== id && l.vers !== id);
    this.save();
    this._emit({ type: "personnage:supprimer", id, liensPurges: liens.length });
    return { personnage, liens };
  },

  /** Réinsère un personnage et ses liens (undo). Idempotent par id. */
  restaurer({ personnage, liens = [] } = {}) {
    if (!personnage || !personnage.id) return;
    const d = this._d();
    if (!d.personnages.some((p) => p && p.id === personnage.id))
      d.personnages.push(personnage);
    const vus = new Set(d.liens.map((l) => l && l.id));
    for (const l of liens) if (l && l.id && !vus.has(l.id)) d.liens.push(l);
    this.save();
    this._emit({ type: "personnage:creer", id: personnage.id });
  },

  /** Position sur le graphe du réseau. Écrite SANS émettre — le
      glisser en produirait des dizaines par seconde, et re-projeterait
      le graphe sous le doigt. Même règle que `poserSituation`. */
  poserPersonnage(id, x, y) {
    const p = this.personnage(id);
    if (!p) return;
    p.x = x;
    p.y = y;
    this.save();
  },

  /* ================= Portrait =================
     Distinct des `images` : le portrait est le VISAGE, celui qui va au
     trombinoscope et en tête de livret. Il est carré et petit
     (360 px) parce qu'il sera tiré quarante fois sur une planche — une
     image de background, elle, peut se permettre 900 px puisqu'il n'y
     en a qu'une ou deux par fiche. */

  majPortrait(personnageId, src) {
    const p = this.personnage(personnageId);
    if (!p) return null;
    p.portrait = src || "";
    this.save();
    this._emit({ type: "personnage:maj", id: personnageId });
    return p;
  },

  /** Combien manquent — le trombinoscope s'en sert pour dire quoi
      faire plutôt que d'afficher des silhouettes sans rien dire. */
  sansPortrait(pjSeulement = true) {
    const gens = pjSeulement ? this.pj() : this.personnages();
    return gens.filter((p) => !(p.portrait || "").trim());
  },

  /* ================= Images d'un personnage =================
     Une image est soit une **URL** (gratuite, mais le livret aura
     besoin du réseau pour s'afficher), soit un **data:URI** (le livret
     reste autonome, mais chaque image pèse sur le quota du
     `localStorage`). Les deux sont légitimes, et l'écran dit le
     compromis plutôt que de choisir à la place de l'auteur. */

  ajouterImage(personnageId, src, legende = "") {
    const p = this.personnage(personnageId);
    if (!p || !src) return null;
    if (!Array.isArray(p.images)) p.images = [];
    const img = { id: this._uid("i"), src, legende };
    p.images.push(img);
    this.save();
    this._emit({ type: "personnage:maj", id: personnageId });
    return img;
  },

  majImage(personnageId, imageId, patch = {}) {
    const p = this.personnage(personnageId);
    const img = p && (p.images || []).find((x) => x && x.id === imageId);
    if (!img) return null;
    Object.assign(img, patch, { id: img.id });
    this.save();
    this._emit({ type: "personnage:maj", id: personnageId });
    return img;
  },

  supprimerImage(personnageId, imageId) {
    const p = this.personnage(personnageId);
    if (!p) return;
    p.images = (p.images || []).filter((x) => x && x.id !== imageId);
    this.save();
    this._emit({ type: "personnage:maj", id: personnageId });
  },

  /* ================= Liens ================= */

  liens() {
    return this._d().liens;
  },

  lien(id) {
    return this._d().liens.find((l) => l && l.id === id) || null;
  },

  /** Liens sortants — « les contacts que ce personnage déclare ». */
  liensDe(id) {
    return this._d().liens.filter((l) => l && l.de === id);
  },

  /** Liens entrants — « pour qui ce personnage compte ».
      C'est le sens que lit le validateur « personne n'est seul ». */
  liensVers(id) {
    return this._d().liens.filter((l) => l && l.vers === id);
  },

  liensTouchant(id) {
    return this._d().liens.filter((l) => l && (l.de === id || l.vers === id));
  },

  /** Le lien de retour, s'il existe. Dérivé, jamais stocké. */
  reciproque(lien) {
    if (!lien) return null;
    return (
      this._d().liens.find((l) => l && l.de === lien.vers && l.vers === lien.de) || null
    );
  },

  /** Le contact-miroir déclaré par ce personnage (au plus un). */
  miroirDe(id) {
    return this._d().liens.find((l) => l && l.de === id && l.miroir) || null;
  },

  /** Insère ou met à jour un lien. Unicité par (de, vers) : re-poser le
      même couple met à jour plutôt que d'empiler un doublon.
      Refuse une tonalité ou une importance hors énumération. */
  upsertLien({
    de,
    vers,
    nature = "",
    enonce = "",
    tonalite = "neutre",
    importance = "secondaire",
    miroir = false,
  } = {}) {
    if (!de || !vers || de === vers) {
      Debug.warn("reseau", "lien invalide (bouts manquants ou identiques)", { de, vers });
      return null;
    }
    if (!(tonalite in TONALITES)) {
      Debug.warn("reseau", "tonalité inconnue, lien refusé", { tonalite });
      return null;
    }
    if (!(importance in IMPORTANCES)) {
      Debug.warn("reseau", "importance inconnue, lien refusé", { importance });
      return null;
    }

    const d = this._d();
    let l = d.liens.find((x) => x && x.de === de && x.vers === vers);
    if (l) Object.assign(l, { nature, enonce, tonalite, importance, miroir: !!miroir });
    else {
      l = { id: this._uid("l"), de, vers, nature, enonce, tonalite, importance, miroir: !!miroir };
      d.liens.push(l);
    }

    // Invariant 2 : un seul miroir par personnage.
    if (l.miroir)
      for (const autre of d.liens)
        if (autre && autre.de === de && autre.id !== l.id) autre.miroir = false;

    this.save();
    this._emit({ type: "lien:upsert", id: l.id, de, vers });
    return l;
  },

  /** Pose les deux sens d'un coup. `retour` hérite de l'aller pour tout
      ce qu'il ne redéfinit pas — un lien symétrique se dit en une ligne,
      un lien asymétrique en deux mots. */
  upsertPaire(aller, retour = {}) {
    const a = this.upsertLien(aller);
    if (!a) return null;
    const b = this.upsertLien({
      de: aller.vers,
      vers: aller.de,
      nature: aller.nature,
      tonalite: aller.tonalite,
      importance: aller.importance,
      // L'énoncé est à la deuxième personne : celui de l'aller ne peut
      // pas servir au retour. Il se réécrit, ou reste vide.
      enonce: "",
      miroir: false,
      ...retour,
    });
    return [a, b];
  },

  supprimerLien(id) {
    const d = this._d();
    const i = d.liens.findIndex((l) => l && l.id === id);
    if (i < 0) return null;
    const l = d.liens.splice(i, 1)[0];
    this.save();
    this._emit({ type: "lien:supprimer", id, de: l.de, vers: l.vers });
    return l;
  },

  /* ================= Sièges =================
     Un siège est ce qu'une personne réelle occupe : la suite des
     incarnations qu'elle jouera. Il ne se DÉRIVE pas — deux fiches
     jouées par le même comédien sont une décision de casting, pas un
     fait lisible dans le texte — alors que le rôle, lui, se lit dans
     `roleId` et n'a donc pas de table.

     Le store ne REFUSE pas un siège invalide : un GN à moitié écrit en
     contient tout le temps, et refuser empêcherait d'écrire. Les règles
     se lisent dans `epoques.anomalies()`, comme les anomalies de
     normalisation se lisent au lieu de bloquer l'import. */

  sieges() {
    return this._d().sieges;
  },

  siege(id) {
    return this._d().sieges.find((s) => s && s.id === id) || null;
  },

  creerSiege(nom = "", personnageIds = []) {
    const s = { id: this._uid("S"), nom, personnageIds: [...personnageIds] };
    this._d().sieges.push(s);
    this.save();
    this._emit({ type: "siege:creer", id: s.id });
    return s;
  },

  majSiege(id, patch = {}) {
    const s = this.siege(id);
    if (!s) return null;
    Object.assign(s, patch, { id: s.id });
    this.save();
    this._emit({ type: "siege:maj", id });
    return s;
  },

  supprimerSiege(id) {
    const d = this._d();
    const i = d.sieges.findIndex((s) => s && s.id === id);
    if (i < 0) return false;
    d.sieges.splice(i, 1);
    this.save();
    this._emit({ type: "siege:supprimer", id });
    return true;
  },

  /** Assied un personnage. Il quitte son siège précédent : un joueur
      n'occupe qu'une place, et laisser le doublon serait exactement le
      bug qu'on cherche à rendre impossible. */
  asseoir(siegeId, personnageId) {
    const s = this.siege(siegeId);
    if (!s || !this.personnage(personnageId)) return null;
    for (const autre of this._d().sieges) {
      if (autre.id === siegeId) continue;
      autre.personnageIds = (autre.personnageIds || []).filter((x) => x !== personnageId);
    }
    if (!s.personnageIds.includes(personnageId)) s.personnageIds.push(personnageId);
    this.save();
    this._emit({ type: "siege:maj", id: siegeId });
    return s;
  },

  lever(siegeId, personnageId) {
    const s = this.siege(siegeId);
    if (!s) return null;
    s.personnageIds = (s.personnageIds || []).filter((x) => x !== personnageId);
    this.save();
    this._emit({ type: "siege:maj", id: siegeId });
    return s;
  },

  /** Déclare que deux incarnations sont la MÊME personne. Le rôle de la
      première l'emporte : on rattache la nouvelle à l'ancienne, jamais
      l'inverse, pour que l'identité la plus anciennement écrite reste
      la référence. */
  fusionnerRoles(idReference, idAutre) {
    const a = this.personnage(idReference);
    const b = this.personnage(idAutre);
    if (!a || !b || a.id === b.id) return null;
    const rid = a.roleId || a.id;
    a.roleId = rid;
    b.roleId = rid;
    this.save();
    this._emit({ type: "personnage:maj", id: b.id });
    return rid;
  },

  /* ================= Groupes ================= */

  groupes() {
    return this._d().groupes;
  },

  groupe(id) {
    return this._d().groupes.find((g) => g && g.id === id) || null;
  },

  creerGroupe(nom = "") {
    const g = { id: this._uid("g"), nom };
    this._d().groupes.push(g);
    this.save();
    this._emit({ type: "groupe:creer", id: g.id });
    return g;
  },

  majGroupe(id, patch = {}) {
    const g = this.groupe(id);
    if (!g) return null;
    Object.assign(g, patch, { id: g.id });
    this.save();
    this._emit({ type: "groupe:maj", id });
    return g;
  },

  /** Supprime un groupe. Les personnages qui y étaient deviennent
      sans groupe — on ne les supprime pas avec le classeur. */
  supprimerGroupe(id) {
    const d = this._d();
    const i = d.groupes.findIndex((g) => g && g.id === id);
    if (i < 0) return null;
    const g = d.groupes.splice(i, 1)[0];
    for (const p of d.personnages) if (p && p.groupeId === id) p.groupeId = null;
    this.save();
    this._emit({ type: "groupe:supprimer", id });
    return g;
  },

  membresDe(groupeId) {
    return this._d().personnages.filter((p) => p && p.groupeId === groupeId);
  },

  /* ================= Remise à zéro ================= */

  vider() {
    this._data = { personnages: [], liens: [], groupes: [], sieges: [] };
    this.save();
    this._emit({ type: "reseau:vider" });
  },
};
