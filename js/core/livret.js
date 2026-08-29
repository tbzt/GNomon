"use strict";

/* ============================================================
   LIVRET & CONSIGNE — les deux documents qui sortent de l'outil.
   ------------------------------------------------------------
   Ils sont **opposés dans leur principe**, et c'est tout le sujet.

   · **Le livret** part chez un joueur. Il se calcule par
     SOUSTRACTION : on retire tout ce qu'un personnage ne peut pas
     savoir de lui-même ni de l'histoire.
   · **La consigne PNJ** reste dans l'équipe. Elle se calcule par
     ADDITION : on y met tout, y compris ce que les PJ croient de faux
     — parce que c'est précisément ce qu'il faut savoir pour jouer un
     PNJ juste.

   ── CE QUE LE LIVRET RETIRE, ET POURQUOI ──
   · **La fonction narrative** (héros, adversaire, faux allié…) : écrire
     « tu es le faux allié » dit au joueur comment son histoire finit.
   · **La transformation possible** : c'est le pronostic de l'auteur.
   · **L'importance d'un lien et le contact-miroir** : instruments de
     construction. Aucun personnage ne pense « ce contact est
     secondaire » de quelqu'un qu'il connaît.
   · **Le carnet de l'auteur** (`notes`) : privé, depuis la migration
     v2 du schéma. C'est `background` qui est publié.
   · **La vérité derrière une croyance fausse.** LE point critique :
     quand un personnage *croit autre chose*, le livret n'écrit QUE ce
     qu'il croit. Sortir les deux livrerait l'intrigue au joueur dans le
     document censé la lui cacher.

   ── CE QUE LES DEUX PORTENT TOUJOURS ──
   La note d'intention, les avertissements de contenu et les mécaniques
   de sécurité. Ils viennent du monde et sont repris sans que l'auteur
   ait à y penser : ces outils ne servent que si tout le monde les a lus
   avant, donc ils doivent être dans **chaque** document.

   Module **pur** : lit des stores, n'en mute aucun.
   ============================================================ */
import { TONALITES, IMPORTANCES } from "./reseaustore.js";

const TRAITS_PUBLIABLES = [
  { cle: "moral", label: "Ce en quoi je crois" },
  { cle: "desir", label: "Ce que je veux" },
  { cle: "besoin", label: "Ce dont j'ai besoin" },
  { cle: "faiblesse", label: "Ce qui me retient" },
  { cle: "pouvoirs", label: "Ce que je sais faire" },
  { cle: "archetype", label: "Ce que je suis" },
];

/** Les blocs communs aux deux documents, tirés du monde. */
function cadre(monde) {
  const m = monde.monde();
  return {
    titre: m.titre,
    contexte: m.contexte,
    intention: m.intention,
    avertissements: m.avertissements,
    securite: monde.mecaniquesActives(),
    securiteNote: m.securiteNote,
    pratique: m.pratique,
    costume: m.costume,
    lieux: monde.lieux(),
  };
}

/* ================= LE LIVRET ================= */

export function livret(personnageId, { reseau, monde, infos, casting = null }) {
  const p = reseau.personnage(personnageId);
  if (!p) return null;

  const groupe = p.groupeId ? reseau.groupe(p.groupeId) : null;

  const traits = TRAITS_PUBLIABLES.map((t) => ({
    label: t.label,
    valeur: (p[t.cle] || "").trim(),
  })).filter((t) => t.valeur);

  const contacts = reseau
    .liensDe(p.id)
    .map((l) => {
      const autre = reseau.personnage(l.vers);
      if (!autre) return null;
      // Ni `importance` ni `miroir` : ce sont des outils d'auteur.
      return {
        nom: autre.nom,
        role: autre.role || "",
        nature: (l.nature || "").trim(),
        cle: l.tonalite,
      };
    })
    .filter(Boolean);

  const { sait, croit } = infos.parPersonnage(p.id);

  /* ── LE POINT CRITIQUE ── une croyance sort SEULE. */
  const croyances = croit.map((i) => (infos.croyance(i.id, p.id) || "").trim());

  const avertissements = [];
  if (!(p.background || "").trim())
    avertissements.push("Le background est vide : le livret n'aura pas de récit.");
  croit.forEach((i) => {
    if (!(infos.croyance(i.id, p.id) || "").trim())
      avertissements.push(
        `« ${i.contenu || "une information"} » : le personnage croit autre chose, mais ce qu'il ` +
          "croit n'est pas écrit — il arriverait sans le savoir.",
      );
  });
  if (!contacts.length)
    avertissements.push("Aucun contact : le personnage arriverait sans connaître personne.");
  if (!cadre(monde).contexte.trim())
    avertissements.push("Le contexte commun du monde est vide — le livret n'aura pas d'entrée.");

  return {
    type: "livret",
    identite: {
      id: p.id,
      nom: p.nom,
      role: p.role || "",
      groupe: groupe ? groupe.nom : "",
      joueur: casting ? etiquetteJoueur(casting, p.id) : "",
    },
    cadre: cadre(monde),
    background: (p.background || "").trim(),
    style: (p.style || "").trim(),
    objectifs: (p.objectifs || []).filter((o) => String(o).trim()),
    images: (p.images || []).filter((i) => i && i.src),
    traits,
    contacts,
    sait: sait.map((i) => i.contenu).filter(Boolean),
    croit: croyances.filter(Boolean),
    avertissements,
  };
}

