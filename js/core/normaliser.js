"use strict";

/* ============================================================
   NORMALISER — ce qui entre doit ressembler à ce que le modèle promet.
   ------------------------------------------------------------
   ── LE TROU ──
   Les invariants du modèle sont tenus dans les stores, et ils le sont
   bien : `upsertLien` refuse une tonalité inconnue, `LiensStore.ajouter`
   refuse une adresse qui n'est pas `http(s)`, `poser()` tient
   « ignore = absence ». Mais ces gardes sont posées sur les **portes
   d'écriture**, et il existe deux chemins qui ne passent pas par elles :

   · **l'import d'archive**, qui écrit les blocs directement ;
   · **la synchronisation**, qui recoud des documents venus d'ailleurs.

   Le second est le plus sérieux, pour deux raisons. Il est
   **automatique** — personne ne choisit d'ouvrir ce fichier-là — et
   depuis l'espace partagé, ce qui arrive vient d'**autres personnes**.
   Un lien du hub y voyage avec son `url`, qui sera rendue dans un
   `href` sans repasser par `urlSure()`.

   Constaté aussi, et c'est le plus visible : une information sans
   `etats` passe l'enveloppe de l'archive, s'écrit, et casse l'écran
   « Qui sait quoi » de façon permanente — le rechargement ne répare
   rien, puisque le mauvais paquet est devenu la vérité locale.

   ── CE QUE FAIT CE MODULE ──
   Il rend une valeur **utilisable par les stores**, et la liste de ce
   qu'il a dû réparer ou écarter. Deux granularités, une seule table de
   règles :

       normaliserDocument(collection, d)  →  { d, anomalies }
       normaliserBloc(cle, brut)          →  { bloc, anomalies }

   La première sert à la synchronisation, qui travaille document par
   document. La seconde à l'import et au chargement.

   ── IL RÉPARE PLUTÔT QU'IL NE REFUSE ──
   Un champ absent reprend son défaut, une énumération inconnue retombe
   sur sa valeur neutre. On n'écarte un objet que s'il n'a pas d'identité
   (sans `id`, rien ne peut le désigner) ou si ce qui le définit est
   inutilisable — un lien externe sans adresse sûre n'est pas un lien.

   Refuser tout un GN parce qu'un personnage est abîmé serait pire :
   l'auteur perdrait quarante fiches pour une virgule. On répare, et on
   **dit ce qu'on a réparé** — c'est à l'appelant de le montrer.

   ── IL NE RÉORDONNE RIEN ──
   La main courante est rangée du plus récent au plus ancien, et la
   conduite en dépend. On parcourt donc les listes en place, sans jamais
   les trier. (`recoudre` de `objets.js`, lui, trie — c'est pour ça
   qu'on ne s'en sert pas ici.)

   Module **pur** : des données entrent, des données sortent.
   ============================================================ */
import { TONALITES, IMPORTANCES, FONCTIONS } from "./reseaustore.js";
import { TYPES_CONCLUSION } from "./tramestore.js";
import { INFLUENCES, ETATS } from "./informationstore.js";
import { urlSure } from "./liensstore.js";
import { planDe, RESTE } from "./objets.js";
import { CHAMPS_FACETTE, facetteVide, TOUTES } from "./personnes.js";

/* ---- Coercitions ---- */

const txt = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const bool = (v) => !!v;
const nombre = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const liste = (v) => (Array.isArray(v) ? v : []);
const carte = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const idOuNull = (v) => (v == null || v === "" ? null : txt(v));
const dans = (v, table, defaut) => (typeof v === "string" && v in table ? v : defaut);

/** Une source d'image sûre à poser dans un `src`. On accepte le web et
    les images embarquées, rien d'autre : un `data:text/html` rendu
    ailleurs qu'en `<img>` deviendrait un document. */
function srcSure(v) {
  const s = txt(v).trim();
  if (!s) return "";
  if (/^data:image\/[a-z.+-]+;/i.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : "";
  } catch {
    return "";
  }
}

/* ---- Les règles, par collection ----
   Chacune rend l'objet réparé, ou `null` pour l'écarter. `note` sert à
   signaler une réparation qui mérite d'être dite. */

