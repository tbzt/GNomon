"use strict";

/* ============================================================
   ARCHIVE — sauvegarder, exporter, partager.
   ------------------------------------------------------------
   GNomon n'a pas de serveur : le partage se fait par **fichier**. Un
   seul JSON porte tout le GN, et c'est lui qu'on s'envoie, qu'on
   sauvegarde, qu'on met dans un dépôt d'équipe.

       { format, version, date, titre, data: { <clé>: <valeur> } }

   ── L'ENVELOPPE EST UN CONTRAT ──
   `format` et `version` sont lus AVANT le contenu. Un fichier d'un
   autre outil, ou d'une version future, est refusé avec une phrase
   claire plutôt qu'importé à moitié — un import partiel laisserait un
   GN incohérent qu'on croirait entier, ce qui est pire que pas d'import.

   ── DEUX MODES, ET LEURS SÉMANTIQUES SONT OPPOSÉES ──
   · **remplacer** — le fichier devient la vérité. Pour restaurer une
     sauvegarde, ou récupérer le travail de quelqu'un d'autre en entier.
   · **fusionner** — le fichier COMPLÈTE ce qui est là : ce qui manque
     est ajouté, ce qui existe déjà **n'est pas touché**. C'est le sens
     prudent : deux personnes qui ont écrit chacune de leur côté ne
     doivent pas se voir écraser par l'ordre d'import. Le prix est qu'un
     objet modifié des deux côtés garde la version locale — et c'est le
     bon prix, parce qu'on peut toujours réimporter en « remplacer »,
     alors qu'on ne peut pas ressusciter ce qui a été écrasé.

   ── L'ARCHIVE CONTIENT TOUT, ET ÇA SE DIT ──
   Le livret est calculé par soustraction avec beaucoup de soin ; la
   consigne PNJ porte les vérités ; le carnet de l'auteur est privé ;
   le fil de l'histoire dit, daté, ce qui s'est réellement passé.
   **L'archive, elle, contient les quatre.** L'envoyer à un joueur
   annulerait d'un coup toutes ces précautions.

   Le fichier porte donc un champ `avertissement` en clair — visible
   dès qu'on l'ouvre dans un éditeur — et l'export le rappelle à
   l'écran. Ce n'est pas une protection technique : c'en est une
   humaine, et c'est la seule qui ait du sens pour un fichier qu'on
   s'envoie soi-même.

   Feuille : ne dépend que de `Storage`.
   ============================================================ */
import { Storage, CLES_PROJET } from "./storage.js";
import { normaliserBloc, resumeAnomalies } from "./normaliser.js";

export const FORMAT = "gnomon-archive";
export const VERSION = 1;

/** Écrit en clair dans le fichier, en tête. */
export const AVERTISSEMENT =
  "Ce fichier contient TOUT le GN : les vérités que les joueurs ignorent, " +
  "le fil de l'histoire, les consignes PNJ et les carnets privés de l'équipe. " +
  "Il se partage entre organisateurs, jamais avec un participant. Pour un joueur, " +
  "exportez son livret.";

/** Les clés qui composent un GN. La liste vit dans `storage.js` — savoir
    quelle clé appartient à un projet et laquelle appartient à l'appareil
    est le métier du socle, et deux listes finiraient par diverger le jour
    où l'une gagnerait une clé que l'autre ignore. */
export const CLES = CLES_PROJET;

/** Les clés dont le contenu est une liste d'objets à `id` — les seules
    que « fusionner » sait réconcilier finement. */
const LISTES = {
  reseau: ["personnages", "liens", "groupes"],
  trames: ["trames", "situations", "conclusions"],
  informations: ["informations"],
  casting: ["candidatures"],
  run: ["journal"],
};

/** `liens` est une liste NUE (pas un objet à champs), donc sa fusion
    se fait à part : on ajoute ce qui manque, par id. */
const LISTES_NUES = ["liens"];

