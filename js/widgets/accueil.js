"use strict";

/* ============================================================
   ACCUEIL — ce qu'on voit quand il n'y a encore rien.
   ------------------------------------------------------------
   Un nouvel arrivant tombait sur un réseau vide et une phrase.
   L'application a onze écrans et quatre moments : sans un mot, on ne
   sait ni par où commencer, ni que le reste existe.

   ── PAS UNE VISITE GUIDÉE ──
   Une visite pas-à-pas se subit une fois, s'annule, et ne revient
   jamais quand on en aurait besoin. Ici : **l'ordre de fabrication en
   quatre lignes**, et trois portes. On lit en quinze secondes, on
   choisit, et l'écran disparaît dès qu'il y a un personnage.

   Il ne réapparaît pas non plus par surprise : il ne s'affiche que
   lorsque le projet est **entièrement** vide — ni monde, ni
   personnage. Vider son casting en cours de route ne doit pas
   ramener la page d'accueil au milieu du travail.
   ============================================================ */
import { Utils } from "../core/utils.js";

const MOMENTS = [
  {
    nom: "Écrire",
    texte:
      "Le monde d'abord — la prémisse, le contexte que tout le monde partage. Puis les personnages et ce qui les lie, les trames et leurs embranchements, et qui sait quoi.",
  },
  {
    nom: "Vérifier",
    texte:
      "Douze règles tirées de la littérature du GN vous disent ce qui manque, sans jamais bloquer. La frise montre qui est attendu à deux endroits à la fois. Les besoins se dérivent de ce que vous avez écrit.",
  },
  {
    nom: "Distribuer",
    texte:
      "Les vœux des joueurs, l'affectation résolue exactement, puis les livrets — d'où sont retirées toutes les choses qu'un joueur ne doit pas lire.",
  },
  {
    nom: "Jouer",
    texte:
      "Le tableau de la nuit. Les conclusions que vous avez écrites deviennent les boutons qu'on presse à trois heures du matin.",
  },
];

export const Accueil = {
  /** Vrai si le projet est entièrement vierge. */
  estVierge(reseau, monde) {
    return !reseau.personnages().length && !monde.amorce();
  },

  html() {
    return (
      '<div class="ac">' +
      '<p class="ac-sur">Atelier d\'écriture et salle de conduite pour jeu de rôle grandeur nature</p>' +
      "<h1>Rien n'est encore écrit.</h1>" +
      '<p class="ac-lede">GNomon suit l\'ordre dans lequel on fabrique un GN. Tout tient dans votre ' +
      "navigateur : aucun compte, aucun serveur, aucune donnée transmise.</p>" +
      '<ol class="ac-moments">' +
      MOMENTS.map(
        (m) =>
          `<li><b>${Utils.escHtml(m.nom)}</b><span>${Utils.escHtml(m.texte)}</span></li>`,
      ).join("") +
      "</ol>" +
      '<div class="ac-portes">' +
      '<button type="button" class="ac-porte principale" data-ac="monde">' +
      "<b>Commencer par le monde</b><span>La prémisse, le propos, le contexte. C'est par là qu'on commence.</span></button>" +
      '<button type="button" class="ac-porte" data-ac="essai">' +
      "<b>Ouvrir le jeu d'essai</b><span>« Les Cendres de Valmorel » — un GN complet, avec ses défauts, pour voir l'outil à l'œuvre.</span></button>" +
      '<button type="button" class="ac-porte" data-ac="import">' +
      "<b>Importer une archive</b><span>Un fichier reçu d'un autre organisateur.</span></button>" +
      "</div>" +
      '<p class="ac-note">Vos données restent sur cet appareil. Pour les sauvegarder ou les ' +
      "partager, exportez une archive — c'est le bouton en haut à droite.</p>" +
      "</div>"
    );
  },

  /** Câble les trois portes. `actions` porte ce que l'app sait faire. */
  brancher(hote, actions) {
    for (const b of hote.querySelectorAll("[data-ac]"))
      b.addEventListener("click", () => {
        const f = actions[b.dataset.ac];
        if (f) f();
      });
  },
};
