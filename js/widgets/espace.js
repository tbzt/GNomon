"use strict";

/* ============================================================
   L'ESPACE PARTAGÉ — l'écran qui manquait.
   ------------------------------------------------------------
   Le moteur était livré et éprouvé — les règles, la découpe en
   documents, la convergence à deux pairs — mais rien ne permettait de
   s'en servir : ni se connecter, ni rattacher un GN, ni lancer un tour.
   Du code juste, et inaccessible.

   ── L'ÉCRAN DIT L'ÉTAT AVANT D'OFFRIR UNE ACTION ──
   Quatre états, et un seul est affiché à la fois : pas configuré · pas
   connecté · connecté mais non rattaché · rattaché. Montrer un bouton
   « Synchroniser » à quelqu'un qui n'est pas connecté produirait une
   erreur qu'on aurait pu éviter en ne l'affichant pas.

   ── LA PROMESSE « 100 % LOCAL » EST RAPPELÉE ICI, PAS AILLEURS ──
   C'est le seul écran d'où un GN peut se mettre à parler à un serveur.
   Il dit donc, en toutes lettres, ce que le rattachement change — et
   notamment que les libellés de casting cessent d'être purement
   locaux, ce qui durcit la règle de pseudonymisation au lieu de
   l'assouplir.

   ── LES CONFLITS SE MONTRENT, TOUJOURS ──
   `synchroniser()` prend le distant pour converger et rend la version
   locale écartée. Si cet écran ne l'affichait pas, la promesse « rien
   n'est détruit » serait fausse : la version serait perdue pour de bon,
   simplement plus tard. Le rapport est donc gardé à l'écran jusqu'au
   tour suivant.
   ============================================================ */
import * as Remote from "../core/remote.js";
import { rattachement, rattacher, detacher, tour } from "../core/espace.js";
import { Utils } from "../core/utils.js";

