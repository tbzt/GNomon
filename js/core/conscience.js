"use strict";

/* ============================================================
   CONSCIENCE — les douze règles, calculées.
   ------------------------------------------------------------
   Aucun outil de GN existant n'en implémente une seule. C'est le
   produit.

   Chaque règle vient d'une source nommée. Là où la donnée du projet ne
   permet pas de vérifier la règle *à la lettre*, la **transposition est
   écrite dans le champ `transpose`** plutôt que dissimulée : une règle
   qui prétend mesurer autre chose que ce qu'elle mesure est pire que
   pas de règle du tout.

   Module **pur** : lit trois stores, n'en mute aucun, ne touche pas au
   DOM. C'est ce qui permettra à S6 de le rejouer après casting — parce
   que Kröger l'a mesuré, la qualité d'un personnage est relationnelle,
   et un personnage sain sur le papier peut casser au casting.

   ── CE QUE CE MODULE NE FAIT PAS ──
   Il ne calcule **aucun score global**. Douze compteurs indépendants,
   jamais une moyenne : Fredou avertit explicitement contre les barèmes
   de points artificiels, et une note unique inviterait à optimiser le
   chiffre plutôt qu'à écrire. Il ne connaît pas non plus les
   dérogations — c'est l'appelant qui les applique, pour que le calcul
   reste rejouable tel quel.
   ============================================================ */

const DENSITE_MIN = 3;
const DENSITE_MAX = 7;

/** Chevauchement de deux situations dans le temps. Deux situations
    sans horaire ne se chevauchent pas : on ne signale pas une
    collision qu'on n'a pas les moyens de constater. */
function seChevauchent(a, b) {
  if (a.debut == null || a.fin == null || b.debut == null || b.fin == null) return false;
  return b.debut < a.fin && a.debut < b.fin;
}

/**
 * Renvoie les douze règles, chacune avec ses alertes.
 *
 *   { cle, nom, question, source, transpose?, alertes: [{ cible, nom, detail }] }
 *
 * `cible` est l'id de l'objet fautif — c'est lui qui sert de clé de
 * dérogation, pour qu'une justification écrite survive au renommage.
 */
