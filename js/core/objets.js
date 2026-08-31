"use strict";

/* ============================================================
   OBJETS — découper un GN en documents, et le recoudre.
   ------------------------------------------------------------
   Le stockage local range un GN en **neuf gros blocs** JSON : tout le
   réseau dans une clé, toutes les trames dans une autre. C'est le bon
   format pour un `localStorage` — une lecture, une écriture, aucune
   jointure.

   C'est le pire format pour écrire à plusieurs. Deux personnes qui
   touchent deux personnages différents touchent le même bloc, donc
   entrent en conflit sur un texte qu'elles n'ont pas écrit. Sur une
   équipe de six, c'est presque tout le temps.

   Ce module traduit entre les deux : d'un côté le bloc, de l'autre une
   **liste de documents** portant chacun son identité. C'est cette
   liste que l'espace partagé synchronise, un document à la fois, avec
   une révision par document.

       reseau  { personnages:[…], liens:[…], groupes:[…] }
          ↕
       personnages/p1a · personnages/p2b · liens/l7c · groupes/g1…

   ── PUR, ET C'EST LE POINT ──
   Des données entrent, des données sortent. Aucun store, aucun réseau,
   aucun DOM. C'est ce qui permet de vérifier hors ligne la propriété
   qui compte vraiment — **découper puis recoudre rend le bloc de
   départ** — sans base de données ni compte.

   ── CE QUI N'EST PAS UNE COLLECTION RESTE ENSEMBLE ──
   Tout n'a pas d'identité. Le titre du monde, sa prémisse, ses
   mécaniques de sécurité ; l'affectation du casting ; l'horloge de la
   run et l'état de ses fils. Ces champs-là forment un document unique
   par clé, nommé `_`. On perd la finesse dessus, et c'est le bon
   arbitrage : deux personnes qui écrivent la prémisse en même temps
   ÉCRIVENT bien la même chose, là où deux personnes qui écrivent deux
   personnages n'ont rien à voir l'une avec l'autre.

   ── L'AFFECTATION EST UN BLOC, ET C'EST VOULU ──
   `casting.affectation` associe chaque candidature à un rôle. La
   découper par candidature laisserait deux moitiés de deux castings se
   mélanger — exactement ce que `poserAffectation` refuse déjà en local
   (« deux moitiés de deux castings différents ne forment pas un
   casting »). Elle voyage donc entière, dans le document `_`.
   ============================================================ */

/** Comment chaque clé de projet se découpe.

    · `listes` — les champs qui portent un tableau d'objets à `id` :
      un document par élément, sous le nom du champ ;
    · `carte`  — le bloc EST une carte clé → valeur (dérogations,
      suivi) : un document par entrée, la clé de la carte fait l'id ;
    · `nu`     — le bloc EST un tableau d'objets à `id` (le hub) ;
    · le reste des champs, s'il y en a, part dans le document `_`. */
const PLAN = Object.freeze({
  monde: { listes: ["lieux"], reste: true },
  reseau: { listes: ["personnages", "liens", "groupes"] },
  trames: { listes: ["trames", "situations", "conclusions"] },
  informations: { listes: ["informations"] },
  casting: { listes: ["candidatures"], reste: true },
  derogations: { carte: true },
  run: { listes: ["journal"], reste: true },
  suivi: { carte: true },
  liens: { nu: true },
});

/** Le document qui porte ce qui n'a pas d'identité propre. */
export const RESTE = "_";

export function planDe(cle) {
  return PLAN[cle] || null;
}

/* ================= Découper ================= */

/**
 * Un bloc de store → des documents.
 *
 * Renvoie `[{ collection, id, d }]`. `collection` est préfixée par la
 * clé du store : deux stores peuvent avoir un champ du même nom, et un
 * chemin distant doit rester unique dans tout le GN.
 */
