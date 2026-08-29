"use strict";

/* ============================================================
   MENTIONS — autocomplétion `@` dans un textarea, rendu des puces,
   et **proposition d'arête**.
   ------------------------------------------------------------
   Repris de ShadowHerds pour la mécanique, réécrit pour le modèle : la
   version d'origine dépend de six modules propres à son domaine, et
   fait quatre modes (@ # : /). Ici il n'en faut qu'un, mais il porte
   quelque chose que l'original n'a pas.

   ── ANCRAGE PAR ID ──
   Une mention se stocke `@[nom](id)`. **L'id est la vérité** ; le nom
   entre crochets n'est qu'un cache lisible. Le rendu résout toujours
   id → nom COURANT — d'où la propagation gratuite du renommage, sans
   aucun hook. L'auteur ne tape jamais le jeton : il saisit « @Mar »,
   choisit dans la liste, le widget insère la forme complète.

   ── CE QUI EST PROPRE À GNomon : la mention propose l'arête ──
   C'est la décision d'interaction qui fait tenir tout le projet. Écrire
   « j'ai vu @Marek sortir du tunnel » dans la fiche d'Elena propose de
   créer le lien Elena → Marek. Sans ça, le graphe est une corvée de
   saisie parallèle, tenue en semaine 1, abandonnée en semaine 3.

   **La tonalité n'est jamais devinée.** Un défaut « neutre » posé en
   douce remplirait le réseau d'arêtes sans intention — et ferait passer
   pour couvert un personnage qui n'a en réalité aucun contact positif,
   c'est-à-dire qu'il désarmerait le validateur qu'il est censé nourrir.
   L'auteur choisit la tonalité d'un clic, ou il remet à plus tard : la
   mention reste, le lien n'existe pas. Un silence honnête vaut mieux
   qu'une valeur inventée.

   L'importance, elle, a un défaut assumé (`secondaire`) : c'est le
   milieu, elle ne fausse aucun compte dans un sens ni dans l'autre.
   ============================================================ */
import { Markdown } from "./markdown.js";
import { Utils } from "../../core/utils.js";

const TOKEN = /@\[([^\]\n]*)\]\(([^)\n]+)\)/g;

