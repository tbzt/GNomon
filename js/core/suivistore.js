"use strict";

/* ============================================================
   SUIVI — ce qu'on a fait d'un besoin.
   ------------------------------------------------------------
   Les besoins sont **dérivés** (`core/besoins.js`) : ils ne se
   stockent pas. Ce qui se stocke, c'est la couche humaine posée
   dessus — **qui s'en occupe, est-ce fait, avec quelle note** —
   indexée par la clé stable du besoin.

   La séparation n'est pas cosmétique. Stocker le besoin lui-même en
   ferait une copie du texte, qui divergerait au premier remaniement :
   c'est exactement ce qu'un tableur d'équipe finit toujours par
   devenir, une liste qui ne correspond plus à rien. Ici, changer le
   matériel d'une situation change le besoin, et l'affectation suit.

   ── LE RESPONSABLE PLUTÔT QUE L'ÉCHÉANCE ──
   Pettersson, dans « Comment organiser un GN de manière efficiente »,
   refuse le rétroplanning et met la **propriété claire des rôles**
   au-dessus du calendrier : « chacun a un poste clairement défini car
   cela permet de gérer le stress ». Ce store suit ce conseil — un nom,
   pas une date.

   ── LES CLÉS ORPHELINES SURVIVENT, ET C'EST VOULU ──
   Supprimer une situation fait disparaître ses besoins ; leur suivi
   reste en base, invisible. Le purger demanderait à ce store de
   connaître toutes les sources possibles — soit exactement le couplage
   qu'on évite. Le coût est quelques octets ; le bénéfice est qu'annuler
   une suppression retrouve son affectation intacte.

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

export const SuiviStore = {
  _key: "suivi",
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
        Debug.warn("besoins", "observateur échoué", { evt, error: e });
      }
    }
  },

  pour(cle) {
    return this._d()[cle] || null;
  },

  maj(cle, patch = {}) {
    const d = this._d();
    const e = { responsable: "", fait: false, note: "", ...(d[cle] || {}), ...patch };
    // Une entrée entièrement vide ne se garde pas : elle ferait grossir
    // la base au rythme des clics d'essai.
    if (!e.responsable && !e.fait && !e.note) delete d[cle];
    else d[cle] = e;
    this.save();
    this._emit({ type: "suivi:maj", cle });
    return d[cle] || null;
  },

  basculerFait(cle) {
    const e = this.pour(cle);
    return this.maj(cle, { fait: !(e && e.fait) });
  },

  /** Compte sur un ensemble de clés données — les besoins étant
      dérivés, c'est à l'appelant de dire lesquelles existent. */
  bilan(cles) {
    let faits = 0;
    let assignes = 0;
    for (const c of cles) {
      const e = this.pour(c);
      if (!e) continue;
      if (e.fait) faits++;
      if (e.responsable) assignes++;
    }
    return { total: cles.length, faits, assignes };
  },

  /** Combien de besoins portent une trace de suivi. Comme
      `Derogations.compte()`, et pour la même raison : savoir si ce
      store a quelque chose à dire sans avoir à énumérer les clés
      depuis l'extérieur. */
  compte() {
    return Object.keys(this._d()).length;
  },

  /** Les personnes déjà nommées, pour proposer plutôt que faire retaper. */
  responsables() {
    return [...new Set(Object.values(this._d()).map((e) => e.responsable).filter(Boolean))].sort();
  },

  vider() {
    this._data = {};
    this.save();
    this._emit({ type: "suivi:vider" });
  },
};
