"use strict";

/* ============================================================
   REMOTE — l'espace partagé. Le seul module qui parle à un serveur.
   ------------------------------------------------------------
   Repris de `core/remote.js` de ShadowHerds… non : de **RecoHero**,
   dont c'est le module éprouvé. Copié pour la mécanique — jetons,
   renouvellement silencieux, invitation sans jamais voir le mot de
   passe — et **divergé sur ce qui compte**, voir plus bas.

   Realtime Database, et pas Firestore : son API REST se consomme au
   simple `fetch`, donc la promesse « aucune dépendance, aucune étape de
   build » tient. Rien n'est importé ici qu'un fichier de configuration.

   ── IL PEUT ÊTRE ABSENT SANS QUE RIEN NE CASSE ──
   Deux verrous, et le second survit au premier. Sans `DB` ni `API_KEY`
   dans `config.js`, `configure()` répond faux et aucune requête ne
   part. Et **même une fois ces valeurs remplies**, un GN ne parle à la
   base que s'il est rattaché à un espace — un geste explicite, fait par
   quelqu'un de connecté. Un projet non rattaché est aussi silencieux
   qu'avant.

   C'est ce qui permet à une page publique unique de servir à la fois
   l'outil d'équipe et l'application locale que le README promet : sans
   rattachement, GNomon ne parle à personne.

   ── LA DIVERGENCE, ET ELLE N'EST PAS NÉGOCIABLE ──
   Chez RecoHero, `quizzes/.read` vaut `true` : n'importe qui répond
   sans compte, et c'est le produit. **Ici, la lecture est aussi
   fermée que l'écriture.** L'archive d'un GN contient les vérités que
   les joueurs ignorent, les consignes PNJ et les carnets privés de
   l'équipe : un espace lisible de tous livrerait l'intrigue à qui
   devine le nom de la branche. Lecture et écriture exigent donc
   l'appartenance aux membres, et c'est écrit dans les règles.

   ── LE GARDE-FOU CONTRE L'ÉCRASEMENT ──
   Chaque document porte une révision. Écrire envoie `rev + 1`, et la
   règle exige que ce soit **exactement** le suivant. Deux personnes
   parties de la même version ne peuvent donc pas écrire l'une après
   l'autre : la seconde est refusée par la BASE, pas par notre
   politesse — ce qui protège même d'un défaut de notre côté.

   C'est précisément ce qui manquait au mode « fusionner » de
   l'archive, qui garde la version locale sans savoir laquelle est la
   plus récente.

   ── ET UNE RÈGLE QU'ON CROIT POSÉE NE SE VOIT PAS ──
   D'où `garde()` : on tente une écriture qui **doit** être refusée. Si
   elle passe, la règle est absente, et il faut le savoir avant d'avoir
   confié un GN à une base qui ne protège rien.

   Feuille : ne dépend que de `Storage`, `Debug` et `config.js`.
   ============================================================ */
import { DB, API_KEY } from "./config.js";
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

const SIGN_IN = () => `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const SIGN_UP = () => `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const REFRESH = () => `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`;
const OOB = () => `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`;

/** Le jeton dure une heure. On le renouvelle un peu avant l'échéance :
    à la seconde près, une requête partie juste avant expirerait en vol. */
const MARGE = 5 * 60 * 1000;

export function configure() {
  return Boolean(DB && API_KEY);
}

/* ---- Erreurs ------------------------------------------------------
   Firebase répond des codes en majuscules, utiles au développeur et
   opaques à qui écrit un GN. On traduit les seuls qu'une personne
   réelle rencontre, et on laisse passer le reste tel quel plutôt que
   d'inventer un message qui masquerait la cause. */

const MESSAGES = {
  EMAIL_NOT_FOUND: "Adresse inconnue.",
  INVALID_PASSWORD: "Mot de passe incorrect.",
  INVALID_LOGIN_CREDENTIALS: "Adresse ou mot de passe incorrect.",
  USER_DISABLED: "Ce compte a été désactivé.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Trop de tentatives. Réessayez dans quelques minutes.",
  INVALID_EMAIL: "Cette adresse n'est pas une adresse e-mail.",
  EMAIL_EXISTS: "Cette adresse a déjà un compte.",
  WEAK_PASSWORD: "Mot de passe trop court : six caractères au minimum.",
  MISSING_PASSWORD: "Mot de passe manquant.",
  UNAUTHORIZED_DOMAIN: "Ce domaine n'est pas autorisé dans le projet Firebase.",
  INVALID_CONTINUE_URI: "Adresse de retour invalide.",
};

function lisible(code) {
  return MESSAGES[code] || `La connexion a échoué (${code || "raison inconnue"}).`;
}

export class ConflitError extends Error {
  constructor(chemin, distant) {
    super("Ce document a été modifié depuis que vous l'avez ouvert.");
    this.name = "ConflitError";
    this.chemin = chemin;
    this.distant = distant;
  }
}

export class RefusError extends Error {
  constructor() {
    super("Refusé : ce compte n'est pas membre de cet espace.");
    this.name = "RefusError";
  }
}

