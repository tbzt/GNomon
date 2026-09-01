"use strict";

/* ============================================================
   FICHE — l'écran d'écriture d'un personnage.
   ------------------------------------------------------------
   Trois choses, et l'ordre compte :

   1. **Les huit champs d'eXpérience** (fonction, point de vue moral,
      désir, besoin, faiblesse, pouvoirs, transformation, archétype).
      Saisis, parce qu'ils sont l'intention de l'auteur. Repliés par
      défaut : on écrit d'abord, on structure ensuite.

   2. **La jauge de couverture** — neuf pastilles CALCULÉES depuis le
      réseau (cf. `core/couverture.js`). Aucune n'est saisissable. On
      clique une pastille grise, elle dit ce qui manque et pourquoi.

   3. **Le background** — le texte REMIS au joueur : long, en pages
      (`---` seul sur sa ligne = saut de page), avec ses images et ses
      indications de style. Et **le carnet**, qui ne sort jamais : c'est
      là qu'on note « à révéler en S3 » sans l'envoyer au joueur.
      Les deux acceptent le `@mention` qui propose l'arête.

   4. **Le squelette** — ce que ce personnage sait avant le jeu, DÉRIVÉ
      des informations qu'on lui a posées. eXpérience décrit exactement
      ce mouvement : poser une information préliminaire sur une
      situation, c'est « commencer à rédiger le squelette de sa future
      fiche ». On l'automatise, il ne reste qu'à romancer.

      Le squelette n'écrit **pas** dans le carnet. Écrire à la place de
      l'auteur produirait du texte qu'il faudrait ensuite démêler du
      sien, et qui se désynchroniserait au premier changement. Il est
      affiché à côté, toujours juste, et l'auteur s'en sert comme d'une
      liste de courses.

   ── RENDU EN DEUX ÉTAGES, et ce n'est pas de l'optimisation ──
   `rendre()` construit tout ; `rafraichirDerives()` ne remet à jour que
   la jauge, les liens et les compteurs. Le store émet à chaque frappe
   sauvegardée — si on re-construisait tout, on écraserait le textarea
   sous le curseur de l'auteur : sélection perdue, position perdue,
   frappe suivante à l'envers. On ne touche jamais au champ qui a le
   focus.
   ============================================================ */
import { couverture } from "../core/couverture.js";
import { INFLUENCES } from "../core/informationstore.js";
import { TONALITES, IMPORTANCES, FONCTIONS } from "../core/reseaustore.js";
import { pointDeVue } from "../core/pointdevue.js";
import { defection } from "../core/defection.js";
import { crashTestArriveeTardive } from "../core/crashtest.js";
import { heure } from "../core/temps.js";
import { Mentions } from "./journal/mentions.js";
import { LienEditeur } from "./lienediteur.js";
import { degatsHtml } from "./degats.js";
import { Utils } from "../core/utils.js";

/** Réduit une image avant de l'embarquer en `data:` — une photo de
    téléphone fait 4 Mo, et le quota du `localStorage` en fait 5 au
    total. 900 px de large suffisent largement à un livret imprimé en
    A5 ; sans cette étape, la première image ferait échouer toutes les
    écritures suivantes. */
