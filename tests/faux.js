"use strict";

/* ============================================================
   STORES FACTICES — l'interface de lecture, rien de plus.
   ------------------------------------------------------------
   Les modules purs prennent des stores en paramètre. On leur donne ici
   des objets montés à la main plutôt que les vrais : rien n'est écrit
   dans le `localStorage`, chaque cas est explicite, et l'exercice
   **prouve** que ces modules ne dépendent que d'une interface de
   lecture. Si l'un d'eux se mettait à appeler un singleton ou à muter
   son entrée, son test casserait aussitôt.

   Ces faux implémentent exactement ce que les modules appellent — pas
   plus. La liste ci-dessous est donc, accessoirement, la
   **documentation du contrat** que chaque pur exige.
   ============================================================ */

/** `{ personnages, liens, groupes }` → l'interface de `ReseauStore`. */
export function fauxReseau({ personnages = [], liens = [], groupes = [] } = {}) {
  const P = personnages.map((p, i) => ({
    id: p.id || `p${i}`,
    nom: p.nom || `Personnage ${i}`,
    role: "",
    pj: p.pj !== false,
    groupeId: null,
    moral: "",
    desir: "",
    besoin: "",
    faiblesse: "",
    pouvoirs: "",
    archetype: "",
    transformation: "",
    surprise: false,
    notes: "",
    background: "",
    style: "",
    objectifs: [],
    portrait: "",
    images: [],
    x: null,
    y: null,
    ...p,
  }));
  const L = liens.map((l, i) => ({
    id: l.id || `l${i}`,
    nature: "",
    tonalite: "neutre",
    importance: "secondaire",
    miroir: false,
    ...l,
  }));
  const G = groupes.map((g, i) => ({ id: g.id || `g${i}`, nom: g.nom || `Groupe ${i}`, ...g }));

  return {
    personnages: () => P,
    personnage: (id) => P.find((p) => p.id === id) || null,
    pj: () => P.filter((p) => p.pj),
    pnj: () => P.filter((p) => !p.pj),
    liens: () => L,
    liensDe: (id) => L.filter((l) => l.de === id),
    liensVers: (id) => L.filter((l) => l.vers === id),
    liensTouchant: (id) => L.filter((l) => l.de === id || l.vers === id),
    reciproque: (l) => L.find((x) => x.de === l.vers && x.vers === l.de) || null,
    miroirDe: (id) => L.find((l) => l.de === id && l.miroir) || null,
    groupes: () => G,
    groupe: (id) => G.find((g) => g.id === id) || null,
    membresDe: (id) => P.filter((p) => p.groupeId === id),
  };
}

/** `{ trames, situations, conclusions }` → l'interface de `TrameStore`. */
export function fauxTrames({ trames = [], situations = [], conclusions = [] } = {}) {
  const T = trames.map((t, i) => ({ id: t.id || `t${i}`, titre: "", porteurId: null, ...t }));
  const S = situations.map((s, i) => ({
    id: s.id || `s${i}`,
    trameId: T[0] ? T[0].id : null,
    titre: "",
    pitch: "",
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
    ...s,
  }));
  const C = conclusions.map((c, i) => ({
    id: c.id || `c${i}`,
    vers: null,
    texte: "",
    type: "normale",
    ...c,
  }));

  return {
    trames: () => T,
    trame: (id) => T.find((t) => t.id === id) || null,
    situations: (trameId = null) =>
      trameId == null ? S : S.filter((s) => s.trameId === trameId),
    situation: (id) => S.find((s) => s.id === id) || null,
    conclusions: () => C,
    conclusion: (id) => C.find((c) => c.id === id) || null,
    conclusionsDe: (id) => C.filter((c) => c.de === id),
    conclusionsVers: (id) => C.filter((c) => c.vers === id),
    requiert: (id) => (S.find((s) => s.id === id) || {}).requiertIds || [],
    produit: (id) => (S.find((s) => s.id === id) || {}).produitIds || [],
    situationsAvec: (infoId) => ({
      requiert: S.filter((s) => (s.requiertIds || []).includes(infoId)),
      produit: S.filter((s) => (s.produitIds || []).includes(infoId)),
    }),
    estEbauche: () => false,
  };
}

/** `[{ id, contenu, influence, etats, croyances }]` → `InformationStore`. */
export function fauxInfos(informations = []) {
  const I = informations.map((i, k) => ({
    id: i.id || `i${k}`,
    contenu: "",
    influence: "latente",
    etats: {},
    croyances: {},
    ...i,
  }));
  const trouve = (id) => I.find((x) => x.id === id) || null;
  return {
    informations: () => I,
    information: trouve,
    etat: (id, p) => (trouve(id) ? trouve(id).etats[p] || "ignore" : "ignore"),
    croyance: (id, p) => (trouve(id) ? trouve(id).croyances[p] || "" : ""),
    detenteurs: (id) => {
      const i = trouve(id);
      return i ? Object.keys(i.etats).filter((p) => i.etats[p] === "sait") : [];
    },
    divergents: (id) => {
      const i = trouve(id);
      return i ? Object.keys(i.etats).filter((p) => i.etats[p] === "croit") : [];
    },
    parPersonnage: (p) => ({
      sait: I.filter((i) => i.etats[p] === "sait"),
      croit: I.filter((i) => i.etats[p] === "croit"),
    }),
  };
}

/** L'interface de `MondeStore`. `securite` est la liste déjà résolue. */
export function fauxMonde(champs = {}, securite = [], lieux = []) {
  const m = {
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
    ...champs,
  };
  return {
    monde: () => m,
    mecaniquesActives: () => securite,
    lieux: () => lieux,
    securite: () => securite.map((s) => s.nom),
  };
}

/** L'interface de `CastingStore` pour les vœux et l'affectation. */
export function fauxCasting({ candidatures = [], affectation = {} } = {}) {
  const K = candidatures.map((c, i) => ({
    id: c.id || `k${i}`,
    label: c.label || `Joueur ${i + 1}`,
    preferences: {},
    vetos: [],
    arrivee: null,
    depart: null,
    ...c,
  }));
  return {
    candidatures: () => K,
    candidature: (id) => K.find((c) => c.id === id) || null,
    affectation: () => affectation,
    roleDe: (id) => affectation[id] || null,
    titulaireDe: (pid) => Object.keys(affectation).find((k) => affectation[k] === pid) || null,
    etatVoeu: (kid, pid) => {
      const c = K.find((x) => x.id === kid);
      if (!c) return 0;
      if ((c.vetos || []).includes(pid)) return "veto";
      return c.preferences[pid] || 0;
    },
  };
}

/** L'interface de `SuiviStore`, pour l'export des besoins. */
export function fauxSuivi(entrees = {}) {
  return {
    pour: (cle) => entrees[cle] || null,
    bilan: (cles) => ({
      total: cles.length,
      faits: cles.filter((c) => entrees[c] && entrees[c].fait).length,
      assignes: cles.filter((c) => entrees[c] && entrees[c].responsable).length,
    }),
  };
}