/* ---- Session -------------------------------------------------------
   Conservée par `Storage`, sous une clé d'APPAREIL : elle n'appartient
   à aucun GN, ne part pas dans l'archive, et ne suit pas la bascule de
   projet. Le mot de passe n'y entre jamais — seulement le jeton, qui
   expire, et celui qui le renouvelle. */

export function session() {
  const s = Storage.get("session", null);
  return s?.refreshToken ? { email: s.email, uid: s.uid } : null;
}

export function deconnecter() {
  Storage.remove("session");
}

export async function connecter(email, motDePasse) {
  const r = await fetch(SIGN_IN(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse, returnSecureToken: true }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(lisible(String(b?.error?.message || "").split(" ")[0]));
  Storage.set("session", {
    email: b.email,
    uid: b.localId,
    idToken: b.idToken,
    refreshToken: b.refreshToken,
    expire: Date.now() + Number(b.expiresIn || 3600) * 1000,
  });
  return session();
}

/** Un jeton valide, ou `null` si personne n'est connecté. Le
    renouvellement est silencieux : c'est la seule façon qu'une session
    de travail d'une après-midi ne se coupe pas au milieu d'une phrase. */
async function jeton() {
  const s = Storage.get("session", null);
  if (!s?.refreshToken) return null;
  if (s.idToken && Date.now() < s.expire - MARGE) return s.idToken;

  const r = await fetch(REFRESH(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refreshToken }),
  });
  if (!r.ok) {
    // Jeton révoqué, mot de passe changé, compte supprimé : la session
    // n'est plus rattrapable. On la retire plutôt que de la traîner.
    Storage.remove("session");
    return null;
  }
  const b = await r.json();
  Storage.set("session", {
    ...s,
    idToken: b.id_token,
    refreshToken: b.refresh_token,
    expire: Date.now() + Number(b.expires_in || 3600) * 1000,
  });
  return b.id_token;
}

/* ---- Comptes -------------------------------------------------------
   Inviter quelqu'un sans serveur, et sans jamais voir son mot de passe.

   Le compte est créé avec un secret aléatoire qu'on jette aussitôt : il
   n'est ni affiché, ni conservé, ni transmis. La personne reçoit
   ensuite le courriel de réinitialisation de Firebase et choisit le
   sien. Nous ne sommes à aucun moment en possession de ce qui
   l'authentifie.

   Créer un compte est de toute façon ouvert à qui connaît la clé
   publique. Ce qui donne des droits, ce n'est pas d'avoir un compte,
   c'est de figurer dans les membres de l'espace ; et cette liste-là,
   les règles la gardent. */

async function identite(url, corps) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  const d = await r.json();
  if (!r.ok) {
    const code = String(d?.error?.message || "").split(" ")[0];
    const e = new Error(lisible(code));
    e.code = code;
    throw e;
  }
  return d;
}

function secretJetable() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
}

/** Renvoie l'identifiant du compte créé. Lève une erreur de code
    `EMAIL_EXISTS` si l'adresse en a déjà un — cas courant et pas une
    panne : l'appelant demandera alors son identifiant à la personne,
    puisque rien côté client ne permet de le retrouver. */
export async function creerCompte(email) {
  const d = await identite(SIGN_UP(), {
    email,
    password: secretJetable(),
    returnSecureToken: false,
  });
  return d.localId;
}

/** Le modèle de courriel de Firebase n'accepte aucune variable de notre
    cru : le nom de l'espace ne peut pas y figurer. Ce qu'on peut faire,
    c'est ramener la personne au bon endroit une fois son mot de passe
    choisi. Le domaine doit être autorisé dans le projet ; s'il ne l'est
    pas, la demande est refusée en bloc — on la refait alors sans, plutôt
    que de laisser une commodité empêcher l'invitation elle-même. */
export async function inviter(email, retourUrl = null) {
  const base = { requestType: "PASSWORD_RESET", email };
  if (!retourUrl) return identite(OOB(), base);
  try {
    return await identite(OOB(), { ...base, continueUrl: retourUrl });
  } catch (e) {
    if (e.code !== "UNAUTHORIZED_DOMAIN" && e.code !== "INVALID_CONTINUE_URI") throw e;
    Debug.log("espace", "domaine non autorisé : courriel envoyé sans redirection");
    return identite(OOB(), base);
  }
}

/* ---- La base ------------------------------------------------------- */

const enc = encodeURIComponent;

function branche(espace, reste = "") {
  return `${DB}/espaces/${enc(espace)}${reste}.json`;
}

function brancheGn(espace, gn, reste = "") {
  return branche(espace, `/gn/${enc(gn)}${reste}`.replace(/\.json$/, ""));
}

async function appel(url, options = {}) {
  const auth = await jeton();
  if (!auth) throw new Error("Il faut être connecté.");
  const sep = url.includes("?") ? "&" : "?";
  const r = await fetch(`${url}${sep}auth=${auth}`, options);
  if (r.status === 401 || r.status === 403) throw new RefusError();
  if (!r.ok) throw new Error(`La base a répondu ${r.status}.`);
  return r.status === 204 ? null : r.json();
}