/** Une facette réparée : chaque champ reprend son défaut. */
function facette(f, note) {
  f = carte(f);
  return {
    ...facetteVide(),
    role: txt(f.role),
    groupeId: idOuNull(f.groupeId),
    fonction: f.fonction == null ? null : dans(f.fonction, FONCTIONS, null),
    moral: txt(f.moral),
    desir: txt(f.desir),
    besoin: txt(f.besoin),
    faiblesse: txt(f.faiblesse),
    pouvoirs: txt(f.pouvoirs),
    transformation: txt(f.transformation),
    archetype: txt(f.archetype),
    surprise: bool(f.surprise),
    notes: txt(f.notes),
    background: txt(f.background),
    style: txt(f.style),
    objectifs: liste(f.objectifs).map(txt),
    possede: liste(f.possede).map(txt),
    pressions: liste(f.pressions).map(txt),
    images: liste(f.images)
      .filter((i) => i && i.id)
      .map((i) => ({ ...i, src: garder(srcSure(i.src), i.src, note, "image à source refusée"), legende: txt(i.legende) }))
      .filter((i) => i.src),
  };
}

const REGLES = {
  // Une personne à facettes. Un objet PLAT — ancien modèle, ou pair
  // ancien — entre dans une seule facette : celle de son époque, ou
  // « * ». Ses champs plats sont retirés de la surface : deux sources
  // pour une même chose finiraient par diverger. Une personne NUE —
  // ni facettes, ni champ plat — est un document de l'espace partagé,
  // dont les facettes voyagent à part (cf. objets.js) : on ne lui en
  // invente pas, sinon son empreinte mentirait à chaque tour.
  "reseau.personnages": (o, note) => {
    const facettes = {};
    const plate = CHAMPS_FACETTE.some((k) => k in o) || "epoqueId" in o || "roleId" in o;
    if (o.facettes && typeof o.facettes === "object" && !Array.isArray(o.facettes)) {
      for (const [k, f] of Object.entries(o.facettes)) if (k) facettes[k] = facette(f, note);
    } else if (plate) {
      facettes[o.epoqueId || TOUTES] = facette(o, note);
    }
    const p = {
      ...o,
      nom: txt(o.nom),
      pj: bool(o.pj),
      portrait: garder(srcSure(o.portrait), o.portrait, note, "portrait à source refusée"),
      x: nombre(o.x),
      y: nombre(o.y),
    };
    if (plate || o.facettes !== undefined) p.facettes = facettes;
    for (const k of [...CHAMPS_FACETTE, "roleId", "epoqueId"]) delete p[k];
    return p;
  },

  // Une facette qui voyage seule (§ objets.js) : elle dit à qui elle
  // est et à quelle époque, sinon personne ne peut la remettre.
  "reseau.facettes": (o, note) => {
    if (!o.personnageId || !o.epoqueId) {
      note("facette sans personne ni époque");
      return null;
    }
    return { id: txt(o.id), personnageId: txt(o.personnageId), epoqueId: txt(o.epoqueId), ...facette(o, note) };
  },

  // Un lien dont les bouts manquent ne désigne rien. Les énumérations
  // sont fermées DANS le store ; ici on les ramène plutôt que d'écarter
  // une arête écrite — c'est la vérité racine du projet.
  "reseau.liens": (o, note) => {
    if (!o.de || !o.vers || o.de === o.vers) return null;
    return {
      ...o,
      de: txt(o.de),
      vers: txt(o.vers),
      /* Pas d'époque = vrai partout. La parenté n'a pas de date. */
      epoqueId: o.epoqueId || null,
      nature: txt(o.nature),
      // Ce que lit le joueur. Absent = vide, et le livret le dit.
      enonce: txt(o.enonce),
      tonalite: garder(dans(o.tonalite, TONALITES, null), o.tonalite, note, "tonalité inconnue") || "neutre",
      importance:
        garder(dans(o.importance, IMPORTANCES, null), o.importance, note, "importance inconnue") ||
        "secondaire",
      miroir: bool(o.miroir),
    };
  },

  "reseau.groupes": (o) => ({ ...o, nom: txt(o.nom) }),

  /* Un siège sans occupant est légitime — on le crée avant de caster.
     Un identifiant de personnage vide, non : il ne désigne rien. */
  "reseau.sieges": (o) => ({
    ...o,
    nom: txt(o.nom),
    personnageIds: liste(o.personnageIds).map(txt).filter(Boolean),
  }),

  // L'époque d'une trame est celle de ses scènes, sauf redite sur une
  // scène. `null` = pas d'époque, ou héritée.
  "trames.trames": (o) => ({
    ...o,
    titre: txt(o.titre),
    porteurId: idOuNull(o.porteurId),
    notes: txt(o.notes),
    epoqueId: o.epoqueId || null,
  }),

  "trames.situations": (o) => ({
    ...o,
    trameId: idOuNull(o.trameId),
    epoqueId: o.epoqueId || null,
    titre: txt(o.titre),
    pitch: txt(o.pitch),
    pointDeVueId: idOuNull(o.pointDeVueId),
    castIds: liste(o.castIds).map(txt).filter(Boolean),
    requiertIds: liste(o.requiertIds).map(txt).filter(Boolean),
    produitIds: liste(o.produitIds).map(txt).filter(Boolean),
    espace: txt(o.espace),
    debut: nombre(o.debut),
    fin: nombre(o.fin),
    miseEnScene: txt(o.miseEnScene),
    materiel: txt(o.materiel),
    joueurParticulier: txt(o.joueurParticulier),
    regles: txt(o.regles),
    terminale: bool(o.terminale),
    x: nombre(o.x) ?? 0,
    y: nombre(o.y) ?? 0,
  }),

  // `de` est l'appartenance d'une conclusion : sans elle, elle flotte.
  // `vers: null` est en revanche parfaitement valide — c'est la question
  // ouverte, moteur de la boucle « et après ? ».
  "trames.conclusions": (o, note) => {
    if (!o.de) return null;
    return {
      ...o,
      de: txt(o.de),
      vers: idOuNull(o.vers),
      texte: txt(o.texte),
      type: garder(dans(o.type, TYPES_CONCLUSION, null), o.type, note, "type de conclusion inconnu") || "normale",
    };
  },

  // LE CAS QUI CASSAIT UN ÉCRAN : sans `etats`, `InformationStore.etat()`
  // lève, et « Qui sait quoi » reste vide même après rechargement.
  "informations.informations": (o, note) => {
    const lire = (brutEtats, brutCroyances) => {
      const etats = {};
      const croyances = {};
      for (const [pid, e] of Object.entries(carte(brutEtats))) {
        const v = dans(e, ETATS, null);
        // « ignore » n'est jamais stocké : c'est l'absence.
        if (!v || v === "ignore") continue;
        etats[pid] = v;
        if (v === "croit") croyances[pid] = txt(carte(brutCroyances)[pid]);
      }
      return { etats, croyances };
    };
    const base = lire(o.etats, o.croyances);
    // Les exceptions datées : ce qu'une personne sait AUTREMENT à une
    // époque donnée. Rares, et gardées telles quelles.
    const etatsParEpoque = {};
    const croyancesParEpoque = {};
    for (const [ep, brut] of Object.entries(carte(o.etatsParEpoque))) {
      if (!ep) continue;
      const r = lire(brut, carte(o.croyancesParEpoque)[ep]);
      if (Object.keys(r.etats).length) etatsParEpoque[ep] = r.etats;
      if (Object.keys(r.croyances).length) croyancesParEpoque[ep] = r.croyances;
    }
    return {
      ...o,
      contenu: txt(o.contenu),
      // Ce que lit celui qui la sait. Absent = vide, et le livret le dit.
      enonce: txt(o.enonce),
      influence: garder(dans(o.influence, INFLUENCES, null), o.influence, note, "influence inconnue") || "latente",
      etats: base.etats,
      croyances: base.croyances,
      etatsParEpoque,
      croyancesParEpoque,
    };
  },

  "casting.candidatures": (o) => {
    const preferences = {};
    for (const [pid, rang] of Object.entries(carte(o.preferences))) {
      const n = Number(rang);
      if (n >= 1 && n <= 3) preferences[pid] = n;
    }
    return {
      ...o,
      label: txt(o.label),
      preferences,
      vetos: liste(o.vetos).map(txt).filter(Boolean),
      arrivee: nombre(o.arrivee),
      depart: nombre(o.depart),
      notes: txt(o.notes),
    };
  },

  // `note` sort dans le livret ; `prive` est la note d'équipe — « ne pas
  // y placer de scène avant 45 h », « l'orga n'y envoie personne » — et
  // ne sort que dans la consigne.
  "monde.lieux": (o) => ({ ...o, nom: txt(o.nom), note: txt(o.note), prive: txt(o.prive) }),

  // L'ordre est de la donnée : une époque sans `ordre` lisible passe en
  // tête plutôt que de casser le tri de `MondeStore.epoques()`.
  "monde.epoques": (o) => ({ ...o, nom: txt(o.nom), ordre: nombre(o.ordre) ?? 0 }),

  // Un interrupteur est une question que le jeu décide. Sans question,
  // il ne désigne rien — mais on le garde : l'auteur l'a créé.
  "monde.interrupteurs": (o) => ({
    ...o,
    question: txt(o.question),
    defaut: txt(o.defaut),
    note: txt(o.note),
    toucheIds: liste(o.toucheIds).map(txt).filter(Boolean),
  }),

  "run.journal": (o) => ({
    ...o,
    ts: nombre(o.ts) ?? 0,
    heure: nombre(o.heure),
    type: txt(o.type) || "note",
    texte: txt(o.texte),
    trameId: idOuNull(o.trameId),
    situationId: idOuNull(o.situationId),
  }),

  // LE HUB — c'est ici que le contournement comptait le plus. Ces
  // adresses partent dans un `href`, et `LiensStore.ajouter()` les
  // valide déjà ; l'import et la synchronisation ne passaient pas par
  // lui. Une adresse refusée retire le lien : il n'a plus d'objet.
  liens: (o, note) => {
    const url = txt(o.url).trim();
    if (!urlSure(url)) {
      note("adresse refusée", url.slice(0, 60));
      return null;
    }
    return { ...o, titre: txt(o.titre), url, note: txt(o.note), ancre: o.ancre == null ? null : txt(o.ancre) };
  },

  derogations: (o) => ({ justification: txt(o.justification), date: txt(o.date) }),

  suivi: (o) => ({ responsable: txt(o.responsable), fait: bool(o.fait), note: txt(o.note) }),
};

