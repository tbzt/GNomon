"use strict";

/* ============================================================
   LES LIVRETS — le seul document qui sort de l'équipe.
   ------------------------------------------------------------
   Un écran de **relecture avant remise**, pas un écran d'écriture. On y
   voit exactement ce que le joueur verra, et rien d'autre — le calcul
   (`core/livret.js`) a déjà retiré ce qu'il ne doit pas lire.

   Deux choses que cet écran fait et que personne d'autre ne fera :

   1. **Il montre l'aperçu réel.** Une fiche relue dans l'outil d'auteur
      se relit avec les yeux de l'auteur, qui sait déjà tout. Ici on lit
      dans l'ordre et avec le contenu du joueur.
   2. **Il signale ce qui rendrait le livret impubliable** — carnet
      vide, croyance sans texte, aucun contact. Ces avertissements sont
      pour l'auteur et ne sortent jamais dans le document.
   ============================================================ */
import { livret, tousLesLivrets, livretHtml, livretMarkdown } from "../core/livret.js";
import { telecharger } from "../core/archive.js";
import { Utils } from "../core/utils.js";

export const Livrets = {
  _hote: null,
  _stores: null,
  _selId: null,

  monter(hote, stores) {
    this._hote = hote;
    this._stores = stores;
    this.rendre();
  },

  rendre() {
    const pjs = this._stores.reseau.pj();
    if (!pjs.length) {
      this._hote.innerHTML =
        '<p class="vide">Aucun PJ. Les livrets se génèrent depuis les personnages joueurs.</p>';
      return;
    }
    if (!this._selId || !this._stores.reseau.personnage(this._selId)) this._selId = pjs[0].id;

    const tous = tousLesLivrets(this._stores);
    const alertes = tous.reduce((n, l) => n + l.avertissements.length, 0);

    this._hote.innerHTML =
      '<div class="lv">' +
      '<div class="lv-barre">' +
      `<p class="carnet-titre">Les livrets<span class="carnet-aide">${pjs.length} ${Utils.plur(pjs.length, "PJ")}` +
      (alertes ? ` · ${alertes} ${Utils.plur(alertes, "point")} à revoir` : " · rien à signaler") +
      "</span></p>" +
      '<span class="lv-actions">' +
      '<button type="button" id="lv-html">Exporter tout (HTML)</button>' +
      '<button type="button" id="lv-md">Exporter tout (markdown)</button>' +
      "</span></div>" +
      '<div class="lv-corps">' +
      `<nav class="lv-liste">${this._liste(tous)}</nav>` +
      `<div class="lv-apercu" id="lv-apercu">${this._apercu()}</div>` +
      "</div></div>";

    this._brancher();
  },

  _liste(tous) {
    return tous
      .map((l) => {
        const id = l.identite.id;
        return (
          `<button type="button" class="lv-item${id === this._selId ? " actif" : ""}" data-lv="${id}">` +
          `<span class="lv-nom">${Utils.escHtml(l.identite.nom)}</span>` +
          `<span class="lv-role">${Utils.escHtml(l.identite.role)}</span>` +
          (l.avertissements.length
            ? `<span class="lv-alerte">${l.avertissements.length}</span>`
            : "") +
          "</button>"
        );
      })
      .join("");
  },

  _apercu() {
    const l = livret(this._selId, this._stores);
    if (!l) return '<p class="vide">Personnage introuvable.</p>';

    const av = l.avertissements.length
      ? '<div class="lv-avert"><p class="cast-bloc-titre">À revoir avant de remettre' +
        "<span>ces remarques sont pour vous — elles ne sortent pas dans le livret</span></p><ul>" +
        l.avertissements.map((a) => `<li>${Utils.escHtml(a)}</li>`).join("") +
        "</ul></div>"
      : "";

    return (
      av +
      '<div class="lv-cadre"><iframe id="lv-iframe" title="Aperçu du livret" ' +
      'sandbox="allow-same-origin"></iframe></div>' +
      '<div class="lv-un">' +
      `<button type="button" id="lv-un-html">Exporter ce livret (HTML)</button>` +
      `<button type="button" id="lv-un-md">Copier en markdown</button>` +
      "</div>"
    );
  },

  _peindreApercu() {
    const cadre = this._hote.querySelector("#lv-iframe");
    const l = livret(this._selId, this._stores);
    if (!cadre || !l) return;
    // On écrit le document réel dans l'iframe : ce que le joueur verra,
    // pas une approximation restylée par la page qui l'entoure.
    cadre.srcdoc = livretHtml(l);
  },

  _brancher() {
    const un = (s) => this._hote.querySelector(s);
    for (const b of this._hote.querySelectorAll("[data-lv]"))
      b.addEventListener("click", () => {
        this._selId = b.dataset.lv;
        un("#lv-apercu").innerHTML = this._apercu();
        for (const x of this._hote.querySelectorAll(".lv-item"))
          x.classList.toggle("actif", x.dataset.lv === this._selId);
        this._brancherApercu();
        this._peindreApercu();
      });
    this._brancherApercu();
    this._peindreApercu();

    un("#lv-html").addEventListener("click", () => this._exporterTout("html"));
    un("#lv-md").addEventListener("click", () => this._exporterTout("md"));
  },

  _brancherApercu() {
    const un = (s) => this._hote.querySelector(s);
    const h = un("#lv-un-html");
    if (h)
      h.addEventListener("click", () => {
        const l = livret(this._selId, this._stores);
        telecharger(`${this._nom(l)}.html`, livretHtml(l), "text/html");
      });
    const m = un("#lv-un-md");
    if (m)
      m.addEventListener("click", async () => {
        const l = livret(this._selId, this._stores);
        const txt = livretMarkdown(l);
        try {
          await navigator.clipboard.writeText(txt);
          this._dire("Livret copié en markdown.");
        } catch {
          // Le presse-papiers peut être refusé (page non sécurisée,
          // permission) : on retombe sur un fichier plutôt que d'échouer
          // en silence.
          telecharger(`${this._nom(l)}.md`, txt, "text/markdown");
          this._dire("Presse-papiers indisponible — le markdown a été téléchargé.");
        }
      });
  },

  _nom(l) {
    return (l.identite.nom || "livret")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  },

  /** Tous les livrets dans UN fichier : c'est ce qu'on imprime, et
      chaque livret commence sur une nouvelle page. */
  _exporterTout(forme) {
    const tous = tousLesLivrets(this._stores);
    const titre = this._stores.monde.monde().titre || "GNomon";
    if (forme === "md") {
      telecharger(
        `livrets-${this._slug(titre)}.md`,
        tous.map(livretMarkdown).join("\n\n---\n\n"),
        "text/markdown",
      );
      return;
    }
    const corps = tous
      .map((l) => {
        const doc = livretHtml(l);
        return doc.slice(doc.indexOf("<body>") + 6, doc.indexOf("</body>"));
      })
      .join('</div><div class="livret">');
    const modele = livretHtml(tous[0]);
    const html =
      modele.slice(0, modele.indexOf("</style>")) +
      "\n  .livret { break-after: page; padding-bottom: 4em; }\n" +
      '  @media print { .livret:last-child { break-after: auto; } }\n</style></head><body>' +
      `<div class="livret">${corps}</div></body></html>`;
    telecharger(`livrets-${this._slug(titre)}.html`, html, "text/html");
  },

  _slug(s) {
    return String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  },

  _dire(txt) {
    const el = document.getElementById("statut");
    if (!el) return;
    el.textContent = txt;
    el.hidden = false;
  },
};
