"use strict";

/* ============================================================
   INFORMATION STORE — qui sait quoi, et qui croit autre chose.
   ------------------------------------------------------------
   L'objet que ShadowHerds n'a pas. Il a des *indices* — des faits qu'on
   découvre. Il lui manque **l'asymétrie de connaissance**, qui est ce
   qui fait marcher une intrigue de GN.

   Kröger en fait une question obligatoire sur chaque intrigue : « tous
   les participants savent-ils la même chose ? Y avait-il un témoin dont
   les autres ignorent la présence ? Est-ce un malentendu — l'ont-ils
   interprété différemment, et pourquoi ? »

       Information { id, contenu, enonce, influence, etats, croyances,
                     etatsParEpoque, croyancesParEpoque }

   `etats` et `croyances` sont ce que chaque PERSONNE sait, à toutes
   les époques. `etatsParEpoque[epoqueId][pid]` est l'exception datée :
   Brun croit en 1965 ce qu'il sait en 1985. Rare, et lue seulement
   quand on demande une époque.

   `etats` associe un id de personnage à `"sait"` ou `"croit"`.
   **L'absence d'entrée vaut « ignore »** : c'est l'état par défaut du
   monde, et le stocker pour quarante personnages × trente informations
   remplirait la base de mille deux cents façons de ne rien dire.

   `enonce` est ce que LIT celui qui la sait, dans son livret. Le
   `contenu` est écrit pour l'équipe — à la troisième personne, avec
   ses notes d'orga — et c'est lui qui servait de texte de livret :
   un joueur lisait « Ange a six semaines à vivre » dans le livret
   d'Ange, et un « socle factuel identique dans les neuf livrets »
   partait tel quel chez le joueur. Un fait a donc deux textes : le
   vrai, pour l'équipe, et sa formulation pour qui le sait. Le livret
   n'imprime que la seconde, et signale quand elle manque.

   Ce que ce champ NE règle PAS : une information que ses porteurs
   doivent lire différemment (« trois personnes sont armées, aucune ne
   sait pour les deux autres ») n'a pas UNE formulation. C'est alors
   deux informations, une par fait — le modèle ne cherche pas à porter
   un texte par porteur.

   `croyances` porte le TEXTE de ce qu'un personnage croit à la place.
   Sans lui, « croit autre chose » ne serait qu'un drapeau — or c'est
   précisément la fausse croyance qui se joue à table. Lucie ne « croit
   pas autre chose » dans l'abstrait : elle croit que son fils est mort
   de la fièvre.

   ── INFLUENCE DIRECTE OU LATENTE — LE RÉGLAGE DE TENSION ──
   eXpérience distingue l'information que le joueur peut traduire en
   acte immédiatement (« le duc a tué tes parents » → il ira le
   provoquer) de celle qui ne permet aucune anticipation. Ce n'est pas
   une nuance de vocabulaire : trop de directe et tout se déclenche à
   20 h ; trop de latente et rien ne démarre.

   Feuille : ne dépend que de `Storage` et `Debug`. Ne connaît ni les
   personnages ni les situations — il ne manipule que des ids.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

/** Ce que le joueur peut faire de l'information dès la lecture. */
export const INFLUENCES = Object.freeze({
  directe: "Directe",
  latente: "Latente",
});

/** Les trois états. « ignore » n'est jamais stocké : c'est l'absence. */
export const ETATS = Object.freeze({
  sait: "Sait",
  croit: "Croit autre chose",
  ignore: "Ignore",
});

const VIDE = { informations: [] };