/* ================= LA CONSIGNE PNJ ================= */

/**
 * Le document d'équipe pour un PNJ. Rien n'est caché — au contraire :
 * ce qui fait jouer un PNJ juste, c'est de savoir **ce que les autres
 * croient de faux**. Un PNJ qui ignore la fausse croyance d'un PJ va la
 * contredire sans le vouloir et défaire l'intrigue en une phrase.
 */
export function consigne(personnageId, { reseau, monde, infos, trames }) {
  const p = reseau.personnage(personnageId);
  if (!p) return null;

  const groupe = p.groupeId ? reseau.groupe(p.groupeId) : null;

  const porte = trames.trames().filter((t) => t.porteurId === p.id);

  const scenes = trames
    .situations()
    .filter((s) => (s.castIds || []).includes(p.id))
    .map((s) => ({
      titre: s.titre || "Sans titre",
      trame: (trames.trame(s.trameId) || {}).titre || "",
      pitch: s.pitch || "",
      debut: s.debut,
      fin: s.fin,
      lieu: s.espace || "",
      miseEnScene: s.miseEnScene || "",
      materiel: s.materiel || "",
      avec: (s.castIds || [])
        .filter((x) => x !== p.id)
        .map((x) => (reseau.personnage(x) || {}).nom)
        .filter(Boolean),
      requiert: trames
        .requiert(s.id)
        .map((id) => (infos.information(id) || {}).contenu)
        .filter(Boolean),
    }))
    .sort((a, b) => (a.debut ?? 99) - (b.debut ?? 99));

  // Simultanéité : combien de comédiens il faudra. Même calcul que la
  // frise, refait ici pour que la consigne soit lisible seule.
  let comediens = 1;
  for (const s of scenes)
    if (s.debut != null && s.fin != null) {
      const n = scenes.filter(
        (o) => o.debut != null && o.fin != null && o.debut < s.fin && s.debut < o.fin,
      ).length;
      if (n > comediens) comediens = n;
    }

  const { sait, croit } = infos.parPersonnage(p.id);

  /* L'ADDITION : les fausses croyances des AUTRES, avec la vérité.
     C'est ce qui manque à toute fiche de PNJ écrite à la main. */
  const croyancesAutour = [];
  for (const i of infos.informations())
    for (const autreId of infos.divergents(i.id)) {
      const q = reseau.personnage(autreId);
      if (!q || autreId === p.id) continue;
      croyancesAutour.push({
        qui: q.nom,
        croit: infos.croyance(i.id, autreId) || "— non écrit —",
        verite: i.contenu || "— sans contenu —",
      });
    }

  const contacts = reseau
    .liensTouchant(p.id)
    .map((l) => {
      const versMoi = l.vers === p.id;
      const autre = reseau.personnage(versMoi ? l.de : l.vers);
      if (!autre) return null;
      return {
        nom: autre.nom,
        sens: versMoi ? "le voit comme" : "voit",
        nature: l.nature || "",
        tonalite: TONALITES[l.tonalite],
        importance: IMPORTANCES[l.importance],
        miroir: !!l.miroir,
        cle: l.tonalite,
      };
    })
    .filter(Boolean);

  return {
    type: "consigne",
    identite: {
      id: p.id,
      nom: p.nom,
      role: p.role || "",
      groupe: groupe ? groupe.nom : "",
    },
    cadre: cadre(monde),
    comediens,
    porte: porte.map((t) => t.titre),
    scenes,
    contacts,
    sait: sait.map((i) => i.contenu).filter(Boolean),
    croit: croit.map((i) => ({
      verite: i.contenu,
      croyance: infos.croyance(i.id, p.id) || "— non écrit —",
    })),
    croyancesAutour,
    style: (p.style || "").trim(),
    notes: (p.notes || "").trim(),
    background: (p.background || "").trim(),
  };
}

