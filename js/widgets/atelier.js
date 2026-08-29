"use strict";

/* ============================================================
   ATELIER — l'écran des trames : le graphe, l'éditeur, la file.
   ------------------------------------------------------------
   Trois zones, et la troisième est celle qui fait écrire :

   1. **Le graphe** — les situations d'une trame, posées à la main
      (layout auteur, `static`), reliées par leurs conclusions.
   2. **L'éditeur** — les champs de la situation choisie, progressifs :
      titre, pitch et point de vue d'abord ; le reste sous un tiroir.
      Une situation à deux champs est valide, marquée « ébauche ».
   3. **La file « et après ? »** — les conclusions écrites dont la suite
      n'existe pas encore. C'est le contrôle qualité d'eXpérience
      transformé en file de travail : au lieu d'une checklist qu'on
      oublie de relire, l'outil pose la question et y répondre crée la
      situation suivante.

   ── REMONTAGE DU GRAPHE : SUR SIGNATURE, PAS SUR ÉVÉNEMENT ──
   Le moteur se remonte entièrement à chaque `mount()`, ce qui remet la
   vue à zéro : un auteur qui a cadré son fil le perdrait à chaque
   frappe sauvegardée. On calcule donc une **signature** de ce qui est
   réellement dessiné (titres, formes, arêtes, positions) et on ne
   remonte que si elle change. Modifier le matériel ou les règles d'une
   situation ne touche pas au graphe — et ne le fait pas sauter.
   ============================================================ */
import { GraphEngine } from "./graph/graphengine.js";
import { TrameStore, TYPES_CONCLUSION } from "../core/tramestore.js";
import { Utils } from "../core/utils.js";

const ACCENT = "#1d4e7a";

/** Champs du second rang — eXpérience, moins les quatre champs
    d'information qui deviendront l'objet `Information` en S3. */
const CHAMPS_RESTE = [
  { cle: "espace", label: "Espace dédié", aide: "Où la scène se tient, et ce qu'il faut que le lieu permette." },
  { cle: "miseEnScene", label: "Mise en scène", aide: "Ce que l'équipe doit préparer pour que la scène puisse arriver." },
  { cle: "materiel", label: "Matériel", aide: "Objets, accessoires, documents." },
  { cle: "regles", label: "Règles nécessaires", aide: "Ce que le système doit permettre à cet endroit précis." },
  { cle: "joueurParticulier", label: "Joueur particulier", aide: "Contrainte sur la personne : sait jouer d'un instrument, n'a pas peur du noir, accepte un costume taché…" },
];

