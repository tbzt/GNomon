"use strict";

/* ============================================================
   HARNAIS — un lanceur de tests de cent lignes.
   ------------------------------------------------------------
   Le projet n'a ni build ni `npm` : un lanceur qui en demanderait un
   contredirait sa seule règle d'installation — « on ouvre le fichier,
   ça marche ». Celui-ci s'ouvre donc dans un navigateur, comme
   l'application, et n'a aucune dépendance.

   ── CE QU'ON TESTE, ET POURQUOI CEUX-LÀ ──
   Les modules **purs** : `couverture`, `conscience`, `defection`,
   `temps`, `besoins`, `livret`, `affectation`, `archive`. Ils prennent
   des stores en paramètre et n'en mutent aucun — c'est ce qui les rend
   testables, et c'est du travail déjà payé qu'on ne récoltait pas.

   Les tests les alimentent avec des **stores factices** (`faux.js`)
   plutôt qu'avec les vrais : rien n'est écrit dans le `localStorage`,
   les cas sont montés à la main, et l'exercice **prouve** au passage
   que ces modules ne dépendent de rien d'autre que d'une interface de
   lecture. Si un jour l'un d'eux touchait à un singleton, son test
   casserait immédiatement.

   Ce qui n'est PAS testé ici : le rendu. Il se vérifie dans le
   navigateur, et l'a été à chaque lot.
   ============================================================ */

const suites = [];
let courante = null;

export function suite(nom, fn) {
  courante = { nom, cas: [] };
  suites.push(courante);
  fn();
  courante = null;
}

export function test(nom, fn) {
  if (!courante) throw new Error("test() hors de suite()");
  courante.cas.push({ nom, fn });
}

/* ---- assertions ---- */

class Echec extends Error {}

function faillir(message, attendu, obtenu) {
  const e = new Echec(message);
  e.attendu = attendu;
  e.obtenu = obtenu;
  throw e;
}

export function ok(v, message = "attendu vrai") {
  if (!v) faillir(message, true, v);
}

export function pasOk(v, message = "attendu faux") {
  if (v) faillir(message, false, v);
}

export function eq(obtenu, attendu, message = "égalité") {
  if (obtenu !== attendu) faillir(message, attendu, obtenu);
}

export function eqProfond(obtenu, attendu, message = "égalité profonde") {
  const a = JSON.stringify(attendu);
  const b = JSON.stringify(obtenu);
  if (a !== b) faillir(message, a, b);
}

/** L'assertion la plus utile du projet : une chaîne ne doit PAS être
    là. Elle compare sur le texte dé-balisé et dés-échappé — l'erreur
    déjà commise une fois était de chercher une apostrophe dans du HTML
    où `esc()` l'avait transformée en `&#39;`, ce qui faisait passer le
    test pour la mauvaise raison. */
export function neContientPas(html, aiguille, message = "fuite") {
  const texte = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  if (texte.includes(aiguille)) faillir(`${message} : « ${aiguille} » est présent`, "absent", "présent");
}

export function contient(html, aiguille, message = "présence") {
  const texte = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
  if (!texte.includes(aiguille))
    faillir(`${message} : « ${aiguille} » est absent`, "présent", "absent");
}

/* ---- exécution ---- */

export function lancer() {
  const resultats = [];
  let passes = 0;
  let echecs = 0;
  for (const s of suites) {
    const cas = [];
    for (const c of s.cas) {
      try {
        c.fn();
        cas.push({ nom: c.nom, ok: true });
        passes++;
      } catch (e) {
        cas.push({
          nom: c.nom,
          ok: false,
          message: e.message,
          attendu: e.attendu,
          obtenu: e.obtenu,
          pile: e instanceof Echec ? null : (e.stack || "").split("\n")[1],
        });
        echecs++;
      }
    }
    resultats.push({ suite: s.nom, cas });
  }
  return { resultats, passes, echecs, total: passes + echecs };
}

/** Rendu HTML. Volontairement autonome : la page de tests ne dépend
    pas de la feuille de style de l'application, pour qu'un test reste
    lisible même si la CSS est cassée. */
export function rendre(bilan, hote) {
  const esc = (s) =>
    String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  hote.innerHTML =
    `<p class="bilan ${bilan.echecs ? "ko" : "ok"}">` +
    `${bilan.passes}/${bilan.total} ${bilan.echecs ? `— ${bilan.echecs} en échec` : "— tout passe"}</p>` +
    bilan.resultats
      .map(
        (s) =>
          `<section><h2>${esc(s.suite)}</h2><ul>` +
          s.cas
            .map(
              (c) =>
                `<li class="${c.ok ? "ok" : "ko"}"><span>${c.ok ? "✓" : "✗"}</span>` +
                `<span>${esc(c.nom)}` +
                (c.ok
                  ? ""
                  : `<i>${esc(c.message)}` +
                    (c.attendu !== undefined
                      ? ` — attendu ${esc(c.attendu)}, obtenu ${esc(c.obtenu)}`
                      : "") +
                    (c.pile ? ` ${esc(c.pile.trim())}` : "") +
                    "</i>") +
                "</span></li>",
            )
            .join("") +
          "</ul></section>",
      )
      .join("");
}
