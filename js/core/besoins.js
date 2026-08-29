"use strict";

/* ============================================================
   BESOINS — ce que l'écriture réclame, dérivé.
   ------------------------------------------------------------
   ── POURQUOI CE N'EST PAS UN KANBAN ──
   La littérature du GN ne demande pas de gestionnaire de tâches, et
   s'en méfie : Pettersson (« Comment organiser un GN de manière
   efficiente ») **refuse explicitement** de donner un rétroplanning, et
   met la propriété claire des rôles au-dessus d'un calendrier rigide.
   Electro-GN, dont le corpus est vaste, n'a aucun guide de logistique.

   Un tableau générique — réserver le lieu, l'assurance, la nourriture —
   serait donc moins bon que Trello, et n'aurait aucun lien avec ce que
   l'outil sait. **On fait l'inverse : on dérive ce que seul GNomon peut
   savoir**, parce que ça se calcule depuis le texte déjà écrit.

   · le `matériel` d'une situation → la liste d'accessoires ;
   · la `mise en scène` → ce que l'équipe doit préparer avant ;
   · la charge PNJ → combien de comédiens, sur quels créneaux ;
   · les `règles nécessaires` → ce que le système doit permettre ;
   · le `joueur particulier` → les contraintes à annoncer au casting ;
   · les portraits et backgrounds manquants → ce qui reste à produire.

   ── LE BESOIN N'EST JAMAIS STOCKÉ ──
   Seul **ce qu'on en a fait** l'est : un responsable, un état, une note
   (`SuiviStore`), indexés par une clé stable dérivée de la source.
   Changer le matériel d'une situation change le besoin, et
   l'affectation suit. Stocker le besoin lui-même créerait une copie qui
   divergerait du texte au premier remaniement — exactement ce qu'un
   tableur d'équipe finit toujours par devenir.

   Module **pur**.
   ============================================================ */

export const CATEGORIES = Object.freeze({
  materiel: { nom: "Matériel et accessoires", aide: "Ce qu'il faut trouver, fabriquer ou emprunter." },
  preparation: { nom: "À préparer sur place", aide: "Ce que l'équipe doit installer pour que la scène puisse arriver." },
  comediens: { nom: "Comédiens PNJ", aide: "Le nombre de personnes à trouver, par créneau." },
  regles: { nom: "Règles à trancher", aide: "Ce que le système doit permettre à un endroit précis." },
  casting: { nom: "Contraintes de casting", aide: "Ce qu'il faut annoncer avant l'inscription." },
  ecriture: { nom: "Reste à produire", aide: "Les documents qui ne sont pas finis." },
});

/** Découpe un champ libre en items. Les auteurs y écrivent souvent une
    liste séparée par des virgules ou des retours ; on la rend comme
    telle plutôt que d'imprimer un pavé qu'on ne peut pas cocher. */
function items(texte) {
  return String(texte || "")
    .split(/[\n·;]+|,(?=\s*[A-ZÀ-Ý0-9])/)
    .map((x) => x.trim().replace(/^[-—•]\s*/, ""))
    .filter(Boolean);
}

function chevauche(a, b) {
  return (
    a.debut != null && a.fin != null && b.debut != null && b.fin != null &&
    b.debut < a.fin && a.debut < b.fin
  );
}

/**
 * Tous les besoins, groupés par catégorie.
 *
 *   [{ categorie, nom, aide, besoins: [{ cle, quoi, ou, quand, source }] }]
 *
 * `cle` est stable et dérivée de la source : c'est elle qui porte
 * l'affectation dans `SuiviStore`, et elle survit à toute réécriture
 * du texte tant que l'objet source existe.
 */
