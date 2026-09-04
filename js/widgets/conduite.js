"use strict";

/* ============================================================
   CONDUITE — le tableau de la nuit.
   ------------------------------------------------------------
   ── POURQUOI CET ÉCRAN NE RESSEMBLE PAS AUX AUTRES ──
   L'atelier est un bureau : on y écrit à J-30, assis, au calme, sur
   fond clair, avec une serif pour la prose. La conduite est une salle
   de veille : 3 h du matin, sous la pluie, à une main, une équipe
   fatiguée qui doit lire un état **en traversant la pièce**. Les deux
   moments n'ont rien en commun, et leur donner la même peau serait une
   économie, pas une cohérence.

   D'où un monde propre, dérivé de l'usage et pas d'un goût :
   · **fond noir chaud** — un écran clair détruit la vision nocturne et
     éclaire la nuit d'un GN où la lumière fait partie de la fiction ;
   · **ambre** — la couleur des instruments de nuit, lisible en basse
     lumière, et volontairement l'opposé du bleu de Prusse de l'atelier :
     on doit savoir dans quelle moitié de l'outil on est, d'un coup d'œil ;
   · **pas d'angles arrondis, une barre de signal à gauche** — c'est un
     tableau, pas un document ; la barre est le seul héritage visuel de
     l'atelier, où elle porte déjà la tonalité d'un lien ;
   · **la serif ne survit que dans la main courante** — elle veut dire
     « ceci a été écrit par une personne », exactement comme ailleurs.
     Le reste est en sans pour l'état, en mono pour les chiffres.

   ── LE TABLEAU SE RÉORDONNE TOUT SEUL ──
   Bloqués d'abord, puis impasses, puis les plus immobiles. On regarde
   le haut, on ne cherche jamais.

   ── DEUX ÉTAGES, ET UN BATTEMENT ──
   `rendre()` construit ; `battre()` ne remet à jour que ce qui dépend
   du temps. Sans ça, le rafraîchissement écraserait la saisie de la
   main courante toutes les quinze secondes — la même maladie qu'en S1,
   sous une troisième forme.
   ============================================================ */
import { tableau, duree, heureFiction, SEUIL_DELAISSE_MIN } from "../core/conduite.js";
import { STATUTS } from "../core/runstore.js";
import { Utils } from "../core/utils.js";

const BATTEMENT_MS = 15000;