export const Espace = {
  _hote: null,
  _projets: null,
  _onChange: null,
  _rapport: null,
  _message: null,
  _occupe: false,
  _gnDistants: null, // liste chargée pour l'espace saisi
  _espaceSaisi: "",
  _membres: null,

  monter(hote, projets, { onChange = null } = {}) {
    this._hote = hote;
    this._projets = projets;
    this._onChange = onChange;
    this._rapport = null;
    this._message = null;
    this._gnDistants = null;
    this._membres = null;
    this.rendre();
  },

  demonter() {
    this._hote = null;
  },

  /* ================= rendu ================= */

  rendre() {
    if (!this._hote) return;
    const s = Remote.session();
    this._hote.innerHTML =
      '<div class="es">' +
      this._entete() +
      (!Remote.configure()
        ? this._pasConfigure()
        : !s
          ? this._connexion()
          : this._connecte(s)) +
      (this._message ? `<p class="es-message">${Utils.escHtml(this._message)}</p>` : "") +
      (this._rapport ? this._rendreRapport(this._rapport) : "") +
      "</div>";
    this._brancher();
  },

  _entete() {
    return (
      '<div class="es-entete">' +
      "<h1>L'espace partagé</h1>" +
      '<p class="es-note">Écrire un GN à plusieurs. Tant qu\'un GN n\'est pas rattaché, ' +
      "il ne parle à personne : la promesse « tout reste sur cet appareil » vaut pour tous les autres.</p>" +
      "</div>"
    );
  },

  _pasConfigure() {
    return (
      '<div class="es-bloc">' +
      '<p class="es-etat">Aucun espace n\'est configuré sur cette installation.</p>' +
      "<p class=\"es-aide\">Il manque l'adresse de la base et la clé d'API dans " +
      "<code>js/core/config.js</code>. Ces deux valeurs sont publiques par nature — ce qui protège " +
      "les GN, ce sont les règles appliquées côté serveur, pas le secret de la configuration.</p>" +
      "<p class=\"es-aide\">Sans elles, GNomon reste ce qu'il est par défaut : entièrement local.</p>" +
      "</div>"
    );
  },

  _connexion() {
    return (
      '<div class="es-bloc">' +
      '<p class="es-etat">Vous n\'êtes pas connecté.</p>' +
      '<div class="es-form">' +
      '<label class="champ"><span class="champ-label">Adresse e-mail</span>' +
      '<input type="email" id="es-email" autocomplete="username" placeholder="vous@exemple.org" /></label>' +
      '<label class="champ"><span class="champ-label">Mot de passe</span>' +
      '<input type="password" id="es-mdp" autocomplete="current-password" /></label>' +
      `<button type="button" id="es-connecter"${this._occupe ? " disabled" : ""}>Se connecter</button>` +
      "</div>" +
      "<p class=\"es-aide\">Un compte ne se crée pas ici : c'est un membre de l'espace qui vous invite, " +
      "et vous choisissez votre mot de passe depuis le courriel reçu. Personne dans l'équipe ne le voit.</p>" +
      "</div>"
    );
  },

  _connecte(s) {
    const projetId = this._projets.actif();
    const r = rattachement(projetId);
    return (
      '<div class="es-bloc">' +
      '<p class="es-etat">Connecté — <b>' + Utils.escHtml(s.email) + "</b>" +
      '<button type="button" id="es-deconnecter" class="es-lien">Se déconnecter</button></p>' +
      "</div>" +
      (r ? this._rattache(r) : this._aRattacher())
    );
  },

  /** Le GN parle déjà à un espace : on montre à qui, et on agit. */
  _rattache(r) {
    return (
      '<div class="es-bloc">' +
      '<p class="es-sous">Ce GN est rattaché</p>' +
      '<p class="es-lien-gn"><span>espace</span> <b>' + Utils.escHtml(r.espace) + "</b>" +
      ' · <span>GN</span> <b>' + Utils.escHtml(r.gn) + "</b></p>" +
      '<div class="es-actions">' +
      `<button type="button" id="es-sync" class="es-principal"${this._occupe ? " disabled" : ""}>` +
      `${this._occupe ? "Synchronisation…" : "Synchroniser maintenant"}</button>` +
      `<button type="button" id="es-garde"${this._occupe ? " disabled" : ""}>Vérifier la garde</button>` +
      '<button type="button" id="es-detacher">Détacher</button>' +
      "</div>" +
      "<p class=\"es-aide\">Détacher ne touche pas au GN : il reste entier sur cet appareil, " +
      "il cesse seulement de parler à la base.</p>" +
      "</div>" +
      this._blocMembres(r.espace)
    );
  },

  /** Le GN est local : on choisit un espace, puis un GN dedans. */
  _aRattacher() {
    return (
      '<div class="es-bloc">' +
      '<p class="es-sous">Rattacher ce GN à un espace</p>' +
      '<div class="es-form es-form-ligne">' +
      '<label class="champ"><span class="champ-label">Nom de l\'espace</span>' +
      `<input type="text" id="es-nom" value="${Utils.escHtml(this._espaceSaisi)}" placeholder="le-nom-convenu" /></label>` +
      `<button type="button" id="es-ouvrir"${this._occupe ? " disabled" : ""}>Ouvrir</button>` +
      "</div>" +
      "<p class=\"es-aide\">Un espace ne se crée pas depuis le web — les règles l'interdisent. " +
      "Celui qui l'a créé vous a donné son nom, et vous a inscrit dans ses membres.</p>" +
      (this._gnDistants ? this._listeGn() : "") +
      "</div>" +
      '<div class="es-bloc es-avert">' +
      "<p class=\"es-sous\">Ce que le rattachement change</p>" +
      "<p class=\"es-aide\">Le GN — personnages, trames, informations, carnets privés, consignes PNJ — " +
      "part sur un serveur tiers, lisible des seuls membres de l'espace. " +
      "<b>Les libellés de casting aussi.</b> La pseudonymisation cesse donc d'être un confort : " +
      "c'est le moment de vérifier qu'aucun nom réel n'y figure.</p>" +
      "</div>"
    );
  },

  _listeGn() {
    const l = this._gnDistants;
    return (
      '<p class="es-sous es-sous-serre">Les GN de cet espace</p>' +
      (l.length
        ? '<ul class="es-gn">' +
          l
            .map(
              (g) =>
                `<li><button type="button" data-gn="${Utils.escHtml(g.id)}">` +
                `<span>${Utils.escHtml(g.nom || g.id)}</span>` +
                `<i>révision ${g.rev}</i></button></li>`,
            )
            .join("")
        : '<ul class="es-gn"><li class="es-vide">Aucun GN dans cet espace pour l\'instant.</li></ul>') +
      "</ul>" +
      '<div class="es-form es-form-ligne">' +
      '<label class="champ"><span class="champ-label">…ou en déposer un nouveau</span>' +
      '<input type="text" id="es-neuf" placeholder="identifiant-du-gn" /></label>' +
      `<button type="button" id="es-deposer"${this._occupe ? " disabled" : ""}>Déposer</button>` +
      "</div>" +
      "<p class=\"es-aide\">Déposer envoie le GN ouvert dans l'espace, sous cet identifiant. " +
      "Choisissez-en un sans espace ni accent — il sert de nom de branche.</p>"
    );
  },

  _blocMembres(espace) {
    if (!this._membres) {
      return (
        '<div class="es-bloc">' +
        '<p class="es-sous">Les membres</p>' +
        `<button type="button" id="es-membres"${this._occupe ? " disabled" : ""}>Voir qui a accès</button>` +
        "</div>"
      );
    }
    return (
      '<div class="es-bloc">' +
      '<p class="es-sous">Les membres</p>' +
      '<ul class="es-membres">' +
      this._membres
        .map(
          (m) =>
            `<li><code>${Utils.escHtml(m.uid)}</code>` +
            (m.gerant ? '<span class="es-gerant">gérant</span>' : "") +
            (m.gerant
              ? ""
              : `<button type="button" class="es-lien" data-retirer="${Utils.escHtml(m.uid)}">Retirer</button>`) +
            "</li>",
        )
        .join("") +
      "</ul>" +
      "<p class=\"es-aide\">Un gérant ne peut pas être retiré — sans cette exception, un membre " +
      "pourrait verrouiller le propriétaire dehors.</p>" +
      '<div class="es-form es-form-ligne">' +
      '<label class="champ"><span class="champ-label">Inviter une adresse</span>' +
      '<input type="email" id="es-invite" placeholder="quelquun@exemple.org" /></label>' +
      `<button type="button" id="es-inviter"${this._occupe ? " disabled" : ""}>Inviter</button>` +
      "</div>" +
      "<p class=\"es-aide\">L'invitation crée le compte si besoin, puis envoie un courriel pour " +
      "choisir un mot de passe — que nous ne voyons jamais. Si l'adresse a déjà un compte, " +
      "demandez son identifiant à la personne et ajoutez-le ci-dessous.</p>" +
      '<div class="es-form es-form-ligne">' +
      '<label class="champ"><span class="champ-label">…ou ajouter un identifiant connu</span>' +
      '<input type="text" id="es-uid" placeholder="uid" /></label>' +
      `<button type="button" id="es-ajouter"${this._occupe ? " disabled" : ""}>Ajouter</button>` +
      "</div>" +
      `<input type="hidden" id="es-espace-courant" value="${Utils.escHtml(espace)}" />` +
      "</div>"
    );
  },

  /** Le rapport d'un tour. Les conflits d'abord : c'est la seule partie
      qui demande une décision humaine, et la version locale écartée n'a
      pas d'autre endroit où exister. */
  _rendreRapport(r) {
    if (!r.ok && r.raison)
      return `<div class="es-bloc es-rapport"><p class="es-etat ko">${Utils.escHtml(r.raison)}</p></div>`;

    const chiffres = [
      `${r.pousses} ${Utils.plur(r.pousses, "envoyé")}`,
      `${r.tires} ${Utils.plur(r.tires, "reçu")}`,
      r.tombes ? `${r.tombes} ${Utils.plur(r.tombes, "suppression")}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      '<div class="es-bloc es-rapport">' +
      '<p class="es-sous">Dernier tour</p>' +
      `<p class="es-chiffres">${chiffres}</p>` +
      (r.conflits.length
        ? '<p class="es-sous es-sous-serre ko">' +
          `${r.conflits.length} ${Utils.plur(r.conflits.length, "conflit")}</p>` +
          "<p class=\"es-aide\">La version de l'autre a été retenue pour que tout le monde converge. " +
          "<b>La vôtre est ci-dessous, entière</b> — rien n'est détruit, mais rien ne la remettra " +
          "en place à votre place.</p>" +
          '<ul class="es-conflits">' +
          r.conflits
            .map(
              (c) =>
                `<li><p class="es-conflit-chemin">${Utils.escHtml(c.chemin)}` +
                `<span>${Utils.escHtml(c.cause || "")}</span></p>` +
                `<pre>${Utils.escHtml(JSON.stringify(c.local, null, 1))}</pre></li>`,
            )
            .join("") +
          "</ul>"
        : '<p class="es-aide ok">Aucun conflit.</p>') +
      (r.refus.length ? this._rendreRefus(r.refus) : "") +
      "</div>"
    );
  },

  /** ── LES REFUS SE GROUPENT PAR CAUSE ──
      Trouvé en lançant un vrai tour avec un jeton périmé : la base a
      refusé les soixante-trois documents, et l'écran a affiché
      soixante-trois lignes identiques. La seule chose à savoir — « ce
      compte n'est pas membre » — était noyée dans sa propre répétition.

      Une cause systémique se dit UNE fois, avec le nombre. On ne nomme
      les chemins que lorsqu'ils sont peu nombreux : là, ils désignent
      un vrai problème par document, et c'est alors qu'ils servent. */
  _rendreRefus(refus) {
    const parCause = new Map();
    for (const x of refus) {
      if (!parCause.has(x.raison)) parCause.set(x.raison, []);
      parCause.get(x.raison).push(x.chemin);
    }

    return (
      '<p class="es-sous es-sous-serre ko">Refusés par la base</p>' +
      '<ul class="es-refus">' +
      [...parCause.entries()]
        .map(([raison, chemins]) => {
          const n = chemins.length;
          return (
            "<li>" +
            `<b>${n} ${Utils.plur(n, "document")} ${Utils.plur(n, "refusé")}</b> — ${Utils.escHtml(raison)}` +
            (n <= 5
              ? `<span class="es-refus-chemins">${chemins.map((c) => Utils.escHtml(c)).join(" · ")}</span>`
              : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>" +
      "<p class=\"es-aide\">Un refus n'arrête pas le tour : les autres documents sont passés. " +
      "Si la cause est une révision dépassée, relancer suffit — la lecture remet les compteurs " +
      "à l'heure. Si c'est l'appartenance, relancer n'y changera rien : il faut être inscrit " +
      "dans les membres de l'espace.</p>"
    );
  },

  /* ================= câblage ================= */

  _brancher() {
    const q = (id) => this._hote.querySelector(id);
    const sur = (id, fn) => {
      const el = q(id);
      if (el) el.addEventListener("click", fn);
    };

    sur("#es-connecter", () => this._connecterMoi());
    sur("#es-deconnecter", () => {
      Remote.deconnecter();
      this._rapport = null;
      this._membres = null;
      this._dire("Déconnecté.");
    });
    sur("#es-ouvrir", () => this._ouvrirEspace());
    sur("#es-deposer", () => this._deposer());
    sur("#es-sync", () => this._synchroniser());
    sur("#es-garde", () => this._verifierGarde());
    sur("#es-detacher", () => this._detacher());
    sur("#es-membres", () => this._chargerMembres());
    sur("#es-inviter", () => this._inviter());
    sur("#es-ajouter", () => this._ajouterUid());

    for (const b of this._hote.querySelectorAll("[data-gn]"))
      b.addEventListener("click", () => this._choisirGn(b.dataset.gn));
    for (const b of this._hote.querySelectorAll("[data-retirer]"))
      b.addEventListener("click", () => this._retirer(b.dataset.retirer));

    // Entrée vaut connexion : c'est le formulaire le plus utilisé.
    const mdp = q("#es-mdp");
    if (mdp)
      mdp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._connecterMoi();
      });
  },

  /* ================= actions =================
     Toutes passent par `_faire`, qui tient l'état « occupé » et
     rattrape l'erreur. Sans ça, un double clic lancerait deux tours de
     synchronisation concurrents sur le même GN — et une erreur réseau
     laisserait l'écran figé sur « Synchronisation… ». */

  async _faire(fn, succes = null) {
    if (this._occupe) return;
    this._occupe = true;
    this._message = null;
    this.rendre();
    try {
      const r = await fn();
      if (succes) this._message = typeof succes === "function" ? succes(r) : succes;
    } catch (e) {
      this._message = e.message || "Quelque chose n'a pas fonctionné.";
    } finally {
      this._occupe = false;
      this.rendre();
      if (this._onChange) this._onChange();
    }
  },

  _dire(msg) {
    this._message = msg;
    this.rendre();
    if (this._onChange) this._onChange();
  },

  _connecterMoi() {
    const email = (this._hote.querySelector("#es-email") || {}).value || "";
    const mdp = (this._hote.querySelector("#es-mdp") || {}).value || "";
    if (!email.trim() || !mdp) return this._dire("Adresse et mot de passe sont nécessaires.");
    this._faire(() => Remote.connecter(email.trim(), mdp), "Connecté.");
  },

  _ouvrirEspace() {
    const nom = ((this._hote.querySelector("#es-nom") || {}).value || "").trim();
    if (!nom) return this._dire("Donnez le nom de l'espace.");
    this._espaceSaisi = nom;
    this._faire(async () => {
      // On vérifie l'appartenance AVANT de lister : « vous n'êtes pas
      // membre » est une phrase plus utile qu'une liste vide.
      if (!(await Remote.accessible(nom))) {
        this._gnDistants = null;
        throw new Error("Ce compte n'est pas membre de cet espace — ou l'espace n'existe pas.");
      }
      this._gnDistants = await Remote.listeGn(nom);
    });
  },

  _choisirGn(gn) {
    const projetId = this._projets.actif();
    rattacher(projetId, this._espaceSaisi, gn);
    this._gnDistants = null;
    this._dire(`Ce GN est rattaché à « ${this._espaceSaisi} » / ${gn}. Synchronisez pour échanger.`);
  },

  /** Déposer, c'est poser la méta puis rattacher — le premier tour de
      synchronisation enverra le contenu. On ne pousse rien ici : c'est
      `sync.js` qui sait quoi envoyer, et il n'a pas à être doublé. */
  _deposer() {
    const gn = ((this._hote.querySelector("#es-neuf") || {}).value || "").trim();
    if (!gn) return this._dire("Donnez un identifiant pour ce GN.");
    if (/[\s.#$/[\]]/.test(gn))
      return this._dire("Cet identifiant ne peut pas servir de branche : évitez espaces, points et / # $ [ ].");
    const projetId = this._projets.actif();
    const nom = this._projets.resume(projetId).titre || gn;
    this._faire(async () => {
      await Remote.poserMeta(this._espaceSaisi, gn, nom, 0);
      rattacher(projetId, this._espaceSaisi, gn);
      this._gnDistants = null;
    }, `Déposé sous « ${gn} ». Lancez une synchronisation pour envoyer le contenu.`);
  },

  _synchroniser() {
    const projetId = this._projets.actif();
    this._faire(async () => {
      const r = await tour(projetId);
      this._rapport = r;
      return r;
    });
  },

  _verifierGarde() {
    const projetId = this._projets.actif();
    const r = rattachement(projetId);
    this._faire(async () => {
      // On éprouve la garde sur un chemin quelconque et à sa révision
      // actuelle : l'écriture doit être refusée, et rien n'est abîmé
      // puisqu'on réécrirait la même valeur.
      const tous = await Remote.lireTout(r.espace, r.gn);
      const chemin = Object.keys(tous)[0];
      if (!chemin)
        throw new Error("Rien à distance pour l'instant : synchronisez d'abord, puis revérifiez.");
      const ok = await Remote.garde(r.espace, r.gn, chemin, Number(tous[chemin].rev) || 0);
      if (ok === false)
        throw new Error("LA GARDE N'EST PAS EN PLACE : deux personnes peuvent s'écraser. Déployez firebase.rules.json.");
      return ok;
    }, "La garde est en place : la base refuse bien une révision qui n'est pas la suivante.");
  },

  _detacher() {
    const projetId = this._projets.actif();
    if (!confirm("Détacher ce GN de son espace ?\n\nLe GN reste entier sur cet appareil ; il cesse seulement d'échanger."))
      return;
    detacher(projetId);
    this._rapport = null;
    this._membres = null;
    this._dire("Détaché. Ce GN ne parle plus à personne.");
  },

  _chargerMembres() {
    const r = rattachement(this._projets.actif());
    this._faire(async () => {
      this._membres = await Remote.membres(r.espace);
    });
  },

  _inviter() {
    const email = ((this._hote.querySelector("#es-invite") || {}).value || "").trim();
    const r = rattachement(this._projets.actif());
    if (!email) return this._dire("Donnez une adresse.");
    this._faire(async () => {
      let uid = null;
      try {
        uid = await Remote.creerCompte(email);
      } catch (e) {
        // Adresse déjà connue : ce n'est pas une panne. Rien côté
        // client ne permet de retrouver un identifiant depuis une
        // adresse — c'est à la personne de le donner.
        if (e.code !== "EMAIL_EXISTS") throw e;
        throw new Error(
          "Cette adresse a déjà un compte. Demandez-lui son identifiant et ajoutez-le ci-dessous.",
        );
      }
      await Remote.ajouterMembre(r.espace, uid);
      await Remote.inviter(email, location.href);
      this._membres = await Remote.membres(r.espace);
    }, `Invitation envoyée à ${email}.`);
  },

  _ajouterUid() {
    const uid = ((this._hote.querySelector("#es-uid") || {}).value || "").trim();
    const r = rattachement(this._projets.actif());
    if (!uid) return this._dire("Donnez un identifiant.");
    this._faire(async () => {
      await Remote.ajouterMembre(r.espace, uid);
      this._membres = await Remote.membres(r.espace);
    }, "Membre ajouté.");
  },

  _retirer(uid) {
    const r = rattachement(this._projets.actif());
    if (!confirm(`Retirer ${uid} de l'espace ?\n\nCette personne perdra l'accès à tous les GN qui s'y trouvent.`))
      return;
    this._faire(async () => {
      await Remote.retirerMembre(r.espace, uid);
      this._membres = await Remote.membres(r.espace);
    }, "Membre retiré.");
  },
};
