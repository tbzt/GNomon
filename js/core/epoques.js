"use strict";

/* ============================================================
   ÉPOQUES — l'identité, l'incarnation et le siège.
   ------------------------------------------------------------
   Un GN qui se déroule à un seul moment n'a pas besoin de ce module.
   Dès qu'il y en a deux — un flashback la veille, une campagne en
   plusieurs opus, un prologue — trois questions que `Personnage`
   confondait se séparent :

       qui est-ce ?      → le RÔLE, qui persiste hors du temps
       quand ?           → l'ÉPOQUE de cette incarnation
       qui le joue ?     → le SIÈGE qu'une personne réelle occupe

   ── CE QUE `Personnage` ÉTAIT DÉJÀ ──
   Tout ce que porte une fiche est daté : le background, les objectifs,
   le style, et surtout les liens. Les contacts de quelqu'un vingt ans
   plus tard ne sont pas les mêmes contacts. **`Personnage` était donc
   déjà une incarnation** ; il lui manquait seulement de le dire, et de
   pointer vers l'identité qui traverse.

   ── LE RÔLE SE DÉRIVE, LE SIÈGE SE DÉCLARE ──
   Deux incarnations qui partagent un `roleId` sont la même personne :
   c'est un fait, il se lit, il n'a pas de table. Deux incarnations
   jouées par la même personne sont une DÉCISION de casting : elle ne se
   devine pas, donc elle se stocke. Même partage que la couverture, qui
   se calcule, et la tonalité d'un lien, qui se saisit.

   ── POURQUOI LES DEUX, ET PAS SEULEMENT LE SIÈGE ──
   Ange-65 et Ange-85 partagent le rôle ET le siège. Antoine-65 et
   Daniel-85 partagent le siège et pas le rôle. Et en campagne un rôle
   change de siège entre deux opus — le personnage revient, le joueur a
   démissionné. Un modèle à un seul niveau ne sait dire aucun des trois.

   ── LES LIENS NE SONT PAS DATÉS ICI ──
   `epoqueId` est optionnel sur un lien et `null` veut dire « vrai à
   toutes les époques ». C'est le bon défaut : la parenté, le sang et
   l'histoire commune n'ont pas de date. Les liens de situation se
   datent quand on en a besoin, et pas avant.

   Module **pur** : il lit des stores, n'en mute aucun, ne touche pas au
   DOM. Feuille : ne dépend de rien.
   ============================================================ */

/** Les époques déclarées, dans l'ordre. Un GN mono-époque en a une. */
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

/* ================= Rôles — dérivés ================= */

/** Les incarnations d'un rôle, ordonnées par époque.
    Un personnage sans `roleId` est son propre rôle : c'est le cas
    dégénéré, et il est correct — un GN mono-époque n'écrit rien. */
export function incarnations(reseauStore, roleId, mondeStore = null) {
  const gens = reseauStore.personnages().filter((p) => p && (p.roleId || p.id) === roleId);
  if (!mondeStore) return gens;
  return gens.sort((a, b) => rang(mondeStore, a.epoqueId) - rang(mondeStore, b.epoqueId));
}

/** L'identifiant de rôle d'un personnage. */
export function roleDe(reseauStore, personnageId) {
  const p = reseauStore.personnage(personnageId);
  return p ? p.roleId || p.id : null;
}

/** Tous les rôles : { id, nom, personnages[] }. Le nom est celui de la
    première incarnation dans l'ordre des époques — c'est sous ce nom-là
    que l'équipe parle du rôle. */
export function roles(reseauStore, mondeStore = null) {
  const par = new Map();
  for (const p of reseauStore.personnages()) {
    if (!p) continue;
    const rid = p.roleId || p.id;
    if (!par.has(rid)) par.set(rid, []);
    par.get(rid).push(p);
  }
  const out = [];
  for (const [id, gens] of par) {
    if (mondeStore) gens.sort((a, b) => rang(mondeStore, a.epoqueId) - rang(mondeStore, b.epoqueId));
    out.push({ id, nom: gens[0]?.nom || "", personnages: gens });
  }
  return out;
}

/* ================= Sièges — déclarés ================= */

export function sieges(reseauStore) {
  return typeof reseauStore.sieges === "function" ? reseauStore.sieges() : [];
}

/** Le siège qui contient ce personnage, ou null. */
export function siegeDe(reseauStore, personnageId) {
  return sieges(reseauStore).find((s) => (s.personnageIds || []).includes(personnageId)) || null;
}

/** Un siège est CONTINU si toutes ses incarnations partagent le rôle —
    le joueur vieillit le même personnage. Sinon il CHANGE de rôle.
    C'est le compte que la fiche pratique écrivait à la main, et qui
    s'écrivait faux. */
export function continu(reseauStore, siege) {
  const ids = siege?.personnageIds || [];
  if (ids.length < 2) return false;
  const r = ids.map((i) => roleDe(reseauStore, i));
  return r.every((x) => x && x === r[0]);
}

export function comptes(reseauStore) {
  const s = sieges(reseauStore);
  return {
    sieges: s.length,
    continus: s.filter((x) => continu(reseauStore, x)).length,
    changements: s.filter((x) => (x.personnageIds || []).length >= 2 && !continu(reseauStore, x)).length,
  };
}

/* ================= Les invariants =================
   Trois règles, et elles ne sont pas décoratives : la première seule
   aurait interdit qu'un même rôle du samedi soit revendiqué par deux
   rôles de la veille — deux joueurs au même costume, découvert au
   casting.

   On RAPPORTE, on ne refuse pas. Un GN à moitié écrit viole ces règles
   en permanence, et un store qui refuserait empêcherait d'écrire. La
   liste se lit dans le cockpit, comme les anomalies de normalisation. */

