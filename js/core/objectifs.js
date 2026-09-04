"use strict";

/* ============================================================
   OBJECTIFS — qui vise qui.
   ------------------------------------------------------------
   Un objectif est une phrase : « Donner un chiffre à Toussainte avant
   le repas ». L'outil ne demande pas de cible en plus, parce que
   l'auteur l'a déjà écrite dans la phrase — et lui faire ressaisir un
   nom dans un menu tuerait l'écriture, comme la jauge de couverture
   l'aurait fait pour les neuf composantes de Kröger.

   Ce module la LIT. Une cible est un autre personnage que la phrase
   nomme : par son nom entier, par son prénom ou son nom de famille
   quand il est le seul à le porter parmi les gens de la même époque,
   ou par une mention `@[nom](id)`.

   ── C'EST UNE LECTURE, PAS UN FAIT ──
   « Faire signer votre père » ne nomme personne et vise pourtant
   quelqu'un. « Empêcher Édouard et Toussainte de se parler » nomme
   deux Édouard possibles et n'en retient aucun. Ce qui en sort est
   donc une **heuristique**, et tout ce qui la consomme le dit : la
   règle de conscience « objectif avec adversaire » porte sa
   transposition en toutes lettres, et la fiche montre ce que la
   lecture a trouvé pour qu'on puisse la corriger en reformulant.

   Module **pur**, sans store : des personnages et des phrases entrent,
   des identifiants sortent.
   ============================================================ */

const MENTION = /@\[[^\]\n]*\]\(([^)\n]+)\)/g;

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Le mot entier, bordé par autre chose qu'une lettre ou un chiffre. */
function contientMot(texte, mot) {
  if (!mot) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${echapper(mot)}(?=$|[^\\p{L}\\p{N}])`, "u");
  return re.test(texte);
}

/** « Roger Lambert, dit Le Belge » → prénom « Roger », famille « Lambert ».
    Ce qui suit la virgule est un surnom : il ne sert pas de clé. */
function morceaux(nom) {
  const base = String(nom || "").split(",")[0].trim().split(/\s+/).filter(Boolean);
  return { prenom: base[0] || "", famille: base.length > 1 ? base[base.length - 1] : "" };
}

/**
 * Les personnages qu'une phrase vise, hors son auteur.
 * `personnages` est la liste entière ; l'époque de l'auteur borne les
 * candidats — Ange-65 ne vise pas Nadia-85.
 */
export function ciblesDe(texte, personnages, auteurId = null) {
  const t = String(texte || "");
  if (!t.trim()) return [];
  const auteur = personnages.find((p) => p && p.id === auteurId) || null;
  const memeEpoque = (q) =>
    !auteur || !auteur.epoqueId || !q.epoqueId || q.epoqueId === auteur.epoqueId;
  const candidats = personnages.filter((q) => q && q.id !== auteurId && memeEpoque(q));

  const ids = new Set();
  for (const m of t.matchAll(MENTION)) if (candidats.some((q) => q.id === m[1])) ids.add(m[1]);

  // Un prénom ou un nom de famille ne désigne quelqu'un que s'il est
  // seul à le porter — l'auteur compris : « Vidal » ne désigne pas
  // Colette dans la bouche de Marcel Vidal. Deux Édouard, et
  // « Édouard » ne dit plus rien.
  const compte = new Map();
  for (const q of personnages.filter((q) => q && memeEpoque(q)))
    for (const cle of Object.values(morceaux(q.nom)))
      if (cle) compte.set(cle, (compte.get(cle) || 0) + 1);

  for (const q of candidats) {
    if (ids.has(q.id)) continue;
    const nom = String(q.nom || "").split(",")[0].trim();
    if (nom && contientMot(t, nom)) {
      ids.add(q.id);
      continue;
    }
    const { prenom, famille } = morceaux(q.nom);
    if ((prenom && compte.get(prenom) === 1 && contientMot(t, prenom)) ||
        (famille && compte.get(famille) === 1 && contientMot(t, famille)))
      ids.add(q.id);
  }
  return [...ids];
}

/** Les objectifs des autres qui visent ce personnage : ce qu'on va lui
    demander. `[{ de, texte }]`, dans l'ordre des fiches. */
export function objectifsVisant(personnages, cibleId) {
  const out = [];
  for (const p of personnages) {
    if (!p || p.id === cibleId) continue;
    for (const o of p.objectifs || [])
      if (ciblesDe(o, personnages, p.id).includes(cibleId)) out.push({ de: p.id, texte: String(o) });
  }
  return out;
}