/** Les documents `_` : ce qui n'a pas d'identité propre. */
const RESTES = {
  monde: (o) => ({
    ...o,
    titre: txt(o.titre),
    premisse: txt(o.premisse),
    propos: txt(o.propos),
    thematique: txt(o.thematique),
    contexte: txt(o.contexte),
    intention: txt(o.intention),
    avertissements: txt(o.avertissements),
    securiteNote: txt(o.securiteNote),
    pratique: txt(o.pratique),
    costume: txt(o.costume),
    references: txt(o.references),
    // Le fil de l'histoire : un texte long, d'organisation. Il entre
    // par l'archive et la synchronisation comme les autres, et repart
    // texte — jamais autre chose, quelle que soit la forme reçue.
    fil: txt(o.fil),
    securite: liste(o.securite).map(txt),
  }),
  casting: (o) => {
    const affectation = {};
    for (const [k, v] of Object.entries(carte(o.affectation))) if (v) affectation[k] = txt(v);
    return { ...o, affectation, dateAffectation: o.dateAffectation ? txt(o.dateAffectation) : null };
  },
  run: (o) => ({
    ...o,
    run: o.run
      ? {
          ...carte(o.run),
          debut: nombre(carte(o.run).debut) ?? 0,
          heureFiction: nombre(carte(o.run).heureFiction) ?? 20,
          pause: nombre(carte(o.run).pause),
          cumulPause: nombre(carte(o.run).cumulPause) ?? 0,
          fin: nombre(carte(o.run).fin),
        }
      : null,
    fils: carte(o.fils),
  }),
};

