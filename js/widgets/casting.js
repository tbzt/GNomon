"use strict";

/* ============================================================
   CASTING — l'écran des vœux et de l'affectation.
   ------------------------------------------------------------
   Une grille candidatures × personnages, où une case se règle au clic
   (rien → j'adore → volontiers → j'accepte → surtout pas → rien), et
   un bouton qui résout le problème d'assignation exactement.

   ── L'AVERTISSEMENT N'EST PAS DÉCORATIF ──
   L'écran dit en toutes lettres ce que le store fait : il ne garde
   qu'un libellé, l'import ignore toutes les autres colonnes, et
   l'organisation garde chez elle la correspondance avec les personnes.
   Une application locale sans serveur ni chiffrement n'est pas un
   endroit pour de la donnée de santé — le dire est la moitié de la
   protection ; l'autre moitié est le bouton de pseudonymisation, à
   portée de clic au moment de l'import.

   ── L'ALGORITHME PROPOSE, L'ORGANISATION DISPOSE ──
   L'affectation calculée est *posée*, pas *imposée* : chaque ligne a un
   sélecteur qui permet de la corriger à la main. Kröger le rappelle —
   quand on connaît les règles, on peut les briser.
   ============================================================ */
import { RANGS } from "../core/castingstore.js";
import { bilan, caster, coutDe } from "../core/bilancasting.js";
import { heure } from "../core/temps.js";
import { Utils } from "../core/utils.js";
import { sieges as siegesDe, anomalies, continu, comptes } from "../core/epoques.js";

const SIGNE = { 3: "★", 2: "◆", 1: "○", veto: "✕", 0: "·" };
const LIBELLE = { ...RANGS, veto: "Surtout pas", 0: "Rien d'exprimé" };