export const Conduite = {
  _hote: null,
  _run: null,
  _trames: null,
  _reseau: null,
  _timer: null,

  monter(hote, run, trames, reseau) {
    this._hote = hote;
    this._run = run;
    this._trames = trames;
    this._reseau = reseau;
    this.rendre();
    clearInterval(this._timer);
    this._timer = setInterval(() => this.battre(), BATTEMENT_MS);
  },

  demonter() {
    clearInterval(this._timer);
    this._timer = null;
  },

  /* ================= rendu complet ================= */

  rendre() {
    if (!this._run.run()) {
      this._hote.innerHTML = this._avantLeJeu();
      this._brancherDemarrage();
      return;
    }

    const t = tableau(this._run, this._trames, this._reseau);
    this._hote.innerHTML =
      '<div class="cd">' +
      this._bandeau(t) +
      '<div class="cd-corps">' +
      `<div class="cd-fils">${this._fils(t)}${this._aLancer()}</div>` +
      `<aside class="cd-flanc">${this._delaisses(t)}${this._aVenir(t)}${this._courante()}</aside>` +
      "</div></div>";
    this._brancher();
  },

  /** Ne touche qu'au temps. Jamais au DOM de saisie. */
  battre() {
    if (!this._run.run() || !this._hote.querySelector(".cd")) return;
    const t = tableau(this._run, this._trames, this._reseau);
    const h = this._hote.querySelector("#cd-horloge");
    if (h) h.textContent = heureFiction(t.heure);
    for (const el of this._hote.querySelectorAll("[data-depuis]")) {
      const f = t.fils.find((x) => x.trameId === el.dataset.depuis);
      if (f) el.textContent = duree(f.minutes);
    }
    const d = this._hote.querySelector("#cd-delaisses");
    if (d) d.innerHTML = this._listeDelaisses(t);
    const c = this._hote.querySelector("#cd-compteurs");
    if (c) c.innerHTML = this._compteurs(t);
  },

  /* ================= morceaux ================= */

  _avantLeJeu() {
    const n = this._trames.trames().length;
    return (
      '<div class="cd cd-avant"><div class="cd-demarrage">' +
      '<p class="cd-titre">Le jeu n\'a pas commencé</p>' +
      `<p class="cd-sous">${n} ${Utils.plur(n, "trame")} ${Utils.plur(n, "prête")}. ` +
      "L'horloge de fiction démarre à l'heure que vous donnez ici : c'est elle qui permet " +
      "au tableau de dire « dans 12 minutes » plutôt que « à 21 h ».</p>" +
      '<label class="cd-champ">Première heure de fiction ' +
      '<input type="number" id="cd-h0" step="0.5" min="0" max="30" value="20" /></label>' +
      '<button type="button" id="cd-demarrer" class="cd-gros">Démarrer le jeu</button>' +
      "</div></div>"
    );
  },

  _bandeau(t) {
    const r = this._run.run();
    const pause = this._run.enPause();
    return (
      `<header class="cd-bandeau${pause ? " en-pause" : ""}">` +
      `<span class="cd-horloge" id="cd-horloge">${heureFiction(t.heure)}</span>` +
      `<span class="cd-etiquette">heure de fiction${pause ? " · EN PAUSE" : ""}</span>` +
      `<span class="cd-compteurs" id="cd-compteurs">${this._compteurs(t)}</span>` +
      '<span class="cd-commandes">' +
      `<button type="button" id="cd-pause">${pause ? "Reprendre" : "Pause"}</button>` +
      (r.fin ? "" : '<button type="button" id="cd-clore">Clore</button>') +
      "</span></header>"
    );
  },

  _compteurs(t) {
    const actifs = t.fils.filter((f) => f.fil.statut === "actif").length;
    const bloques = t.fils.filter((f) => f.fil.statut === "bloque").length;
    const impasses = t.fils.filter((f) => f.impasse).length;
    const item = (n, mot, classe) =>
      `<b class="cd-c ${n ? classe : "calme"}">${n}</b> ${Utils.escHtml(mot)}`;
    return (
      item(actifs, "en jeu", "vif") +
      item(bloques, Utils.plur(bloques, "bloqué"), "alarme") +
      item(impasses, Utils.plur(impasses, "impasse"), "alarme") +
      item(t.delaisses.length, Utils.plur(t.delaisses.length, "délaissé"), "alarme")
    );
  },

  _fils(t) {
    if (!t.fils.length)
      return '<p class="cd-vide">Aucun fil lancé. Ouvrez-en un ci-dessous.</p>';
    return t.fils.map((f) => this._fil(f)).join("");
  },

  _fil(f) {
    const s = f.situation;
    const etat = f.fil.statut === "bloque" ? "bloque" : f.impasse ? "impasse" : f.fil.statut;
    const pdv = s && s.pointDeVueId ? this._reseau.personnage(s.pointDeVueId) : null;
    const cast = s
      ? (s.castIds || [])
          .map((id) => this._reseau.personnage(id))
          .filter(Boolean)
          .map((p) => `<span class="cd-tete${p.pj ? "" : " pnj"}">${Utils.escHtml(p.nom.split(" ")[0])}</span>`)
          .join("")
      : "";

    const boutons = f.conclusions.length
      ? f.conclusions
          .map(
            (c) =>
              `<button type="button" class="cd-suite${c.type === "echappatoire" ? " echap" : c.type === "narration" ? " narration" : c.type === "interrupteur" ? " interrupteur" : ""}${c.vers ? "" : " sans-suite"}" ` +
              `data-bif="${f.trameId}" data-c="${c.id}">` +
              `${Utils.escHtml(c.texte) || "conclusion sans texte"}` +
              (c.vers ? "" : '<span class="cd-averti">rien d\'écrit après</span>') +
              "</button>",
          )
          .join("")
      : '<p class="cd-improviser">Aucune conclusion écrite. À improviser — et à noter ' +
        "dans la main courante pour le débrief.</p>";

    return (
      `<article class="cd-fil e-${etat}">` +
      '<header><span class="cd-statut">' +
      Utils.escHtml(f.impasse && f.fil.statut === "actif" ? "Impasse" : STATUTS[f.fil.statut]) +
      `</span><span class="cd-trame">${Utils.escHtml(f.trame.titre)}</span>` +
      `<span class="cd-depuis" data-depuis="${f.trameId}">${duree(f.minutes)}</span></header>` +
      `<p class="cd-scene">${Utils.escHtml(s ? s.titre || "Sans titre" : "situation supprimée")}</p>` +
      (s && s.pitch ? `<p class="cd-pitch">${Utils.escHtml(s.pitch)}</p>` : "") +
      '<p class="cd-meta">' +
      (pdv ? `vu par <b>${Utils.escHtml(pdv.nom)}</b>` : "") +
      (s && s.espace ? ` · ${Utils.escHtml(s.espace)}` : "") +
      `</p><p class="cd-cast">${cast}</p>` +
      `<div class="cd-suites">${boutons}</div>` +
      '<footer class="cd-actions">' +
      `<button type="button" data-bloquer="${f.trameId}">${f.fil.statut === "bloque" ? "Débloquer" : "Marquer bloqué"}</button>` +
      `<button type="button" data-clore-fil="${f.trameId}">Clore le fil</button>` +
      "</footer></article>"
    );
  },

  _aLancer() {
    const ouverts = new Set(Object.keys(this._run.fils()));
    const restantes = this._trames.trames().filter((t) => !ouverts.has(t.id));
    if (!restantes.length) return "";
    return (
      '<div class="cd-alancer"><p class="cd-section">Fils non lancés</p>' +
      restantes
        .map((t) => {
          const sits = this._trames.situations(t.id);
          const opts = sits
            .map((s) => `<option value="${s.id}">${Utils.escHtml(s.titre || "Sans titre")}</option>`)
            .join("");
          return (
            `<div class="cd-lancement"><span>${Utils.escHtml(t.titre)}</span>` +
            (sits.length
              ? `<select data-depart="${t.id}">${opts}</select>` +
                `<button type="button" data-lancer="${t.id}">Lancer</button>`
              : '<span class="cd-etiquette">aucune situation</span>') +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  },

  _delaisses(t) {
    return (
      '<section class="cd-flanc-bloc alarme">' +
      `<p class="cd-section">Délaissés<span>plus de ${SEUIL_DELAISSE_MIN} min sans scène</span></p>` +
      `<div id="cd-delaisses">${this._listeDelaisses(t)}</div></section>`
    );
  },

  _listeDelaisses(t) {
    if (!t.delaisses.length)
      return '<p class="cd-ok">Tout le monde a croisé une scène récemment.</p>';
    return (
      '<ul class="cd-liste">' +
      t.delaisses
        .map(
          (d) =>
            `<li><span>${Utils.escHtml(d.personnage.nom)}</span>` +
            `<b>${duree(d.minutes)}${d.jamais ? " · jamais" : ""}</b></li>`,
        )
        .join("") +
      "</ul>"
    );
  },

  _aVenir(t) {
    if (!t.aVenir.length) return "";
    return (
      '<section class="cd-flanc-bloc"><p class="cd-section">Ce qui vient</p><ul class="cd-liste">' +
      t.aVenir
        .map(
          (a) =>
            `<li><span>${Utils.escHtml(a.situation.titre || "Sans titre")}</span>` +
            `<b>${a.dansMinutes <= 0 ? "maintenant" : `dans ${duree(a.dansMinutes)}`}</b></li>`,
        )
        .join("") +
      "</ul></section>"
    );
  },

  _courante() {
    const j = this._run.journal().slice(0, 40);
    return (
      '<section class="cd-flanc-bloc"><p class="cd-section">Main courante</p>' +
      '<div class="cd-saisie"><input id="cd-note" placeholder="Ce qui vient de se passer…" ' +
      'aria-label="Entrée de main courante" /><button type="button" id="cd-noter">Noter</button></div>' +
      '<ol class="cd-journal">' +
      j
        .map(
          (e) =>
            `<li class="t-${e.type}"><span class="cd-h">${heureFiction(e.heure)}</span>` +
            `<span class="cd-txt">${Utils.escHtml(e.texte)}</span></li>`,
        )
        .join("") +
      "</ol></section>"
    );
  },

  /* ================= câblage ================= */

  _brancherDemarrage() {
    const b = this._hote.querySelector("#cd-demarrer");
    if (!b) return;
    b.addEventListener("click", () => {
      const h = Number(this._hote.querySelector("#cd-h0").value);
      this._run.demarrer(Number.isFinite(h) ? h : 20);
    });
  },

  _brancher() {
    const q = (s) => this._hote.querySelectorAll(s);
    const un = (s) => this._hote.querySelector(s);

    un("#cd-pause").addEventListener("click", () => this._run.basculerPause());
    const clore = un("#cd-clore");
    if (clore)
      clore.addEventListener("click", () => {
        if (confirm("Clore le jeu ? L'horloge s'arrête.")) this._run.clore();
      });

    for (const b of q("[data-bif]"))
      b.addEventListener("click", () => {
        const c = this._trames.conclusion(b.dataset.c);
        if (!c) return;
        const cible = c.vers ? this._trames.situation(c.vers) : null;
        this._run.bifurquer(b.dataset.bif, {
          vers: c.vers,
          texte: c.texte || "bascule",
          titreCible: cible ? cible.titre || "Sans titre" : "",
        });
      });

    for (const b of q("[data-bloquer]"))
      b.addEventListener("click", () => {
        const f = this._run.fil(b.dataset.bloquer);
        this._run.majFil(b.dataset.bloquer, {
          statut: f && f.statut === "bloque" ? "actif" : "bloque",
        });
      });

    for (const b of q("[data-clore-fil]"))
      b.addEventListener("click", () => this._run.majFil(b.dataset.cloreFil, { statut: "clos" }));

    for (const b of q("[data-lancer]"))
      b.addEventListener("click", () => {
        const sel = un(`[data-depart="${CSS.escape(b.dataset.lancer)}"]`);
        if (!sel || !sel.value) return;
        const s = this._trames.situation(sel.value);
        this._run.lancer(b.dataset.lancer, sel.value, s ? s.titre || "Sans titre" : "");
      });

    const note = un("#cd-note");
    const poser = () => {
      if (!note.value.trim()) return;
      this._run.noter(note.value);
      note.value = "";
    };
    un("#cd-noter").addEventListener("click", poser);
    note.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        poser();
      }
    });
  },
};
