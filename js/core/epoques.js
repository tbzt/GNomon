"use strict";

/* ============================================================
   ÉPOQUES — le temps du GN, et ce qu'une personne y est.
   ------------------------------------------------------------
   Un GN qui se déroule à un seul moment n'a pas besoin de ce module.
   Dès qu'il y en a deux — un flashback la veille, une campagne en
   plusieurs opus — une seule question se pose partout : **à quelle
   époque regarde-t-on ?**

   ── LA PERSONNE EST L'UNITÉ ──
   Ce module a d'abord relié des incarnations par un rôle : Ange-65 et
   Ange-85, deux personnages, un `roleId`. Sur un GN réel, les scènes
   castaient la personne et non l'incarnation, et l'auteur voyait deux
   Toussainte. Le modèle a suivi les données (cf. `personnes.js`) : une
   personne porte une **facette** par époque, et ce qui reste ici, ce
   sont les lectures — les époques dans l'ordre, qui existe quand, ce
   que vaut un siège, ce qui cloche.

   ── LES LIENS SONT DATÉS, OU NE LE SONT PAS ──
   `epoqueId` est optionnel sur un lien et `null` veut dire « vrai à
   toutes les époques ». C'est le bon défaut : la parenté, le sang et
   l'histoire commune n'ont pas de date.

   Module **pur** : il lit des stores, n'en mute aucun. Feuille.
   ============================================================ */

/** Les époques déclarées, dans l'ordre. Un GN mono-époque n'en a aucune. */
export function epoques(mondeStore) {
  const l = (mondeStore?.monde?.() || {}).epoques;
  return Array.isArray(l) ? [...l].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)) : [];
}

export function epoque(mondeStore, id) {
  return epoques(mondeStore).find((e) => e.id === id) || null;
}

/** Rang d'une époque dans l'ordre déclaré ; -1 si inconnue. */
export function rang(mondeStore, epoqueId) {
  return epoques(mondeStore).findIndex((e) => e.id === epoqueId);
}

/** Les identifiants d'époque, dans l'ordre. */
export function ordre(mondeStore) {
  return epoques(mondeStore).map((e) => e.id);
}

/* ================= Personnes ================= */

/** Existe-t-elle à cette époque ? Un faux store sans `existeA` répond
    d'après le champ plat `epoqueId`, comme avant. */
function existe(reseauStore, id, epoqueId) {
  if (typeof reseauStore.existeA === "function") return reseauStore.existeA(id, epoqueId);
  const p = reseauStore.personnage(id);
  return !!p && (!epoqueId || !p.epoqueId || p.epoqueId === epoqueId);
}

/** Les clés de facette d'une personne : ses époques. */
export function epoquesDe(reseauStore, id) {
  if (typeof reseauStore.epoquesDe === "function") return reseauStore.epoquesDe(id);
  const p = reseauStore.personnage(id);
  return p ? [p.epoqueId || "*"] : [];
}

/** Une personne est son propre rôle : gardé pour les appelants. */
export function roleDe(reseauStore, personnageId) {
  return reseauStore.personnage(personnageId) ? personnageId : null;
}

/** Les rôles sont les personnes. `{ id, nom, personnages: [p] }`. */
export function roles(reseauStore) {
  return reseauStore
    .personnages()
    .filter(Boolean)
    .map((p) => ({ id: p.id, nom: p.nom, personnages: [p] }));
}

export function incarnations(reseauStore, personnageId) {
  const p = reseauStore.personnage(personnageId);
  return p ? [p] : [];
}

/** La personne, époque par époque : une entrée par époque déclarée,
    dans l'ordre, avec sa facette (sa vue à cette époque) ou `null`
    quand elle n'y existe pas — un mort de 1965 n'a pas de 1985.
    `courant` marque l'époque courante du store. Sans époque déclarée,
    la liste est vide : un GN mono-époque ne voit rien. */
export function roleParEpoque(reseauStore, mondeStore, personnageId) {
  const courante = typeof reseauStore.epoqueCourante === "function" ? reseauStore.epoqueCourante() : null;
  return epoques(mondeStore).map((e) => ({
    epoque: e,
    personnage: existe(reseauStore, personnageId, e.id) ? reseauStore.personnage(personnageId, e.id) : null,
    courant: e.id === courante,
  }));
}

/** La personne à une époque, ou null si elle n'y est pas. */
export function incarnationA(reseauStore, personnageId, epoqueId) {
  if (!existe(reseauStore, personnageId, epoqueId)) return null;
  return reseauStore.personnage(personnageId, epoqueId);
}

/** Les personnes d'une époque. Sans époque demandée, tout le monde. */
export function personnagesA(reseauStore, epoqueId) {
  const gens = reseauStore.personnages(epoqueId === undefined ? undefined : epoqueId).filter(Boolean);
  return epoqueId ? gens.filter((p) => existe(reseauStore, p.id, epoqueId)) : gens;
}

/** L'époque d'une scène : la sienne, sinon celle de sa trame. Un faux
    store sans `epoqueDe` lit le champ. */
export function epoqueDeScene(tramesStore, s) {
  if (typeof tramesStore.epoqueDe === "function") return tramesStore.epoqueDe(s.id);
  return s.epoqueId || null;
}

/** Les scènes qui se jouent à une époque : celles qui la portent, et
    celles qui n'en portent aucune. Sans époque demandée, toutes. */
export function situationsA(tramesStore, epoqueId) {
  const toutes = tramesStore.situations();
  if (!epoqueId) return toutes;
  return toutes.filter((s) => {
    const e = epoqueDeScene(tramesStore, s);
    return !e || e === epoqueId;
  });
}