export const Archive = {
  /** Construit le paquet. Ne lit que `Storage` : ce qui n'a jamais été
      écrit est simplement absent, et se relira comme un défaut. */
  construire(titre = "") {
    const data = {};
    for (const cle of CLES) {
      const v = Storage.get(cle, null);
      if (v !== null) data[cle] = v;
    }
    return {
      format: FORMAT,
      version: VERSION,
      avertissement: AVERTISSEMENT,
      date: new Date().toISOString(),
      titre,
      data,
    };
  },

  /** Vérifie l'enveloppe. Renvoie `{ ok, raison }`. */
  verifier(paquet) {
    if (!paquet || typeof paquet !== "object")
      return { ok: false, raison: "Ce fichier n'est pas un JSON exploitable." };
    if (paquet.format !== FORMAT)
      return {
        ok: false,
        raison: `Ce fichier n'est pas une archive GNomon (format « ${paquet.format || "absent"} »).`,
      };
    if (typeof paquet.version !== "number" || paquet.version > VERSION)
      return {
        ok: false,
        raison:
          `Archive en version ${paquet.version}, or cette copie de GNomon ne lit ` +
          `que jusqu'à la version ${VERSION}. Mettez l'outil à jour plutôt que d'importer à moitié.`,
      };
    if (!paquet.data || typeof paquet.data !== "object")
      return { ok: false, raison: "L'archive ne contient aucune donnée." };
    return { ok: true };
  },

  /** Ce que le paquet contient, sans rien écrire — pour que l'auteur
      voie ce qu'il s'apprête à importer avant de le faire. `fil` dit
      si le fil de l'histoire est écrit : c'est la pièce la plus
      sensible du paquet, et celle qu'on veut savoir présente avant de
      remplacer la sienne. */
  inventaire(paquet) {
    const d = paquet.data || {};
    const n = (v, k) => (Array.isArray(v?.[k]) ? v[k].length : 0);
    return {
      titre: paquet.titre || d.monde?.titre || "",
      date: (paquet.date || "").slice(0, 10),
      fil: typeof d.monde?.fil === "string" && d.monde.fil.trim().length > 0,
      personnages: n(d.reseau, "personnages"),
      liens: n(d.reseau, "liens"),
      trames: n(d.trames, "trames"),
      situations: n(d.trames, "situations"),
      informations: n(d.informations, "informations"),
      candidatures: n(d.casting, "candidatures"),
      run: d.run?.run ? "partie en cours" : "",
    };
  },

  /** Applique le paquet. `mode` vaut « remplacer » ou « fusionner ».

      ── L'ENVELOPPE NE SUFFISAIT PAS ──
      `verifier()` lit `format` et `version`, puis on écrivait le contenu
      tel quel. Une archive d'enveloppe valide mais au contenu abîmé
      passait donc, s'écrivait, et cassait un écran de façon permanente —
      le rechargement ne répare rien, puisque le mauvais paquet est
      devenu la vérité locale. Constaté sur une information sans `etats` :
      « Qui sait quoi » restait vide, sans un mot.

      Chaque bloc passe maintenant par `normaliserBloc`, qui répare ce
      qui peut l'être et écarte ce qui ne le peut pas. Refuser tout le
      fichier serait pire : on perdrait quarante fiches pour une virgule.
      Ce qui a été réparé remonte dans le bilan — un import silencieux
      qui corrige des données est un import qui ment. */
  appliquer(paquet, mode = "fusionner") {
    const v = this.verifier(paquet);
    if (!v.ok) return v;

    const bilan = {};
    const anomalies = [];
    for (const cle of CLES) {
      const brut = paquet.data[cle];
      if (brut === undefined) continue;
      const norme = normaliserBloc(cle, brut);
      anomalies.push(...norme.anomalies);
      const entrant = norme.bloc;

      if (mode !== "remplacer" && LISTES_NUES.includes(cle) && Array.isArray(entrant)) {
        const local = Storage.get(cle, null);
        const a = Array.isArray(local) ? local : [];
        const vus = new Set(a.map((x) => x && x.id));
        const neufs = entrant.filter((x) => x && x.id && !vus.has(x.id));
        Storage.set(cle, [...a, ...neufs]);
        bilan[cle] = `${neufs.length} ajouté${neufs.length > 1 ? "s" : ""}`;
        continue;
      }

      if (mode === "remplacer" || !LISTES[cle]) {
        Storage.set(cle, entrant);
        bilan[cle] = "remplacé";
        continue;
      }

      const local = Storage.get(cle, null);
      if (local === null || typeof local !== "object") {
        Storage.set(cle, entrant);
        bilan[cle] = "ajouté";
        continue;
      }

      let ajoutes = 0;
      const fusionne = { ...entrant, ...local };
      for (const champ of LISTES[cle]) {
        const a = Array.isArray(local[champ]) ? local[champ] : [];
        const b = Array.isArray(entrant[champ]) ? entrant[champ] : [];
        const vus = new Set(a.map((x) => x && x.id));
        const neufs = b.filter((x) => x && x.id && !vus.has(x.id));
        ajoutes += neufs.length;
        fusionne[champ] = [...a, ...neufs];
      }
      Storage.set(cle, fusionne);
      bilan[cle] = `${ajoutes} ajouté${ajoutes > 1 ? "s" : ""}`;
    }
    return { ok: true, bilan, anomalies, reparations: resumeAnomalies(anomalies) };
  },

  /** Nom de fichier lisible et triable. */
  nomFichier(titre = "") {
    const t = (titre || "gnomon")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return `${t || "gnomon"}-${new Date().toISOString().slice(0, 10)}.json`;
  },
};

/** Déclenche le téléchargement d'un contenu texte. Un seul endroit :
    trois écrans exportent, aucun ne doit réinventer l'ancre. */
export function telecharger(nom, contenu, type = "application/json") {
  const blob = new Blob([contenu], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Révoquer trop tôt annule le téléchargement sur certains navigateurs.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
