"use strict";

/* ============================================================
   LIVRET — le background remis à une personne.
   ------------------------------------------------------------
   C'est le seul document de GNomon qui sorte de l'équipe. Tout le reste
   est un outil d'auteur ; celui-ci, un joueur va le lire. La question
   n'est donc pas « que sait-on ? » mais **« que peut-il savoir ? »**

   ── CE QUI EST RETIRÉ, ET POURQUOI ──
   Ces exclusions ne sont pas des oublis. Chacune détruirait le jeu.

   · **La fonction narrative** (héros, adversaire, faux allié…). Écrire
     « tu es le faux allié » dit au joueur comment son histoire finit.
   · **La transformation possible.** C'est le pronostic de l'auteur, pas
     une connaissance du personnage — la lire, c'est jouer le résultat.
   · **L'importance d'un lien et le contact-miroir.** Instruments de
     construction. « Ce contact est secondaire » est une phrase qu'aucun
     personnage ne pense de quelqu'un qu'il connaît.
   · **La vérité derrière une croyance fausse.** LE point critique, et
     le plus facile à rater : quand un personnage *croit autre chose*,
     le livret n'écrit QUE ce qu'il croit, jamais le fait réel. Sortir
     les deux — ce que font tous les tableurs — livre l'intrigue au
     joueur dans le document censé la lui cacher.

   ── LES AVERTISSEMENTS ──
   Le module signale à l'auteur ce qui rendrait le livret impubliable —
   une croyance sans texte écrit produirait un trou béant, un carnet
   vide un livret sans personnage. Ils s'adressent à l'auteur et **ne
   sortent jamais dans le document**.

   Module **pur** : lit quatre stores, n'en mute aucun, ne produit que
   des données. Le rendu (HTML, markdown) est ailleurs.
   ============================================================ */
import { TONALITES } from "./reseaustore.js";

/** Les champs qu'un personnage peut connaître de lui-même. L'ordre est
    celui dans lequel une personne se décrirait, pas celui de la saisie. */
const TRAITS_PUBLIABLES = [
  { cle: "moral", label: "Ce en quoi je crois" },
  { cle: "desir", label: "Ce que je veux" },
  { cle: "besoin", label: "Ce dont j'ai besoin" },
  { cle: "faiblesse", label: "Ce qui me retient" },
  { cle: "pouvoirs", label: "Ce que je sais faire" },
  { cle: "archetype", label: "Ce que je suis" },
];

/**
 * Construit le livret d'un personnage.
 *
 *   { identite, monde, traits, contacts, sait, croit, prose,
 *     avertissements }
 */
export function livret(personnageId, { reseau, monde, infos, casting = null }) {
  const p = reseau.personnage(personnageId);
  if (!p) return null;

  const m = monde.monde();
  const groupe = p.groupeId ? reseau.groupe(p.groupeId) : null;

  const traits = TRAITS_PUBLIABLES.map((t) => ({
    label: t.label,
    valeur: (p[t.cle] || "").trim(),
  })).filter((t) => t.valeur);

  /* Les contacts, du point de vue du personnage : ce qu'il déclare
     connaître. On garde la nature et la tonalité — qui sont ce qu'il
     ressent — et on jette l'importance et le miroir, qui sont ce que
     l'auteur en fait. */
  const contacts = reseau
    .liensDe(p.id)
    .map((l) => {
      const autre = reseau.personnage(l.vers);
      if (!autre) return null;
      return {
        nom: autre.nom,
        role: autre.role || "",
        nature: (l.nature || "").trim(),
        tonalite: TONALITES[l.tonalite],
        cle: l.tonalite,
      };
    })
    .filter(Boolean);

  const { sait, croit } = infos.parPersonnage(p.id);

  /* ── LE POINT CRITIQUE ──
     Une croyance fausse sort SEULE. Le contenu réel de l'information
     n'est jamais joint : il est ce que le personnage ignore. */
  const croyances = croit.map((i) => ({
    texte: (infos.croyance(i.id, p.id) || "").trim(),
    informationId: i.id,
  }));

  const avertissements = [];
  if (!(p.notes || "").trim())
    avertissements.push(
      "Le carnet est vide : le livret n'aura pas de récit, seulement des listes.",
    );
  for (const c of croyances)
    if (!c.texte)
      avertissements.push(
        "Une croyance fausse n'a pas de texte écrit — elle serait absente du livret, " +
          "et le personnage arriverait sans savoir ce qu'il croit.",
      );
  if (!contacts.length)
    avertissements.push("Aucun contact déclaré : le personnage arriverait sans connaître personne.");
  if (!m.contexte.trim())
    avertissements.push("Le contexte commun du monde est vide — le livret n'aura pas d'entrée.");

  return {
    identite: {
      id: p.id,
      nom: p.nom,
      role: p.role || "",
      groupe: groupe ? groupe.nom : "",
      pj: p.pj,
      joueur: casting ? etiquetteJoueur(casting, p.id) : "",
    },
    monde: { titre: m.titre, contexte: m.contexte, thematique: m.thematique },
    prose: (p.notes || "").trim(),
    traits,
    contacts,
    sait: sait.map((i) => i.contenu).filter(Boolean),
    croit: croyances.map((c) => c.texte).filter(Boolean),
    avertissements,
  };
}

function etiquetteJoueur(casting, personnageId) {
  const k = casting.titulaireDe(personnageId);
  if (!k) return "";
  const c = casting.candidature(k);
  return c ? c.label : "";
}

/** Tous les livrets, dans l'ordre du réseau. `pjSeulement` par défaut :
    un PNJ n'a pas de livret de joueur, il a une consigne d'équipe. */