function etiquetteJoueur(casting, personnageId) {
  const k = casting.titulaireDe(personnageId);
  if (!k) return "";
  const c = casting.candidature(k);
  return c ? c.label : "";
}

export function tousLesLivrets(stores) {
  return stores.reseau.pj().map((p) => livret(p.id, stores)).filter(Boolean);
}

export function toutesLesConsignes(stores) {
  return stores.reseau.pnj().map((p) => consigne(p.id, stores)).filter(Boolean);
}

/* ================= Rendus ================= */

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/** Markdown léger → HTML. Deux conventions propres au livret :
    · `---` seul sur sa ligne = **saut de page** à l'impression, ce qui
      permet à un background de tenir en plusieurs pages voulues ;
    · un jeton `@[nom](id)` devient le NOM SEUL — un joueur n'a que
      faire d'un identifiant. */
function proseHtml(texte) {
  return esc(texte)
    .replace(/@\[([^\]\n]*)\]\(([^)\n]+)\)/g, "<b>$1</b>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^\n_]+)_/g, "<em>$1</em>")
    .split(/\n/)
    .reduce((acc, ligne) => {
      if (/^\s*---\s*$/.test(ligne)) acc.push({ saut: true });
      else if (/^\s*$/.test(ligne)) acc.push({ vide: true });
      else {
        const d = acc[acc.length - 1];
        if (d && d.texte !== undefined) d.texte += "<br>" + ligne;
        else acc.push({ texte: ligne });
      }
      return acc;
    }, [])
    .map((b) => (b.saut ? '<div class="saut"></div>' : b.texte ? `<p>${b.texte}</p>` : ""))
    .join("");
}

function proseTexte(texte) {
  return String(texte || "").replace(/@\[([^\]\n]*)\]\(([^)\n]+)\)/g, "$1");
}

