"use strict";

/* ============================================================
   DÉGÂTS — le rendu d'une absence, en un seul endroit.
   ------------------------------------------------------------
   Le geste « et s'il ne vient pas ? » vivait entièrement dans le flanc
   du graphe (`reseaugraphe.js`, `_flancDefection`). Le calcul, lui,
   était déjà partagé (`core/defection.js`) — mais le TEXTE ne l'était
   pas, donc l'ouvrir depuis la fiche aurait voulu dire l'écrire une
   seconde fois. Deux textes pour un même calcul finissent toujours par
   dire deux choses différentes.

   Ce module ne détient donc aucune vérité et ne calcule rien : il met
   en mots ce que `defection()` et `crashtest.js` rendent. C'est du
   rendu pur — une fonction, du HTML, aucun état, aucun écouteur.

   ── LE VOCABULAIRE EST CELUI DU GRAPHE ──
   Mêmes intitulés, même ordre, même phrase de sortie quand rien ne
   casse. On passe de la fiche au graphe sans réapprendre à lire, ce qui
   est la règle du projet depuis les deux lentilles du réseau.
   ============================================================ */
import { Utils } from "../core/utils.js";

/** Un bloc de dégâts, ou rien du tout si la liste est vide — on ne
    montre pas un titre suivi du néant.

    ── `items` ARRIVE DÉJÀ ÉCHAPPÉ ──
    Chaque appelant passe par `Utils.escHtml` avant d'appeler, parce que
    les items portent du balisage voulu (`<b>plus aucun joueur</b>`) : on
    ne peut donc pas échapper ici sans le détruire. Même contrat que
    `Markdown.inline`, qui travaille sur du texte déjà échappé — sauf
    que lui le dit, et pas celui-ci. C'est dit maintenant : un appelant
    qui passerait du texte d'auteur nu ouvrirait une injection, et les
    noms viennent désormais d'autres membres de l'espace. */
function bloc(titre, items, ton = "") {
  if (!items.length) return "";
  return (
    `<p class="dg-sous ${ton}">${titre}</p>` +
    `<ul class="dg-liste">${items.map((x) => `<li>${x}</li>`).join("")}</ul>`
  );
}

/**
 * Ce que rend `defection()`, mis en mots.
 *
 * `titre` permet à l'appelant de nommer le cas (« Sans Elena », « Avant
 * 22h ») — le module ne suppose pas qu'il s'agit toujours d'une absence
 * totale, puisque l'arrivée tardive réutilise le même rendu.
 */
export function degatsHtml(d, { titre = null } = {}) {
  if (!d) return "";
  return (
    (titre ? `<p class="dg-titre alarme">${Utils.escHtml(titre)}</p>` : "") +
    (d.gravite
      ? `<p class="dg-aide"><b>${d.gravite}</b> ${Utils.plur(d.gravite, "dégât")} ${Utils.plur(d.gravite, "irrécupérable")}.</p>`
      : '<p class="dg-aide ok">Rien ne casse. Le GN tient sans cette personne.</p>') +
    bloc(
      "Scènes sans point de vue",
      d.orphelines.map((s) => Utils.escHtml(s.titre)),
      "grave",
    ) +
    bloc(
      "Scènes fragilisées",
      d.fragilisees.map(
        (s) =>
          `${Utils.escHtml(s.titre)} — ` +
          (s.morte
            ? "<b>plus aucun joueur</b>"
            : `${s.restants} ${Utils.plur(s.restants, "joueur")} ${Utils.plur(s.restants, "restant")}`),
      ),
    ) +
    bloc(
      "Miroirs perdus",
      d.miroirsPerdus.map((m) => `${Utils.escHtml(m.nom)} se retrouve sans contact-miroir`),
      "grave",
    ) +
    bloc(
      "Informations que personne d'autre ne porte",
      d.informationsOrphelines.map(
        (i) =>
          Utils.escHtml(i.contenu) +
          (i.requisePar.length
            ? ` — requise par ${i.requisePar.map(Utils.escHtml).join(", ")}`
            : ""),
      ),
      "grave",
    )
  );
}

/** Ce que coûterait la coupe d'une situation (`crashTestSituation`). */
export function coupeHtml(r) {
  if (!r) return "";
  return (
    `<p class="dg-titre alarme">Sans « ${Utils.escHtml(r.situation.titre || "Sans titre")} »</p>` +
    (r.rienNeCasse
      ? '<p class="dg-aide ok">Rien ne casse ailleurs. Cette situation peut être coupée sans effet de bord.</p>'
      : "") +
    bloc(
      "Conclusions qui ne mèneraient plus nulle part",
      r.conclusionsOrphelinees.map(
        (c) => `« ${Utils.escHtml(c.texte)} » — écrite depuis ${Utils.escHtml(c.depuis)}`,
      ),
    ) +
    bloc(
      "Informations que plus rien ne produirait",
      r.informationsPerdues.map(
        (i) =>
          Utils.escHtml(i.contenu) +
          (i.requisePar.length
            ? ` — encore requise par ${i.requisePar.map(Utils.escHtml).join(", ")}`
            : ""),
      ),
      "grave",
    ) +
    bloc(
      "Personnages qui n'auraient plus aucune scène",
      r.personnagesDesoeuvres.map(
        (p) => `${Utils.escHtml(p.nom)}${p.pj ? "" : " (PNJ)"}`,
      ),
      "grave",
    )
  );
}

/** Ce que coûterait une information jamais découverte
    (`crashTestInformation`). */
export function jamaisSueHtml(r) {
  if (!r) return "";
  return (
    `<p class="dg-titre alarme">Si « ${Utils.escHtml(r.information.contenu || "cette information")} » n'était jamais sue</p>` +
    (r.rienNeCasse
      ? '<p class="dg-aide ok">Aucune situation n\'en dépend. Rien ne s\'arrête.</p>'
      : `<p class="dg-aide"><b>${r.situationsEmpechees.length}</b> ${Utils.plur(r.situationsEmpechees.length, "situation")} ` +
        `${Utils.plur(r.situationsEmpechees.length, "empêchée")}` +
        (r.profondeur > 1
          ? ` — la perte se propage sur ${r.profondeur} étages.`
          : " — effet direct, sans cascade.") +
        "</p>") +
    bloc(
      "Situations qui ne pourraient plus arriver",
      r.situationsEmpechees.map((s) => Utils.escHtml(s.titre)),
      "grave",
    ) +
    bloc(
      "Informations qui ne seraient plus produites non plus",
      r.informationsPerdues.map((i) => Utils.escHtml(i.contenu)),
      "grave",
    )
  );
}