/** Retient la valeur propre, et ne signale que ce qui était PRÉSENT et
    a été refusé. Un champ absent qui reprend son défaut n'est pas une
    anomalie : le dire remplirait le rapport de bruit — « portrait à
    source refusée » pour un personnage qui n'en a jamais eu — et un
    rapport bruyant s'apprend à s'ignorer, ce qui coûte les vraies
    lignes en même temps que les fausses. */
function garder(propre, brut, note, quoi) {
  const present = brut !== undefined && brut !== null && brut !== "";
  if (present && propre !== brut && note) note(quoi);
  return propre;
}

/* ================= Un document ================= */

/**
 * Normalise UN document, tel que la synchronisation les reçoit.
 * Renvoie `{ d, anomalies }` ; `d` vaut `null` si le document est à
 * écarter.
 */
export function normaliserDocument(collection, brut, id = "") {
  const anomalies = [];
  // `quoi` est la CAUSE, stable, et `valeur` ce qui l'a provoquée. Les
  // mélanger — « adresse refusée (javascript:1) » — donne une cause
  // différente à chaque occurrence, donc un résumé qui ne groupe plus
  // rien. Trouvé par le test qui l'exigeait.
  const note = (quoi, valeur = "") => anomalies.push({ collection, id, quoi, valeur });

  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) {
    // Un reste peut légitimement être un objet nu ; tout le reste non.
    note("document illisible");
    return { d: null, anomalies };
  }

  const [cle, champ] = collection.includes(".") ? collection.split(".") : [collection, null];
  const regle = champ || !RESTES[cle] ? REGLES[collection] : null;

  if (!champ && RESTES[cle] && id === RESTE) return { d: RESTES[cle](brut), anomalies };
  if (!regle) return { d: brut, anomalies };

  // Tout ce qui vit dans une liste doit porter une identité : sans elle,
  // rien ne peut le désigner, ni le mettre à jour, ni le supprimer.
  if (champ && !brut.id) {
    note("objet sans identifiant");
    return { d: null, anomalies };
  }

  const avant = anomalies.length;
  const d = regle(brut, note);
  // La règle a déjà dit pourquoi (« adresse refusée ») : le répéter en
  // termes vagues ajouterait une ligne sans rien apprendre.
  if (d === null && anomalies.length === avant) note("objet inutilisable, écarté");
  return { d, anomalies };
}