export const InformationStore = {
  _key: "informations",
  _data: null,
  _observers: new Set(),

  /* ================= Persistance ================= */

  load() {
    const raw = Storage.get(this._key, null);
    this._data = {
      informations: Array.isArray(raw?.informations) ? raw.informations : [],
    };
    return this._data;
  },

  save() {
    Storage.set(this._key, this._data || VIDE);
  },

  _d() {
    if (!this._data) this.load();
    return this._data;
  },

  _uid() {
    return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  subscribe(cb) {
    if (typeof cb === "function") this._observers.add(cb);
    return () => this._observers.delete(cb);
  },

  _emit(evt) {
    for (const cb of this._observers) {
      try {
        cb(evt);
      } catch (e) {
        Debug.warn("information", "observateur échoué", { evt, error: e });
      }
    }
  },

  /* ================= Lecture ================= */

  informations() {
    return this._d().informations;
  },

  information(id) {
    return this._d().informations.find((i) => i && i.id === id) || null;
  },

  /** L'état d'un personnage vis-à-vis d'une information.
      Une information inconnue renvoie « ignore », pas `null` : le
      monde par défaut est un monde où l'on ne sait pas. */
  etat(infoId, personnageId, epoqueId = null) {
    const i = this.information(infoId);
    if (!i) return "ignore";
    if (epoqueId && i.etatsParEpoque && i.etatsParEpoque[epoqueId] && i.etatsParEpoque[epoqueId][personnageId])
      return i.etatsParEpoque[epoqueId][personnageId];
    return i.etats[personnageId] || "ignore";
  },

  croyance(infoId, personnageId, epoqueId = null) {
    const i = this.information(infoId);
    if (!i) return "";
    if (epoqueId && i.croyancesParEpoque && i.croyancesParEpoque[epoqueId] && i.croyancesParEpoque[epoqueId][personnageId] != null)
      return i.croyancesParEpoque[epoqueId][personnageId];
    return i.croyances[personnageId] || "";
  },

  /** Cette personne a-t-elle un état DIFFÉRENT à cette époque ? */
  exceptionA(infoId, personnageId, epoqueId) {
    const i = this.information(infoId);
    return !!(i && epoqueId && i.etatsParEpoque && i.etatsParEpoque[epoqueId] && i.etatsParEpoque[epoqueId][personnageId]);
  },

  /** Les personnes qui ont un état sur cette information, exceptions
      datées comprises quand on demande une époque. */
  _porteurs(i, epoqueId) {
    const ids = new Set(Object.keys(i.etats));
    if (epoqueId && i.etatsParEpoque && i.etatsParEpoque[epoqueId])
      for (const p of Object.keys(i.etatsParEpoque[epoqueId])) ids.add(p);
    return [...ids];
  },

  /** Ceux qui la savent vraiment. */
  detenteurs(infoId, epoqueId = null) {
    const i = this.information(infoId);
    if (!i) return [];
    return this._porteurs(i, epoqueId).filter((p) => this.etat(infoId, p, epoqueId) === "sait");
  },

  /** Ceux qui croient autre chose — la matière des malentendus. */
  divergents(infoId, epoqueId = null) {
    const i = this.information(infoId);
    if (!i) return [];
    return this._porteurs(i, epoqueId).filter((p) => this.etat(infoId, p, epoqueId) === "croit");
  },

  /** Tout ce qu'un personnage porte, trié. Sert au squelette de fiche :
      c'est ce qu'il faut avoir écrit dans sa fiche avant le jeu. */
  parPersonnage(personnageId, epoqueId = null) {
    const sait = [];
    const croit = [];
    for (const i of this._d().informations) {
      const e = this.etat(i.id, personnageId, epoqueId);
      if (e === "sait") sait.push(i);
      else if (e === "croit") croit.push(i);
    }
    return { sait, croit };
  },

  /* ================= Mutation ================= */

  creer({ contenu = "", influence = "latente", enonce = "" } = {}) {
    if (!(influence in INFLUENCES)) {
      Debug.warn("information", "influence inconnue, refusée", { influence });
      return null;
    }
    const i = { id: this._uid(), contenu, enonce, influence, etats: {}, croyances: {}, etatsParEpoque: {}, croyancesParEpoque: {} };
    this._d().informations.push(i);
    this.save();
    this._emit({ type: "information:creer", id: i.id });
    return i;
  },

  maj(id, patch = {}) {
    const i = this.information(id);
    if (!i) return null;
    if (patch.influence && !(patch.influence in INFLUENCES)) {
      Debug.warn("information", "influence inconnue, refusée", { influence: patch.influence });
      delete patch.influence;
    }
    // `etats` et `croyances` ne passent JAMAIS par ici : ils ont leur
    // porte (`poser`), qui tient l'invariant « ignore = absence ».
    delete patch.etats;
    delete patch.croyances;
    delete patch.etatsParEpoque;
    delete patch.croyancesParEpoque;
    Object.assign(i, patch, { id: i.id });
    this.save();
    this._emit({ type: "information:maj", id });
    return i;
  },

  supprimer(id) {
    const d = this._d();
    const k = d.informations.findIndex((i) => i && i.id === id);
    if (k < 0) return null;
    const i = d.informations.splice(k, 1)[0];
    this.save();
    this._emit({ type: "information:supprimer", id });
    return i;
  },

  /** Pose l'état d'un personnage. `"ignore"` **retire** l'entrée plutôt
      que de l'écrire — l'invariant « ignore = absence » se tient ici et
      nulle part ailleurs, sinon deux façons d'écrire la même chose
      finiraient par diverger.

      Une croyance ne survit pas à la sortie de l'état « croit » : la
      garder produirait un texte fantôme qu'aucun écran n'affiche et que
      personne ne penserait à relire. */
  poser(infoId, personnageId, etat, croyance = "", epoqueId = null) {
    const i = this.information(infoId);
    if (!i || !personnageId) return null;
    if (!(etat in ETATS)) {
      Debug.warn("information", "état inconnu, refusé", { etat });
      return null;
    }
    // Une époque demandée pose une EXCEPTION datée : « ignore » la
    // retire, et la personne reprend son état de toutes les époques.
    if (epoqueId) {
      if (!i.etatsParEpoque) i.etatsParEpoque = {};
      if (!i.croyancesParEpoque) i.croyancesParEpoque = {};
      const E = (i.etatsParEpoque[epoqueId] = i.etatsParEpoque[epoqueId] || {});
      const C = (i.croyancesParEpoque[epoqueId] = i.croyancesParEpoque[epoqueId] || {});
      if (etat === "ignore" || etat === i.etats[personnageId]) {
        delete E[personnageId];
        delete C[personnageId];
      } else {
        E[personnageId] = etat;
        if (etat === "croit") C[personnageId] = croyance;
        else delete C[personnageId];
      }
      this.save();
      this._emit({ type: "information:poser", id: infoId, personnageId, etat, epoqueId });
      return i;
    }
    if (etat === "ignore") {
      delete i.etats[personnageId];
      delete i.croyances[personnageId];
    } else {
      i.etats[personnageId] = etat;
      if (etat === "croit") i.croyances[personnageId] = croyance;
      else delete i.croyances[personnageId];
    }
    this.save();
    this._emit({ type: "information:poser", id: infoId, personnageId, etat });
    return i;
  },

  /** Fait tourner l'état : ignore → sait → croit → ignore. C'est le
      geste de la matrice — une cellule se règle au clic, pas au menu.
      Avec une époque, c'est l'exception datée qui tourne. */
  cycler(infoId, personnageId, epoqueId = null) {
    const suite = { ignore: "sait", sait: "croit", croit: "ignore" };
    return this.poser(infoId, personnageId, suite[this.etat(infoId, personnageId, epoqueId)], "", epoqueId);
  },

  /* ================= Remise à zéro ================= */

  vider() {
    this._data = { informations: [] };
    this.save();
    this._emit({ type: "informations:vider" });
  },
};