export function conscience(reseau, trames, infos) {
  const pjs = reseau.pj();
  const persos = reseau.personnages();
  const situations = trames.situations();
  const nomDe = (id) => {
    const p = reseau.personnage(id);
    return p ? p.nom : "personnage supprimé";
  };
  const titreDe = (s) => s.titre || "Sans titre";

  /* ---- 1. Personne n'est seul ---- */
  const seuls = pjs
    .filter((p) => !reseau.liensVers(p.id).some((l) => l.importance === "primaire"))
    .map((p) => ({ cible: p.id, nom: p.nom, detail: "personne ne le compte comme contact primaire" }));

  /* ---- 2. Héros de sa propre histoire ---- */
  const figurants = pjs
    .filter((p) => !situations.some((s) => s.pointDeVueId === p.id))
    .map((p) => ({
      cible: p.id,
      nom: p.nom,
      detail: "il n'est le point de vue d'aucune situation",
    }));

  /* ---- 3. Pas que du noir ---- */
  const sansPositif = pjs
    .filter((p) => !reseau.liensDe(p.id).some((l) => l.tonalite === "positif"))
    .map((p) => ({ cible: p.id, nom: p.nom, detail: "aucun de ses contacts n'est positif" }));

  /* ---- 4. Miroir disponible ---- */
  const miroirsPris = [];
  for (const p of pjs) {
    const mir = reseau.miroirDe(p.id);
    if (!mir) continue;
    const m = mir.vers;
    for (const s of situations.filter((x) => x.pointDeVueId === p.id)) {
      const ailleurs = situations.find(
        (o) =>
          o.id !== s.id &&
          (o.castIds || []).includes(m) &&
          !(o.castIds || []).includes(p.id) &&
          seChevauchent(s, o),
      );
      if (ailleurs)
        miroirsPris.push({
          cible: s.id,
          nom: titreDe(s),
          detail: `${nomDe(m)} est retenu par « ${titreDe(ailleurs)} » au même moment`,
        });
    }
  }

  /* ---- 5. Intrigue armée ---- */
  const desarmees = [];
  for (const s of situations)
    for (const idInfo of trames.requiert(s.id)) {
      const info = infos.information(idInfo);
      if (!info) continue;
      const porteur = (s.castIds || []).some((c) => infos.etat(idInfo, c) === "sait");
      if (!porteur)
        desarmees.push({
          cible: s.id,
          nom: titreDe(s),
          detail: `« ${info.contenu || "information sans contenu"} » n'est détenue par personne en scène`,
        });
    }

  /* ---- 6. Chaîne complète ---- */
  const impasses = [];
  for (const s of situations) {
    if (s.terminale) continue;
    for (const idInfo of trames.produit(s.id)) {
      const info = infos.information(idInfo);
      if (!info) continue;
      const usages = trames.situationsAvec(idInfo);
      if (!usages.requiert.length)
        impasses.push({
          cible: s.id,
          nom: titreDe(s),
          detail: `ce qui s'y apprend — « ${info.contenu || "sans contenu"} » — ne sert nulle part ensuite`,
        });
    }
  }

  /* ---- 7. Défection ---- */
  const fragiles = situations
    .map((s) => ({
      s,
      joueurs: (s.castIds || []).filter((id) => {
        const p = reseau.personnage(id);
        return p && p.pj;
      }),
    }))
    .filter(({ joueurs }) => joueurs.length <= 1)
    .map(({ s, joueurs }) => ({
      cible: s.id,
      nom: titreDe(s),
      detail: joueurs.length
        ? `tient au seul ${nomDe(joueurs[0])} — s'il ne vient pas, la scène n'a pas lieu`
        : "aucun joueur au casting",
    }));

  /* ---- 8. Densité ---- */
  const densites = pjs
    .map((p) => {
      const n = new Set(
        reseau.liensTouchant(p.id).map((l) => (l.de === p.id ? l.vers : l.de)),
      ).size;
      return { p, n };
    })
    .filter(({ n }) => n < DENSITE_MIN || n > DENSITE_MAX)
    .map(({ p, n }) => ({
      cible: p.id,
      nom: p.nom,
      detail:
        n < DENSITE_MIN
          ? `${n} interlocuteur${n > 1 ? "s" : ""} — risque de se retrouver seul`
          : `${n} interlocuteurs — trop pour être tenus en tête`,
    }));

  /* ---- 9. Ponts inter-groupes ---- */
  const groupeDe = (id) => (reseau.personnage(id) || {}).groupeId || null;
  const ilots = reseau
    .groupes()
    .filter(
      (g) =>
        reseau.membresDe(g.id).length &&
        !reseau
          .liens()
          .some(
            (l) =>
              groupeDe(l.de) !== groupeDe(l.vers) &&
              (groupeDe(l.de) === g.id || groupeDe(l.vers) === g.id),
          ),
    )
    .map((g) => ({ cible: g.id, nom: g.nom, detail: "aucun lien vers l'extérieur du groupe" }));

  /* ---- 10. Mixité des intrigues ---- */
  const monotones = pjs
    .filter((p) => {
      const interne =
        !!(p.desir || "").trim() || situations.some((s) => s.pointDeVueId === p.id);
      const externe = situations.some(
        (s) => (s.castIds || []).includes(p.id) && s.pointDeVueId && s.pointDeVueId !== p.id,
      );
      return !(interne && externe);
    })
    .map((p) => {
      const interne =
        !!(p.desir || "").trim() || situations.some((s) => s.pointDeVueId === p.id);
      return {
        cible: p.id,
        nom: p.nom,
        detail: interne
          ? "rien ne lui vient du dehors : il n'est dans aucune scène qu'un autre porte"
          : "rien ne vient de lui : ni désir écrit, ni scène dont il soit le point de vue",
      };
    });

  /* ---- 11. Suites ---- */
  const culsDeSac = situations
    .filter((s) => !s.terminale && !trames.conclusionsDe(s.id).some((c) => c.vers))
    .map((s) => ({
      cible: s.id,
      nom: titreDe(s),
      detail: trames.conclusionsDe(s.id).length
        ? "ses conclusions ne mènent encore nulle part"
        : "aucune conclusion, et elle n'est pas marquée terminale",
    }));

  /* ---- 12. Différenciation morale ---- */
  const jumeaux = [];
  for (let i = 0; i < pjs.length; i++)
    for (let j = i + 1; j < pjs.length; j++) {
      const a = pjs[i];
      const b = pjs[j];
      if (!a.groupeId || a.groupeId !== b.groupeId) continue;
      const ma = (a.moral || "").trim();
      if (!ma || ma !== (b.moral || "").trim()) continue;
      jumeaux.push({
        cible: `${a.id}+${b.id}`,
        nom: `${a.nom} et ${b.nom}`,
        detail: `même groupe, même point de vue moral : « ${ma} »`,
      });
    }

  return [
    {
      cle: "seul",
      nom: "Personne n'est seul",
      question: "Tout PJ est-il le contact primaire de quelqu'un ?",
      source: "Kröger — « aucun contact pertinent » est le premier symptôme d'un mauvais personnage",
      alertes: seuls,
    },
    {
      cle: "heros",
      nom: "Héros de sa propre histoire",
      question: "Tout PJ est-il le point de vue d'au moins une situation ?",
      source: "Fredou · eXpérience — « la femme du pêcheur » n'existe que pour soutenir un autre",
      alertes: figurants,
    },
    {
      cle: "positif",
      nom: "Pas que du noir",
      question: "Tout PJ a-t-il un contact inconditionnellement positif ?",
      source: "Kröger — « tous tes contacts sont négatifs » figure au catalogue des mauvais personnages",
      alertes: sansPositif,
    },
    {
      cle: "miroir",
      nom: "Miroir disponible",
      question: "Le contact-miroir est-il libre pendant la scène-clé ?",
      source: "Kröger — « ton miroir ne peut pas être coincé la moitié du GN dans une négociation dont tu es exclu »",
      alertes: miroirsPris,
    },
    {
      cle: "armee",
      nom: "Intrigue armée",
      question: "Quelqu'un en scène détient-il ce qu'il faut savoir ?",
      source: "Kröger — « une intrigue passive sans déclencheur n'est pas une intrigue » · Trames et enjeux — la vérification « avant Tx »",
      alertes: desarmees,
    },
    {
      cle: "chaine",
      nom: "Chaîne complète",
      question: "Ce qui s'apprend sert-il ensuite à quelque chose ?",
      source: "Trames et enjeux — « après Tx, le personnage a-t-il de quoi continuer ? » · Kröger — « si ça n'influence rien, pourquoi est-ce là ? »",
      alertes: impasses,
    },
    {
      cle: "defection",
      nom: "Défection",
      question: "Que reste-t-il si un joueur ne vient pas ?",
      source: "Morningstar — la redondance est un choix de design, pas un accident",
      transpose:
        "Mesuré ici comme « une situation dont la jouabilité tient à un seul PJ ». Les nombres exacts de Morningstar (taille des groupes, liens par personnage) restent à vérifier à la source avant d'être codés.",
      alertes: fragiles,
    },
    {
      cle: "densite",
      nom: "Densité",
      question: `Entre ${DENSITE_MIN} et ${DENSITE_MAX} interlocuteurs par PJ ?`,
      source: "Kröger — ni trop nombreux pour être retenus, ni trop peu au risque de rester seul",
      alertes: densites,
    },
    {
      cle: "ponts",
      nom: "Ponts inter-groupes",
      question: "Chaque groupe a-t-il des contacts hors de lui-même ?",
      source: "Kröger — « does every group have cross-group contacts ? »",
      alertes: ilots,
    },
    {
      cle: "mixite",
      nom: "Mixité des intrigues",
      question: "Chaque PJ a-t-il de quoi agir, et de quoi lui arriver ?",
      source: "Kröger — « dans l'idéal, un personnage a des intrigues internes ET externes »",
      transpose:
        "L'objet Intrigue n'existe pas : « interne » est lu comme un désir écrit ou une situation dont le PJ est le point de vue, « externe » comme une situation qu'un autre porte et où il figure.",
      alertes: monotones,
    },
    {
      cle: "suites",
      nom: "Suites",
      question: "Chaque situation mène-t-elle quelque part ?",
      source: "eXpérience — « a-t-elle des suites envisageables ? Lesquelles ? »",
      alertes: culsDeSac,
    },
    {
      cle: "differenciation",
      nom: "Différenciation morale",
      question: "Deux PJ d'un même groupe pensent-ils différemment ?",
      source: "eXpérience · Electro-GN — les personnages s'individualisent par comparaison sur le problème moral",
      alertes: jumeaux,
    },
  ];
}