/* ================= Un bloc entier ================= */

/**
 * Normalise le bloc d'une clé de projet — la forme qu'ont l'archive et
 * le `localStorage`. **L'ordre des listes est conservé** : la main
 * courante est rangée du plus récent au plus ancien et la conduite en
 * dépend.
 */
export function normaliserBloc(cle, brut) {
  const plan = planDe(cle);
  const anomalies = [];
  if (!plan) return { bloc: brut, anomalies };

  const filtrer = (collection, arr) => {
    const out = [];
    for (const o of liste(arr)) {
      const r = normaliserDocument(collection, o, o && o.id);
      anomalies.push(...r.anomalies);
      if (r.d !== null) out.push(r.d);
    }
    return out;
  };

  if (plan.nu) return { bloc: filtrer(cle, brut), anomalies };

  if (plan.carte) {
    const bloc = {};
    for (const [k, v] of Object.entries(carte(brut))) {
      const r = normaliserDocument(cle, v, k);
      anomalies.push(...r.anomalies);
      if (r.d !== null) bloc[k] = r.d;
    }
    return { bloc, anomalies };
  }

  const source = carte(brut);
  const bloc = {};
  for (const champ of plan.listes || []) bloc[champ] = filtrer(`${cle}.${champ}`, source[champ]);
  // Dans un bloc, une personne sans aucune facette n'existe à aucune
  // époque : elle en reçoit une, à « * ». (Par document, non : ses
  // facettes arrivent à part.)
  if (plan.facettes)
    for (const p of bloc[plan.facettes])
      if (!p.facettes || !Object.keys(p.facettes).length) p.facettes = { [TOUTES]: facetteVide() };

  if (plan.reste) {
    const reste = {};
    for (const [k, v] of Object.entries(source)) if (!(plan.listes || []).includes(k)) reste[k] = v;
    const r = normaliserDocument(cle, reste, RESTE);
    anomalies.push(...r.anomalies);
    Object.assign(bloc, r.d || {});
  }
  return { bloc, anomalies };
}

/** Une phrase pour l'écran : ce qui a été réparé, groupé par cause.
    Vingt lignes identiques noieraient la seule chose à savoir. */
export function resumeAnomalies(anomalies) {
  if (!anomalies || !anomalies.length) return "";
  const parCause = new Map();
  for (const a of anomalies) parCause.set(a.quoi, (parCause.get(a.quoi) || 0) + 1);
  return [...parCause.entries()].map(([quoi, n]) => (n > 1 ? `${quoi} (${n})` : quoi)).join(" · ");
}