const STYLE_DOC = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { max-width: 40em; margin: 0 auto; padding: 3em 1.5em 5em;
    font-family: "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    font-size: 17px; line-height: 1.65; color: #1a1a1a; background: #fbfaf7; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 1em; margin-bottom: 2em; }
  .sur { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px;
    letter-spacing: .16em; text-transform: uppercase; color: #6b6257; margin: 0 0 .6em; }
  h1 { font-size: 2.1em; line-height: 1.1; margin: 0 0 .2em; }
  .role { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px;
    color: #6b6257; margin: 0; }
  h2 { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px;
    letter-spacing: .14em; text-transform: uppercase; color: #6b6257;
    margin: 2.4em 0 .7em; font-weight: 600; }
  section:first-of-type h2 { margin-top: 0; }
  dl { margin: 0; } dt { font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 12px; letter-spacing: .06em; color: #6b6257; margin-top: .9em; }
  dd { margin: .15em 0 0; }
  ul { padding-left: 1.2em; margin: 0; } li { margin-bottom: .45em; }
  .contact { margin-bottom: .9em; } .contact b { font-size: 1.05em; }
  .contact .lien { display: block; color: #3a3a3a; }
  .t-negatif b::after { content: " ✕"; color: #8c2f26; }
  .t-positif b::after { content: " ✓"; color: #2f6e4f; }
  .t-complique b::after { content: " ∼"; color: #5c4390; }
  figure { margin: 1.6em 0; } figure img { width: 100%; height: auto; display: block; }
  figcaption { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px;
    color: #6b6257; margin-top: .4em; }
  .encadre { border: 1px solid #d6d0c4; border-left: 3px solid #8c2f26;
    padding: .9em 1.1em; margin: 1.4em 0; background: #f5f2eb; }
  .encadre h2 { margin-top: 0; color: #8c2f26; }
  .encadre.calme { border-left-color: #5c4390; } .encadre.calme h2 { color: #5c4390; }
  .secu li { margin-bottom: .6em; } .secu b { display: block; }
  code { font-family: ui-monospace, monospace; font-size: .9em; background: #efece5;
    padding: 1px 4px; }
  .saut { break-after: page; height: 0; }
  .scene { border-left: 2px solid #d6d0c4; padding-left: .9em; margin-bottom: 1.4em; }
  .scene .quand { font-family: ui-monospace, monospace; font-size: 12px; color: #6b6257; }
  table { border-collapse: collapse; width: 100%; font-size: 15px; }
  td, th { border: 1px solid #d6d0c4; padding: .45em .6em; text-align: left;
    vertical-align: top; }
  th { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px;
    letter-spacing: .08em; text-transform: uppercase; color: #6b6257; font-weight: 600; }
  @media print {
    @page { size: A5 portrait; margin: 12mm; }
    body { background: #fff; padding: 0; max-width: none; font-size: 10.5pt; }
    h1 { font-size: 1.8em; }
    section { break-inside: avoid; }
    figure { break-inside: avoid; }
  }`;

function enveloppe(titreOnglet, corps, styleSup = "") {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titreOnglet)}</title>
<style>${STYLE_DOC}${styleSup}</style></head><body>
${corps}
</body></html>`;
}

const bloc = (titre, contenu, classe = "") =>
  contenu ? `<section class="${classe}"><h2>${esc(titre)}</h2>${contenu}</section>` : "";

const liste = (items) =>
  items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";

/** Les blocs de cadre, communs aux deux documents. */
function cadreHtml(c, { pratique = true } = {}) {
  const secu = c.securite.length
    ? `<ul class="secu">${c.securite
        .map((m) => `<li><b>${esc(m.nom)}</b>${esc(m.texte)}</li>`)
        .join("")}${c.securiteNote ? `<li>${esc(c.securiteNote)}</li>` : ""}</ul>`
    : c.securiteNote
      ? `<p>${esc(c.securiteNote)}</p>`
      : "";
  return (
    bloc("Notre intention", c.intention ? proseHtml(c.intention) : "") +
    (c.avertissements
      ? `<div class="encadre"><h2>Avertissements de contenu</h2>${proseHtml(c.avertissements)}</div>`
      : "") +
    (secu ? `<div class="encadre calme"><h2>Sécurité en jeu</h2>${secu}</div>` : "") +
    bloc("Le monde", c.contexte ? proseHtml(c.contexte) : "") +
    (pratique
      ? bloc("En pratique", c.pratique ? proseHtml(c.pratique) : "") +
        bloc("Costume", c.costume ? proseHtml(c.costume) : "")
      : "")
  );
}

export function livretHtml(l) {
  const c = l.cadre;
  const images = l.images.length
    ? l.images
        .map(
          (i) =>
            `<figure><img src="${esc(i.src)}" alt="${esc(i.legende || l.identite.nom)}">` +
            (i.legende ? `<figcaption>${esc(i.legende)}</figcaption>` : "") +
            "</figure>",
        )
        .join("")
    : "";

  return enveloppe(
    `${l.identite.nom}${c.titre ? " — " + c.titre : ""}`,
    `<header>
  ${c.titre ? `<p class="sur">${esc(c.titre)}</p>` : ""}
  <h1>${esc(l.identite.nom)}</h1>
  <p class="role">${[l.identite.role, l.identite.groupe].filter(Boolean).map(esc).join(" · ")}</p>
</header>
${cadreHtml(c)}
${images ? `<section>${images}</section>` : ""}
${bloc("Votre histoire", l.background ? proseHtml(l.background) : "")}
${bloc(
  "Qui vous êtes",
  l.traits.length
    ? `<dl>${l.traits.map((t) => `<dt>${esc(t.label)}</dt><dd>${esc(t.valeur)}</dd>`).join("")}</dl>`
    : "",
)}
${bloc("Ce que vous cherchez", liste(l.objectifs))}
${bloc(
  "Ceux que vous connaissez",
  l.contacts.length
    ? l.contacts
        .map(
          (x) =>
            `<div class="contact t-${x.cle}"><b>${esc(x.nom)}</b>` +
            (x.role ? ` <span class="role">${esc(x.role)}</span>` : "") +
            (x.nature ? `<span class="lien">${esc(x.nature)}</span>` : "") +
            "</div>",
        )
        .join("")
    : "",
)}
${bloc("Ce que vous savez", liste([...l.sait, ...l.croit]))}
${bloc("Comment vous jouer", l.style ? proseHtml(l.style) : "")}
${c.lieux.length ? bloc("Les lieux", liste(c.lieux.map((x) => `${x.nom}${x.note ? " — " + x.note : ""}`))) : ""}`,
  );
}

/** La consigne PNJ. Même peau, contenu opposé : rien n'est retiré. */
export function consigneHtml(k) {
  const c = k.cadre;
  const scenes = k.scenes.length
    ? k.scenes
        .map(
          (s) =>
            `<div class="scene"><b>${esc(s.titre)}</b>` +
            `<span class="quand">${s.debut != null ? `${s.debut}h → ${s.fin}h` : "sans horaire"}` +
            `${s.lieu ? " · " + esc(s.lieu) : ""}${s.trame ? " · " + esc(s.trame) : ""}</span>` +
            (s.pitch ? `<p>${esc(s.pitch)}</p>` : "") +
            (s.avec.length ? `<p><i>Avec :</i> ${s.avec.map(esc).join(", ")}</p>` : "") +
            (s.requiert.length
              ? `<p><i>Suppose que quelqu'un sache :</i> ${s.requiert.map(esc).join(" · ")}</p>`
              : "") +
            (s.miseEnScene ? `<p><i>À préparer :</i> ${esc(s.miseEnScene)}</p>` : "") +
            (s.materiel ? `<p><i>Matériel :</i> ${esc(s.materiel)}</p>` : "") +
            "</div>",
        )
        .join("")
    : "";

  const autour = k.croyancesAutour.length
    ? `<table><thead><tr><th>Qui</th><th>Croit</th><th>Alors qu'en fait</th></tr></thead><tbody>` +
      k.croyancesAutour
        .map(
          (x) =>
            `<tr><td>${esc(x.qui)}</td><td>${esc(x.croit)}</td><td>${esc(x.verite)}</td></tr>`,
        )
        .join("") +
      "</tbody></table>"
    : "";

  return enveloppe(
    `Consigne — ${k.identite.nom}`,
    `<header>
  <p class="sur">Consigne d'équipe${c.titre ? " · " + esc(c.titre) : ""}</p>
  <h1>${esc(k.identite.nom)}</h1>
  <p class="role">${[k.identite.role, k.identite.groupe, `${k.comediens} comédien${k.comediens > 1 ? "s" : ""}`].filter(Boolean).map(esc).join(" · ")}</p>
</header>
<div class="encadre"><h2>Ce document ne se remet à personne</h2>
<p>Il contient les vérités que les joueurs ignorent. Il est fait pour l'équipe.</p></div>
${bloc("Ce que vous portez", liste(k.porte))}
${bloc("Où vous entrez", scenes)}
${bloc("Ce que vous savez", liste(k.sait))}
${bloc(
  "Ce que vous croyez à tort",
  k.croit.length
    ? liste(k.croit.map((x) => `Vous croyez : ${x.croyance} — en fait : ${x.verite}`))
    : "",
)}
${bloc("Ce que les autres croient de faux", autour)}
${bloc(
  "Qui vous connaissez",
  k.contacts.length
    ? k.contacts
        .map(
          (x) =>
            `<div class="contact t-${x.cle}"><b>${esc(x.nom)}</b>` +
            `<span class="lien">${esc(x.sens)} : ${esc(x.nature || "—")} · ${esc(x.tonalite)} · ${esc(x.importance)}` +
            `${x.miroir ? " · contact-miroir" : ""}</span></div>`,
        )
        .join("")
    : "",
)}
${bloc("Comment le jouer", k.style ? proseHtml(k.style) : "")}
${bloc("Notes d'écriture", k.notes ? proseHtml(k.notes) : "")}
${cadreHtml(c, { pratique: false })}`,
  );
}

export function livretMarkdown(l) {
  const out = [];
  const c = l.cadre;
  if (c.titre) out.push(`# ${c.titre}`);
  out.push(`## ${l.identite.nom}`);
  const sous = [l.identite.role, l.identite.groupe].filter(Boolean).join(" · ");
  if (sous) out.push(`*${sous}*`);
  const sect = (t, corps) => {
    if (corps && corps.length) out.push("", `### ${t}`, "", ...[].concat(corps));
  };
  sect("Notre intention", c.intention && proseTexte(c.intention));
  sect("Avertissements de contenu", c.avertissements && proseTexte(c.avertissements));
  sect(
    "Sécurité en jeu",
    c.securite.map((m) => `- **${m.nom}** ${m.texte}`).concat(c.securiteNote ? [c.securiteNote] : []),
  );
  sect("Le monde", c.contexte && proseTexte(c.contexte));
  sect("En pratique", c.pratique && proseTexte(c.pratique));
  sect("Costume", c.costume && proseTexte(c.costume));
  sect("Votre histoire", l.background && proseTexte(l.background));
  sect("Qui vous êtes", l.traits.map((t) => `**${t.label}** — ${t.valeur}`));
  sect("Ce que vous cherchez", l.objectifs.map((o) => `- ${o}`));
  sect(
    "Ceux que vous connaissez",
    l.contacts.map((x) => `- **${x.nom}**${x.role ? ` (${x.role})` : ""}${x.nature ? ` — ${x.nature}` : ""}`),
  );
  sect("Ce que vous savez", [...l.sait, ...l.croit].map((s) => `- ${s}`));
  sect("Comment vous jouer", l.style && proseTexte(l.style));
  return out.join("\n");
}
