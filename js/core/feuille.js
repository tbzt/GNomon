"use strict";

/* ============================================================
   LA FEUILLE DE 2 H — ce que l'orga note quand la première session
   s'arrête, et ce qu'il dit à chacun le lendemain matin.
   ------------------------------------------------------------
   Un GN en deux temps laisse quelques questions ouvertes le premier
   soir, et la suite se joue dessus. Le fil de l'histoire les tenait
   en prose ; à 2 h du matin, personne ne relit un Markdown de soixante
   mille signes. La feuille est ce Markdown-là réduit à ce qu'il faut :
   une question par ligne, sa valeur par défaut, les gens à qui la
   valeur jouée se dit, et une case pour l'écrire.

   Elle ne sort JAMAIS dans un livret : elle dit ce que les livrets
   affirment faute de mieux. Module **pur** : la liste des
   interrupteurs et un lecteur de noms entrent, un texte sort.
   ============================================================ */

export function feuilleDe2h({ titre = "", interrupteurs = [], reseau = null } = {}) {
  const nomDe = (id) => {
    const p = reseau && reseau.personnage ? reseau.personnage(id) : null;
    return p ? p.nom : "personnage supprimé";
  };
  const out = [`# Feuille de 2 h${titre ? " — " + titre : ""}`, ""];
  out.push(
    "*Ce que l'orga note à la fin de la première session. Chaque ligne se traduit le " +
      "lendemain matin par une phrase dite au joueur, jamais par une réimpression : un livret " +
      "n'affirme que ce qui est tenu ; ce qui a été joué se dit.*",
    "",
  );
  if (!interrupteurs.length) out.push("Aucun interrupteur déclaré.", "");
  interrupteurs.forEach((x, i) => {
    out.push(`## ${i + 1}. ${(x.question || "").trim() || "(sans question)"}`, "");
    out.push(`- Défaut, si rien n'a été joué de net : ${(x.defaut || "").trim() || "—"}`);
    const touche = (x.toucheIds || []).map(nomDe);
    out.push(`- Ça touche : ${touche.length ? touche.join(", ") : "—"}`);
    if ((x.note || "").trim()) out.push(`- À dire le matin : ${x.note.trim()}`);
    out.push("- Valeur jouée : ______________________", "");
  });
  return out.join("\n");
}
