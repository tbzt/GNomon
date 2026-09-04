"use strict";

/* ============================================================
   PERSONNES — la personne, et ce qu'elle est à chaque époque.
   ------------------------------------------------------------
   ── L'UNITÉ EST LA PERSONNE, L'ÉPOQUE EST UNE DIMENSION ──
   Le modèle précédent rangeait une **incarnation** par époque (Ange-65,
   Ange-85) et les reliait par un `roleId`. Sur un GN réel, les scènes
   de 1965 castaient l'identifiant de 1985, la matrice n'était remplie
   que sur 1985, et l'auteur voyait deux Toussainte dans sa liste. Les
   données disaient déjà : on écrit UNE personne, et c'est la scène qui
   sait à quelle époque elle se joue.

       Personnage { id, nom, pj, portrait, x, y,
                    facettes: { [epoqueId | "*"]: Facette } }
       Facette    { role, groupeId, fonction, moral, desir, besoin,
                    faiblesse, pouvoirs, transformation, archetype,
                    surprise, notes, background, style,
                    objectifs[], possede[], pressions[], images[] }

   La clé `"*"` est la facette « toutes les époques » : c'est la seule
   d'un GN à un seul moment, qui ne voit donc rien changer.

   ── LA VUE ──
   Le reste de l'outil lit des personnages **plats** : `p.moral`,
   `p.objectifs`, `p.groupeId`. Il continue. `vue(p, epoqueId)` rend la
   facette demandée fondue sur la personne — et c'est ce que le store
   renvoie. Une époque où la personne n'a pas de facette rend la
   facette la plus proche, jamais `null` : une scène de 1965 qui caste
   Régis doit pouvoir l'afficher depuis n'importe quel écran. C'est
   `existeA()` qui dit si la personne est de cette époque-là.

   ── LA CONVERSION ──
   `convertirIncarnations()` fait passer un GN de l'ancien modèle au
   nouveau : les incarnations d'un même rôle deviennent les facettes
   d'une personne, et tout ce qui les nommait — liens, casting de
   scène, états d'information, sièges, dérogations — est ramené sur
   l'identifiant conservé. Elle sert à la migration du stockage local,
   à l'import d'une archive de version 1, et elle est portée en Python
   pour convertir un fichier hors de l'outil : les deux ports se
   vérifient l'un l'autre.

   Module **pur**, sans store.
   ============================================================ */

export const TOUTES = "*";

export const CHAMPS_FACETTE = Object.freeze([
  "role", "groupeId", "fonction", "moral", "desir", "besoin", "faiblesse", "pouvoirs",
  "transformation", "archetype", "surprise", "notes", "background", "style",
  "objectifs", "possede", "pressions", "images",
]);

export const CHAMPS_COMMUNS = Object.freeze(["id", "nom", "pj", "portrait", "x", "y"]);

export function facetteVide() {
  return {
    role: "", groupeId: null, fonction: null, moral: "", desir: "", besoin: "", faiblesse: "",
    pouvoirs: "", transformation: "", archetype: "", surprise: false, notes: "", background: "",
    style: "", objectifs: [], possede: [], pressions: [], images: [],
  };
}

/** Une facette à partir d'un objet plat : on ne garde que ses champs. */
export function facetteDepuis(plat = {}) {
  const f = facetteVide();
  for (const k of CHAMPS_FACETTE) if (plat[k] !== undefined) f[k] = plat[k];
  return f;
}

/** Sépare un patch plat en ce qui est commun et ce qui est de facette. */
export function separer(patch = {}) {
  const commun = {};
  const facette = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id") continue;
    if (CHAMPS_COMMUNS.includes(k)) commun[k] = v;
    else if (CHAMPS_FACETTE.includes(k)) facette[k] = v;
  }
  return { commun, facette };
}

