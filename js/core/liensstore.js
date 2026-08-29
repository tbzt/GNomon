"use strict";

/* ============================================================
   LIENS EXTERNES — relier sans stocker.
   ------------------------------------------------------------
   GNomon ne veut pas devenir le Drive de l'équipe, ni son Trello, ni
   son dossier de photos. Ces outils existent, les équipes les ont
   déjà, et les refaire moins bien serait une perte sèche.

   Mais l'outil peut être **le point de départ** : un endroit où l'on
   retrouve où sont les choses. Ce store ne garde donc que des
   **adresses** — jamais le contenu qui est au bout.

       Lien { id, titre, url, note, ancre }

   `ancre` vaut `null` pour un lien général (le Drive de l'équipe, le
   tableau d'organisation), ou une clé d'objet pour un lien attaché —
   `besoin:<clé>` pour un accessoire à commander, et demain
   `personnage:<id>` ou `situation:<id>` si le besoin s'en fait sentir.
   Le champ est libre exprès : ajouter une ancre ne demandera pas de
   migration.

   ── LA VALIDATION D'URL N'EST PAS DU CONFORT ──
   Ces adresses seront rendues en `<a href>`. Un `javascript:` collé là
   s'exécuterait au clic, dans une page qui contient tout le GN. On
   n'accepte donc que `http:` et `https:`, vérifiés en construisant une
   `URL` — pas avec une expression régulière, qui se contourne. Et le
   rendu porte `rel="noopener noreferrer"` : sans `noopener`, la page
   ouverte peut réécrire celle qui l'a ouverte.

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage } from "./storage.js";
import { Debug } from "./debug.js";

/** Vrai si l'adresse est sûre à poser dans un `href`. */
export function urlSure(brut) {
  try {
    const u = new URL(String(brut).trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Le nom d'hôte, pour montrer d'un coup d'œil où mène le lien. */
export function hote(brut) {
  try {
    return new URL(brut).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const LiensStore = {
  _key: "liens",
  _data: null,
  _observers: new Set(),

  load() {
    const raw = Storage.get(this._key, null);
    this._data = Array.isArray(raw) ? raw : [];
    return this._data;
  },

  save() {
    Storage.set(this._key, this._data || []);
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
        Debug.warn("liens", "observateur échoué", { evt, error: e });
      }
    }
  },

  tous() {
    return this._d();
  },

  /** Les liens généraux — le hub proprement dit. */
  generaux() {
    return this._d().filter((l) => l && !l.ancre);
  },

  /** Les liens attachés à un objet précis. */
  pour(ancre) {
    return this._d().filter((l) => l && l.ancre === ancre);
  },

  /** Ajoute un lien. Renvoie `{ ok, raison }` plutôt que `null` : une
      adresse refusée doit pouvoir être expliquée à l'auteur. */
  ajouter({ titre = "", url = "", note = "", ancre = null } = {}) {
    const propre = String(url || "").trim();
    if (!propre) return { ok: false, raison: "Une adresse est nécessaire." };
    if (!urlSure(propre))
      return {
        ok: false,
        raison: "Seules les adresses http:// et https:// sont acceptées.",
      };
    const l = {
      id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      titre: String(titre).trim() || hote(propre),
      url: propre,
      note: String(note).trim(),
      ancre,
    };
    this._d().push(l);
    this.save();
    this._emit({ type: "lien:creer", id: l.id });
    return { ok: true, lien: l };
  },

  maj(id, patch = {}) {
    const l = this._d().find((x) => x && x.id === id);
    if (!l) return { ok: false, raison: "Lien introuvable." };
    if (patch.url !== undefined) {
      const propre = String(patch.url).trim();
      if (!urlSure(propre))
        return { ok: false, raison: "Seules les adresses http:// et https:// sont acceptées." };
      patch.url = propre;
    }
    Object.assign(l, patch, { id: l.id });
    this.save();
    this._emit({ type: "lien:maj", id });
    return { ok: true, lien: l };
  },

  supprimer(id) {
    this._data = this._d().filter((x) => x && x.id !== id);
    this.save();
    this._emit({ type: "lien:supprimer", id });
  },

  vider() {
    this._data = [];
    this.save();
    this._emit({ type: "liens:vider" });
  },
};