export function besoins({ reseau, trames, monde }) {
  const out = { materiel: [], preparation: [], comediens: [], regles: [], casting: [], ecriture: [] };

  const heure = (s) =>
    s.debut != null && s.fin != null ? `${s.debut}h → ${s.fin}h` : "";

  for (const s of trames.situations()) {
    const titre = s.titre || "Sans titre";
    const ou = s.espace || "";
    const quand = heure(s);

    items(s.materiel).forEach((q, i) =>
      out.materiel.push({ cle: `materiel:${s.id}:${i}`, quoi: q, ou, quand, source: titre }),
    );
    items(s.miseEnScene).forEach((q, i) =>
      out.preparation.push({ cle: `prep:${s.id}:${i}`, quoi: q, ou, quand, source: titre }),
    );
    items(s.regles).forEach((q, i) =>
      out.regles.push({ cle: `regles:${s.id}:${i}`, quoi: q, ou: "", quand, source: titre }),
    );
    items(s.joueurParticulier).forEach((q, i) =>
      out.casting.push({ cle: `joueur:${s.id}:${i}`, quoi: q, ou: "", quand, source: titre }),
    );
  }

  /* Les comédiens : le pic de simultanéité d'un PNJ EST le nombre de
     personnes à trouver. C'est le même calcul que la frise, et c'est
     le besoin le plus difficile à voir à la main. */
  for (const p of reseau.pnj()) {
    const siennes = trames.situations().filter((s) => (s.castIds || []).includes(p.id));
    if (!siennes.length) continue;
    let pic = 1;
    let creneau = null;
    for (const s of siennes) {
      const n = siennes.filter((o) => o.id === s.id || chevauche(s, o)).length;
      if (n > pic) {
        pic = n;
        creneau = s;
      }
    }
    out.comediens.push({
      cle: `comediens:${p.id}`,
      quoi: `${pic} comédien${pic > 1 ? "s" : ""} pour ${p.nom}`,
      ou: creneau ? creneau.espace || "" : "",
      quand: creneau ? heure(creneau) : "",
      source: `${siennes.length} situation${siennes.length > 1 ? "s" : ""}`,
    });
  }

  /* Ce qui reste à produire. Distinct de la conscience : celle-ci juge
     la QUALITÉ du texte, ceci compte les DOCUMENTS non finis. */
  for (const p of reseau.pj()) {
    if (!(p.portrait || "").trim())
      out.ecriture.push({
        cle: `portrait:${p.id}`,
        quoi: `Portrait de ${p.nom}`,
        ou: "",
        quand: "",
        source: "trombinoscope",
      });
    if (!(p.background || "").trim())
      out.ecriture.push({
        cle: `background:${p.id}`,
        quoi: `Background de ${p.nom}`,
        ou: "",
        quand: "",
        source: "livret",
      });
  }

  const m = monde.monde();
  for (const [cle, label] of [
    ["contexte", "Le contexte commun"],
    ["intention", "La note d'intention"],
    ["avertissements", "Les avertissements de contenu"],
  ])
    if (!(m[cle] || "").trim())
      out.ecriture.push({
        cle: `monde:${cle}`,
        quoi: `${label} — repris dans chaque livret`,
        ou: "",
        quand: "",
        source: "le monde",
      });

  return Object.entries(CATEGORIES)
    .map(([cle, c]) => ({ categorie: cle, nom: c.nom, aide: c.aide, besoins: out[cle] }))
    .filter((g) => g.besoins.length);
}

/** Aplati, pour l'export et les compteurs. */
export function tousLesBesoins(stores) {
  return besoins(stores).flatMap((g) => g.besoins.map((b) => ({ ...b, categorie: g.nom })));
}

/** Markdown à coller dans l'outil d'équipe. C'est le pont assumé : on
    ne refait pas Trello, on l'alimente. */
export function besoinsMarkdown(stores, suivi) {
  const out = [];
  for (const g of besoins(stores)) {
    out.push(`## ${g.nom}`, "");
    for (const b of g.besoins) {
      const s = suivi ? suivi.pour(b.cle) : null;
      const meta = [b.source, b.ou, b.quand].filter(Boolean).join(" · ");
      out.push(
        `- [${s && s.fait ? "x" : " "}] ${b.quoi}` +
          (meta ? ` — *${meta}*` : "") +
          (s && s.responsable ? ` **(${s.responsable})**` : ""),
      );
    }
    out.push("");
  }
  return out.join("\n");
}