export function decouper(cle, bloc) {
  const plan = PLAN[cle];
  if (!plan || bloc == null) return [];
  const out = [];

  if (plan.nu) {
    for (const o of Array.isArray(bloc) ? bloc : [])
      if (o && o.id) out.push({ collection: cle, id: String(o.id), d: o });
    return out;
  }

  if (plan.carte) {
    for (const [k, v] of Object.entries(bloc || {}))
      out.push({ collection: cle, id: String(k), d: v });
    return out;
  }

  const listes = plan.listes || [];
  for (const champ of listes)
    for (const o of Array.isArray(bloc[champ]) ? bloc[champ] : [])
      if (o && o.id) out.push({ collection: `${cle}.${champ}`, id: String(o.id), d: o });

  if (plan.reste) {
    const reste = {};
    for (const [k, v] of Object.entries(bloc)) if (!listes.includes(k)) reste[k] = v;
    // Un reste vide n'est pas un document : l'écrire poserait une
    // révision sur du néant, que le prochain démarrage recréerait.
    if (Object.keys(reste).length) out.push({ collection: cle, id: RESTE, d: reste });
  }

  return out;
}

/** Découpe les neuf clés d'un coup. `blocs` est `{ cle: bloc }`. */
export function decouperTout(blocs) {
  const out = [];
  for (const cle of Object.keys(PLAN))
    if (blocs[cle] !== undefined) out.push(...decouper(cle, blocs[cle]));
  return out;
}

/* ================= Recoudre ================= */

/**
 * Des documents → un bloc de store.
 *
 * `documents` est la liste rendue par `decouper`, dans n'importe quel
 * ordre. **L'ordre d'origine des listes n'est pas garanti** — une base
 * distante rend ses enfants triés par clé — donc on trie sur ce qui est
 * stable : l'identifiant, qui commence par un horodatage en base 36
 * (`_uid`). L'ordre de création est ainsi rendu, pas l'ordre d'un
 * tableau qu'on aurait perdu en route.
 */
export function recoudre(cle, documents) {
  const plan = PLAN[cle];
  if (!plan) return null;
  const miens = documents.filter(
    (x) => x.collection === cle || x.collection.startsWith(`${cle}.`),
  );

  if (plan.nu)
    return miens
      .filter((x) => x.d)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((x) => x.d);

  if (plan.carte) {
    const bloc = {};
    for (const x of miens) if (x.d !== undefined && x.d !== null) bloc[x.id] = x.d;
    return bloc;
  }

  const bloc = {};
  for (const champ of plan.listes || [])
    bloc[champ] = miens
      .filter((x) => x.collection === `${cle}.${champ}` && x.d)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((x) => x.d);

  if (plan.reste) {
    const r = miens.find((x) => x.id === RESTE && x.collection === cle);
    if (r && r.d) Object.assign(bloc, r.d);
  }
  return bloc;
}

export function recoudreTout(documents) {
  const blocs = {};
  for (const cle of Object.keys(PLAN)) blocs[cle] = recoudre(cle, documents);
  return blocs;
}

/* ================= L'empreinte ================= */

/**
 * De quoi savoir qu'un document a changé sans garder une copie de
 * l'ancien. On sérialise **à clés triées** : `{a:1,b:2}` et `{b:2,a:1}`
 * sont le même objet, et un `JSON.stringify` nu les dirait différents à
 * la première réécriture d'un champ. Sans ce tri, l'outil pousserait
 * tout le GN à chaque démarrage.
 *
 * FNV-1a 32 bits : ce n'est pas de la cryptographie, et ça n'a pas à en
 * être — on compare une valeur à elle-même d'une seconde à l'autre, pas
 * à celle d'un adversaire.
 */
export function empreinte(valeur) {
  const s = stableJson(valeur);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function stableJson(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const cles = Object.keys(v).sort();
  return `{${cles.map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(",")}}`;
}

/* ================= Le chemin distant ================= */

/**
 * `reseau.personnages` + `p1a` → `reseau~personnages/p1a`.
 *
 * Le point est **interdit dans une clé** de Realtime Database (avec
 * `$`, `#`, `[`, `]` et `/`). On le remplace par un tilde plutôt que de
 * renommer les collections : le nom du champ doit continuer de se lire
 * dans le chemin, sinon plus personne ne sait ce qu'il regarde en
 * ouvrant la console de la base.
 */
export function chemin(collection, id) {
  return `${collection.replace(/\./g, "~")}/${encodeURIComponent(id)}`;
}

export function depuisChemin(chemin_) {
  const i = chemin_.indexOf("/");
  if (i < 0) return null;
  return {
    collection: chemin_.slice(0, i).replace(/~/g, "."),
    id: decodeURIComponent(chemin_.slice(i + 1)),
  };
}
