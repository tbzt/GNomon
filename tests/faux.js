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

import { vue as vueDe, existeA as existeFacette, facettesDe } from "../js/core/personnes.js";

/** `{ personnages, liens, groupes, sieges, epoques }` → l'interface de `ReseauStore`.

    Un personnage de test peut être PLAT (l'ancien modèle, un champ
    `epoqueId` optionnel) ou une personne à `facettes`. Le faux rend des
    vues plates dans les deux cas, comme le vrai store. `epoques` est
    l'ordre des époques, pour la vue et pour `epoquesDe`. */
export function fauxReseau({ personnages = [], liens = [], groupes = [], sieges = [], epoques = [] } = {}) {
  const ordre = epoques;
  const F = personnages.filter((p) => p && p.facettes).map((p, i) => ({ id: p.id || `f${i}`, nom: "", pj: true, portrait: "", x: null, y: null, ...p }));
  const P = personnages.filter((p) => !(p && p.facettes)).map((p, i) => ({
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
    roleId: null,
    epoqueId: null,
    presentA: true,
    ...p,
  }));
  const plat = (id, ep) => {
    const p = P.find((x) => x.id === id);
    if (p) return p;
    const f = F.find((x) => x.id === id);
    return f ? vueDe(f, ep === undefined ? null : ep, ordre) : null;
  };
  const tous = (ep) => [...P, ...F.map((f) => vueDe(f, ep === undefined ? null : ep, ordre))];
  const existe = (id, ep) => {
    const f = F.find((x) => x.id === id);
    if (f) return existeFacette(f, ep);
    const p = P.find((x) => x.id === id);
    return !!p && (!ep || !p.epoqueId || p.epoqueId === ep);
  };
  const visible = (l, ep) => !l.epoqueId || !ep || l.epoqueId === ep;
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
    sieges: () => sieges,
    siege: (id) => sieges.find((x) => x.id === id) || null,
    personnages: (ep) => tous(ep),
    personnage: (id, ep) => plat(id, ep),
    existeA: (id, ep = null) => existe(id, ep),
    epoquesDe: (id) => {
      const f = F.find((x) => x.id === id);
      if (f) return facettesDe(f, ordre);
      const p = P.find((x) => x.id === id);
      return p ? [p.epoqueId || "*"] : [];
    },
    epoqueCourante: () => null,
    ordreEpoques: () => ordre,
    pj: (ep) => tous(ep).filter((p) => p.pj),
    pnj: (ep) => tous(ep).filter((p) => !p.pj),
    // Sans époque, le tableau lui-même : des tests y poussent des liens.
    liens: (ep) => (ep == null ? L : L.filter((l) => visible(l, ep))),
    liensBruts: () => L,
    liensDe: (id, ep) => L.filter((l) => l.de === id && visible(l, ep)),
    liensVers: (id, ep) => L.filter((l) => l.vers === id && visible(l, ep)),
    liensTouchant: (id, ep) => L.filter((l) => (l.de === id || l.vers === id) && visible(l, ep)),
    reciproque: (l) => L.find((x) => x.de === l.vers && x.vers === l.de) || null,
    miroirDe: (id, ep) => L.find((l) => l.de === id && l.miroir && visible(l, ep)) || null,
    groupes: () => G,
    groupe: (id) => G.find((g) => g.id === id) || null,
    membresDe: (id, ep) => tous(ep).filter((p) => p.groupeId === id),
  };
}

/** `{ trames, situations, conclusions }` → l'interface de `TrameStore`. */
export function fauxTrames({ trames = [], situations = [], conclusions = [] } = {}) {
  const T = trames.map((t, i) => ({ id: t.id || `t${i}`, titre: "", porteurId: null, ...t }));
  const S = situations.map((s, i) => ({
    id: s.id || `s${i}`,
    trameId: T[0] ? T[0].id : null,
    epoqueId: null,
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
    epoqueDe: (id) => {
      const s = S.find((x) => x.id === id);
      if (!s) return null;
      if (s.epoqueId) return s.epoqueId;
      const t = T.find((x) => x.id === s.trameId);
      return (t && t.epoqueId) || null;
    },
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
    enonce: "",
    influence: "latente",
    etats: {},
    croyances: {},
    etatsParEpoque: {},
    croyancesParEpoque: {},
    ...i,
  }));
  const trouve = (id) => I.find((x) => x.id === id) || null;
  const etatDe = (i, p, ep) => {
    if (ep && i.etatsParEpoque[ep] && i.etatsParEpoque[ep][p]) return i.etatsParEpoque[ep][p];
    return i.etats[p] || "ignore";
  };
  return {
    informations: () => I,
    information: trouve,
    etat: (id, p, ep = null) => {
      const i = trouve(id);
      return i ? etatDe(i, p, ep) : "ignore";
    },
    croyance: (id, p, ep = null) => {
      const i = trouve(id);
      if (!i) return "";
      if (ep && i.croyancesParEpoque[ep] && i.croyancesParEpoque[ep][p] != null) return i.croyancesParEpoque[ep][p];
      return i.croyances[p] || "";
    },
    detenteurs: (id, ep = null) => {
      const i = trouve(id);
      if (!i) return [];
      const ids = new Set([...Object.keys(i.etats), ...Object.keys((ep && i.etatsParEpoque[ep]) || {})]);
      return [...ids].filter((p) => etatDe(i, p, ep) === "sait");
    },
    divergents: (id, ep = null) => {
      const i = trouve(id);
      if (!i) return [];
      const ids = new Set([...Object.keys(i.etats), ...Object.keys((ep && i.etatsParEpoque[ep]) || {})]);
      return [...ids].filter((p) => etatDe(i, p, ep) === "croit");
    },
    parPersonnage: (p, ep = null) => ({
      sait: I.filter((i) => etatDe(i, p, ep) === "sait"),
      croit: I.filter((i) => etatDe(i, p, ep) === "croit"),
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
    fil: "",
    ...champs,
  };
  return {
    monde: () => m,
    epoques: () => [...(m.epoques || [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)),
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
