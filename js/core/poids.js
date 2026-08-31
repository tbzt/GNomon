"use strict";

/* ============================================================
   POIDS — combien pèse le GN, et ce qui pèse dedans.
   ------------------------------------------------------------
   GNomon vit dans le `localStorage`, dont le quota tourne autour de
   **5 Mo par origine** — une limite qu'on ne rencontre jamais en
   écrivant du texte, et qu'on percute en trois clics dès qu'on colle
   des images.

   `storage.js` sait déjà signaler un échec d'écriture, mais c'est trop
   tard : quand le quota est atteint, la modification en cours est
   perdue. Un indicateur qui monte permet d'exporter **avant**.

   ── POURQUOI ON N'INTERROGE PAS LE NAVIGATEUR ──
   `navigator.storage.estimate()` existe, mais il mesure l'origine
   ENTIÈRE (caches, IndexedDB, service workers) et renvoie des quotas
   qui n'ont rien à voir avec la limite propre au `localStorage`. Il
   dirait « 2 % utilisés » à un GN sur le point de ne plus pouvoir
   écrire. On mesure donc ce qu'on écrit vraiment, et on le compare à
   une borne prudente annoncée comme telle.

   ── CE QU'ON MESURE ──
   La longueur des chaînes stockées. En UTF-16, un caractère pèse deux
   octets, et c'est ainsi que la plupart des navigateurs comptent leur
   quota — mais un `data:` d'image est de l'ASCII, où l'écart est nul.
   On compte donc en caractères et on l'annonce en octets : c'est
   l'ordre de grandeur qui compte, pas la troisième décimale.

   Feuille : ne dépend que de `Storage`.
   ============================================================ */
import { Storage } from "./storage.js";

/** Borne prudente. La vraie limite varie de 5 à 10 Mo selon les
    navigateurs ; viser bas fait prévenir tôt, ce qui est le but. */
export const BORNE = 5 * 1024 * 1024;

const SEUIL_ATTENTION = 0.5;
const SEUIL_CRITIQUE = 0.8;

export function formaterOctets(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Ce que pèse le GN, et où.
 *
 *   { octets, part, niveau, parCle: [{cle, octets}],
 *     portraits: {n, octets}, images: {n, octets} }
 */
export function poids() {
  // TOUTES les entrées, projets confondus : le quota du `localStorage`
  // se compte par origine. Ne mesurer que le GN ouvert annoncerait
  // « rien à signaler » à une équipe qui garde trois éditions en réserve
  // et n'a plus la place d'écrire la quatrième.
  const parCle = Storage.toutesLesEntrees().sort((a, b) => b.octets - a.octets);

  const octets = parCle.reduce((n, x) => n + x.octets, 0);

  // Les images sont presque toujours la cause : on les isole pour que
  // le message dise quoi faire, pas seulement qu'il y a un problème.
  const reseau = Storage.get("reseau", null);
  let nPortraits = 0;
  let oPortraits = 0;
  let nImages = 0;
  let oImages = 0;
  for (const p of (reseau && reseau.personnages) || []) {
    if (p && typeof p.portrait === "string" && p.portrait.startsWith("data:")) {
      nPortraits++;
      oPortraits += p.portrait.length;
    }
    for (const im of (p && p.images) || [])
      if (im && typeof im.src === "string" && im.src.startsWith("data:")) {
        nImages++;
        oImages += im.src.length;
      }
  }

  const part = octets / BORNE;
  return {
    octets,
    part,
    niveau: part >= SEUIL_CRITIQUE ? "critique" : part >= SEUIL_ATTENTION ? "attention" : "calme",
    parCle,
    portraits: { n: nPortraits, octets: oPortraits },
    images: { n: nImages, octets: oImages },
  };
}

/** Une phrase qui dit quoi faire, pas seulement où on en est. */
export function conseil(p) {
  const media = p.portraits.octets + p.images.octets;
  const partMedia = p.octets ? media / p.octets : 0;
  if (p.niveau === "calme")
    return (
      `${formaterOctets(p.octets)} sur une borne prudente de ${formaterOctets(BORNE)}. ` +
      "Rien à faire."
    );
  const cause =
    partMedia > 0.6
      ? `Les images en occupent ${Math.round(partMedia * 100)} % ` +
        `(${p.portraits.n} portraits, ${p.images.n} images). ` +
        "Une adresse web à la place d'un fichier ne pèse rien."
      : "Ce n'est pas dû aux images : le texte lui-même est volumineux.";
  return p.niveau === "critique"
    ? `${formaterOctets(p.octets)} — au-delà de 80 % de la borne. **Exportez maintenant.** ${cause}`
    : `${formaterOctets(p.octets)} — la moitié de la borne est atteinte. ${cause}`;
}
