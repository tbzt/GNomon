"use strict";

/* ============================================================
   THÈME — trois états, pas deux.
   ------------------------------------------------------------
   Un thème n'a pas deux états mais **trois** : clair, sombre, et
   « comme le système » — qui est le défaut et n'est pas la même chose
   que l'un des deux autres. Une bascule à deux positions oblige à
   choisir pour toujours, alors que la plupart des gens veulent suivre
   leur appareil et ne dévier qu'à l'occasion : en plein soleil à
   J-Jour, ou la nuit sur un portable réglé en clair.

   ── LE THÈME NE VOYAGE PAS DANS L'ARCHIVE ──
   Il est stocké sous une clé qui n'est **pas** dans `Archive.CLES` :
   c'est une préférence d'appareil, pas une donnée de GN. Recevoir
   l'archive d'un collègue ne doit pas retourner son écran.

   ── LA CONDUITE NE SUIT PAS ──
   Elle définit ses propres tokens et reste nocturne quel que soit le
   réglage : ce n'est pas une préférence, c'est son contexte d'usage.

   Feuille : ne dépend que de `Storage`.
   ============================================================ */
import { Storage } from "./storage.js";

export const ETATS = ["systeme", "clair", "sombre"];
export const LIBELLES = { systeme: "Système", clair: "Clair", sombre: "Sombre" };

const CLE = "theme";

export const Theme = {
  _observers: new Set(),

  /** L'état choisi — pas le thème effectivement rendu. */
  etat() {
    const v = Storage.get(CLE, "systeme");
    return ETATS.includes(v) ? v : "systeme";
  },

  /** Ce qui est réellement affiché, système résolu. Sert à nommer
      l'état suivant dans l'interface sans mentir. */
  effectif() {
    const e = this.etat();
    if (e !== "systeme") return e;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair";
  },

  /** Pose l'attribut sur la racine. En « système », on ne pose RIEN :
      c'est l'absence d'attribut qui laisse la requête média décider. */
  appliquer() {
    const e = this.etat();
    const r = document.documentElement;
    if (e === "systeme") r.removeAttribute("data-theme");
    else r.setAttribute("data-theme", e === "sombre" ? "dark" : "light");
    for (const cb of this._observers) {
      try {
        cb(e);
      } catch {
        /* un abonné qui échoue ne doit pas empêcher les autres */
      }
    }
  },

  poser(etat) {
    if (!ETATS.includes(etat)) return;
    Storage.set(CLE, etat);
    this.appliquer();
  },

  /** Fait tourner système → clair → sombre → système. */
  cycler() {
    const i = ETATS.indexOf(this.etat());
    this.poser(ETATS[(i + 1) % ETATS.length]);
  },

  subscribe(cb) {
    if (typeof cb === "function") this._observers.add(cb);
    return () => this._observers.delete(cb);
  },

  /** À appeler une fois au démarrage. Suit aussi les changements de
      réglage du système tant qu'on est en mode « système ». */
  init() {
    this.appliquer();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (this.etat() === "systeme") this.appliquer();
    });
  },
};