/** L'époque à laquelle un calcul se fait : celle qu'on donne, sinon la
    courante du store, sinon aucune. */
export function epoqueDeCalcul(reseauStore, epoqueId) {
  if (epoqueId !== undefined) return epoqueId || null;
  return typeof reseauStore.epoqueCourante === "function" ? reseauStore.epoqueCourante() || null : null;
}

/* ================= Sièges — déclarés ================= */

export function sieges(reseauStore) {
  return typeof reseauStore.sieges === "function" ? reseauStore.sieges() : [];
}

/** Le siège qui contient cette personne, ou null. */
export function siegeDe(reseauStore, personnageId) {
  return sieges(reseauStore).find((s) => (s.personnageIds || []).includes(personnageId)) || null;
}

/** Un siège est CONTINU quand la même personne y traverse plusieurs
    époques ; il CHANGE de rôle quand il tient plusieurs personnes. */
export function continu(reseauStore, siege) {
  const ids = siege?.personnageIds || [];
  if (ids.length !== 1) return false;
  return epoquesDe(reseauStore, ids[0]).filter((k) => k !== "*").length >= 2;
}

export function comptes(reseauStore) {
  const s = sieges(reseauStore);
  return {
    sieges: s.length,
    continus: s.filter((x) => continu(reseauStore, x)).length,
    changements: s.filter((x) => (x.personnageIds || []).length >= 2).length,
  };
}

/* ================= Les invariants =================
   On RAPPORTE, on ne refuse pas. Un GN à moitié écrit viole ces règles
   en permanence, et un store qui refuserait empêcherait d'écrire. La
   liste se lit dans le cockpit, comme les anomalies de normalisation. */

export function anomalies(reseauStore, mondeStore = null) {
  const out = [];
  const S = sieges(reseauStore);
  const gens = reseauStore.personnages().filter(Boolean);
  const nom = (id) => reseauStore.personnage(id)?.nom || id;
  const declarees = mondeStore ? ordre(mondeStore) : [];

  // 1 — une personne dans au plus un siège
  const vus = new Map();
  for (const s of S) {
    for (const pid of s.personnageIds || []) {
      if (vus.has(pid)) {
        out.push({
          code: "siege:double",
          message: `${nom(pid)} est dans deux sièges : ${vus.get(pid).nom || vus.get(pid).id} et ${s.nom || s.id}. Deux joueurs se présenteraient au même rôle.`,
          ids: [pid, vus.get(pid).id, s.id],
        });
      } else vus.set(pid, s);
    }
  }

  // 2 — un siège, une personne par époque
  for (const s of S) {
    const ids = s.personnageIds || [];
    if (ids.length < 2) continue;
    const par = new Map();
    for (const pid of ids)
      for (const e of epoquesDe(reseauStore, pid)) {
        if (par.has(e)) {
          out.push({
            code: "siege:epoque",
            message: `Le siège ${s.nom || s.id} tient deux rôles à la même époque : ${nom(par.get(e))} et ${nom(pid)}. Un joueur ne peut pas être à deux endroits.`,
            ids: [s.id, par.get(e), pid],
          });
        } else par.set(e, pid);
      }
  }

  // 3 — un PJ sans siège n'est joué par personne
  if (S.length) {
    for (const p of gens) {
      if (p.pj && !vus.has(p.id)) {
        out.push({
          code: "siege:orphelin",
          message: `${p.nom || p.id} n'est dans aucun siège : personne ne le joue.`,
          ids: [p.id],
        });
      }
    }
  }

  // 4 — une facette à une époque qui n'est pas déclarée
  if (declarees.length) {
    for (const p of gens) {
      for (const e of epoquesDe(reseauStore, p.id)) {
        if (e !== "*" && !declarees.includes(e)) {
          out.push({
            code: "epoque:inconnue",
            message: `${p.nom || p.id} est à une époque qui n'est pas déclarée (${e}).`,
            ids: [p.id],
          });
        }
      }
    }
  }

  return out;
}

/* ================= Liens ================= */

/** Les liens visibles à une époque : ceux qui la portent, et ceux qui
    ne portent rien — la parenté n'a pas de date. */
export function liensA(reseauStore, epoqueId) {
  const tous = typeof reseauStore.liensBruts === "function" ? reseauStore.liensBruts() : reseauStore.liens();
  return tous.filter((l) => !l.epoqueId || !epoqueId || l.epoqueId === epoqueId);
}

/** Un lien lu à une époque : ses deux bouts s'ils y existent, sinon
    null — un mort de 1965 n'a pas de contact au mariage. */
export function projeter(reseauStore, lien, epoqueId) {
  if (!epoqueId) return { de: lien.de, vers: lien.vers };
  if (lien.epoqueId && lien.epoqueId !== epoqueId) return null;
  if (!existe(reseauStore, lien.de, epoqueId) || !existe(reseauStore, lien.vers, epoqueId)) return null;
  return { de: lien.de, vers: lien.vers };
}

/** Le graphe d'une époque : les personnes qui y sont, et leurs liens.
    C'est ce que la vue réseau consomme. */
export function grapheA(reseauStore, epoqueId) {
  const gens = personnagesA(reseauStore, epoqueId);
  if (!epoqueId) return { personnages: gens, liens: liensA(reseauStore, null) };
  const dedans = new Set(gens.map((p) => p.id));
  const liens = liensA(reseauStore, epoqueId).filter((l) => dedans.has(l.de) && dedans.has(l.vers));
  return { personnages: gens, liens };
}
