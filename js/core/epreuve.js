"use strict";

/* ============================================================
   ÉPREUVE — vérifier que les règles font ce qu'on croit.
   ------------------------------------------------------------
   ── POURQUOI CE MODULE EXISTE ──
   Une règle qu'on croit posée et qui ne l'est pas **ne se voit pas**.
   Tout marche : on écrit, ça s'enregistre, l'équipe travaille. Le jour
   où deux personnes écrivent en même temps, l'une perd son après-midi —
   et on découvre alors que la garde n'a jamais été là.

   Le seul moyen de le savoir est de tenter ce qui **doit** échouer.
   C'est la doctrine de RecoHero (`guardActive`), généralisée ici à
   toutes les règles qui comptent.

   ── DEUX MOITIÉS, ET ELLES NE SE PROUVENT PAS PAREIL ──
   · `epreuveAnonyme()` — sans compte, donc exécutable par n'importe
     qui, n'importe quand. Elle prouve la chose la plus grave : qu'un
     GN n'est pas lisible du monde entier.
   · `epreuveMembre()` — connecté et membre. Elle prouve le reste : que
     l'appartenance donne bien accès, que la garde anti-écrasement
     mord, qu'on ne peut pas signer à la place d'un autre.

   **L'anonyme seule ne suffit pas**, et il faut le dire : une base
   laissée en « mode verrouillé » par défaut refuse elle aussi tout
   accès anonyme. De l'extérieur, les deux se ressemblent exactement.
   Seule la moitié connectée distingue « mes règles sont en place » de
   « rien n'est en place et personne ne peut travailler ».

   ── ELLE NE TOUCHE À AUCUN VRAI GN ──
   Tout passe par un identifiant de GN réservé (`_epreuve`), écrit puis
   retiré. Un GN qui porterait ce nom serait effacé — d'où le préfixe
   souligné, qu'aucun `_uid()` ne produit.
   ============================================================ */
import { DB, API_KEY } from "./config.js";
import { session, connecter, ecrire } from "./remote.js";
import { Debug } from "./debug.js";

/** L'identifiant de GN réservé à l'épreuve. Aucun `_uid()` ne commence
    par un souligné : la collision est impossible, pas improbable. */
const GN_EPREUVE = "_epreuve";
const CHEMIN = "reseau~personnages/_sonde";

const REFUS = "✅ refusé";
const PASSE = "❌ ACCEPTÉ";

function cas(quoi, refuse, note = "") {
  return { quoi, verdict: refuse ? REFUS : PASSE, ok: refuse, note };
}

/* ================= La moitié anonyme ================= */

/**
 * Sans compte : **tout** doit être refusé. Contrairement à RecoHero, où
 * la lecture des questionnaires est ouverte et doit passer, ici un
 * seul succès serait une fuite — l'archive d'un GN porte les vérités
 * que les joueurs ignorent.
 *
 * Prend un nom d'espace quelconque : il n'a pas besoin d'exister, on
 * teste la porte, pas ce qu'il y a derrière.
 */
export async function epreuveAnonyme(espace = "epreuve") {
  if (!DB) return { ok: false, raison: "Aucune base déclarée dans config.js." };
  const e = encodeURIComponent(espace);
  const J = (o) => ({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(o),
  });

  const essais = [
    ["lire la racine", `${DB}/.json`, undefined],
    ["lister tous les espaces", `${DB}/espaces.json`, undefined],
    ["lire un espace", `${DB}/espaces/${e}.json`, undefined],
    ["lire ses membres", `${DB}/espaces/${e}/membres.json`, undefined],
    ["lire ses gérants", `${DB}/espaces/${e}/gerants.json`, undefined],
    ["lister ses GN", `${DB}/espaces/${e}/gn.json`, undefined],
    ["lire les objets d'un GN", `${DB}/espaces/${e}/gn/gn1/objets.json`, undefined],
    ["lire un personnage", `${DB}/espaces/${e}/gn/gn1/objets/${CHEMIN}.json`, undefined],
    ["se fabriquer un espace", `${DB}/espaces/_intrus.json`, J({ membres: { moi: true } })],
    ["s'ajouter comme membre", `${DB}/espaces/${e}/membres/_intrus.json`, J(true)],
    ["s'ajouter comme gérant", `${DB}/espaces/${e}/gerants/_intrus.json`, J(true)],
    ["écrire un personnage", `${DB}/espaces/${e}/gn/gn1/objets/${CHEMIN}.json`, J({ rev: 1, par: "_intrus", d: {} })],
    ["écrire la méta d'un GN", `${DB}/espaces/${e}/gn/gn1/meta.json`, J({ nom: "X", rev: 1, par: "_intrus" })],
    ["écraser la racine", `${DB}/.json`, J({})],
    ["supprimer un GN entier", `${DB}/espaces/${e}/gn/gn1.json`, { method: "DELETE" }],
  ];

  const resultats = [];
  for (const [quoi, url, opt] of essais) {
    try {
      const r = await fetch(url, opt);
      resultats.push(cas(quoi, !r.ok, `HTTP ${r.status}`));
    } catch (err) {
      resultats.push(cas(quoi, true, "réseau : " + String(err).slice(0, 50)));
    }
  }
  return bilan("anonyme", resultats, {
    reserve:
      "Tout refuser prouve qu'aucun GN n'est lisible du monde — c'est le pire " +
      "danger, et il est écarté. Ça ne prouve PAS que vos règles sont déployées : " +
      "une base laissée en mode verrouillé refuse pareil. Lancez l'épreuve membre.",
  });
}

