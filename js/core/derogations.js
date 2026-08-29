"use strict";

/* ============================================================
   DÉROGATIONS — les alertes écartées, et pourquoi.
   ------------------------------------------------------------
   Kröger : « quand tu connais les règles, tu peux les briser — si tu
   peux argumenter pourquoi ce personnage n'a pas besoin de cet
   élément, il n'en a probablement pas besoin ; mais si tu ne peux pas
   l'argumenter, il en a besoin. »

   Toute la valeur de cette phrase est dans l'argument. Alors :

   ── UNE DÉROGATION SANS JUSTIFICATION ÉCRITE N'EXISTE PAS ──
   `ecarter()` refuse une justification vide. Un bouton « ignorer » nu
   transformerait la conscience en gêne à faire taire, et au bout de
   trois semaines toutes les alertes seraient éteintes sans qu'aucune
   décision n'ait été prise. Écrire une phrase coûte peu et laisse une
   trace ; c'est exactement ce qu'on demande.

   ── UNE DÉROGATION NE MASQUE PAS L'ALERTE ──
   Ce store dit qu'une alerte a été *traitée*, pas qu'elle a disparu.
   L'écran continue de l'afficher, avec sa justification, à l'intention
   du **crosschecker** — le rôle que Kröger nomme dans son processus.
   Cacher l'alerte reviendrait à cacher la décision.

   La clé est `<règle>::<cible>` : elle survit au renommage (les cibles
   sont des ids) et se perd si l'objet disparaît, ce qui est le
   comportement voulu — une justification n'a de sens qu'attachée à ce
   qu'elle justifie.

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

export const Derogations = {
  _key: "derogations",
  _data: null,
  _observers: new Set(),

  load() {
    const raw = Storage.get(this._key, null);
    this._data = raw && typeof raw === "object" ? raw : {};
    return this._data;
  },

  save() {
    Storage.set(this._key, this._data || {});
  },

  _d() {
    if (!this._data) this.load();
    return this._data;
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
        Debug.warn("conscience", "observateur échoué", { evt, error: e });
      }
    }
  },

  _cle(regle, cible) {
    return `${regle}::${cible}`;
  },

  /** La dérogation posée sur cette alerte, ou `null`. */
  pour(regle, cible) {
    return this._d()[this._cle(regle, cible)] || null;
  },

  toutes() {
    return Object.entries(this._d()).map(([cle, d]) => ({ cle, ...d }));
  },

  compte() {
    return Object.keys(this._d()).length;
  },

  /** Écarte une alerte. **Refuse une justification vide** : c'est
      l'invariant du module, pas une validation de formulaire. */
  ecarter(regle, cible, justification) {
    const texte = String(justification || "").trim();
    if (!texte) {
      Debug.warn("conscience", "dérogation sans justification, refusée", { regle, cible });
      return null;
    }
    const d = { justification: texte, date: new Date().toISOString().slice(0, 10) };
    this._d()[this._cle(regle, cible)] = d;
    this.save();
    this._emit({ type: "derogation:poser", regle, cible });
    return d;
  },

  retablir(regle, cible) {
    delete this._d()[this._cle(regle, cible)];
    this.save();
    this._emit({ type: "derogation:retirer", regle, cible });
  },

  vider() {
    this._data = {};
    this.save();
    this._emit({ type: "derogations:vider" });
  },
};