/** Les clés de facette d'une personne, dans l'ordre des époques puis "*". */
export function facettesDe(p, ordre = []) {
  const f = (p && p.facettes) || {};
  const cles = Object.keys(f);
  const rangDe = (k) => (k === TOUTES ? ordre.length : ordre.indexOf(k) >= 0 ? ordre.indexOf(k) : ordre.length + 1);
  return cles.sort((a, b) => rangDe(a) - rangDe(b));
}

/** La personne existe-t-elle à cette époque ? Sans époque demandée,
    dès qu'elle a une facette. Une facette "*" vaut pour toutes. */
export function existeA(p, epoqueId = null) {
  const f = (p && p.facettes) || {};
  if (!epoqueId) return Object.keys(f).length > 0;
  return !!(f[epoqueId] || f[TOUTES]);
}

/** La clé de facette qui répond à une époque — avec repli : la
    facette "*", puis la dernière époque connue, puis n'importe laquelle. */
export function cleFacette(p, epoqueId = null, ordre = []) {
  const f = (p && p.facettes) || {};
  if (epoqueId && f[epoqueId]) return epoqueId;
  if (f[TOUTES]) return TOUTES;
  const cles = facettesDe(p, ordre);
  if (!cles.length) return null;
  // Sans époque : la dernière déclarée qui existe. Avec une époque
  // absente : la plus proche AVANT elle (ce qu'il était encore), sinon
  // la première après.
  if (!epoqueId) return cles[cles.length - 1];
  const i = ordre.indexOf(epoqueId);
  if (i >= 0) {
    for (let j = i - 1; j >= 0; j--) if (f[ordre[j]]) return ordre[j];
    for (let j = i + 1; j < ordre.length; j++) if (f[ordre[j]]) return ordre[j];
  }
  return cles[cles.length - 1];
}

/** Le personnage plat, tel que le reste de l'outil le lit. `epoqueId`
    est la clé de facette servie (null pour "*"), `presentA` dit si la
    personne est vraiment de l'époque demandée. */
export function vue(p, epoqueId = null, ordre = []) {
  if (!p) return null;
  const cle = cleFacette(p, epoqueId, ordre);
  const f = cle ? p.facettes[cle] || {} : {};
  return {
    ...facetteVide(),
    ...f,
    id: p.id,
    nom: p.nom,
    pj: p.pj,
    portrait: p.portrait || "",
    x: p.x ?? null,
    y: p.y ?? null,
    epoqueId: cle === TOUTES ? null : cle,
    facette: cle,
    presentA: existeA(p, epoqueId),
  };
}

/** Un personnage plat de l'ancien modèle → une personne à une facette. */
export function personneDepuisPlat(o) {
  const cle = o.epoqueId || TOUTES;
  return {
    id: o.id,
    nom: o.nom || "",
    pj: o.pj !== false,
    portrait: o.portrait || "",
    x: o.x ?? null,
    y: o.y ?? null,
    facettes: { [cle]: facetteDepuis(o) },
  };
}

/* ================= La conversion ================= */

/**
 * Convertit les blocs d'un GN de l'ancien modèle (incarnations reliées
 * par `roleId`) au nouveau (personnes à facettes). Pur : rend de
 * nouveaux blocs et la correspondance des identifiants.
 *
 *   convertirIncarnations({ reseau, trames, informations, casting,
 *                           derogations, monde }, ordreEpoques)
 *   → { reseau, trames, informations, casting, derogations, monde,
 *       correspondance: { ancienId: nouvelId }, fusions }
 *
 * L'identifiant conservé pour un rôle est celui que le reste du GN
 * nomme le plus (scènes, informations, sièges) ; à égalité, celui de
 * la dernière époque. C'est celui qu'on trouve dans les scènes d'un GN
 * écrit avec l'ancien modèle, donc celui qui casse le moins de choses.
 */