/* ================= La moitié connectée ================= */

/**
 * Connecté et membre de `espace`. Écrit dans un GN réservé, tente ce
 * qui doit échouer, puis nettoie derrière elle.
 *
 * Le premier cas est le seul qui doive **réussir** : si l'appartenance
 * ne donne pas accès, tout le reste est un faux positif — une base qui
 * refuse tout passerait chacun des autres cas haut la main.
 */
export async function epreuveMembre(espace) {
  if (!DB) return { ok: false, raison: "Aucune base déclarée dans config.js." };
  const moi = session();
  if (!moi) return { ok: false, raison: "Il faut être connecté pour cette épreuve." };
  if (!espace) return { ok: false, raison: "Nommez l'espace à éprouver." };

  const resultats = [];
  const gn = GN_EPREUVE;
  const url = `${DB}/espaces/${encodeURIComponent(espace)}/gn/${gn}/objets/${CHEMIN}.json`;
  /* 1. L'appartenance DONNE accès — le cas qui valide tous les autres. */
  let rev = 0;
  try {
    rev = await ecrire(espace, gn, CHEMIN, { sonde: true }, 0);
    resultats.push({ quoi: "un membre peut écrire", verdict: "✅ accepté", ok: rev === 1, note: `rev ${rev}` });
  } catch (err) {
    resultats.push({
      quoi: "un membre peut écrire",
      verdict: "❌ REFUSÉ",
      ok: false,
      note: String(err.message).slice(0, 90),
    });
    return bilan("membre", resultats, {
      reserve:
        "L'écriture d'un membre est refusée : soit ce compte n'est pas dans " +
        "`membres`, soit les règles ne sont pas celles du dépôt. Rien d'autre " +
        "n'a été tenté — les cas suivants auraient tous « réussi » pour la " +
        "mauvaise raison.",
    });
  }

  /* 2. LA GARDE — réécrire la même révision doit être refusé. C'est
        elle qui empêche deux personnes de s'écraser. */
  resultats.push(
    cas(
      "réécrire la même révision (la garde)",
      !(await passe(url, { rev, par: moi.uid, d: { sonde: "écrasement" } })),
      "c'est le garde-fou anti-écrasement",
    ),
  );

  /* 3. Sauter une révision doit être refusé aussi : sinon on
        contournerait la garde en avançant de deux. */
  resultats.push(
    cas("sauter une révision", !(await passe(url, { rev: rev + 5, par: moi.uid, d: {} }))),
  );

  /* 4. Signer à la place d'un autre. */
  resultats.push(
    cas("signer sous un autre identifiant", !(await passe(url, { rev: rev + 1, par: "quelquun-dautre", d: {} }))),
  );

  /* 5. Greffer un champ hors du modèle (`$autre: false`). */
  resultats.push(
    cas("ajouter un champ inconnu", !(await passe(url, { rev: rev + 1, par: moi.uid, d: {}, injecte: "x" }))),
  );

  /* 6. Toucher aux gérants. */
  const urlGerant = `${DB}/espaces/${encodeURIComponent(espace)}/gerants/${encodeURIComponent(moi.uid)}.json`;
  resultats.push(cas("se déclarer gérant", !(await passe(urlGerant, true))));

  /* 7. La révision suivante, elle, doit passer — sinon la garde
        n'empêcherait pas seulement l'écrasement, mais le travail. */
  try {
    const suivante = await ecrire(espace, gn, CHEMIN, { sonde: "suite" }, rev);
    resultats.push({
      quoi: "la révision suivante passe",
      verdict: "✅ accepté",
      ok: suivante === rev + 1,
      note: `rev ${suivante}`,
    });
  } catch (err) {
    resultats.push({ quoi: "la révision suivante passe", verdict: "❌ REFUSÉ", ok: false, note: String(err.message).slice(0, 80) });
  }

  /* Nettoyage : le GN d'épreuve ne reste pas dans l'espace. */
  try {
    await supprimerBranche(`${DB}/espaces/${encodeURIComponent(espace)}/gn/${gn}.json`);
    resultats.push({ quoi: "nettoyage du GN d'épreuve", verdict: "✅ retiré", ok: true, note: "" });
  } catch (err) {
    resultats.push({
      quoi: "nettoyage du GN d'épreuve",
      verdict: "⚠ à retirer à la main",
      ok: false,
      note: `espaces/${espace}/gn/${gn}`,
    });
  }

  return bilan("membre", resultats);
}

/* ================= Outils ================= */

/** Vrai si l'écriture PASSE. On ne lève pas : ici, réussir est
    l'anomalie, et une exception rendrait le cas illisible. */
