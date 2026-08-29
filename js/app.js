"use strict";

/* ============================================================
   APP — bootstrap et orchestration.

   Lot S0 : il n'y a encore qu'un écran, « Le réseau », et il est nu
   exprès. Le graphe force-dirigé viendra en S2 ; ici on montre la
   **vérité telle qu'elle est stockée**, parce que c'est ce qu'il faut
   pouvoir vérifier avant de dessiner par-dessus.

   Ce que cet écran prouve, et qui n'est pas décoratif :
   - le lien est **orienté** — chaque personnage déclare ses contacts,
     et le sens retour est un autre lien, avec ses propres valeurs ;
   - la **réciprocité est dérivée**, jamais stockée : la mention
     « ⇄ » lit le lien inverse au moment du rendu ;
   - le **miroir est unique** par personnage : en poser un second
     retire le premier, et ça se voit tout de suite.
   ============================================================ */
import { Storage } from "./core/storage.js";
import { ReseauStore, TONALITES, IMPORTANCES, FONCTIONS } from "./core/reseaustore.js";
import { chargerValmorel } from "./data/valmorel.js";

export const App = {
  init() {
    Storage.runMigrations();
    ReseauStore.load();
    ReseauStore.subscribe(() => this.rendre());
    this._brancherBarre();
    this.rendre();
  },

  _brancherBarre() {
    document.getElementById("act-seed").addEventListener("click", () => {
      if (
        ReseauStore.personnages().length &&
        !confirm("Remplacer le réseau actuel par le jeu d'essai « Valmorel » ?")
      )
        return;
      ReseauStore.vider();
      const n = chargerValmorel(ReseauStore);
      this._statut(`Valmorel chargé — ${n.personnages} personnages, ${n.liens} liens.`);
    });

    document.getElementById("act-vider").addEventListener("click", () => {
      if (!ReseauStore.personnages().length) return;
      if (!confirm("Vider le réseau ? Cette action n'est pas annulable.")) return;
      ReseauStore.vider();
      this._statut("Réseau vidé.");
    });
  },

  _statut(txt) {
    const el = document.getElementById("statut");
    el.textContent = txt;
    el.hidden = !txt;
  },

  /* ---------------- rendu ---------------- */

  rendre() {
    const hote = document.getElementById("reseau");
    const persos = ReseauStore.personnages();

    if (!persos.length) {
      hote.innerHTML =
        '<p class="vide">Aucun personnage. Chargez le jeu d\'essai pour voir le modèle à l\'œuvre.</p>';
      this._compteurs();
      return;
    }

    const groupes = [...ReseauStore.groupes(), { id: null, nom: "Sans groupe" }];
    hote.innerHTML = groupes
      .map((g) => {
        const membres = persos.filter((p) => p.groupeId === g.id);
        if (!membres.length) return "";
        return (
          `<section class="groupe"><h2>${esc(g.nom)}</h2>` +
          membres.map((p) => this._carte(p)).join("") +
          "</section>"
        );
      })
      .join("");

    this._compteurs();
  },

  _carte(p) {
    const liens = ReseauStore.liensDe(p.id);
    const entrants = ReseauStore.liensVers(p.id);
    const primairesRecus = entrants.filter((l) => l.importance === "primaire").length;

    const lignes = liens.length
      ? liens
          .map((l) => {
            const cible = ReseauStore.personnage(l.vers);
            const retour = ReseauStore.reciproque(l);
            const sym =
              retour && retour.tonalite === l.tonalite && retour.importance === l.importance;
            return (
              `<li class="lien t-${l.tonalite} i-${l.importance}">` +
              `<span class="fleche" title="${sym ? "réciproque à l'identique" : retour ? "réciproque, mais différent" : "aucun lien de retour"}">${sym ? "⇄" : retour ? "⇄̸" : "→"}</span> ` +
              `<b>${esc(cible ? cible.nom : "?")}</b>` +
              (l.miroir ? ' <span class="miroir" title="contact-miroir">◎</span>' : "") +
              `<span class="nature">${esc(l.nature) || "—"}</span>` +
              `<span class="tags">${TONALITES[l.tonalite]} · ${IMPORTANCES[l.importance]}</span>` +
              "</li>"
            );
          })
          .join("")
      : '<li class="lien vide-lien">aucun contact déclaré</li>';

    return (
      `<article class="perso${p.pj ? "" : " pnj"}">` +
      `<header><h3>${esc(p.nom)}</h3>` +
      `<p class="role">${esc(p.role)}${p.fonction ? " · " + FONCTIONS[p.fonction] : ""} · ${p.pj ? "PJ" : "PNJ"}</p></header>` +
      (p.moral ? `<p class="moral">« ${esc(p.moral)} »</p>` : "") +
      `<p class="compte">${liens.length} contact${liens.length > 1 ? "s" : ""} déclaré${liens.length > 1 ? "s" : ""} · ` +
      `<span class="${primairesRecus ? "" : "alerte"}">${primairesRecus} lien${primairesRecus > 1 ? "s" : ""} primaire${primairesRecus > 1 ? "s" : ""} reçu${primairesRecus > 1 ? "s" : ""}</span></p>` +
      `<ul class="liens">${lignes}</ul>` +
      "</article>"
    );
  },

  _compteurs() {
    const p = ReseauStore.personnages().length;
    const l = ReseauStore.liens().length;
    const m = ReseauStore.liens().filter((x) => x.miroir).length;
    document.getElementById("compteurs").textContent =
      `${p} personnage${p > 1 ? "s" : ""} · ${l} lien${l > 1 ? "s" : ""} orienté${l > 1 ? "s" : ""} · ${m} miroir${m > 1 ? "s" : ""}`;
  },
};

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// Accès console pour explorer la vérité à la main.
window.App = App;
window.ReseauStore = ReseauStore;

App.init();