export function convertirIncarnations(blocs = {}, ordreEpoques = []) {
  const reseau = blocs.reseau || {};
  const trames = blocs.trames || {};
  const informations = blocs.informations || {};
  const casting = blocs.casting || {};
  const derogations = blocs.derogations || {};
  const monde = blocs.monde || {};
  const gens = (reseau.personnages || []).filter((p) => p && p.id);

  // Déjà converti ? Une personne à facettes n'a rien à faire ici.
  const dejaFait = gens.length > 0 && gens.every((p) => p.facettes && typeof p.facettes === "object");
  if (dejaFait) return { ...blocs, correspondance: {}, fusions: 0 };

  const rangEp = (id) => (id ? ordreEpoques.indexOf(id) : -1);

  // 1. Grouper par rôle, et compter les références de chaque incarnation.
  const refs = new Map();
  const bump = (id) => id && refs.set(id, (refs.get(id) || 0) + 1);
  for (const s of trames.situations || []) {
    for (const c of s.castIds || []) bump(c);
    bump(s.pointDeVueId);
  }
  for (const t of trames.trames || []) bump(t.porteurId);
  for (const i of informations.informations || []) for (const k of Object.keys(i.etats || {})) bump(k);
  for (const s of reseau.sieges || []) for (const k of s.personnageIds || []) bump(k);

  const parRole = new Map();
  for (const p of gens) {
    const rid = p.roleId || p.id;
    if (!parRole.has(rid)) parRole.set(rid, []);
    parRole.get(rid).push(p);
  }

  const correspondance = {};
  const personnes = [];
  let fusions = 0;
  for (const incs of parRole.values()) {
    const tri = [...incs].sort(
      (a, b) => (refs.get(b.id) || 0) - (refs.get(a.id) || 0) || rangEp(b.epoqueId) - rangEp(a.epoqueId),
    );
    const garde = tri[0];
    const facettes = {};
    // De la première à la dernière époque, pour qu'une collision de clé
    // laisse la dernière écrite.
    for (const inc of [...incs].sort((a, b) => rangEp(a.epoqueId) - rangEp(b.epoqueId)))
      facettes[inc.epoqueId || TOUTES] = facetteDepuis(inc);
    personnes.push({
      id: garde.id,
      nom: garde.nom || "",
      pj: garde.pj !== false,
      portrait: garde.portrait || incs.map((x) => x.portrait).find(Boolean) || "",
      x: garde.x ?? null,
      y: garde.y ?? null,
      facettes,
    });
    for (const inc of incs) {
      correspondance[inc.id] = garde.id;
      if (inc.id !== garde.id) fusions++;
    }
  }
  const nouvel = (id) => (id == null ? id : correspondance[id] || id);
  const epoqueDe = (id) => {
    const p = gens.find((x) => x.id === id);
    return p ? p.epoqueId || null : null;
  };
  const dedup = (ids) => [...new Set((ids || []).map(nouvel))];

  // 2. Les liens : ramenés, et un doublon (de, vers, époque) ne survit pas.
  const liens = [];
  const vusLiens = new Set();
  for (const l of reseau.liens || []) {
    if (!l) continue;
    const de = nouvel(l.de);
    const vers = nouvel(l.vers);
    if (!de || !vers || de === vers) continue;
    const cle = `${de}|${vers}|${l.epoqueId || ""}`;
    if (vusLiens.has(cle)) continue;
    vusLiens.add(cle);
    liens.push({ ...l, de, vers });
  }

  // 3. Les sièges : la même personne n'y est assise qu'une fois.
  const sieges = (reseau.sieges || []).map((s) => ({ ...s, personnageIds: dedup(s.personnageIds) }));

  // 4. Les trames : porteur, casting, point de vue ; et l'époque de la
  //    trame, lue sur ceux de son casting qui n'existaient qu'à une
  //    époque — les seuls qui la disent sans ambiguïté.
  const situationsNeuves = (trames.situations || []).map((s) => ({
    ...s,
    castIds: dedup(s.castIds),
    pointDeVueId: nouvel(s.pointDeVueId),
    epoqueId: s.epoqueId || null,
  }));
  const tramesNeuves = (trames.trames || []).map((t) => {
    const compte = new Map();
    for (const s of trames.situations || []) {
      if (s.trameId !== t.id) continue;
      for (const c of s.castIds || []) {
        const p = gens.find((x) => x.id === c);
        if (!p || !p.epoqueId) continue;
        const rid = p.roleId || p.id;
        if ((parRole.get(rid) || []).length !== 1) continue;
        compte.set(p.epoqueId, (compte.get(p.epoqueId) || 0) + 1);
      }
    }
    let epoqueId = t.epoqueId || null;
    if (!epoqueId && compte.size) epoqueId = [...compte.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { ...t, porteurId: nouvel(t.porteurId), epoqueId };
  });

  // 5. Les informations : un état par personne ; quand deux incarnations
  //    savaient des choses différentes, l'état de la dernière époque est
  //    la base et l'autre devient une exception datée.
  const infosNeuves = (informations.informations || []).map((i) => {
    const etats = {};
    const croyances = {};
    const etatsParEpoque = { ...(i.etatsParEpoque || {}) };
    const croyancesParEpoque = { ...(i.croyancesParEpoque || {}) };
    const parPersonne = new Map();
    for (const [pid, e] of Object.entries(i.etats || {})) {
      const np = nouvel(pid);
      if (!parPersonne.has(np)) parPersonne.set(np, []);
      parPersonne.get(np).push({ pid, e, cr: (i.croyances || {})[pid] || "", ep: epoqueDe(pid) });
    }
    for (const [np, lignes] of parPersonne) {
      lignes.sort((a, b) => rangEp(b.ep) - rangEp(a.ep));
      const base = lignes[0];
      etats[np] = base.e;
      if (base.e === "croit") croyances[np] = base.cr;
      for (const autre of lignes.slice(1)) {
        if (autre.e === base.e && autre.cr === base.cr) continue;
        if (!autre.ep) continue;
        if (!etatsParEpoque[autre.ep]) etatsParEpoque[autre.ep] = {};
        etatsParEpoque[autre.ep][np] = autre.e;
        if (autre.e === "croit") {
          if (!croyancesParEpoque[autre.ep]) croyancesParEpoque[autre.ep] = {};
          croyancesParEpoque[autre.ep][np] = autre.cr;
        }
      }
    }
    return { ...i, etats, croyances, etatsParEpoque, croyancesParEpoque };
  });

  // 6. Le casting : l'affectation et les vœux nomment des personnes.
  const candidatures = (casting.candidatures || []).map((c) => {
    const preferences = {};
    for (const [pid, r] of Object.entries(c.preferences || {})) {
      const np = nouvel(pid);
      preferences[np] = Math.max(preferences[np] || 0, Number(r) || 0);
    }
    return { ...c, preferences, vetos: dedup(c.vetos) };
  });
  const affectation = {};
  for (const [k, v] of Object.entries(casting.affectation || {})) affectation[k] = nouvel(v);

  // 7. Les dérogations : la cible d'une clé peut être un personnage, ou
  //    deux (« a+b », la différenciation morale).
  const derogationsNeuves = {};
  for (const [cle, v] of Object.entries(derogations || {})) {
    const i = cle.indexOf("::");
    if (i < 0) {
      derogationsNeuves[cle] = v;
      continue;
    }
    const regle = cle.slice(0, i);
    const cible = cle.slice(i + 2).split("+").map(nouvel).join("+");
    derogationsNeuves[`${regle}::${cible}`] = derogationsNeuves[`${regle}::${cible}`] || v;
  }

  // 8. Le monde : les interrupteurs nomment des personnes.
  const interrupteurs = (monde.interrupteurs || []).map((k) => ({ ...k, toucheIds: dedup(k.toucheIds) }));

  return {
    reseau: { ...reseau, personnages: personnes, liens, sieges },
    trames: { ...trames, trames: tramesNeuves, situations: situationsNeuves },
    informations: { ...informations, informations: infosNeuves },
    casting: { ...casting, candidatures, affectation },
    derogations: derogationsNeuves,
    monde: { ...monde, interrupteurs },
    correspondance,
    fusions,
  };
}