export const Casting = {
  _hote: null,
  _casting: null,
  _reseau: null,
  _trames: null,
  _import: false,
  _brut: "",
  _sig: "",

  monter(hote, casting, reseau, trames, monde = null) {
    this._hote = hote;
    this._casting = casting;
    this._reseau = reseau;
    this._trames = trames;
    // Facultatif : sert seulement à signaler une époque non déclarée.
    this._monde = monde;
    this.rendre();
  },

  /** ── LA GRILLE NE SE RECONSTRUIT PAS À CHAQUE VŒU ──
      Cinquante-cinq candidatures sur quarante rôles font 2 200 cases, et
      c'est un écran où l'on clique deux mille fois. `rendre()`
      réécrivait tout : le conteneur `.scroll-x` devenait un nœud neuf et
      son défilement repartait de zéro. Mesuré : scrollLeft 251 → 0 à
      chaque case. On règle un vœu, on est renvoyé à la première colonne,
      on re-défile pour atteindre la suivante.

      Même discipline que le tableau du réseau (§6) : la signature ne
      porte que la STRUCTURE — quelles candidatures, quels rôles, l'état
      des panneaux — jamais les vœux ni l'affectation, qui sont
      précisément ce qu'on modifie. */
  _signature() {
    return [
      this._casting.candidatures().map((c) => c.id).join(","),
      this._reseau.pj().map((p) => `${p.id}:${p.nom}`).join(","),
      this._import ? "import" : "-",
      Object.keys(this._casting.affectation()).length ? "bilan" : "-",
    ].join("|");
  },

  rafraichir() {
    if (!this._hote || !this._hote.querySelector("td.cell")) return this.rendre();
    if (this._signature() !== this._sig) return this.rendre();

    const aff = this._casting.affectation();
    for (const td of this._hote.querySelectorAll("td.cell")) {
      const e = this._casting.etatVoeu(td.dataset.k, td.dataset.p);
      const tenu = aff[td.dataset.k] === td.dataset.p;
      const p = this._reseau.personnage(td.dataset.p);
      td.className = `cell v-${e}${tenu ? " tenu" : ""}`;
      td.textContent = SIGNE[e];
      td.title = `${p ? p.nom : "?"} — ${LIBELLE[e]}${tenu ? " · attribué" : ""}`;
    }
    // Le sélecteur de rôle de chaque ligne suit l'affectation — sauf
    // celui qu'on est en train d'ouvrir.
    const actif = document.activeElement;
    for (const sel of this._hote.querySelectorAll("[data-role]")) {
      if (sel === actif) continue;
      const v = aff[sel.dataset.role] || "";
      if (sel.value !== v) sel.value = v;
    }
    // Le bilan est dérivé de l'affectation : il se refait entier, mais
    // il vit SOUS la grille et ne porte aucune saisie.
    const bilan = this._hote.querySelector(".cast-bilan");
    if (bilan && Object.keys(aff).length) {
      const neuf = document.createElement("div");
      neuf.innerHTML = this._bilan();
      const remplacant = neuf.firstElementChild;
      if (remplacant) bilan.replaceWith(remplacant);
    }
  },

  rendre() {
    const cands = this._casting.candidatures();
    const roles = this._reseau.pj();

    this._hote.innerHTML =
      '<div class="casting">' +
      this._barre(cands, roles) +
      (this._import ? this._panneauImport() : "") +
      (cands.length && roles.length
        ? `<div class="scroll-x">${this._grille(cands, roles)}</div>`
        : `<p class="vide">${
            roles.length
              ? "Aucune candidature. Importez un feuillet, ou ajoutez-en une à la main."
              : "Aucun PJ dans le réseau — il n'y a rien à distribuer."
          }</p>`) +
      (Object.keys(this._casting.affectation()).length ? this._bilan() : "") +
      this._sieges() +
      "</div>";

    this._brancher();
    this._sig = this._signature();
  },

  _barre(cands, roles) {
    return (
      '<div class="cast-barre">' +
      `<p class="carnet-titre">Les vœux<span class="carnet-aide">${cands.length} ${Utils.plur(cands.length, "candidature")} · ${roles.length} ${Utils.plur(roles.length, "rôle")}</span></p>` +
      '<span class="cast-actions">' +
      '<button type="button" id="cast-import">Importer…</button>' +
      '<button type="button" id="cast-ajout">+ Candidature</button>' +
      `<button type="button" id="cast-lancer"${cands.length && roles.length ? "" : " disabled"}>Caster</button>` +
      (Object.keys(this._casting.affectation()).length
        ? '<button type="button" id="cast-effacer">Effacer</button>'
        : "") +
      "</span></div>" +
      '<p class="cast-garde"><b>Aucune donnée personnelle ici.</b> Ce store ne garde qu\'un libellé : ' +
      "l'import ignore toutes les autres colonnes, et rien n'est chiffré. Santé, allergies, " +
      "contacts d'urgence, lignes et voiles restent dans votre tableur — pas dans un " +
      "<code>localStorage</code>.</p>"
    );
  },

  _panneauImport() {
    const ap = this._brut ? this._casting.apercu(this._brut) : null;
    return (
      '<div class="cast-import">' +
      '<p class="champ-label">Collez un feuillet (CSV, TSV, ou une colonne de noms)</p>' +
      `<textarea rows="5" id="cast-brut" placeholder="Nom;Courriel;Régime…">${Utils.escHtml(this._brut)}</textarea>` +
      (ap
        ? '<div class="cast-apercu"><p class="champ-label">Quelle colonne sert de libellé ?</p>' +
          '<div class="cast-cols">' +
          (ap.entetes.length ? ap.entetes : (ap.lignes[0] || []))
            .map(
              (e, i) =>
                `<button type="button" class="cast-col" data-col="${i}">${Utils.escHtml(e || `colonne ${i + 1}`)}</button>`,
            )
            .join("") +
          "</div>" +
          '<label class="bascule"><input type="checkbox" id="cast-pseudo" checked /> ' +
          "Pseudonymiser (« Joueur 1 », « Joueur 2 »…)</label>" +
          '<p class="cast-note">Seule la colonne choisie est lue. Les autres ne sont ' +
          "jamais écrites — ni ici, ni ailleurs.</p></div>"
        : '<p class="cast-note">Collez le contenu pour choisir la colonne.</p>') +
      '<button type="button" id="cast-fermer">Fermer</button>' +
      "</div>"
    );
  },

  _grille(cands, roles) {
    const cols = roles
      .map((p) => `<th title="${Utils.escHtml(p.nom)}">${Utils.escHtml(p.nom.split(" ").slice(-1)[0])}</th>`)
      .join("");

    const lignes = cands
      .map((c) => {
        const attribue = this._casting.roleDe(c.id);
        const cells = roles
          .map((p) => {
            const e = this._casting.etatVoeu(c.id, p.id);
            const tenu = attribue === p.id;
            return (
              `<td class="cell v-${e}${tenu ? " tenu" : ""}" data-k="${c.id}" data-p="${p.id}" ` +
              `role="button" tabindex="0" title="${Utils.escHtml(p.nom)} — ${LIBELLE[e]}${tenu ? " · attribué" : ""}">` +
              `${SIGNE[e]}</td>`
            );
          })
          .join("");
        const opts = roles
          .map(
            (p) =>
              `<option value="${p.id}"${attribue === p.id ? " selected" : ""}>${Utils.escHtml(p.nom)}</option>`,
          )
          .join("");
        return (
          "<tr>" +
          '<th class="cast-cell">' +
          `<input class="cast-label" data-label="${c.id}" value="${Utils.escHtml(c.label)}" aria-label="Libellé" />` +
          '<span class="cast-dispo">présent ' +
          `<input type="number" step="0.5" data-arr="${c.id}" value="${c.arrivee ?? ""}" placeholder="dès" aria-label="Heure d'arrivée" /> → ` +
          `<input type="number" step="0.5" data-dep="${c.id}" value="${c.depart ?? ""}" placeholder="jusqu'à" aria-label="Heure de départ" /></span>` +
          `<select class="cast-role" data-role="${c.id}"><option value="">— aucun rôle —</option>${opts}</select>` +
          `<button type="button" class="cast-x" data-suppr="${c.id}" title="Retirer">✕</button>` +
          "</th>" +
          cells +
          "</tr>"
        );
      })
      .join("");

    return `<table class="matrice casting-grille"><thead><tr><th>Candidature</th>${cols}</tr></thead><tbody>${lignes}</tbody></table>`;
  },

  /* ================= le bilan ================= */

  _bilan() {
    const b = bilan(this._casting, this._reseau, this._trames);
    const n = (a) => a.length;
    const exauces = [3, 2, 1].map((r) => `${n(b.rangs[r])} × ${RANGS[r]}`).join(" · ");

    return (
      '<section class="cast-bilan">' +
      `<p class="fr-bandeau-titre">Bilan du casting<span>${b.castes} sur ${b.total} ${Utils.plur(b.total, "candidature")} · ${b.roles} ${Utils.plur(b.roles, "rôle")}` +
      (this._casting.dateAffectation() ? ` · ${this._casting.dateAffectation()}` : "") +
      "</span></p>" +
      '<p class="cast-rangs">' +
      `${exauces} · <span class="tiede">${n(b.rangs[0])} sans vœu exprimé</span>` +
      (n(b.rangs.veto) ? ` · <span class="grave">${n(b.rangs.veto)} veto imposé</span>` : "") +
      "</p>" +
      this._bandeau(
        "grave",
        b.rangs.veto.map(
          (x) =>
            `<b>${Utils.escHtml(x.candidature.label)}</b> a reçu ${Utils.escHtml(x.personnage.nom)}, qu'il refusait`,
        ),
        "Veto imposé",
        "l'appariement n'avait pas d'autre solution — à corriger à la main",
      ) +
      this._bandeau(
        "grave",
        b.horsDispo.map(
          (x) =>
            `<b>${Utils.escHtml(x.candidature.label)}</b> tient ${Utils.escHtml(x.personnage.nom)}, dont ` +
            `${x.scenes.length} ${Utils.plur(x.scenes.length, "scène")} ${Utils.plur(x.scenes.length, "tombe", "nt")} hors de sa présence ` +
            `(${x.scenes.map((s) => `${Utils.escHtml(s.titre || "sans titre")} à ${heure(s.debut)}`).join(", ")})`,
        ),
        "Hors disponibilité",
        "le rôle a des scènes quand la personne n'est pas là",
      ) +
      this._bandeau(
        "tiede",
        b.desaccords.map(
          (d) =>
            `<b>${Utils.escHtml(d.enthousiaste.personnage.nom)}</b> (${Utils.escHtml(d.enthousiaste.candidature.label)}, enthousiaste) ` +
            `et <b>${Utils.escHtml(d.tiede.personnage.nom)}</b> (${Utils.escHtml(d.tiede.candidature.label)}, tiède) ` +
            "sont liés en miroir",
        ),
        "Miroir désaccordé",
        "le miroir veut que l'intrigue pèse autant des deux côtés — là, elle penchera",
      ) +
      this._bandeau(
        "neutre",
        [
          ...b.sansJoueur.map((p) => `<b>${Utils.escHtml(p.nom)}</b> n'a personne`),
          ...b.sansRole.map((c) => `<b>${Utils.escHtml(c.label)}</b> n'a pas de rôle`),
        ],
        "Déséquilibre",
        "il y a plus de rôles que de joueurs, ou l'inverse",
      ) +
      "</section>"
    );
  },

  _bandeau(classe, items, titre, sous) {
    if (!items.length) return "";
    return (
      `<div class="cast-bloc ${classe}"><p class="cast-bloc-titre">${titre}<span>${sous}</span></p><ul>` +
      items.map((t) => `<li>${t}</li>`).join("") +
      "</ul></div>"
    );
  },

  /* ================= câblage ================= */

  /* ================= Sièges =================
     Un siège est la place qu'une personne réelle occupe : la suite des
     incarnations qu'elle jouera. Il ne concerne que les GN à plusieurs
     époques, et le panneau ne s'affiche pas ailleurs.

     Ce qu'on montre d'abord, ce sont les ANOMALIES — un même rôle
     revendiqué par deux sièges, un joueur à deux endroits le même soir.
     Ce sont des erreurs qui ne se voient pas en lisant les fiches : on
     les découvre au casting, quand deux personnes se présentent au même
     costume. Les afficher ici, c'est les découvrir six mois plus tôt. */

  _sieges() {
    const S = siegesDe(this._reseau);
    const ecarts = anomalies(this._reseau, this._monde || null);
    if (!S.length && !ecarts.length) return "";

    const c = comptes(this._reseau);
    const nom = (id) => this._reseau.personnage(id)?.nom || id;

    const alertes = ecarts.length
      ? '<ul class="sieges-ecarts">' +
        ecarts
          .map((e) => `<li>${Utils.escHtml(e.message)}</li>`)
          .join("") +
        "</ul>"
      : "";

    const liste = S.length
      ? '<ul class="sieges">' +
        S.map((si) => {
          const ids = si.personnageIds || [];
          const genre = continu(this._reseau, si)
            ? '<span class="siege-genre">continu</span>'
            : ids.length > 1
              ? '<span class="siege-genre">change de rôle</span>'
              : "";
          return (
            `<li><span class="siege-nom">${Utils.escHtml(si.nom || si.id)}</span>${genre}` +
            `<span class="siege-gens">${ids.map((i) => Utils.escHtml(nom(i))).join(" → ") || "personne"}</span></li>`
          );
        }).join("") +
        "</ul>"
      : "";

    return (
      '<div class="sieges-bloc"><p class="carnet-titre">Les sièges' +
      `<span class="carnet-aide">${c.sieges} places · ${c.continus} continues · ${c.changements} avec changement de rôle</span></p>` +
      alertes +
      liste +
      "</div>"
    );
  },

  _brancher() {
    const q = (s) => this._hote.querySelectorAll(s);
    const un = (s) => this._hote.querySelector(s);

    un("#cast-import").addEventListener("click", () => {
      this._import = !this._import;
      this.rendre();
    });
    un("#cast-ajout").addEventListener("click", () => this._casting.creer({}));
    un("#cast-lancer").addEventListener("click", () => {
      const map = caster(this._casting, this._reseau, this._trames);
      this._casting.poserAffectation(map);
    });
    const eff = un("#cast-effacer");
    if (eff) eff.addEventListener("click", () => this._casting.effacerAffectation());

    const brut = un("#cast-brut");
    if (brut) {
      brut.addEventListener("input", () => {
        this._brut = brut.value;
      });
      brut.addEventListener("change", () => this.rendre());
    }
    const fermer = un("#cast-fermer");
    if (fermer)
      fermer.addEventListener("click", () => {
        this._import = false;
        this._brut = "";
        this.rendre();
      });
    for (const b of q("[data-col]"))
      b.addEventListener("click", () => {
        const pseudo = un("#cast-pseudo");
        const n = this._casting.importer(this._brut, {
          colonne: Number(b.dataset.col),
          pseudonymiser: !pseudo || pseudo.checked,
        });
        this._import = false;
        this._brut = "";
        this.rendre();
        const st = document.getElementById("statut");
        // Voir `App._statut` : une alarme d'écriture reste au-dessus.
        if (st && !st.classList.contains("danger")) {
          st.textContent = `${n} ${Utils.plur(n, "candidature")} ${Utils.plur(n, "importée")} — seule la colonne choisie a été lue.`;
          st.hidden = false;
        }
      });

    for (const td of q("td.cell")) {
      const go = () => this._casting.cycler(td.dataset.k, td.dataset.p);
      td.addEventListener("click", go);
      td.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    }

    for (const el of q("[data-label]"))
      el.addEventListener("change", (e) =>
        this._casting.maj(el.dataset.label, { label: e.target.value.trim() }),
      );
    for (const el of q("[data-arr]"))
      el.addEventListener("change", (e) =>
        this._casting.maj(el.dataset.arr, {
          arrivee: e.target.value === "" ? null : Number(e.target.value),
        }),
      );
    for (const el of q("[data-dep]"))
      el.addEventListener("change", (e) =>
        this._casting.maj(el.dataset.dep, {
          depart: e.target.value === "" ? null : Number(e.target.value),
        }),
      );
    for (const el of q("[data-role]"))
      el.addEventListener("change", (e) =>
        this._casting.attribuer(el.dataset.role, e.target.value || null),
      );
    for (const b of q("[data-suppr]"))
      b.addEventListener("click", () => {
        if (confirm("Retirer cette candidature ?")) this._casting.supprimer(b.dataset.suppr);
      });
  },
};