export function tousLesLivrets(stores, { pjSeulement = true } = {}) {
  const persos = pjSeulement ? stores.reseau.pj() : stores.reseau.personnages();
  return persos.map((p) => livret(p.id, stores)).filter(Boolean);
}

/* ================= Rendus ================= */

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/** Le markdown léger du carnet, rendu en HTML. Les jetons de mention
    `@[nom](id)` deviennent le NOM SEUL : un joueur n'a que faire d'un
    identifiant, et le crochet resterait à l'écran. */
function proseHtml(texte) {
  return esc(texte)
    .replace(/@\[([^\]\n]*)\]\(([^)\n]+)\)/g, "<b>$1</b>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^\n_]+)_/g, "<em>$1</em>")
    .split(/\n{2,}/)
    .map((par) => `<p>${par.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function proseTexte(texte) {
  return String(texte || "").replace(/@\[([^\]\n]*)\]\(([^)\n]+)\)/g, "$1");
}

/** Un livret en HTML autonome et imprimable. Aucune ressource externe :
    le fichier part par courriel ou sur une clé, il doit s'ouvrir seul. */
export function livretHtml(l) {
  const bloc = (titre, contenu) =>
    contenu ? `<section><h2>${esc(titre)}</h2>${contenu}</section>` : "";

  const listes = (items) =>
    items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(l.identite.nom)}${l.monde.titre ? " — " + esc(l.monde.titre) : ""}</title>
<style>
  :root { color-scheme: light; }
  body { max-width: 40em; margin: 0 auto; padding: 3em 1.5em 5em;
    font-family: "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    font-size: 17px; line-height: 1.65; color: #1a1a1a; background: #fbfaf7; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 1em; margin-bottom: 2em; }
  .monde { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px;
    letter-spacing: .16em; text-transform: uppercase; color: #6b6257; margin: 0 0 .6em; }
  h1 { font-size: 2.1em; line-height: 1.1; margin: 0 0 .2em; }
  .role { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px;
    color: #6b6257; margin: 0; }
  h2 { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px;
    letter-spacing: .14em; text-transform: uppercase; color: #6b6257;
    margin: 2.2em 0 .7em; font-weight: 600; }
  section:first-of-type h2 { margin-top: 0; }
  dl { margin: 0; }
  dt { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px;
    letter-spacing: .06em; color: #6b6257; margin-top: .9em; }
  dd { margin: .15em 0 0; }
  ul { padding-left: 1.2em; margin: 0; }
  li { margin-bottom: .4em; }
  .contact { margin-bottom: .9em; }
  .contact b { font-size: 1.05em; }
  .contact .lien { display: block; color: #3a3a3a; }
  .t-negatif b::after { content: " ✕"; color: #8c2f26; }
  .t-positif b::after { content: " ✓"; color: #2f6e4f; }
  .t-complique b::after { content: " ∼"; color: #5c4390; }
  code { font-family: ui-monospace, monospace; font-size: .9em; background: #efece5;
    padding: 1px 4px; }
  @media print { body { background: #fff; padding: 0; font-size: 11.5pt; }
    section { break-inside: avoid; } }
</style></head><body>
<header>
  ${l.monde.titre ? `<p class="monde">${esc(l.monde.titre)}</p>` : ""}
  <h1>${esc(l.identite.nom)}</h1>
  <p class="role">${[l.identite.role, l.identite.groupe].filter(Boolean).map(esc).join(" · ")}</p>
</header>
${bloc("Le monde", l.monde.contexte ? proseHtml(l.monde.contexte) : "")}
${bloc("Votre histoire", l.prose ? proseHtml(l.prose) : "")}
${bloc(
  "Qui vous êtes",
  l.traits.length
    ? `<dl>${l.traits.map((t) => `<dt>${esc(t.label)}</dt><dd>${esc(t.valeur)}</dd>`).join("")}</dl>`
    : "",
)}
${bloc(
  "Ceux que vous connaissez",
  l.contacts.length
    ? l.contacts
        .map(
          (c) =>
            `<div class="contact t-${c.cle}"><b>${esc(c.nom)}</b>` +
            (c.role ? ` <span class="role">${esc(c.role)}</span>` : "") +
            (c.nature ? `<span class="lien">${esc(c.nature)}</span>` : "") +
            "</div>",
        )
        .join("")
    : "",
)}
${bloc("Ce que vous savez", listes([...l.sait, ...l.croit]))}
</body></html>`;
}

/** Le même, en markdown — pour coller dans un courriel ou un forum. */
export function livretMarkdown(l) {
  const out = [];
  if (l.monde.titre) out.push(`# ${l.monde.titre}`);
  out.push(`## ${l.identite.nom}`);
  const sous = [l.identite.role, l.identite.groupe].filter(Boolean).join(" · ");
  if (sous) out.push(`*${sous}*`);
  if (l.monde.contexte) out.push("", "### Le monde", "", proseTexte(l.monde.contexte));
  if (l.prose) out.push("", "### Votre histoire", "", proseTexte(l.prose));
  if (l.traits.length) {
    out.push("", "### Qui vous êtes", "");
    for (const t of l.traits) out.push(`**${t.label}** — ${t.valeur}`);
  }
  if (l.contacts.length) {
    out.push("", "### Ceux que vous connaissez", "");
    for (const c of l.contacts)
      out.push(`- **${c.nom}**${c.role ? ` (${c.role})` : ""}${c.nature ? ` — ${c.nature}` : ""}`);
  }
  const su = [...l.sait, ...l.croit];
  if (su.length) {
    out.push("", "### Ce que vous savez", "");
    for (const s of su) out.push(`- ${s}`);
  }
  return out.join("\n");
}