export function anomalies(reseauStore, mondeStore = null) {
  const out = [];
  const S = sieges(reseauStore);
  const gens = reseauStore.personnages().filter(Boolean);
  const nom = (id) => reseauStore.personnage(id)?.nom || id;

  // 1 — un personnage dans au plus un siège
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

  // 2 — un siège, une incarnation par époque
  for (const s of S) {
    const par = new Map();
    for (const pid of s.personnageIds || []) {
      const e = reseauStore.personnage(pid)?.epoqueId || null;
      if (par.has(e)) {
        out.push({
          code: "siege:epoque",
          message: `Le siège ${s.nom || s.id} tient deux rôles à la même époque : ${nom(par.get(e))} et ${nom(pid)}. Un joueur ne peut pas être à deux endroits.`,
          ids: [s.id, par.get(e), pid],
        });
      } else par.set(e, pid);
    }
  }

  // 3 — un rôle, une incarnation par époque
  for (const r of roles(reseauStore)) {
    const par = new Map();
    for (const p of r.personnages) {
      const e = p.epoqueId || null;
      if (par.has(e)) {
        out.push({
          code: "role:epoque",
          message: `Le rôle « ${r.nom} » a deux incarnations à la même époque : ${nom(par.get(e))} et ${nom(p.id)}.`,
          ids: [r.id, par.get(e), p.id],
        });
      } else par.set(e, p.id);
    }
  }

  // 4 — un personnage sans siège n'est joué par personne
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

  // 5 — époque inconnue
  if (mondeStore) {
    const connues = new Set(epoques(mondeStore).map((e) => e.id));
    if (connues.size) {
      for (const p of gens) {
        if (p.epoqueId && !connues.has(p.epoqueId)) {
          out.push({
            code: "epoque:inconnue",
            message: `${p.nom || p.id} est à une époque qui n'est pas déclarée (${p.epoqueId}).`,
            ids: [p.id],
          });
        }
      }
    }
  }

  return out;
}

/* ================= Liens =================
   ── UN LIEN APPARTIENT AU RÔLE, PAS À L'INCARNATION ──
   « Sa femme depuis 1958 » est un fait sur la personne, pas sur la
   personne-en-1985. Si les liens ne se lisaient qu'à l'incarnation qui
   les porte, créer un « Ange 1965 » lui donnerait un graphe vide — et
   l'auteur recopierait trois cents arêtes à la main pour rien.

   Ils se résolvent donc PAR RÔLE, et se PROJETTENT sur l'époque
   affichée : un lien écrit entre Ange-85 et Simone-85 se lit, en 1965,
   entre Ange-65 et Simone-65. Un lien daté ne se lit qu'à sa date. */

/** Les liens visibles à une époque : ceux qui la portent, et ceux qui
    ne portent rien — la parenté n'a pas de date. */
export function liensA(reseauStore, epoqueId) {
  return reseauStore.liens().filter((l) => !l.epoqueId || l.epoqueId === epoqueId);
}

/** L'incarnation d'un rôle à une époque donnée, ou null. */
export function incarnationA(reseauStore, personnageId, epoqueId) {
  const rid = roleDe(reseauStore, personnageId);
  if (!rid) return null;
  const p = reseauStore
    .personnages()
    .find((x) => x && (x.roleId || x.id) === rid && x.epoqueId === epoqueId);
  return p || null;
}

/** Projette un lien sur une époque : renvoie ses deux bouts ramenés aux
    incarnations de cette époque, ou `null` si l'un des deux n'y existe
    pas — un mort de 1965 n'a pas de contact au mariage. */
export function projeter(reseauStore, lien, epoqueId) {
  if (!epoqueId) return { de: lien.de, vers: lien.vers };
  if (lien.epoqueId && lien.epoqueId !== epoqueId) return null;
  const de = incarnationA(reseauStore, lien.de, epoqueId);
  const vers = incarnationA(reseauStore, lien.vers, epoqueId);
  if (!de || !vers) return null;
  return { de: de.id, vers: vers.id };
}

/** Le graphe d'une époque : les personnages qui y sont, et les liens
    projetés sur eux. C'est ce que la vue réseau consomme. */
export function grapheA(reseauStore, epoqueId) {
  const gens = personnagesA(reseauStore, epoqueId);
  if (!epoqueId) return { personnages: gens, liens: reseauStore.liens() };
  const dedans = new Set(gens.map((p) => p.id));
  const liens = [];
  const vus = new Set();
  for (const l of reseauStore.liens()) {
    const proj = projeter(reseauStore, l, epoqueId);
    if (!proj || !dedans.has(proj.de) || !dedans.has(proj.vers)) continue;
    // Deux incarnations d'un même rôle peuvent projeter le même lien :
    // on n'en dessine qu'une arête.
    const cle = `${l.id}|${proj.de}|${proj.vers}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    liens.push({ ...l, de: proj.de, vers: proj.vers });
  }
  return { personnages: gens, liens };
}

/** Les personnages d'une époque. Sans époque déclarée, tout le monde.
    Un personnage sans époque est partout : c'est le cas d'un GN qui
    n'en a jamais déclaré, et il ne doit rien perdre. */
export function personnagesA(reseauStore, epoqueId) {
  const gens = reseauStore.personnages().filter(Boolean);
  return epoqueId ? gens.filter((p) => !p.epoqueId || p.epoqueId === epoqueId) : gens;
}
