"use strict";

/* ============================================================
   LES BESOINS — ce que l'écriture réclame, et où en est l'équipe.
   ------------------------------------------------------------
   Aucun besoin n'est saisi ici : tous viennent du texte déjà écrit
   (`core/besoins.js`). Ce qu'on pose dessus, c'est un **responsable**
   et un **état**, rien de plus — Pettersson met la propriété claire des
   rôles au-dessus du calendrier, et c'est ce qu'on suit.

   ── L'ÉCRAN NE REMPLACE PAS VOTRE OUTIL D'ÉQUIPE ──
   Il l'alimente. Le bouton d'export produit un markdown à coller dans
   le tableau que l'équipe utilise déjà, cases à cocher comprises. Le
   pont est assumé : refaire Trello serait des semaines pour faire
   moins bien, alors que ce qui suit ne se calcule QUE ici.
   ============================================================ */
import { besoins, besoinsMarkdown } from "../core/besoins.js";
import { telecharger } from "../core/archive.js";
import { hote } from "../core/liensstore.js";
import { Utils } from "../core/utils.js";

export const Besoins = {
  _hote: null,
  _stores: null,
  _suivi: null,
  _liens: null,
  _masquerFaits: false,

  monter(hote, stores, suivi, liens) {
    this._hote = hote;
    this._stores = stores;
    this._suivi = suivi;
    this._liens = liens;
    this.rendre();
  },

  rendre() {
    const groupes = besoins(this._stores);
    const cles = groupes.flatMap((g) => g.besoins.map((b) => b.cle));
    const bilan = this._suivi.bilan(cles);

    if (!groupes.length) {
      this._hote.innerHTML =
        '<p class="vide">Aucun besoin — rien n\'est encore écrit qui en réclame. ' +
        "Le matériel, la mise en scène et les contraintes d'une situation apparaissent ici " +
        "dès que vous les renseignez dans l'atelier.</p>";
      return;
    }

    this._hote.innerHTML =
      '<div class="bs">' +
      '<div class="bs-barre">' +
      `<p class="carnet-titre">Ce que l'écriture réclame` +
      `<span class="carnet-aide">${bilan.total} ${Utils.plur(bilan.total, "besoin")} · ` +
      `${bilan.faits} ${Utils.plur(bilan.faits, "fait")} · ${bilan.assignes} ${Utils.plur(bilan.assignes, "assigné")}` +
      " · rien n'est saisi ici, tout est dérivé</span></p>" +
      '<span class="bs-actions">' +
      `<label class="bascule"><input type="checkbox" id="bs-masquer"${this._masquerFaits ? " checked" : ""} /> Masquer ce qui est fait</label>` +
      '<button type="button" id="bs-md">Exporter en markdown</button>' +
      "</span></div>" +
      '<p class="bs-pont">Cet écran ne remplace pas votre tableau d\'équipe, il l\'alimente : ' +
      "l'export produit une liste à cocher prête à coller dans Trello, Framaboard ou un document " +
      "partagé. Ce qui est ici ne se calcule nulle part ailleurs.</p>" +
      groupes.map((g) => this._groupe(g)).join("") +
      "</div>";

    this._brancher();
  },

  _groupe(g) {
    const lignes = g.besoins
      .map((b) => this._ligne(b))
      .filter(Boolean)
      .join("");
    if (!lignes) return "";
    return (
      `<section class="bs-groupe"><p class="bs-titre">${Utils.escHtml(g.nom)}` +
      `<span>${Utils.escHtml(g.aide)}</span></p>` +
      `<ul class="bs-liste">${lignes}</ul></section>`
    );
  },

  _ligne(b) {
    const s = this._suivi.pour(b.cle);
    const fait = !!(s && s.fait);
    if (fait && this._masquerFaits) return "";
    const meta = [b.source, b.ou, b.quand].filter(Boolean);
    const liens = this._liens.pour(`besoin:${b.cle}`);

    return (
      `<li class="bs-item${fait ? " fait" : ""}">` +
      `<label class="bs-coche"><input type="checkbox" data-fait="${Utils.escHtml(b.cle)}"${fait ? " checked" : ""} ` +
      `aria-label="Marquer fait" /></label>` +
      '<span class="bs-corps">' +
      `<span class="bs-quoi">${Utils.escHtml(b.quoi)}</span>` +
      (meta.length ? `<span class="bs-meta">${meta.map(Utils.escHtml).join(" · ")}</span>` : "") +
      (liens.length
        ? `<span class="bs-liens">${liens
            .map(
              (l) =>
                `<a href="${Utils.escHtml(l.url)}" target="_blank" rel="noopener noreferrer">` +
                `${Utils.escHtml(l.titre)}<span>${Utils.escHtml(hote(l.url))}</span></a>` +
                `<button type="button" class="bs-lien-x" data-lien-x="${l.id}" title="Retirer le lien">✕</button>`,
            )
            .join("")}</span>`
        : "") +
      "</span>" +
      `<input class="bs-resp" data-resp="${Utils.escHtml(b.cle)}" list="bs-gens" ` +
      `value="${Utils.escHtml((s && s.responsable) || "")}" placeholder="qui ?" aria-label="Responsable" />` +
      `<button type="button" class="bs-lien-plus" data-lien-plus="${Utils.escHtml(b.cle)}" title="Attacher un lien">⚯</button>` +
      "</li>"
    );
  },

  _brancher() {
    const h = this._hote;

    // Les personnes déjà nommées, proposées plutôt que retapées.
    const gens = this._suivi.responsables();
    if (gens.length) {
      const dl = document.createElement("datalist");
      dl.id = "bs-gens";
      dl.innerHTML = gens.map((g) => `<option value="${Utils.escHtml(g)}"></option>`).join("");
      h.appendChild(dl);
    }

    h.querySelector("#bs-masquer").addEventListener("change", (e) => {
      this._masquerFaits = e.target.checked;
      this.rendre();
    });
    h.querySelector("#bs-md").addEventListener("click", () => {
      const titre = this._stores.monde.monde().titre || "gnomon";
      telecharger(
        `besoins-${slug(titre)}.md`,
        besoinsMarkdown(this._stores, this._suivi),
        "text/markdown",
      );
    });

    for (const c of h.querySelectorAll("[data-fait]"))
      c.addEventListener("change", () => this._suivi.basculerFait(c.dataset.fait));
    for (const el of h.querySelectorAll("[data-resp]"))
      el.addEventListener("change", (e) =>
        this._suivi.maj(el.dataset.resp, { responsable: e.target.value.trim() }),
      );

    for (const b of h.querySelectorAll("[data-lien-plus]"))
      b.addEventListener("click", () => {
        const url = prompt("Adresse à attacher (Drive, Trello, une photo de référence…) :", "");
        if (url === null || !url.trim()) return;
        const titre = prompt("Comment l'appeler ?", hote(url) || "Lien") || "";
        const r = this._liens.ajouter({ titre, url, ancre: `besoin:${b.dataset.lienPlus}` });
        if (!r.ok) this._dire(r.raison);
      });
    for (const b of h.querySelectorAll("[data-lien-x]"))
      b.addEventListener("click", () => this._liens.supprimer(b.dataset.lienX));
  },

  _dire(txt) {
    const el = document.getElementById("statut");
    if (!el) return;
    el.textContent = txt;
    el.hidden = false;
  },
};

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
