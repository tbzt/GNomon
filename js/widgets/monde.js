"use strict";

/* ============================================================
   LE MONDE — les fondamentaux, et le contexte commun.
   ------------------------------------------------------------
   Le premier écran du moment « Écrire », parce que c'est le premier
   travail : eXpérience commence par la prémisse, le propos et la
   thématique, avant tout personnage.

   C'est un écran de **document**, pas d'instrument : on y rédige. Il
   garde donc la serif et une colonne de lecture, là où la matrice ou le
   casting passent en sans et prennent la largeur.

   Sauvegarde débouncée et rendu en deux étages, comme la fiche — le
   store émet à chaque frappe, et reconstruire l'écran écraserait le
   champ sous le curseur.

   ── LE FIL A SA PROPRE SECTION, ET ELLE LE DIT ──
   Le fil de l'histoire n'est pas un champ parmi les autres : tout ce
   qui précède est public ou repris dans les livrets, lui ne sort
   jamais de l'équipe. Il est donc rangé à part, sous un titre qui
   l'annonce comme document d'organisation, plutôt que glissé dans la
   liste où un œil pressé le prendrait pour un « contexte » de plus.
   ============================================================ */
import { MECANIQUES } from "../core/mondestore.js";
import { hote } from "../core/liensstore.js";
import { Utils } from "../core/utils.js";

/** Le fil de l'histoire — hors de `CHAMPS` parce qu'il a sa section. */
const FIL = {
  cle: "fil",
  label: "Le fil de l'histoire",
  lignes: 18,
  aide:
    "Ce qui s'est RÉELLEMENT passé, daté, en une seule version — distinct du contexte (ce que tout le monde sait) " +
    "et des livrets (ce que chacun croit). En Markdown. Marquez ce qui est [FIXE], ce qui est un [INTERRUPTEUR] " +
    "que le jeu décide, ce qui est une [PROPOSITION] à valider ; finissez par un tableau « qui sait quoi ».",
  invite:
    "## Lundi 12 avril 1965 — le coup [FIXE]\n\n- 6h40, sur la départementale, quatre minutes. Aucun des neuf n'a tiré.\n" +
    "- [INTERRUPTEUR] Vers 22h30, Marcel va jusqu'à la porte de la doctoresse et fait demi-tour.\n\n" +
    "## Qui sait quoi\n\n| Vérité | Qui la sait | Qui croit autre chose |\n|---|---|---|",
};

const CHAMPS = [
  {
    cle: "premisse",
    label: "La prémisse",
    lignes: 2,
    aide: "eXpérience en donne la forme : [le héros] + va à + [action initiale] + et + [conséquence]. Une prémisse floue fait un GN flou.",
    invite: "Une doctoresse revient au village pour rouvrir l'enquête, et découvre sa propre signature au bas du rapport.",
  },
  {
    cle: "propos",
    label: "Le propos",
    lignes: 2,
    aide: "Ce que l'histoire dit. Pas son sujet — son affirmation.",
    invite: "Se taire pour protéger les siens finit par les détruire.",
  },
  {
    cle: "thematique",
    label: "La thématique",
    lignes: 2,
    aide: "L'époque, le genre, le registre. Ce qui donne le ton avant même le premier mot de jeu.",
    invite: "Montagne, hiver 1912. Drame rural, peu de violence, beaucoup de silences.",
  },
  {
    cle: "contexte",
    label: "Le contexte commun",
    lignes: 10,
    aide: "Ce que TOUT LE MONDE sait. C'est ce texte qui ouvre chaque livret — le sol partagé, pas les secrets.",
    invite: "Il y a trois semaines, une avalanche a emporté le tunnel haut…",
  },
  {
    cle: "intention",
    label: "La note d'intention",
    lignes: 4,
    aide: "Ce que l'équipe veut faire vivre, dit aux joueurs. Elle ouvre chaque livret — c'est souvent le seul texte que tout le monde lit vraiment.",
    invite: "Nous voulons un jeu de silences plus que d'affrontements. Le drame vient de ce qui n'est pas dit à temps.",
  },
  {
    cle: "avertissements",
    label: "Avertissements de contenu",
    lignes: 3,
    aide: "Les thèmes durs RÉELLEMENT présents. Se lit avant l'inscription, pas la veille.",
    invite: "Deuil d'un enfant, culpabilité, mensonge institutionnel. Pas de violence physique jouée.",
  },
  {
    cle: "pratique",
    label: "En pratique",
    lignes: 3,
    aide: "Horaires, lieu, ce qu'il faut apporter. Le prosaïque qui évite vingt courriels.",
    invite: "Samedi 14 h → dimanche 11 h. Salle des fêtes de Valmorel. Apportez un duvet et une lampe.",
  },
  {
    cle: "costume",
    label: "Costume",
    lignes: 3,
    aide: "Le code vestimentaire commun. Le détail par personnage va dans « Comment le jouer » de sa fiche.",
    invite: "Laine, lin, couleurs éteintes. Pas de fermeture éclair visible, pas de montre.",
  },
  {
    cle: "references",
    label: "Références",
    lignes: 3,
    aide: "Films, livres, images. Pour l'équipe d'écriture — ce champ ne sort jamais dans un livret.",
    invite: "",
  },
];