function initiales(nom) {
  return String(nom || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join("");
}

function reduire(fichier, largeurMax = 900, qualite = 0.82) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = reject;
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(1, largeurMax / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", qualite));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

/** Le portrait est CARRÉ et petit (360 px) : il sera tiré quarante
    fois sur une planche de trombinoscope, et quarante portraits à
    900 px dépasseraient à eux seuls le quota du `localStorage`. On
    recadre au centre plutôt que de déformer — un visage étiré est pire
    qu'un visage coupé. */
function reduireCarre(fichier, cote = 360, qualite = 0.78) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = reject;
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        const c = document.createElement("canvas");
        c.width = c.height = cote;
        c.getContext("2d").drawImage(img, sx, sy, min, min, 0, 0, cote, cote);
        resolve(c.toDataURL("image/jpeg", qualite));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

const CHAMPS = [
  { cle: "moral", label: "Point de vue moral", aide: "Sa position sur le problème central. Différente de celle des autres, surtout de son adversaire." },
  { cle: "desir", label: "Désir", aide: "Sa carotte. On doit pouvoir dire QUAND il sera réalisé." },
  { cle: "besoin", label: "Besoin", aide: "Plus profond et plus flou que le désir — et souvent en contradiction avec lui." },
  { cle: "faiblesse", label: "Faiblesse", aide: "Ce qui l'empêche d'obtenir son désir." },
  { cle: "pouvoirs", label: "Pouvoirs et capacités", aide: "Ce qu'il sait faire que les autres ne savent pas." },
  { cle: "transformation", label: "Transformation possible", aide: "Ce qu'il peut devenir au cours du jeu." },
  { cle: "archetype", label: "Archétype", aide: "Le moule, pour se repérer — et sa zone d'ombre." },
];

export const Fiche = {
  _store: null,
  _infos: null,
  _hote: null,
  _id: null,
  _onOuvrir: null,
  _tSave: null,
  _tCarnet: null,
  _lienOuvert: null,

  monter(hote, store, personnageId, { onOuvrir = null, infos = null, trames = null } = {}) {
    // On quitte peut-être une fiche en cours d'écriture : la sauvegarde
    // est débouncée, donc les dernières frappes ne sont pas encore au
    // store. Les écrire AVANT de changer de personnage.
    this.flush();
    this._hote = hote;
    this._store = store;
    this._infos = infos;
    this._trames = trames;
    this._id = personnageId;
    this._onOuvrir = onOuvrir;
    // L'éditeur ouvert appartenait au lien d'un AUTRE personnage.
    this._lienOuvert = null;
    // Les dégâts d'une absence sont une question qu'on POSE, pas un
    // état permanent de la fiche : on les replie en changeant de
    // personne, comme l'éditeur de lien juste au-dessus.
    this._crashOuvert = false;
    this._heureTard = null;
    this.rendre();
  },

  personnageId() {
    return this._id;
  },

  /** Écrit immédiatement le carnet en attente et annule le débounce.
      À appeler avant toute navigation, et au blur du champ : sans ça,
      quitter l'écran dans les 400 ms perd les dernières frappes. */
  flush() {
    clearTimeout(this._tSave);
    clearTimeout(this._tCarnet);
    this._tSave = this._tCarnet = null;
    if (!this._hote || !this._id) return;
    const p = this._store.personnage(this._id);
    if (!p) return;
    const patch = {};
    const fond = this._hote.querySelector("#background");
    if (fond && p.background !== fond.value) patch.background = fond.value;
    const carnet = this._hote.querySelector("#carnet");
    if (carnet && p.notes !== carnet.value) patch.notes = carnet.value;
    if (Object.keys(patch).length) this._store.majPersonnage(this._id, patch);
  },

  /* ================= rendu complet ================= */

  rendre() {
    const p = this._store.personnage(this._id);
    if (!p) {
      this._hote.innerHTML = '<p class="vide">Ce personnage n\'existe plus.</p>';
      return;
    }

    this._hote.innerHTML =
      `<article class="fiche${p.pj ? "" : " pnj"}">` +
      this._entete(p) +
      '<div class="fiche-corps">' +
      `<div class="fiche-gauche">${this._background(p)}${this._carnet(p)}${this._extras(p)}` +
      `<div id="fiche-liens">${this._liens(p)}</div></div>` +
      `<aside class="fiche-droite"><div id="fiche-jauge">${this._jauge(p)}</div>` +
      `<div id="fiche-squelette">${this._squelette(p)}</div>` +
      `<div id="fiche-vecu">${this._vecu(p)}</div>${this._champs(p)}</aside>` +
      "</div></article>";

    this._brancher();
  },

  /** Ne remet à jour que le dérivé. Ne touche jamais au champ focalisé. */
  rafraichirDerives() {
    const p = this._store.personnage(this._id);
    if (!p || !this._hote.querySelector(".fiche")) return;
    const j = this._hote.querySelector("#fiche-jauge");
    const l = this._hote.querySelector("#fiche-liens");
    const q = this._hote.querySelector("#fiche-squelette");
    const v = this._hote.querySelector("#fiche-vecu");
    if (j) j.innerHTML = this._jauge(p);
    if (q) q.innerHTML = this._squelette(p);
    if (v) {
      v.innerHTML = this._vecu(p);
      this._brancherVecu();
    }
    if (l) this._reprojeterLiens(l, p);
    const t = this._hote.querySelector(".fiche-titre");
    if (t && document.activeElement !== t) t.value = p.nom;
    this._brancherJauge();
  },

  /* ================= morceaux ================= */

  _entete(p) {
    const opts = Object.entries(FONCTIONS)
      .map(
        ([k, v]) =>
          `<option value="${k}"${p.fonction === k ? " selected" : ""}>${Utils.escHtml(v)}</option>`,
      )
      .join("");
    return (
      '<header class="fiche-entete">' +
      '<div class="fiche-identite">' +
      '<div class="fiche-portrait">' +
      (p.portrait
        ? `<img src="${Utils.escHtml(p.portrait)}" alt="" />`
        : `<span class="silhouette">${Utils.escHtml(initiales(p.nom))}</span>`) +
      '<span class="portrait-actions">' +
      '<button type="button" id="portrait-fichier" title="Depuis un fichier">Photo</button>' +
      '<button type="button" id="portrait-url" title="Depuis une adresse">URL</button>' +
      (p.portrait ? '<button type="button" id="portrait-x" title="Retirer">✕</button>' : "") +
      '<input id="fichier-portrait" type="file" accept="image/*" hidden /></span>' +
      "</div><div class=\"fiche-identite-texte\">" +
      `<input class="fiche-titre" value="${Utils.escHtml(p.nom)}" aria-label="Nom du personnage" />` +
      '<div class="fiche-meta">' +
      `<input class="fiche-role" value="${Utils.escHtml(p.role)}" placeholder="Métier ou fonction…" aria-label="Métier ou fonction" />` +
      `<select class="fiche-fonction" aria-label="Fonction narrative"><option value="">— fonction narrative —</option>${opts}</select>` +
      `<label class="bascule"><input type="checkbox" class="fiche-pj"${p.pj ? " checked" : ""} /> PJ</label>` +
      `<label class="bascule"><input type="checkbox" class="fiche-surprise"${p.surprise ? " checked" : ""} /> Surprise en réserve</label>` +
      "</div></div></div></header>"
    );
  },

  _jauge(p) {
    const c = couverture(this._store, p.id);
    const n = c.filter((x) => x.ok).length;
    return (
      '<div class="jauge-bloc">' +
      `<p class="jauge-titre"><span>Couverture</span><span class="jauge-score">${n}/9</span></p>` +
      '<div class="jauge">' +
      c
        .map(
          (x, i) =>
            `<button type="button" class="pastille${x.ok ? " on" : ""}" data-i="${i}" ` +
            `aria-pressed="false" aria-label="${Utils.escHtml(x.nom)} : ${x.ok ? "couvert" : "manquant"}" ` +
            `title="${Utils.escHtml(x.nom)}"></button>`,
        )
        .join("") +
      "</div>" +
      '<p class="jauge-dit" id="jauge-dit">Les neuf pastilles sont <b>calculées</b> depuis le réseau, ' +
      "jamais saisies. Touchez-en une pour savoir ce qu'elle mesure.</p>" +
      "</div>"
    );
  },

  /** Ce que ce personnage porte avant que le jeu commence. Dérivé,
      jamais saisi ici — la vérité est dans `InformationStore`, posée
      depuis les situations qui en ont besoin. */
  _squelette(p) {
    if (!this._infos) return "";
    const { sait, croit } = this._infos.parPersonnage(p.id);
    if (!sait.length && !croit.length)
      return (
        '<div class="squelette vide-sq"><p class="jauge-titre"><span>Ce qu\'il sait</span></p>' +
        "<p>Rien pour l'instant. Les informations arrivent ici quand une situation " +
        "déclare en avoir besoin — la fiche s'amorce toute seule.</p></div>"
      );

    // Le marqueur « faux » suit l'ÉTAT, jamais le fait qu'on ait déjà
    // écrit la croyance. Le lier au texte affichait un personnage qui
    // croit autre chose comme s'il savait, tant que la croyance était
    // vide — soit exactement le contraire de ce que l'auteur doit voir.
    const ligne = (i, faux = false, croyance = "") =>
      `<li class="sq-item${faux ? " sq-faux" : ""}">` +
      `<span class="sq-txt">${Utils.escHtml(i.contenu) || "<sans contenu>"}</span>` +
      (faux
        ? `<span class="sq-croit">il croit : ${Utils.escHtml(croyance) || "— reste à écrire"}</span>`
        : `<span class="sq-infl">influence ${INFLUENCES[i.influence].toLowerCase()}</span>`) +
      "</li>";

    return (
      '<div class="squelette">' +
      `<p class="jauge-titre"><span>Ce qu'il sait</span><span class="jauge-score">${sait.length + croit.length}</span></p>` +
      '<ul class="sq-liste">' +
      sait.map((i) => ligne(i)).join("") +
      croit.map((i) => ligne(i, true, this._infos.croyance(i.id, p.id))).join("") +
      "</ul>" +
      '<p class="sq-note">Le squelette de sa fiche. Il ne s\'écrit pas dans le carnet : ' +
      "à vous de le romancer.</p></div>"
    );
  },

  /** ── CE QU'IL VIT ──
      Le GN vu depuis cette personne : a-t-elle réellement quelque chose
      à jouer, et que coûte son absence ? Deux questions que l'outil
      savait déjà répondre (`pointdevue.js`, `defection.js`) mais qu'il
      fallait aller chercher ailleurs — le crash test n'existait que sur
      le graphe, et rien ne disait « ce personnage risque de ne rien
      vivre ».

      Entièrement DÉRIVÉ, comme le squelette et la jauge : rien ne
      s'écrit ici. Et le bloc disparaît si l'écran est monté sans les
      trames, plutôt que de mentir avec un « aucune scène » qui ne
      voudrait rien dire. */
  _vecu(p) {
    if (!this._trames || !this._infos) return "";
    const v = pointDeVue(p.id, {
      reseau: this._store,
      trames: this._trames,
      infos: this._infos,
    });
    if (!v) return "";

    const porte = v.situations.filter((s) => s.porteur).length;
    const figure = v.situations.length - porte;

    const lignes = [];
    if (v.situations.length)
      lignes.push(
        `<li><b>${v.situations.length}</b> ${Utils.plur(v.situations.length, "scène")} — ` +
          `${porte} ${Utils.plur(porte, "portée")}, ${figure} en figuration</li>`,
      );
    if (v.peutApprendre.length)
      lignes.push(
        `<li><b>${v.peutApprendre.length}</b> ${Utils.plur(v.peutApprendre.length, "chose")} ` +
          `${Utils.plur(v.peutApprendre.length, "à découvrir")}</li>`,
      );
    const ouvertes = v.peutProvoquer.filter((c) => c.aUneSuite).length;
    if (v.peutProvoquer.length)
      lignes.push(
        `<li><b>${v.peutProvoquer.length}</b> ${Utils.plur(v.peutProvoquer.length, "conséquence")} ` +
          `${Utils.plur(v.peutProvoquer.length, "possible")}` +
          (ouvertes < v.peutProvoquer.length
            ? ` <span class="vc-attente">(${v.peutProvoquer.length - ouvertes} sans suite écrite)</span>`
            : "") +
          "</li>",
      );

    // Les trous sont le seul calcul neuf de ce bloc, et le plus utile :
    // c'est là qu'un joueur se retrouve à errer sans savoir quoi faire.
    const trous = v.trous
      .map(
        (t) =>
          `<li class="vc-trou">Rien de prévu entre <b>${heure(t.debut)}</b> et <b>${heure(t.fin)}</b>` +
          ` — ${t.duree.toFixed(1).replace(/\.0$/, "")} h</li>`,
      )
      .join("");

    // ── LE VERDICT NE SE DIT PAS PAREIL POUR UN PNJ ──
    // « Présent mais spectateur » est un défaut pour un PJ — c'est un
    // joueur qui paiera pour ne rien vivre. Pour un PNJ, c'est souvent
    // le métier : il est une FONCTION, pas une personne avec un arc
    // (même distinction que la frise, cf. §5e). Le signaler en rouge
    // apprendrait à ignorer l'alerte là où elle compte vraiment.
    const alarme = !v.aQuelqueChoseAVivre && p.pj;
    return (
      '<div class="vecu">' +
      '<p class="jauge-titre"><span>Ce qu\'il vit</span>' +
      `<span class="jauge-score ${alarme ? "vc-rien" : ""}">${v.aQuelqueChoseAVivre ? "✓" : "—"}</span></p>` +
      (v.aQuelqueChoseAVivre
        ? `<ul class="vc-liste">${lignes.join("")}${trous}</ul>`
        : alarme
          ? '<p class="vc-alerte">Ce personnage n\'a rien à jouer : aucune scène qu\'il porte, ' +
            "rien à y apprendre, aucune conséquence à provoquer. Il est présent, mais spectateur.</p>"
          : '<p class="vc-note">Il figure sans rien porter ni rien apprendre. Pour un PNJ, c\'est ' +
            "souvent le rôle attendu — il sert les scènes des autres.</p>") +
      (v.sansHoraire.length
        ? `<p class="vc-note">${v.sansHoraire.length} ${Utils.plur(v.sansHoraire.length, "scène")} ` +
          `${Utils.plur(v.sansHoraire.length, "sans horaire")} — non ${Utils.plur(v.sansHoraire.length, "placée")} sur la frise, ` +
          "donc hors du calcul des temps morts.</p>"
        : "") +
      '<div class="vc-essais">' +
      `<button type="button" class="vc-crash" data-crash aria-expanded="${this._crashOuvert}">` +
      `${this._crashOuvert ? "Masquer" : "Et s'il ne vient pas ?"}</button>` +
      // ── L'ABSENCE PARTIELLE ──
      // Un retard n'est pas une absence, et c'est justement pour ça
      // qu'il mérite sa porte : « je n'arrive qu'à 22 h » est le message
      // qu'on reçoit vraiment, bien plus souvent que « je ne viens
      // pas ». Le calcul réutilise `defection()` sur les seules scènes
      // manquées (cf. `core/crashtest.js`).
      `<button type="button" class="vc-crash" data-tard aria-expanded="${this._heureTard != null}">` +
      `${this._heureTard != null ? "Masquer" : "…ou s'il arrive tard ?"}</button>` +
      "</div>" +
      (this._crashOuvert
        ? '<div class="vc-degats">' +
          degatsHtml(
            defection(p.id, { reseau: this._store, trames: this._trames, infos: this._infos }),
          ) +
          "</div>"
        : "") +
      (this._heureTard != null ? this._tardif(p) : "") +
      "</div>"
    );
  },

  /** Ce qu'un retard coûte. L'heure est saisie, parce qu'elle vient
      d'un message reçu — il n'y a pas de défaut sensé à deviner. */
  _tardif(p) {
    const r = crashTestArriveeTardive(p.id, this._heureTard, {
      reseau: this._store,
      trames: this._trames,
      infos: this._infos,
    });
    return (
      '<div class="vc-degats">' +
      '<p class="vc-tard-ligne"><label>Arrive à</label>' +
      `<input type="number" step="0.5" min="0" max="48" data-tard-h value="${this._heureTard}" aria-label="Heure d'arrivée" />` +
      `<span>${heure(this._heureTard)}</span></p>` +
      (!r || !r.manquees.length
        ? '<p class="dg-aide ok">Il ne manque rien : aucune de ses scènes ne se termine avant cette heure.</p>'
        : `<p class="dg-aide">Il manquerait <b>${r.manquees.length}</b> ${Utils.plur(r.manquees.length, "scène")} : ` +
          r.manquees.map((s) => `« ${Utils.escHtml(s.titre)} »`).join(", ") +
          ".</p>" + degatsHtml(r.degats)) +
      "</div>"
    );
  },

  _brancherVecu() {
    const v = this._hote.querySelector("#fiche-vecu");
    if (!v) return;
    const rejouer = () => {
      const p = this._store.personnage(this._id);
      if (!p) return;
      v.innerHTML = this._vecu(p);
      this._brancherVecu();
    };

    const b = v.querySelector("[data-crash]");
    if (b)
      b.addEventListener("click", () => {
        this._crashOuvert = !this._crashOuvert;
        rejouer();
      });

    const t = v.querySelector("[data-tard]");
    if (t)
      t.addEventListener("click", () => {
        // Une heure par défaut plutôt qu'un champ vide : ouvrir le
        // panneau doit montrer un résultat, pas demander une saisie
        // avant de servir à quelque chose.
        this._heureTard = this._heureTard == null ? 22 : null;
        rejouer();
      });

    const h = v.querySelector("[data-tard-h]");
    if (h)
      h.addEventListener("change", (e) => {
        const n = Number(e.target.value);
        this._heureTard = Number.isFinite(n) ? n : this._heureTard;
        rejouer();
      });
  },

  _champs(p) {
    return (
      '<details class="champs-bloc"><summary title="Les huit champs de la méthode eXpérience. Le huitième — la fonction narrative — est dans l\'en-tête, avec l\'identité.">Structure du personnage</summary>' +
      CHAMPS.map(
        (c) =>
          `<label class="champ"><span class="champ-label" title="${Utils.escHtml(c.aide)}">${c.label}</span>` +
          `<textarea rows="2" data-champ="${c.cle}" placeholder="${Utils.escHtml(c.aide)}">${Utils.escHtml(p[c.cle] || "")}</textarea></label>`,
      ).join("") +
      "</details>"
    );
  },

  /** Le texte REMIS. `---` seul sur sa ligne fait un saut de page à
      l'impression : c'est ainsi qu'un background tient en plusieurs
      pages voulues plutôt qu'en un bloc qui déborde. */
  _background(p) {
    return (
      '<section class="carnet">' +
      '<p class="carnet-titre">Le background <span class="carnet-aide">remis au joueur · <b>@</b> mentionne · <b>---</b> saut de page</span></p>' +
      `<textarea id="background" rows="16" placeholder="Le texte que la personne lira avant de venir. Prenez la place qu'il faut — une ligne « --- » commence une nouvelle page.">${Utils.escHtml(p.background || "")}</textarea>` +
      '<div id="proposition" hidden></div>' +
      '<p class="carnet-titre">Aperçu</p>' +
      `<div class="carnet-apercu" id="apercu">${Mentions.renderText(p.background || "", this._store)}</div>` +
      "</section>"
    );
  },

  /** Le carnet PRIVÉ. Depuis la migration v2 du schéma, il ne part
      jamais dans un livret — c'est là qu'on écrit ce qu'il ne faut
      surtout pas remettre. */
  _carnet(p) {
    return (
      '<details class="carnet-prive"><summary>Le carnet de l\'auteur <span>privé — ne sort d\'aucun document remis</span></summary>' +
      `<textarea id="carnet" rows="7" placeholder="Vos remarques : ce qui reste à écrire, ce qu'il ne faut pas dire, les pistes.">${Utils.escHtml(p.notes || "")}</textarea>` +
      "</details>"
    );
  },

  _extras(p) {
    const objectifs = (p.objectifs || []).length
      ? (p.objectifs || [])
          .map(
            (o, i) =>
              `<li><input data-obj="${i}" value="${Utils.escHtml(o)}" placeholder="Ce qu'il cherche à obtenir" aria-label="Objectif" />` +
              `<button type="button" data-obj-x="${i}" title="Retirer">✕</button></li>`,
          )
          .join("")
      : '<li class="vide-obj">Aucun objectif. Ce sont les missions concrètes, distinctes du désir.</li>';

    const images = (p.images || []).length
      ? (p.images || [])
          .map(
            (im) =>
              `<li><img src="${Utils.escHtml(im.src)}" alt="" />` +
              `<input data-img-leg="${im.id}" value="${Utils.escHtml(im.legende || "")}" placeholder="Légende" aria-label="Légende" />` +
              `<button type="button" data-img-x="${im.id}" title="Retirer">✕</button></li>`,
          )
          .join("")
      : '<li class="vide-obj">Aucune image.</li>';

    return (
      '<section class="extras">' +
      '<p class="carnet-titre">Ce qu\'il cherche<span class="carnet-aide">les missions concrètes, distinctes du désir</span></p>' +
      `<ul class="objectifs">${objectifs}</ul>` +
      '<button type="button" id="ajout-obj">+ Objectif</button>' +
      '<p class="carnet-titre" style="margin-top:18px">Comment le jouer<span class="carnet-aide">costume, allure, voix — ce bloc part dans le livret</span></p>' +
      `<textarea id="style-jeu" rows="3" placeholder="Se tient droite, parle peu. Tablier de dispensaire, mains abîmées.">${Utils.escHtml(p.style || "")}</textarea>` +
      '<p class="carnet-titre" style="margin-top:18px">Images<span class="carnet-aide">intégrées au livret</span></p>' +
      `<ul class="images">${images}</ul>` +
      '<span class="img-actions"><button type="button" id="ajout-img">+ Fichier</button>' +
      '<button type="button" id="ajout-url">+ Adresse</button>' +
      '<input id="fichier-image" type="file" accept="image/*" hidden /></span>' +
      '<p class="img-note">Un fichier est <b>intégré</b> au livret (autonome, mais il pèse sur le stockage — ' +
      "il est réduit à 900 px). Une adresse ne pèse rien, mais le livret aura besoin du réseau.</p>" +
      "</section>"
    );
  },

  /* ================= les contacts, et leur édition =================
     ── LE LIEN EST LA VÉRITÉ RACINE, IL DOIT POUVOIR S'ÉCRIRE ──
     La `@mention` propose l'arête et ne demande que la tonalité — c'est
     le bon geste au moment d'écrire, et il fige volontairement le reste
     (`importance: secondaire`, `nature: ""`, `miroir: false`). Mais il
     n'existait ensuite AUCUNE porte pour reprendre ces trois-là, ni
     pour retirer un lien posé de travers.

     Conséquence, mesurée : `primaire` et `miroir` étaient inatteignables
     dans un projet écrit avec l'outil. Cinq calculs les attendent — la
     règle « personne n'est seul » (qui lit les liens ENTRANTS primaires),
     la règle « miroir disponible », la pastille contact-miroir, le
     miroir désaccordé du bilan de casting, et les miroirs perdus de la
     défection. Tous restaient muets, sauf sur le jeu d'essai, qui pose
     ces valeurs à la main.

     L'éditeur est donc ici, replié sous chaque contact : on ne quitte
     pas la fiche qu'on est en train d'écrire pour régler ce qu'on vient
     d'y déclarer. */

  _liens(p) {
    const liens = this._store.liensDe(p.id);
    if (!liens.length)
      return '<p class="liens-vide">Aucun contact déclaré. Mentionnez quelqu\'un dans le carnet.</p>';
    return (
      '<p class="carnet-titre">Ses contacts' +
      `<span class="carnet-aide">ce que ${Utils.escHtml(p.nom)} déclare — le lien est orienté</span></p>` +
      '<ul class="liens">' +
      liens.map((l) => this._ligneLien(l)).join("") +
      "</ul>"
    );
  },

  _ligneLien(l) {
    const cible = this._store.personnage(l.vers);
    const retour = this._store.reciproque(l);
    const sym = retour && retour.tonalite === l.tonalite && retour.importance === l.importance;
    const ouvert = this._lienOuvert === l.id;
    return (
      `<li class="lien t-${l.tonalite} i-${l.importance}${ouvert ? " ouvert" : ""}">` +
      `<span class="fleche" title="${sym ? "réciproque à l'identique" : retour ? "réciproque, mais différent" : "aucun lien de retour"}">${sym ? "⇄" : retour ? "⇄̸" : "→"}</span>` +
      `<span class="lien-qui"><b>${Utils.escHtml(cible ? cible.nom : "?")}</b>` +
      (l.miroir ? ' <span class="miroir" title="contact-miroir">◎</span>' : "") +
      "</span>" +
      `<span class="nature">${Utils.escHtml(l.nature) || "—"}</span>` +
      `<span class="tags">${TONALITES[l.tonalite]} · ${IMPORTANCES[l.importance]}</span>` +
      `<button type="button" class="lien-modifier" data-lien="${l.id}" aria-expanded="${ouvert}">` +
      `${ouvert ? "Fermer" : "Modifier"}</button>` +
      "</li>" +
      (ouvert ? this._editeurLien(l) : "")
    );
  },

  /** L'enveloppe seule : le corps de l'éditeur est partagé avec le
      flanc du graphe (`lienediteur.js`), qui a besoin du même geste. */
  _editeurLien(l) {
    return (
      `<li class="lien-edit" data-edit="${l.id}">` +
      LienEditeur.html(this._store, l, this._store.personnage(this._id)) +
      "</li>"
    );
  },

  _brancherLiens() {
    const bloc = this._hote.querySelector("#fiche-liens");
    if (!bloc) return;

    for (const b of bloc.querySelectorAll("[data-lien]"))
      b.addEventListener("click", () => {
        this._lienOuvert = this._lienOuvert === b.dataset.lien ? null : b.dataset.lien;
        const p = this._store.personnage(this._id);
        if (!p) return;
        bloc.innerHTML = this._liens(p);
        this._brancherLiens();
        // Ouvrir pour régler quelque chose : le curseur va au seul champ
        // qui se tape, pas au premier de la rangée.
        const n = this._lienOuvert && bloc.querySelector('[data-le="nature"]');
        if (n) n.focus();
      });

    // Refermer l'éditeur AVANT que le store n'émette : sinon la
    // re-projection rouvrirait un lien qui n'existe plus.
    LienEditeur.brancher(bloc, this._store, {
      avantSuppression: () => {
        this._lienOuvert = null;
      },
    });
  },

  /** Les contacts se re-projettent comme le reste du dérivé — sauf que
      depuis l'éditeur, ILS sont ce qu'on est en train de modifier.

      La garde naïve — « si un champ de texte a le focus, ne rien
      refaire » — a été essayée et jetée : ouvrir l'éditeur donne le
      focus au champ « nature », donc PLUS RIEN ne se re-projetait tant
      qu'il était ouvert. La ligne de résumé continuait d'afficher
      « Positif · Secondaire » alors que le store portait déjà
      « primaire » et le miroir. Deux vérités à l'écran pour un seul
      fait, c'est-à-dire le défaut que tout le reste du projet évite.

      On reconstruit donc toujours, et on **reporte** ce qui ne se
      trouve pas dans le store : le texte en cours de frappe (`nature`
      n'écrit qu'au `change`, donc il n'y est pas encore) et la position
      du curseur. Le focus revient au même contrôle — sans quoi régler
      une tonalité au clavier renverrait en haut de la page. */
  _reprojeterLiens(bloc, p) {
    const a = document.activeElement;
    const vif = a && bloc.contains(a) && a.dataset.le ? a : null;
    const garde = vif
      ? {
          l: vif.dataset.l,
          le: vif.dataset.le,
          texte: vif.type === "text" ? vif.value : null,
          debut: vif.type === "text" ? vif.selectionStart : null,
          fin: vif.type === "text" ? vif.selectionEnd : null,
        }
      : null;

    bloc.innerHTML = this._liens(p);
    this._brancherLiens();

    if (!garde) return;
    const el = bloc.querySelector(`[data-le="${garde.le}"][data-l="${garde.l}"]`);
    if (!el) return;
    if (garde.texte !== null) el.value = garde.texte;
    el.focus();
    if (garde.texte !== null) el.setSelectionRange(garde.debut, garde.fin);
  },

  /* ================= câblage ================= */

  _brancher() {
    const q = (s) => this._hote.querySelector(s);
    const maj = (patch) => this._store.majPersonnage(this._id, patch);

    this._brancherVecu();

    q(".fiche-titre").addEventListener("change", (e) => maj({ nom: e.target.value.trim() }));
    q(".fiche-role").addEventListener("change", (e) => maj({ role: e.target.value.trim() }));
    q(".fiche-fonction").addEventListener("change", (e) =>
      maj({ fonction: e.target.value || null }),
    );
    q(".fiche-pj").addEventListener("change", (e) => maj({ pj: e.target.checked }));
    q(".fiche-surprise").addEventListener("change", (e) => maj({ surprise: e.target.checked }));

    for (const ta of this._hote.querySelectorAll("[data-champ]"))
      ta.addEventListener("change", (e) => maj({ [e.target.dataset.champ]: e.target.value }));

    const surMention = ({ cible, existe }) => {
      if (existe) this._propositionFermer();
      else this._proposer(cible);
    };

    const fond = q("#background");
    fond.addEventListener("input", () => {
      q("#apercu").innerHTML = Mentions.renderText(fond.value, this._store);
      clearTimeout(this._tSave);
      this._tSave = setTimeout(() => maj({ background: fond.value }), 400);
    });
    fond.addEventListener("blur", () => this.flush());
    Mentions.attach(fond, { store: this._store, personnageId: this._id, onMention: surMention });

    const carnet = q("#carnet");
    carnet.addEventListener("input", () => {
      clearTimeout(this._tCarnet);
      this._tCarnet = setTimeout(() => maj({ notes: carnet.value }), 400);
    });
    carnet.addEventListener("blur", () => this.flush());
    Mentions.attach(carnet, { store: this._store, personnageId: this._id, onMention: surMention });

    q("#style-jeu").addEventListener("change", (e) => maj({ style: e.target.value }));

    q("#portrait-fichier").addEventListener("click", () => q("#fichier-portrait").click());
    q("#fichier-portrait").addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      try {
        this._store.majPortrait(this._id, await reduireCarre(f));
      } catch {
        this._signaler("Ce portrait n'a pas pu être lu.");
      }
    });
    q("#portrait-url").addEventListener("click", () => {
      const u = prompt("Adresse du portrait (https://…) :", "");
      if (u && /^https?:\/\//i.test(u.trim())) this._store.majPortrait(this._id, u.trim());
      else if (u) this._signaler("Une adresse d'image doit commencer par http:// ou https://.");
    });
    const px = q("#portrait-x");
    if (px) px.addEventListener("click", () => this._store.majPortrait(this._id, ""));
    this._brancherExtras();

    // Une puce ouvre la fiche du personnage mentionné.
    q("#apercu").addEventListener("click", (e) => {
      const chip = e.target.closest('[data-action="ouvrir-personnage"]');
      if (chip && this._onOuvrir) this._onOuvrir(chip.dataset.id);
    });

    this._brancherJauge();
    this._brancherLiens();
  },

  /* ---- objectifs, style, images ---- */

  _brancherExtras() {
    const h = this._hote;
    const maj = (patch) => this._store.majPersonnage(this._id, patch);
    const objs = () => [...(this._store.personnage(this._id).objectifs || [])];

    h.querySelector("#ajout-obj").addEventListener("click", () => maj({ objectifs: [...objs(), ""] }));
    for (const el of h.querySelectorAll("[data-obj]"))
      el.addEventListener("change", (e) => {
        const o = objs();
        o[Number(el.dataset.obj)] = e.target.value;
        maj({ objectifs: o });
      });
    for (const b of h.querySelectorAll("[data-obj-x]"))
      b.addEventListener("click", () => {
        const o = objs();
        o.splice(Number(b.dataset.objX), 1);
        maj({ objectifs: o });
      });

    h.querySelector("#ajout-img").addEventListener("click", () =>
      h.querySelector("#fichier-image").click(),
    );
    h.querySelector("#fichier-image").addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      try {
        const src = await reduire(f);
        this._store.ajouterImage(this._id, src);
      } catch {
        this._signaler("Cette image n'a pas pu être lue.");
      }
    });
    h.querySelector("#ajout-url").addEventListener("click", () => {
      const u = prompt("Adresse de l'image (https://…) :", "");
      if (u && /^https?:\/\//i.test(u.trim())) this._store.ajouterImage(this._id, u.trim());
      else if (u) this._signaler("Une adresse d'image doit commencer par http:// ou https://.");
    });
    for (const el of h.querySelectorAll("[data-img-leg]"))
      el.addEventListener("change", (e) =>
        this._store.majImage(this._id, el.dataset.imgLeg, { legende: e.target.value }),
      );
    for (const b of h.querySelectorAll("[data-img-x]"))
      b.addEventListener("click", () => this._store.supprimerImage(this._id, b.dataset.imgX));
  },

  _signaler(txt) {
    const el = document.getElementById("statut");
    // `danger` = une écriture a échoué : ce message-là ne se fait pas
    // recouvrir par un incident de lecture d'image.
    if (!el || el.classList.contains("danger")) return;
    el.textContent = txt;
    el.hidden = false;
  },

  _brancherJauge() {
    const c = couverture(this._store, this._id);
    const dit = this._hote.querySelector("#jauge-dit");
    for (const b of this._hote.querySelectorAll(".pastille")) {
      b.addEventListener("click", () => {
        for (const o of this._hote.querySelectorAll(".pastille"))
          o.setAttribute("aria-pressed", "false");
        b.setAttribute("aria-pressed", "true");
        const x = c[Number(b.dataset.i)];
        dit.innerHTML = x.ok
          ? `<b>${Utils.escHtml(x.nom)}</b> — couvert.`
          : `<b>${Utils.escHtml(x.nom)}</b> — manquant. ${Utils.escHtml(x.manque)}`;
      });
    }
  },

  /* ================= la proposition d'arête ================= */

  /** Quatre boutons de tonalité, et rien de pré-sélectionné : c'est le
      seul choix que l'auteur DOIT faire, parce qu'aucun défaut ne serait
      honnête. L'importance a un défaut au milieu, ajustable après coup. */
  _proposer(cible) {
    const moi = this._store.personnage(this._id);
    const box = this._hote.querySelector("#proposition");
    box.innerHTML =
      '<p class="prop-titre">Créer le lien ' +
      `<b>${Utils.escHtml(moi.nom)} → ${Utils.escHtml(cible.nom)}</b> ?</p>` +
      '<div class="prop-tons">' +
      Object.entries(TONALITES)
        .map(
          ([k, v]) =>
            `<button type="button" class="prop-ton t-${k}" data-ton="${k}">${Utils.escHtml(v)}</button>`,
        )
        .join("") +
      "</div>" +
      '<p class="prop-note">L\'importance sera <b>secondaire</b> — ajustable ensuite. ' +
      "La tonalité, elle, n'est pas devinée : un « neutre » posé en douce ferait " +
      "passer pour couvert un personnage qui ne l'est pas.</p>" +
      '<button type="button" class="prop-plus-tard">Plus tard</button>';
    box.hidden = false;

    for (const b of box.querySelectorAll(".prop-ton"))
      b.addEventListener("click", () => {
        this._store.upsertLien({
          de: this._id,
          vers: cible.id,
          nature: "",
          tonalite: b.dataset.ton,
          importance: "secondaire",
        });
        this._propositionFermer();
      });

    box.querySelector(".prop-plus-tard").addEventListener("click", () =>
      this._propositionFermer(),
    );
  },

  _propositionFermer() {
    const box = this._hote.querySelector("#proposition");
    if (box) {
      box.hidden = true;
      box.innerHTML = "";
    }
  },
};
