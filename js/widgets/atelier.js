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
import { TYPES_CONCLUSION } from "../core/tramestore.js";
import { INFLUENCES, ETATS } from "../core/informationstore.js";
import { crashTestSituation } from "../core/crashtest.js";
import { contexteSuite } from "../core/liaison.js";
import { coupeHtml } from "./degats.js";
import { Utils } from "../core/utils.js";

const ACCENT = "#1d4e7a";

/** Champs du second rang — eXpérience. Les quatre champs
    d'information ne sont pas ici : ce sont des références, gérées par
    la section « Informations » (cf. `_informations`). */
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
  _infos: null,
  _trameId: null,
  _situationId: null,
  _signature: "",
  // Comme le crash test de la fiche : une question qu'on pose, pas un
  // état permanent. On retient POUR QUELLE situation le panneau est
  // ouvert, plutôt qu'un booléen qu'il faudrait penser à remettre à
  // zéro aux huit endroits où la sélection change — un oubli et
  // l'auteur verrait les dégâts d'une scène en regardant une autre.
  _coupePour: null,
  // Pour QUELLE conclusion le panneau « écrire la suite » est ouvert.
  _suitePour: null,

  monter(hote, trames, reseau, infos) {
    this._hote = hote;
    this._trames = trames;
    this._reseau = reseau;
    this._infos = infos;
    this._recadrer();
    this.rendre();
  },

  /** L'atelier est un module : sa sélection survit au démontage. Elle ne
      survit PAS au vidage des trames (jeu d'essai rechargé, remise à
      zéro) — l'id mémorisé pointe alors sur une trame détruite, et le
      graphe s'affiche vide sans rien dire. On revalide au montage, et
      on retombe sur la première trame. */
  _recadrer() {
    if (this._trameId && !this._trames.trame(this._trameId)) this._trameId = null;
    if (this._situationId && !this._trames.situation(this._situationId))
      this._situationId = null;
    if (!this._trameId) this._trameId = (this._trames.trames()[0] || {}).id || null;
  },

  demonter() {
    GraphEngine.destroy();
    this._signature = "";
  },

  trameId() {
    return this._trameId;
  },

  /** Ouvre l'atelier SUR une situation précise, en basculant sur sa
      trame au passage. Sert à la frise : cliquer un bloc du planning
      amène là où on peut le corriger, plutôt que d'obliger à retrouver
      la situation à la main. */
  viser(situationId) {
    const s = this._trames.situation(situationId);
    if (!s) return false;
    this._trameId = s.trameId;
    this._situationId = s.id;
    this._signature = "";
    this.rafraichir();
    return true;
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
    this._recadrer();
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
      this._informations(s) +
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
      // « Et si je la coupe ? » vient AVANT « Supprimer » — et c'est
      // l'ordre qui fait le sens : on regarde ce que la coupe emporte
      // avant de la faire, jamais après. Le calcul est en lecture seule
      // (cf. `core/crashtest.js`).
      '<button type="button" class="ed-coupe" data-coupe ' +
      `aria-expanded="${this._coupePour === s.id}">` +
      `${this._coupePour === s.id ? "Masquer" : "Et si je la coupe ?"}</button>` +
      (this._coupePour === s.id
        ? `<div class="ed-degats">${coupeHtml(crashTestSituation(s.id, { reseau: this._reseau, trames: this._trames, infos: this._infos }))}</div>`
        : "") +
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

  /** ── LE FLUX INVERSÉ ──
      eXpérience : « pensez d'abord à ce que vous voulez que les joueurs
      fassent, ensuite à ce que vous avez besoin de leur donner pour
      ça ». Une situation **requiert** ce qu'il faut savoir pour
      qu'elle arrive, et **produit** ce qui s'y apprend.

      Sous chaque information requise, on montre **le cast et son état** :
      c'est là que la question « qui doit savoir quoi avant le jeu ? »
      se règle, d'un clic par personne. Le squelette de sa fiche suit
      tout seul. */
  _informations(s) {
    if (!this._infos) return "";
    const bloc = (sens, titre, aide) => {
      const ids = sens === "produit" ? this._trames.produit(s.id) : this._trames.requiert(s.id);
      const lignes = ids
        .map((id) => {
          const i = this._infos.information(id);
          if (!i)
            return `<li class="inf-item morte" data-inf="${id}" data-sens="${sens}"><span class="inf-txt">information supprimée</span><button type="button" data-delier>✕</button></li>`;
          const cast =
            sens === "requiert"
              ? '<span class="inf-cast">' +
                s.castIds
                  .map((pid) => {
                    const p = this._reseau.personnage(pid);
                    const e = this._infos.etat(id, pid);
                    return (
                      `<button type="button" class="inf-etat k-${e}" data-etat="${pid}" data-inf2="${id}" ` +
                      `title="${Utils.escHtml(p ? p.nom : "supprimé")} — ${ETATS[e]}">` +
                      `${Utils.escHtml(p ? p.nom.split(" ")[0] : "?")}</button>`
                    );
                  })
                  .join("") +
                (s.castIds.length ? "" : '<span class="inf-vide">aucun casting sur cette situation</span>') +
                "</span>"
              : "";
          return (
            `<li class="inf-item" data-inf="${id}" data-sens="${sens}">` +
            `<span class="inf-txt">${Utils.escHtml(i.contenu) || "<sans contenu>"}` +
            `<span class="infl">${INFLUENCES[i.influence].toLowerCase()}</span></span>` +
            cast +
            '<button type="button" data-delier title="Retirer de cette situation">✕</button></li>'
          );
        })
        .join("");
      const dispo = this._infos
        .informations()
        .filter((i) => !ids.includes(i.id))
        .map((i) => `<option value="${i.id}">${Utils.escHtml(i.contenu || "<sans contenu>")}</option>`)
        .join("");
      return (
        `<div class="champ"><span class="champ-label" title="${Utils.escHtml(aide)}">${titre}</span>` +
        `<ul class="infs">${lignes || '<li class="inf-item vide">rien pour l\'instant</li>'}</ul>` +
        `<span class="inf-ajout"><select data-ajout="${sens}"><option value="">+ lier une information…</option>${dispo}</select>` +
        `<button type="button" data-neuve="${sens}">Neuve</button></span></div>`
      );
    };
    return (
      bloc(
        "requiert",
        "Ce qu'il faut savoir",
        "Les informations préliminaires : sans elles, la scène ne peut pas arriver. Cliquez un nom du cast pour régler ce qu'il en sait.",
      ) + bloc("produit", "Ce qui s'y apprend", "Ce que la scène révèle — la matière des situations suivantes.")
    );
  },

  _brancherInformations(s) {
    const hote = this._hote.querySelector("#editeur");
    for (const li of hote.querySelectorAll(".inf-item[data-inf]")) {
      const b = li.querySelector("[data-delier]");
      if (b)
        b.addEventListener("click", () =>
          this._trames.delierInformation(s.id, li.dataset.inf, li.dataset.sens),
        );
    }
    for (const b of hote.querySelectorAll("[data-etat]"))
      b.addEventListener("click", () => this._infos.cycler(b.dataset.inf2, b.dataset.etat));
    for (const sel of hote.querySelectorAll("[data-ajout]"))
      sel.addEventListener("change", (e) => {
        if (!e.target.value) return;
        this._trames.lierInformation(s.id, e.target.value, sel.dataset.ajout);
      });
    for (const b of hote.querySelectorAll("[data-neuve]"))
      b.addEventListener("click", () => {
        const contenu = prompt("L'information, telle qu'elle est vraie :", "");
        if (contenu === null || !contenu.trim()) return;
        const i = this._infos.creer({ contenu: contenu.trim(), influence: "latente" });
        if (i) this._trames.lierInformation(s.id, i.id, b.dataset.neuve);
      });
  },

  _brancherEditeur(s) {
    const hote = this._hote.querySelector("#editeur");
    const maj = (patch) => this._trames.majSituation(s.id, patch);

    const coupe = hote.querySelector("[data-coupe]");
    if (coupe)
      coupe.addEventListener("click", () => {
        this._coupePour = this._coupePour === s.id ? null : s.id;
        this._rendreEditeur();
      });

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

    this._brancherInformations(s);

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

  /** ── ÉCRIRE LA SUITE, AVEC LE CONTEXTE SOUS LES YEUX ──
      C'était un `prompt()` : une boîte grise qui demande un titre et
      ne montre rien. Or écrire la suite demande de se rappeler ce que
      les présents savent déjà, et quels fils viennent d'être tendus
      sans être rattachés — deux choses que les stores savent (cf.
      `core/liaison.js`) et que l'auteur devait retrouver de tête.

      Le panneau PROPOSE et ne décide rien : il n'écrit aucun titre, ne
      coche aucune information. C'est le geste du `@mention`, transposé
      au moment de la suite. */
  _repondre(conclusionId) {
    this._suitePour = this._suitePour === conclusionId ? null : conclusionId;
    this._rendreEtApres();
  },

  _creerSuite(conclusionId, titre, requiertIds) {
    if (!titre.trim()) return;
    const suite = this._trames.creerSuite(conclusionId, { titre: titre.trim() });
    if (suite) {
      // Les informations cochées deviennent les préalables de la
      // nouvelle scène — c'est le rattachement qu'on venait proposer.
      for (const id of requiertIds) this._trames.lierInformation(suite.id, id, "requiert");
      this._suitePour = null;
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
          const ouvert = this._suitePour === c.id;
          return (
            `<li${ouvert ? ' class="ouvert"' : ""}>` +
            `<span class="file-src">${Utils.escHtml(src ? src.titre || "Sans titre" : "?")}</span>` +
            `<span class="file-txt">${Utils.escHtml(c.texte) || "<conclusion sans texte>"}</span>` +
            `<button type="button" data-f="${c.id}" aria-expanded="${ouvert}">` +
            `${ouvert ? "Fermer" : "Écrire la suite"}</button>` +
            (ouvert ? this._panneauSuite(c) : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
    for (const b of hote.querySelectorAll("[data-f]"))
      b.addEventListener("click", () => this._repondre(b.dataset.f));
    this._brancherSuite();
  },

  /** Le contexte d'écriture, en lecture seule sauf les cases à cocher.
      Rien n'est pré-rempli ni pré-coché : proposer n'est pas décider. */
  _panneauSuite(c) {
    const ctx = contexteSuite(c.id, {
      reseau: this._reseau,
      trames: this._trames,
      infos: this._infos,
    });
    if (!ctx) return "";

    return (
      '<div class="suite-panneau">' +
      '<label class="champ"><span class="champ-label">Titre de la situation qui suit</span>' +
      `<input type="text" data-suite-titre placeholder="Ce qui arrive ensuite…" /></label>` +
      (ctx.aRattacher.length
        ? '<p class="suite-sous">Ce qui s\'apprend ici et ne sert nulle part encore</p>' +
          '<p class="suite-aide">Cochez ce que la nouvelle situation exigera de savoir. ' +
          "C'est ainsi qu'un fil tendu se rattache — rien n'est coché à votre place.</p>" +
          '<ul class="suite-infos">' +
          ctx.aRattacher
            .map(
              (i) =>
                `<li><label><input type="checkbox" data-suite-info="${Utils.escHtml(i.id)}" /> ` +
                `${Utils.escHtml(i.contenu)}</label></li>`,
            )
            .join("") +
          "</ul>"
        : "") +
      (ctx.dejaSu.length
        ? '<p class="suite-sous">Ce que les présents savent déjà</p>' +
          '<p class="suite-aide">Pour ne pas leur faire redécouvrir ce qu\'ils savent.</p>' +
          '<ul class="suite-su">' +
          ctx.dejaSu
            .map(
              (i) =>
                `<li>${Utils.escHtml(i.contenu)} <span>${Utils.escHtml(i.qui.join(", "))}</span></li>`,
            )
            .join("") +
          "</ul>"
        : '<p class="suite-aide">Personne au casting de cette scène ne sait rien de particulier ' +
          "— la suite part d'une page blanche.</p>") +
      `<button type="button" class="suite-creer" data-suite-creer="${Utils.escHtml(c.id)}">Créer la suite</button>` +
      "</div>"
    );
  },

  _brancherSuite() {
    const b = this._hote.querySelector("[data-suite-creer]");
    if (!b) return;
    const champ = this._hote.querySelector("[data-suite-titre]");
    const creer = () => {
      const coches = [...this._hote.querySelectorAll("[data-suite-info]:checked")].map(
        (x) => x.dataset.suiteInfo,
      );
      if (!champ.value.trim()) {
        champ.focus();
        champ.placeholder = "Un titre est nécessaire pour créer la suite.";
        return;
      }
      this._creerSuite(b.dataset.suiteCreer, champ.value, coches);
    };
    b.addEventListener("click", creer);
    // Entrée valide, comme dans le `prompt()` qu'on remplace : le geste
    // rapide ne doit pas se perdre en gagnant du contexte.
    champ.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        creer();
      }
    });
    champ.focus();
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