async function passe(url, corps) {
  try {
    const t = await jetonBrut();
    const r = await fetch(`${url}?auth=${t}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function supprimerBranche(url) {
  const t = await jetonBrut();
  const r = await fetch(`${url}?auth=${t}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

/** Le jeton courant. `remote.js` garde le sien privé — c'est bien —
    donc on relit celui que `Storage` détient, sans le renouveler : une
    épreuve dure quelques secondes, jamais l'heure d'expiration. */
async function jetonBrut() {
  const { Storage } = await import("./storage.js");
  return (Storage.get("session", null) || {}).idToken || "";
}

function bilan(nom, resultats, { reserve = "" } = {}) {
  const rates = resultats.filter((r) => !r.ok);
  const ok = rates.length === 0;
  Debug[ok ? "log" : "warn"]("espace", `épreuve ${nom}`, { rates: rates.length });
  return {
    ok,
    epreuve: nom,
    total: resultats.length,
    reussis: resultats.length - rates.length,
    resultats,
    reserve,
    resume: ok
      ? `${resultats.length}/${resultats.length} — les règles font ce qu'elles annoncent.`
      : `${rates.length} cas sur ${resultats.length} ne se comportent pas comme prévu.`,
  };
}

/* ================= La connexion ==================
   Un mot de passe ne se tape pas dans une ligne de console : il y
   resterait, en clair, dans l'historique de l'onglet — et l'historique
   d'une console survit au rechargement. D'où une vraie saisie, en
   `type="password"`, dans un `<dialog>` natif : il piège le focus et
   se ferme à Échap sans qu'on ait à le coder.

   Provisoire, et assumé comme tel : c'est l'écran de l'espace qui
   portera ça pour de bon. En attendant, il permet de jouer l'épreuve
   membre sans laisser de trace. Le mot de passe ne traverse pas le
   projet — `connecter()` l'échange contre un jeton et l'oublie. */
export function connexion() {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "ep-connexion";
    d.innerHTML =
      "<form>" +
      "<p class=\"carnet-titre\">Se connecter à l'espace</p>" +
      '<label class="champ"><span class="champ-label">Adresse</span>' +
      '<input type="email" name="email" autocomplete="username" required autofocus /></label>' +
      '<label class="champ"><span class="champ-label">Mot de passe</span>' +
      '<input type="password" name="mdp" autocomplete="current-password" required /></label>' +
      '<p class="ep-erreur" hidden></p>' +
      '<span class="ep-actions">' +
      // ── Annuler est un `type="button"` ──
      // En `submit`, et placé en premier, c'est LUI que la touche Entrée
      // active : on tapait son mot de passe, on validait, et le dialogue
      // se fermait sans avoir rien tenté. Ni erreur, ni succès.
      '<button type="button" data-ep="annuler">Annuler</button>' +
      '<button type="submit" data-ep="ok">Se connecter</button>' +
      "</span></form>";
    document.body.appendChild(d);

    const form = d.querySelector("form");
    const err = d.querySelector(".ep-erreur");
    const ok = d.querySelector('[data-ep="ok"]');

    // ── `rendre` est idempotent ──
    // La version précédente écoutait `close` pour rendre `null`. Or une
    // connexion RÉUSSIE appelle `close()`, donc l'écouteur partait le
    // premier et la promesse rendait `null` alors que la session venait
    // d'être posée. Une seule sortie, une seule fois.
    let fini = false;
    const rendre = (v) => {
      if (fini) return;
      fini = true;
      if (d.open) d.close();
      d.remove();
      resolve(v);
    };

    d.querySelector('[data-ep="annuler"]').addEventListener("click", () => rendre(null));
    // Échap ferme un <dialog> sans passer par nos boutons.
    d.addEventListener("cancel", () => rendre(null));

    form.addEventListener("submit", async (e) => {
      // Toujours, et en premier : un formulaire nu rechargerait la page.
      e.preventDefault();
      err.hidden = true;
      ok.disabled = true;
      ok.textContent = "Connexion…";
      const f = new FormData(form);
      try {
        rendre(await connecter(String(f.get("email")), String(f.get("mdp"))));
      } catch (ex) {
        // On reste ouvert : se tromper de mot de passe ne doit pas
        // obliger à tout retaper, adresse comprise.
        err.textContent = ex.message;
        err.hidden = false;
        ok.disabled = false;
        ok.textContent = "Se connecter";
      }
    });

    d.showModal();
  });
}

/** Une sortie lisible dans la console — c'est là qu'on lira ça. */
export function afficher(bilanEpreuve) {
  if (!bilanEpreuve) return;
  if (bilanEpreuve.raison) return console.warn(bilanEpreuve.raison);
  console.log(`%c${bilanEpreuve.resume}`, "font-weight:bold");
  console.table(
    bilanEpreuve.resultats.map((r) => ({ cas: r.quoi, verdict: r.verdict, note: r.note })),
  );
  if (bilanEpreuve.reserve) console.info(bilanEpreuve.reserve);
}

export const Epreuve = { anonyme: epreuveAnonyme, membre: epreuveMembre, connexion, afficher, session };