/* ---- Membres -------------------------------------------------------
   La liste qui donne le droit d'ouvrir un GN. Lisible des seuls
   membres, et modifiable par eux — sauf pour un gérant, que les règles
   protègent : sans cette exception, un seul membre pourrait verrouiller
   tout le monde dehors, propriétaire compris.

   Créer un espace est impossible depuis le web, et c'est délibéré : la
   branche `membres` d'un espace neuf ne peut être posée que depuis la
   console. Personne ne se fabrique un espace. */

export async function membres(espace) {
  const [liste, gerants] = await Promise.all([
    appel(branche(espace, "/membres")).catch(() => null),
    appel(branche(espace, "/gerants")).catch(() => null),
  ]);
  const proteges = new Set(Object.keys(gerants || {}));
  return Object.keys(liste || {}).map((uid) => ({ uid, gerant: proteges.has(uid) }));
}

export async function ajouterMembre(espace, uid) {
  return appel(branche(espace, `/membres/${enc(uid)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: "true",
  });
}

export async function retirerMembre(espace, uid) {
  return appel(branche(espace, `/membres/${enc(uid)}`), { method: "DELETE" });
}

/** Vrai si le compte connecté peut ouvrir cet espace. Sert à dire
    « vous n'êtes pas membre » AVANT d'avoir l'air de charger un GN. */
export async function accessible(espace) {
  try {
    await appel(branche(espace, "/membres"));
    return true;
  } catch {
    return false;
  }
}

/* ---- Les GN d'un espace -------------------------------------------- */

export async function listeGn(espace) {
  const d = await appel(branche(espace, "/gn")).catch(() => null);
  return Object.entries(d || {}).map(([id, v]) => ({
    id,
    nom: v?.meta?.nom || "",
    rev: Number(v?.meta?.rev) || 0,
  }));
}

export async function poserMeta(espace, gn, nom, rev) {
  const s = session();
  return appel(brancheGn(espace, gn, "/meta"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nom, rev: (Number(rev) || 0) + 1, par: s?.uid || "", le: Date.now() }),
  });
}

/* ---- Les documents -------------------------------------------------
   Un document par objet : un personnage, une situation, une
   information. Deux auteurs qui écrivent deux personnages n'entrent
   jamais en conflit — c'est tout l'objet de la maille (cf.
   `core/objets.js`). */

/** Tous les documents d'un GN, à plat : `{ "<collection>/<id>": doc }`. */
export async function lireTout(espace, gn) {
  const d = await appel(brancheGn(espace, gn, "/objets")).catch(() => null);
  const out = {};
  for (const [collection, enfants] of Object.entries(d || {}))
    for (const [id, doc] of Object.entries(enfants || {})) out[`${collection}/${id}`] = doc;
  return out;
}

export async function lireUn(espace, gn, chemin) {
  return appel(brancheGn(espace, gn, `/objets/${chemin}`)).catch(() => null);
}

/**
 * Écrit un document. `rev` est celle qu'on croit avoir ; la base exige
 * d'en recevoir exactement la suivante.
 *
 * `sup: true` pose une **pierre tombale** au lieu d'effacer la branche.
 * Effacer perdrait la révision, et un pair qui détient encore l'objet
 * le repousserait à la synchronisation suivante : ce qu'on a supprimé
 * reviendrait tout seul, sans que personne comprenne pourquoi.
 */
export async function ecrire(espace, gn, chemin, d, rev, { sup = false } = {}) {
  const s = session();
  const corps = { rev: (Number(rev) || 0) + 1, par: s?.uid || "", le: Date.now() };
  if (sup) corps.sup = true;
  else corps.d = d;

  try {
    await appel(brancheGn(espace, gn, `/objets/${chemin}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    return corps.rev;
  } catch (e) {
    if (!(e instanceof RefusError)) throw e;
    // La base renvoie le même refus pour « vous n'êtes pas membre » et
    // pour « votre révision n'est pas la suivante ». On ne devine pas
    // d'après le message : on relit, et c'est le distant qui tranche.
    const distant = await lireUn(espace, gn, chemin);
    if (distant && (Number(distant.rev) || 0) !== (Number(rev) || 0))
      throw new ConflitError(chemin, distant);
    throw e;
  }
}

/* ---- La preuve que les règles sont bien là -------------------------
   Une règle qu'on croit posée et qui ne l'est pas ne se voit pas : tout
   marche, jusqu'au jour où deux personnes écrivent en même temps et où
   l'une perd son après-midi. On tente donc une écriture qui DOIT être
   refusée — réécrire une révision à sa valeur actuelle. Si elle passe,
   la garde est absente ; et rien n'est abîmé, puisqu'on a réécrit la
   même valeur.

   À appeler une fois après avoir déployé les règles, avant de confier
   un GN à cette base. */
export async function garde(espace, gn, chemin, rev) {
  if (!configure() || !session()) return null;
  const s = session();
  try {
    await appel(brancheGn(espace, gn, `/objets/${chemin}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rev: Number(rev) || 0, par: s?.uid || "" }),
    });
    Debug.warn("espace", "LA GARDE N'EST PAS EN PLACE : l'écrasement est possible");
    return false;
  } catch {
    return true;
  }
}