export const Monde = {
  _hote: null,
  _store: null,
  _liens: null,
  _tSave: null,

  monter(hote, store, liens) {
    this._hote = hote;
    this._store = store;
    this._liens = liens;
    this.rendre();
  },

  /** Écrit ce qui est en attente. Appelé avant toute navigation. */
  flush() {
    clearTimeout(this._tSave);
    this._tSave = null;
    if (!this._hote) return;
    const patch = {};
    for (const el of this._hote.querySelectorAll("[data-m]")) patch[el.dataset.m] = el.value;
    const t = this._hote.querySelector("#monde-titre");
    if (t) patch.titre = t.value.trim();
    if (Object.keys(patch).length) this._store.maj(patch);
  },

  rendre() {
    const m = this._store.monde();
    this._hote.innerHTML =
      '<div class="monde">' +
      `<input id="monde-titre" class="monde-titre" value="${Utils.escHtml(m.titre)}" ` +
      'placeholder="Le titre du GN" aria-label="Titre du GN" />' +
      '<p class="monde-intro">Les trois premières étapes de la méthode eXpérience. On les écrit ' +
      "avant tout personnage — et c'est le <b>contexte commun</b> qui ouvrira chaque livret.</p>" +
      CHAMPS.map(
        (c) =>
          `<label class="champ monde-champ"><span class="champ-label" title="${Utils.escHtml(c.aide)}">${c.label}</span>` +
          `<span class="monde-aide">${Utils.escHtml(c.aide)}</span>` +
          `<textarea rows="${c.lignes}" data-m="${c.cle}" placeholder="${Utils.escHtml(c.invite)}">${Utils.escHtml(m[c.cle] || "")}</textarea></label>`,
      ).join("") +
      this._fil() +
      this._securite() +
      this._hub() +
      `<div class="monde-lieux"><p class="carnet-titre">Les lieux<span class="carnet-aide">le site tel qu'il est, indépendamment des scènes qui s'y jouent</span></p>` +
      `<div id="liste-lieux">${this._lieux()}</div>` +
      '<button type="button" id="ajout-lieu">+ Lieu</button></div>' +
      `<div class="monde-lieux"><p class="carnet-titre">Les époques<span class="carnet-aide">un GN à un seul moment n'en déclare aucune</span></p>` +
      `<div id="liste-epoques">${this._epoques()}</div>` +
      '<button type="button" id="ajout-epoque">+ Époque</button></div>' +
      "</div>";
    this._brancher();
  },

  rafraichirDerives() {
    // Le hub et les lieux se re-projettent ; les champs de saisie, non.
    const l = this._hote.querySelector("#liste-lieux");
    if (l) {
      l.innerHTML = this._lieux();
      this._brancherLieux();
    }
    const h = this._hote.querySelector(".monde-hub");
    if (h && document.activeElement && !h.contains(document.activeElement)) {
      h.outerHTML = this._hub();
      this._brancher();
    }
  },

  /** Document d'organisation : ce qui s'est passé, en une seule version.
      Il ne sort jamais d'un livret — l'écran le dit en toutes lettres,
      parce que c'est la seule protection qui ait du sens pour un texte
      qu'on rédige soi-même. Même mécanique de saisie que les autres
      champs (`data-m`) : le flush et la sauvegarde débouncée le
      prennent sans rien de plus. */
  _fil() {
    const m = this._store.monde();
    return (
      '<div class="monde-fil"><p class="carnet-titre">' +
      Utils.escHtml(FIL.label) +
      '<span class="carnet-aide">document d\'organisation — ne sort jamais dans un livret</span></p>' +
      '<p class="monde-aide">' +
      "Un GN a trois niveaux de vérité : <b>ce qui s'est passé</b> (ici, une seule version), " +
      "<b>ce que chaque personnage croit</b> (les livrets), et <b>ce que tout le monde sait</b> " +
      "(le contexte commun, plus haut). Ce texte reste dans l'équipe : il n'est repris dans " +
      "aucun livret, aucune consigne, aucune planche. Il part avec l'archive, qui contient déjà tout." +
      "</p>" +
      `<label class="champ monde-champ"><span class="champ-label" title="${Utils.escHtml(FIL.aide)}">Le fil, en Markdown</span>` +
      `<span class="monde-aide">${Utils.escHtml(FIL.aide)}</span>` +
      `<textarea rows="${FIL.lignes}" data-m="${FIL.cle}" placeholder="${Utils.escHtml(FIL.invite)}">${Utils.escHtml(m.fil || "")}</textarea></label>` +
      "</div>"
    );
  },

  /** Toutes actives par défaut : le défaut sûr est celui qui protège.
      En retirer une doit être un geste, pas un oubli. */
  _securite() {
    const actives = this._store.securite();
    return (
      '<div class="monde-securite"><p class="carnet-titre">Sécurité en jeu' +
      "<span class=\"carnet-aide\">reprises dans chaque livret et chaque consigne</span></p>" +
      '<p class="monde-aide">Ces outils ne servent que si tout le monde les a lus <b>avant</b>. ' +
      "Ils sont donc repris automatiquement dans chaque document remis.</p>" +
      '<ul class="mecas">' +
      Object.entries(MECANIQUES)
        .map(
          ([cle, m]) =>
            `<li><label><input type="checkbox" data-meca="${cle}"${actives.includes(cle) ? " checked" : ""} /> ` +
            `<b>${Utils.escHtml(m.nom)}</b></label><span>${Utils.escHtml(m.texte)}</span></li>`,
        )
        .join("") +
      "</ul>" +
      '<label class="champ"><span class="champ-label">Ce qui est propre à ce GN</span>' +
      `<textarea rows="2" data-m="securiteNote" placeholder="Le référent sécurité est Claire, gilet orange, joignable au 06…">${Utils.escHtml(this._store.monde().securiteNote || "")}</textarea></label>` +
      "</div>"
    );
  },

  /** ── RELIER SANS STOCKER ──
      GNomon ne veut pas devenir le Drive de l'équipe, ni son tableau
      d'organisation : ces outils existent et les refaire moins bien
      serait une perte sèche. Mais il peut être le **point de départ**
      d'où l'on retrouve où sont les choses. On ne garde donc que des
      adresses, jamais ce qui est au bout. */
  _hub() {
    const l = this._liens ? this._liens.generaux() : [];
    const lignes = l.length
      ? l
          .map(
            (x) =>
              `<li><a href="${Utils.escHtml(x.url)}" target="_blank" rel="noopener noreferrer">` +
              `<b>${Utils.escHtml(x.titre)}</b><span>${Utils.escHtml(hote(x.url))}</span></a>` +
              `<input data-lien-note="${x.id}" value="${Utils.escHtml(x.note)}" placeholder="À quoi ça sert" aria-label="Note" />` +
              `<button type="button" data-lien-x="${x.id}" title="Retirer">✕</button></li>`,
          )
          .join("")
      : '<li class="liens-vide">Aucun lien. Le Drive de l\'équipe, le tableau d\'organisation, ' +
        "le dossier de photos — tout ce qu'on cherche toujours.</li>";
    return (
      '<div class="monde-hub"><p class="carnet-titre">Où sont les choses' +
      "<span class=\"carnet-aide\">des adresses, jamais leur contenu</span></p>" +
      '<p class="monde-aide">GNomon ne remplace ni votre Drive ni votre tableau d\'organisation. ' +
      "Il peut être l'endroit d'où on les retrouve.</p>" +
      `<ul class="hub">${lignes}</ul>` +
      '<button type="button" id="ajout-lien">+ Lien</button></div>'
    );
  },

  /* ================= Époques =================
     Deux moments de jeu — un flashback la veille, un opus précédent —
     et tout ce que porte une fiche est daté. La liste vide veut dire
     « un seul moment », et c'est le cas de presque tous les GN : on ne
     crée donc rien d'office, on ouvre juste la porte.

     L'ORDRE est la seule chose que le reste du code demande : il dit ce
     qui vient avant, et c'est lui qui fait la frise et la projection
     des liens. Il se règle par les flèches, pas par un champ à saisir —
     un numéro à taper se contredit dès qu'on insère au milieu. */

  _epoques() {
    const l = this._store.epoques();
    if (!l.length)
      return '<p class="liens-vide">Aucune époque. Un GN qui se déroule à un seul moment n\'en a pas besoin.</p>';
    return (
      '<ul class="lieux">' +
      l
        .map(
          (e, i) =>
            `<li><input data-epoque-nom="${e.id}" value="${Utils.escHtml(e.nom)}" placeholder="1965" aria-label="Nom de l'époque" />` +
            `<span class="epoque-ordre">` +
            `<button type="button" data-epoque-haut="${e.id}"${i === 0 ? " disabled" : ""} title="Plus tôt" aria-label="Plus tôt">↑</button>` +
            `<button type="button" data-epoque-bas="${e.id}"${i === l.length - 1 ? " disabled" : ""} title="Plus tard" aria-label="Plus tard">↓</button>` +
            `</span>` +
            `<button type="button" data-epoque-x="${e.id}" title="Retirer">✕</button></li>`,
        )
        .join("") +
      "</ul>"
    );
  },

  _brancherEpoques() {
    const rendre = () => {
      const n = this._hote.querySelector("#liste-epoques");
      if (n) {
        n.innerHTML = this._epoques();
        this._brancherEpoques();
      }
    };
    for (const el of this._hote.querySelectorAll("[data-epoque-nom]"))
      el.addEventListener("input", (e) =>
        this._store.majEpoque(el.dataset.epoqueNom, { nom: e.target.value }),
      );
    for (const el of this._hote.querySelectorAll("[data-epoque-x]"))
      el.addEventListener("click", () => {
        this._store.supprimerEpoque(el.dataset.epoqueX);
        rendre();
      });
    // Échanger deux ordres plutôt que renuméroter toute la liste : on ne
    // touche qu'aux deux qui bougent, et l'opération est son propre inverse.
    const glisser = (id, delta) => {
      const l = this._store.epoques();
      const i = l.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= l.length) return;
      this._store.majEpoque(l[i].id, { ordre: l[j].ordre });
      this._store.majEpoque(l[j].id, { ordre: l[i].ordre });
      rendre();
    };
    for (const el of this._hote.querySelectorAll("[data-epoque-haut]"))
      el.addEventListener("click", () => glisser(el.dataset.epoqueHaut, -1));
    for (const el of this._hote.querySelectorAll("[data-epoque-bas]"))
      el.addEventListener("click", () => glisser(el.dataset.epoqueBas, 1));
  },

  _lieux() {
    const lieux = this._store.lieux();
    if (!lieux.length)
      return '<p class="liens-vide">Aucun lieu. Ils servent au livret et à l\'équipe.</p>';
    return (
      '<ul class="lieux">' +
      lieux
        .map(
          (x) =>
            `<li><input data-lieu-nom="${x.id}" value="${Utils.escHtml(x.nom)}" placeholder="Le dispensaire" aria-label="Nom du lieu" />` +
            `<input data-lieu-note="${x.id}" value="${Utils.escHtml(x.note)}" placeholder="Ce qu'il permet, ce qu'il empêche…" aria-label="Note" />` +
            `<button type="button" data-lieu-x="${x.id}" title="Retirer">✕</button></li>`,
        )
        .join("") +
      "</ul>"
    );
  },

  _brancher() {
    const maj = (patch) => this._store.maj(patch);
    this._hote.querySelector("#monde-titre").addEventListener("change", (e) =>
      maj({ titre: e.target.value.trim() }),
    );
    for (const ta of this._hote.querySelectorAll("[data-m]")) {
      ta.addEventListener("input", () => {
        clearTimeout(this._tSave);
        this._tSave = setTimeout(() => maj({ [ta.dataset.m]: ta.value }), 500);
      });
      ta.addEventListener("blur", () => this.flush());
    }
    const bl = this._hote.querySelector("#ajout-lien");
    if (bl)
      bl.addEventListener("click", () => {
        const url = prompt("Adresse (https://…) :", "");
        if (url === null || !url.trim()) return;
        const titre = prompt("Comment l'appeler ?", hote(url) || "Lien") || "";
        const r = this._liens.ajouter({ titre, url });
        if (!r.ok) {
          const el = document.getElementById("statut");
          if (el) {
            el.textContent = r.raison;
            el.hidden = false;
          }
        }
      });
    for (const el of this._hote.querySelectorAll("[data-lien-note]"))
      el.addEventListener("change", (e) =>
        this._liens.maj(el.dataset.lienNote, { note: e.target.value }),
      );
    for (const b of this._hote.querySelectorAll("[data-lien-x]"))
      b.addEventListener("click", () => this._liens.supprimer(b.dataset.lienX));

    for (const c of this._hote.querySelectorAll("[data-meca]"))
      c.addEventListener("change", () => this._store.basculerMecanique(c.dataset.meca));
    this._hote
      .querySelector("#ajout-lieu")
      .addEventListener("click", () => this._store.ajouterLieu());
    this._brancherLieux();
    const ajout = this._hote.querySelector("#ajout-epoque");
    if (ajout)
      ajout.addEventListener("click", () => {
        this._store.creerEpoque("");
        const n = this._hote.querySelector("#liste-epoques");
        if (n) {
          n.innerHTML = this._epoques();
          this._brancherEpoques();
        }
      });
    this._brancherEpoques();
  },

  _brancherLieux() {
    for (const el of this._hote.querySelectorAll("[data-lieu-nom]"))
      el.addEventListener("change", (e) =>
        this._store.majLieu(el.dataset.lieuNom, { nom: e.target.value }),
      );
    for (const el of this._hote.querySelectorAll("[data-lieu-note]"))
      el.addEventListener("change", (e) =>
        this._store.majLieu(el.dataset.lieuNote, { note: e.target.value }),
      );
    for (const b of this._hote.querySelectorAll("[data-lieu-x]"))
      b.addEventListener("click", () => this._store.supprimerLieu(b.dataset.lieuX));
  },
};