export const Atelier = {
  _hote: null,
  _trames: null,
  _reseau: null,
  _trameId: null,
  _situationId: null,
  _signature: "",

  monter(hote, trames, reseau) {
    this._hote = hote;
    this._trames = trames;
    this._reseau = reseau;
    if (!this._trameId) this._trameId = (trames.trames()[0] || {}).id || null;
    this.rendre();
  },

  demonter() {
    GraphEngine.destroy();
    this._signature = "";
  },

  trameId() {
    return this._trameId;
  },

  /* ================= rendu complet ================= */

  rendre() {
    this._hote.innerHTML =
      '<div class="atelier">' +
      `<div class="trames-barre" id="trames-barre">${this._barreTrames()}</div>` +
      '<div class="atelier-corps">' +
      '<div class="atelier-canvas" id="graphe"></div>' +
      '<aside class="atelier-editeur" id="editeur"></aside>' +
      "</div>" +
      '<section id="et-apres"></section>' +
      "</div>";

    this._brancherBarre();
    this._signature = "";
    this.rafraichir();
  },

  /** Re-projette : graphe si sa signature a changé, éditeur et file
      toujours (ils sont bon marché et n'ont pas d'état de vue). */
  rafraichir() {
    const sig = this._calculerSignature();
    if (sig !== this._signature) {
      this._signature = sig;
      this._monterGraphe();
    }
    this._rendreEditeur();
    this._rendreEtApres();
    const barre = this._hote.querySelector("#trames-barre");
    if (barre) {
      barre.innerHTML = this._barreTrames();
      this._brancherBarre();
    }
  },

  /* ================= le graphe ================= */

  _calculerSignature() {
    if (!this._trameId) return "vide";
    const sits = this._trames.situations(this._trameId);
    const ids = new Set(sits.map((s) => s.id));
    const n = sits
      .map((s) => `${s.id}|${s.titre}|${s.terminale}|${s.x}|${s.y}|${s.castIds.length}|${s.pitch.slice(0, 40)}`)
      .join(";");
    const e = this._trames
      .conclusions()
      .filter((c) => ids.has(c.de) && c.vers && ids.has(c.vers))
      .map((c) => `${c.id}|${c.vers}|${c.type}|${c.texte.slice(0, 30)}`)
      .join(";");
    return `${this._trameId}#${n}#${e}#${this._situationId}`;
  },

  _monterGraphe() {
    const hote = this._hote.querySelector("#graphe");
    if (!hote) return;
    GraphEngine.destroy();
    if (!this._trameId) {
      hote.innerHTML =
        '<p class="vide-canvas">Aucune trame. Créez-en une pour commencer à poser des situations.</p>';
      return;
    }
    hote.innerHTML = "";

    const sits = this._trames.situations(this._trameId);
    if (!sits.length) {
      hote.innerHTML =
        '<p class="vide-canvas">Cette trame n\'a pas encore de situation. Posez la première.</p>';
      return;
    }

    const ids = new Set(sits.map((s) => s.id));
    const nodes = sits.map((s) => this._projeter(s));
    const edges = this._trames
      .conclusions()
      .filter((c) => ids.has(c.de) && c.vers && ids.has(c.vers))
      .map((c) => ({
        id: c.id,
        from: c.de,
        to: c.vers,
        label: c.texte,
        pattern: c.type === "echappatoire" ? "dashed" : "solid",
        dir: "forward",
      }));

    GraphEngine.mount(hote, {
      nodes,
      edges,
      accent: ACCENT,
      static: true,
      onNodeMoved: (id, x, y) => {
        this._trames.poserSituation(id, x, y);
        // Position écrite en silence : on remet la signature à jour
        // pour ne pas provoquer un remontage au prochain événement.
        this._signature = this._calculerSignature();
      },
      onNodeTap: (id) => {
        this._situationId = id;
        this._signature = this._calculerSignature();
        this._rendreEditeur();
        GraphEngine.select(id);
      },
      onBackgroundTap: () => {
        this._situationId = null;
        this._signature = this._calculerSignature();
        this._rendreEditeur();
      },
    });
    if (this._situationId && ids.has(this._situationId)) GraphEngine.select(this._situationId);
  },

  /** Situation → nœud. La FORME dit la structure, pas la décoration :
      une situation à deux conclusions ou plus est un vrai point de
      bifurcation (losange) ; une terminale se ferme (pastille double) ;
      le reste est une scène (rectangle). */
  _projeter(s) {
    const sortantes = this._trames.conclusionsDe(s.id);
    const enAttente = sortantes.filter((c) => !c.vers).length;
    const shape = s.terminale ? "circle-double" : sortantes.length >= 2 ? "diamond" : "rect";
    const pdv = s.pointDeVueId ? this._reseau.personnage(s.pointDeVueId) : null;

    const chips = s.castIds
      .map((id) => this._reseau.personnage(id))
      .map((p) => ({ text: p ? p.nom.split(" ")[0] : "supprimé", danger: !p }))
      .slice(0, 4);
    if (enAttente)
      chips.push({ text: `${enAttente} suite${enAttente > 1 ? "s" : ""} à écrire`, danger: true });

    return {
      id: s.id,
      label: s.titre || "Sans titre",
      shape,
      x: s.x,
      y: s.y,
      card: {
        glyph: s.terminale ? "◉" : sortantes.length >= 2 ? "⑂" : "▭",
        typeLabel: this._trames.estEbauche(s) ? "Ébauche" : pdv ? `Vu par ${pdv.nom.split(" ")[0]}` : "Situation",
        title: s.titre || "Sans titre",
        sub: s.pitch ? s.pitch.slice(0, 90) : "",
        chips,
      },
    };
  },

  /* ================= la barre des trames ================= */

  _barreTrames() {
    const t = this._trames.trames();
    return (
      t
        .map((x) => {
          const n = this._trames.situations(x.id).length;
          return (
            `<button type="button" class="onglet-trame${x.id === this._trameId ? " actif" : ""}" data-trame="${x.id}">` +
            `${Utils.escHtml(x.titre)}<span class="onglet-compte">${n}</span></button>`
          );
        })
        .join("") + '<button type="button" class="onglet-trame ajout" data-nouvelle>+ Trame</button>'
    );
  },

  _brancherBarre() {
    const barre = this._hote.querySelector("#trames-barre");
    for (const b of barre.querySelectorAll("[data-trame]"))
      b.addEventListener("click", () => {
        this._trameId = b.dataset.trame;
        this._situationId = null;
        this._signature = "";
        this.rafraichir();
      });
    const nouvelle = barre.querySelector("[data-nouvelle]");
    if (nouvelle)
      nouvelle.addEventListener("click", () => {
        const titre = prompt("Titre de la trame ?", "Nouvelle trame");
        if (titre === null) return;
        const t = this._trames.creerTrame({ titre: titre.trim() || "Nouvelle trame" });
        this._trameId = t.id;
        this._situationId = null;
        this._signature = "";
        this.rafraichir();
      });
  },

  /* ================= l'éditeur ================= */

  _rendreEditeur() {
    const hote = this._hote.querySelector("#editeur");
    if (!hote) return;
    const s = this._situationId ? this._trames.situation(this._situationId) : null;

    if (!s) {
      hote.innerHTML =
        '<p class="editeur-vide">Choisissez une situation dans le graphe, ou posez-en une nouvelle.</p>' +
        (this._trameId ? '<button type="button" id="act-situation">+ Situation</button>' : "");
      const b = hote.querySelector("#act-situation");
      if (b) b.addEventListener("click", () => this._nouvelleSituation());
      return;
    }

    const persos = this._reseau.personnages();
    const optPdv = persos
      .map(
        (p) =>
          `<option value="${p.id}"${s.pointDeVueId === p.id ? " selected" : ""}>${Utils.escHtml(p.nom)}</option>`,
      )
      .join("");

    hote.innerHTML =
      '<div class="editeur">' +
      `<input class="ed-titre" value="${Utils.escHtml(s.titre)}" placeholder="Titre de la situation" aria-label="Titre" />` +
      (this._trames.estEbauche(s) ? '<p class="ed-ebauche">Ébauche — c\'est un état valide.</p>' : "") +
      '<label class="champ"><span class="champ-label" title="La scène telle que vous la raconteriez si vous en étiez le metteur en scène.">Pitch</span>' +
      `<textarea rows="3" data-s="pitch" placeholder="La scène, comme dans un film…">${Utils.escHtml(s.pitch)}</textarea></label>` +
      '<label class="champ"><span class="champ-label" title="Qui est le héros de cette scène ? eXpérience : « identifiez qui est le héros de cette scène ».">Point de vue</span>' +
      `<select data-s-select="pointDeVueId"><option value="">— personne —</option>${optPdv}</select></label>` +
      `<div class="champ"><span class="champ-label">Casting</span>${this._cast(s, persos)}</div>` +
      this._conclusions(s) +
      '<details class="champs-bloc"><summary>Le reste — ce qu\'il faut pour que ça arrive</summary>' +
      '<label class="champ"><span class="champ-label">Temps dédié</span><span class="ed-temps">' +
      `<input type="number" step="0.5" min="0" max="48" data-s-num="debut" value="${s.debut ?? ""}" placeholder="début" aria-label="Heure de début" /> → ` +
      `<input type="number" step="0.5" min="0" max="48" data-s-num="fin" value="${s.fin ?? ""}" placeholder="fin" aria-label="Heure de fin" /></span></label>` +
      CHAMPS_RESTE.map(
        (c) =>
          `<label class="champ"><span class="champ-label" title="${Utils.escHtml(c.aide)}">${c.label}</span>` +
          `<textarea rows="2" data-s="${c.cle}" placeholder="${Utils.escHtml(c.aide)}">${Utils.escHtml(s[c.cle] || "")}</textarea></label>`,
      ).join("") +
      `<label class="bascule"><input type="checkbox" data-s-bool="terminale"${s.terminale ? " checked" : ""} /> Situation terminale</label>` +
      "</details>" +
      '<button type="button" class="ed-supprimer">Supprimer la situation</button>' +
      "</div>";

    this._brancherEditeur(s);
  },

  _cast(s, persos) {
    const dedans = new Set(s.castIds);
    return (
      '<div class="ed-cast">' +
      persos
        .map(
          (p) =>
            `<button type="button" class="cast-puce${dedans.has(p.id) ? " dedans" : ""}" data-cast="${p.id}">` +
            `${Utils.escHtml(p.nom.split(" ")[0])}</button>`,
        )
        .join("") +
      "</div>"
    );
  },

  _conclusions(s) {
    const cs = this._trames.conclusionsDe(s.id);
    const lignes = cs
      .map((c) => {
        const cible = c.vers ? this._trames.situation(c.vers) : null;
        return (
          `<li class="concl ${c.type}${c.vers ? "" : " orpheline"}" data-c="${c.id}">` +
          `<input class="concl-texte" value="${Utils.escHtml(c.texte)}" placeholder="Ce qui peut arriver…" aria-label="Texte de la conclusion" />` +
          '<span class="concl-actions">' +
          `<button type="button" class="concl-type" data-basculer title="Basculer conclusion / échappatoire">${TYPES_CONCLUSION[c.type]}</button>` +
          (cible
            ? `<button type="button" class="concl-cible" data-aller="${cible.id}">→ ${Utils.escHtml(cible.titre || "Sans titre")}</button>`
            : '<button type="button" class="concl-apres" data-apres>Et après ?</button>') +
          '<button type="button" class="concl-x" data-suppr title="Retirer">✕</button>' +
          "</span></li>"
        );
      })
      .join("");
    return (
      '<div class="champ"><span class="champ-label" title="Chaque conclusion est une arête sortante. eXpérience : « a-t-elle des suites envisageables ? Lesquelles ? »">Conclusions potentielles</span>' +
      `<ul class="concls">${lignes || '<li class="concl vide">Aucune conclusion. Une situation sans suite est un cul-de-sac — sauf si elle est terminale.</li>'}</ul>` +
      '<button type="button" class="concl-ajout">+ Conclusion</button></div>'
    );
  },

  _brancherEditeur(s) {
    const hote = this._hote.querySelector("#editeur");
    const maj = (patch) => this._trames.majSituation(s.id, patch);

    hote.querySelector(".ed-titre").addEventListener("change", (e) =>
      maj({ titre: e.target.value.trim() }),
    );
    for (const ta of hote.querySelectorAll("[data-s]"))
      ta.addEventListener("change", (e) => maj({ [e.target.dataset.s]: e.target.value }));
    for (const el of hote.querySelectorAll("[data-s-select]"))
      el.addEventListener("change", (e) =>
        maj({ [e.target.dataset.sSelect]: e.target.value || null }),
      );
    for (const el of hote.querySelectorAll("[data-s-num]"))
      el.addEventListener("change", (e) =>
        maj({ [e.target.dataset.sNum]: e.target.value === "" ? null : Number(e.target.value) }),
      );
    for (const el of hote.querySelectorAll("[data-s-bool]"))
      el.addEventListener("change", (e) => maj({ [e.target.dataset.sBool]: e.target.checked }));

    for (const b of hote.querySelectorAll("[data-cast]"))
      b.addEventListener("click", () => {
        const id = b.dataset.cast;
        const cur = this._trames.situation(s.id).castIds;
        maj({ castIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      });

    hote.querySelector(".concl-ajout").addEventListener("click", () => {
      this._trames.ajouterConclusion(s.id, { texte: "" });
    });

    for (const li of hote.querySelectorAll(".concl[data-c]")) {
      const id = li.dataset.c;
      li.querySelector(".concl-texte").addEventListener("change", (e) =>
        this._trames.majConclusion(id, { texte: e.target.value }),
      );
      li.querySelector("[data-basculer]").addEventListener("click", () => {
        const c = this._trames.conclusion(id);
        this._trames.majConclusion(id, {
          type: c.type === "normale" ? "echappatoire" : "normale",
        });
      });
      li.querySelector("[data-suppr]").addEventListener("click", () =>
        this._trames.supprimerConclusion(id),
      );
      const apres = li.querySelector("[data-apres]");
      if (apres) apres.addEventListener("click", () => this._repondre(id));
      const aller = li.querySelector("[data-aller]");
      if (aller)
        aller.addEventListener("click", () => {
          this._situationId = aller.dataset.aller;
          this._signature = "";
          this.rafraichir();
        });
    }

    hote.querySelector(".ed-supprimer").addEventListener("click", () => {
      if (!confirm(`Supprimer « ${s.titre || "Sans titre"} » ?`)) return;
      const r = this._trames.supprimerSituation(s.id);
      this._situationId = null;
      if (r && r.orphelinees)
        this._signaler(
          `${r.orphelinees} conclusion${r.orphelinees > 1 ? "s" : ""} pointaient vers elle : ` +
            "elles redeviennent des questions ouvertes plutôt que d'être effacées.",
        );
    });
  },

  /* ================= la boucle « et après ? » ================= */

  _repondre(conclusionId) {
    const c = this._trames.conclusion(conclusionId);
    if (!c) return;
    const titre = prompt(
      `Et après « ${c.texte || "cette conclusion"} » ?\n\nTitre de la situation qui suit — ou laissez vide pour annuler.`,
      "",
    );
    if (titre === null || !titre.trim()) return;
    const suite = this._trames.creerSuite(conclusionId, { titre: titre.trim() });
    if (suite) {
      this._situationId = suite.id;
      this._signature = "";
      this.rafraichir();
    }
  },

  _rendreEtApres() {
    const hote = this._hote.querySelector("#et-apres");
    if (!hote) return;
    const orph = this._trames.orphelines(this._trameId);
    if (!orph.length) {
      hote.innerHTML =
        '<p class="file-vide">Aucune question ouverte : chaque conclusion de cette trame mène quelque part.</p>';
      return;
    }
    hote.innerHTML =
      `<p class="file-titre">Et après ? <span>${orph.length} question${orph.length > 1 ? "s" : ""} ouverte${orph.length > 1 ? "s" : ""}</span></p>` +
      '<ul class="file">' +
      orph
        .map((c) => {
          const src = this._trames.situation(c.de);
          return (
            `<li><span class="file-src">${Utils.escHtml(src ? src.titre || "Sans titre" : "?")}</span>` +
            `<span class="file-txt">${Utils.escHtml(c.texte) || "<conclusion sans texte>"}</span>` +
            `<button type="button" data-f="${c.id}">Écrire la suite</button></li>`
          );
        })
        .join("") +
      "</ul>";
    for (const b of hote.querySelectorAll("[data-f]"))
      b.addEventListener("click", () => this._repondre(b.dataset.f));
  },

  /* ================= divers ================= */

  _nouvelleSituation() {
    if (!this._trameId) return;
    const n = this._trames.situations(this._trameId).length;
    const s = this._trames.creerSituation(this._trameId, {
      titre: "Sans titre",
      x: 180 + (n % 3) * 240,
      y: 120 + Math.floor(n / 3) * 150,
    });
    this._situationId = s.id;
    this._signature = "";
    this.rafraichir();
  },

  _signaler(txt) {
    const el = document.getElementById("statut");
    if (!el) return;
    el.textContent = txt;
    el.hidden = false;
  },
};