export const Mentions = {
  _box: null,
  _target: null,
  _match: null, // { start, end, query }
  _results: [],
  _sel: 0,
  _ctx: null, // { store, personnageId, onMention }

  /* ---------------- câblage ---------------- */

  /** Câble un textarea. `ctx.personnageId` est l'auteur de la fiche :
      c'est de lui que partira l'arête proposée. Idempotent. */
  attach(textarea, ctx) {
    if (!textarea) return;
    this._ctx = ctx;
    if (textarea.dataset.mentionsWired) return;
    textarea.dataset.mentionsWired = "1";
    textarea.addEventListener("input", () => this._onInput(textarea));
    textarea.addEventListener("keydown", (e) => this._onKeydown(e));
    // setTimeout : laisse le mousedown de la liste s'exécuter avant la
    // fermeture, sinon le clic ne sélectionne jamais rien.
    textarea.addEventListener("blur", () => setTimeout(() => this._close(), 0));
  },

  _ensureBox() {
    if (this._box) return this._box;
    const box = document.createElement("div");
    box.id = "mentions-box";
    box.setAttribute("role", "listbox");
    box.hidden = true;
    // mousedown, pas click : il précède le blur du textarea.
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const row = e.target.closest(".mention-row");
      if (row) this._pick(Number(row.dataset.idx));
    });
    document.body.appendChild(box);
    this._box = box;
    return box;
  },

  /* ---------------- détection ---------------- */

  /** Un `@partiel` précédé d'un début de texte ou d'une espace, sans
      espace jusqu'au curseur. Le garde `startsWith("[")` évite de se
      déclencher quand le curseur est À L'INTÉRIEUR d'un jeton déjà posé. */
  _onInput(textarea) {
    const pos = textarea.selectionStart;
    const avant = textarea.value.slice(0, pos);
    const m = avant.match(/(?:^|\s)@([^\s@]*)$/);
    if (m && !m[1].startsWith("[")) this._open(textarea, pos, m[1]);
    else this._close();
  },

  _open(textarea, pos, query) {
    const { store, personnageId } = this._ctx || {};
    if (!store) return this._close();
    const q = Utils.searchNorm(query);
    this._results = store
      .personnages()
      .filter((p) => p.id !== personnageId)
      .filter((p) => !q || Utils.searchNorm(p.nom).includes(q))
      .slice(0, 8);
    this._match = { start: pos - query.length - 1, end: pos, query };
    this._target = textarea;
    this._sel = 0;
    this._results.length ? this._render() : this._close();
  },

  _onKeydown(e) {
    if (!this._match || !this._box || this._box.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this._sel = (this._sel + 1) % this._results.length;
      this._render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this._sel = (this._sel - 1 + this._results.length) % this._results.length;
      this._render();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      this._pick(this._sel);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this._close();
    }
  },

  _render() {
    const box = this._ensureBox();
    box.innerHTML = this._results
      .map(
        (p, i) =>
          `<div class="mention-row${i === this._sel ? " sel" : ""}" data-idx="${i}" role="option" aria-selected="${i === this._sel}">` +
          `<span class="mention-type">${p.pj ? "PJ" : "PNJ"}</span>` +
          `<span class="mention-nom">${Utils.escHtml(p.nom)}</span>` +
          `<span class="mention-role">${Utils.escHtml(p.role || "")}</span>` +
          "</div>",
      )
      .join("");
    const r = this._target.getBoundingClientRect();
    box.style.left = `${Math.round(r.left + window.scrollX)}px`;
    box.style.top = `${Math.round(r.bottom + window.scrollY + 4)}px`;
    box.style.width = `${Math.round(r.width)}px`;
    box.hidden = false;
  },

  _close() {
    if (this._box) this._box.hidden = true;
    this._match = null;
    this._results = [];
  },

  /* ---------------- insertion ---------------- */

  _pick(i) {
    const p = this._results[i];
    const ta = this._target;
    const m = this._match;
    if (!p || !ta || !m) return this._close();

    const jeton = `@[${p.nom}](${p.id})`;
    ta.value = ta.value.slice(0, m.start) + jeton + ta.value.slice(m.end);
    const caret = m.start + jeton.length;
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    this._close();
    ta.focus();

    // Le cœur : si l'arête n'existe pas encore, on la propose.
    const { store, personnageId, onMention } = this._ctx || {};
    if (!store || !personnageId || typeof onMention !== "function") return;
    const deja = store.liensDe(personnageId).some((l) => l.vers === p.id);
    onMention({ cible: p, existe: deja });
  },

  /* ---------------- rendu lecture ---------------- */

  /** Texte d'auteur → HTML sûr. Les jetons deviennent des puces dont le
      libellé est résolu à CHAQUE rendu : renommer un personnage met à
      jour toutes ses mentions, partout, sans migration. Une mention dont
      l'id n'existe plus est marquée « morte » plutôt que masquée — une
      référence cassée doit se voir. */
  renderText(texte, store) {
    if (!texte) return "";
    let out = "";
    let last = 0;
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(texte))) {
      out += Markdown.inline(Utils.escHtml(texte.slice(last, m.index)));
      const id = m[2];
      const p = store ? store.personnage(id) : null;
      const nom = p ? p.nom : m[1];
      out +=
        `<span class="mention-chip${p ? "" : " morte"}" data-action="ouvrir-personnage" ` +
        `data-id="${Utils.escHtml(id)}" role="button" tabindex="0" ` +
        `title="${p ? Utils.escHtml(p.role || "") : "personnage supprimé"}">` +
        `@${Utils.escHtml(nom || "?")}</span>`;
      last = TOKEN.lastIndex;
    }
    out += Markdown.inline(Utils.escHtml(texte.slice(last)));
    return out.replace(/\n/g, "<br>");
  },

  /** Ids mentionnés dans un texte — sert aux futurs rétroliens (S3). */
  idsMentionnes(texte) {
    const ids = new Set();
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(texte || ""))) ids.add(m[2]);
    return [...ids];
  },
};
