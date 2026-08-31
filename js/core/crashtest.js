"use strict";

/* ============================================================
   CRASH TEST — « et si… ? », posé sur autre chose qu'une personne.
   ------------------------------------------------------------
   `defection.js` répond déjà, et exactement, à « et si ce personnage ne
   vient pas ? ». Ce module ne le refait pas : il l'importe, et couvre
   les trois cas qu'il ne sait pas traiter — parce qu'ils ne portent pas
   sur une personne, ou pas sur une absence totale.

   ── 1. LA SUPPRESSION D'UNE SITUATION ──
   En LECTURE SEULE, contrairement à `TrameStore.supprimerSituation()`
   qui, lui, écrit. C'est le point : on veut savoir ce que coûterait la
   coupe **avant** de la faire, pas après. Trois dégâts :
   les conclusions entrantes qui perdraient leur cible, les informations
   qu'elle seule produit, et les personnages dont c'est la seule scène.

   ── 2. UNE INFORMATION JAMAIS DÉCOUVERTE ──
   Distinct du diagnostic « information sans porteur », qui constate un
   état présent (« personne ne la sait **aujourd'hui** »). Ici on simule
   un futur : elle ne sera **jamais** sue. Et c'est **récursif** — les
   situations qui la requièrent n'arrivent pas, donc ce qu'elles
   produisent n'est pas produit non plus, donc les situations qui en
   dépendaient tombent à leur tour. C'est la propagation qu'aucune
   relecture à la main ne fait, et c'est tout l'intérêt.

   ── 3. UNE ARRIVÉE TARDIVE ──
   Pas une absence : une absence **partielle**. Les situations qui se
   terminent avant l'arrivée sont perdues pour cette personne ; les
   autres tiennent. On réutilise `defection()` sur cet ensemble réduit
   plutôt que d'écrire un second calcul de dégâts — un joueur qui arrive
   à 22 h est, pour tout ce qui se joue avant 22 h, un joueur absent.

   ── CE QUE CE MODULE NE REND JAMAIS ──
   Un score. Chaque fonction rend une **liste structurée de
   conséquences**, à charge de l'appelant de les montrer. « 3 scènes
   fragilisées, 1 information sans porteur » se lit ; « gravité : 7 » ne
   veut rien dire et invite à optimiser un chiffre.

   Module **pur** : lit des stores, n'en mute aucun, ne touche pas au
   DOM.
   ============================================================ */
import { defection } from "./defection.js";

/**
 * Ce que coûterait la suppression d'une situation — sans la supprimer.
 *
 *   { situation, conclusionsOrphelinees[], informationsPerdues[],
 *     personnagesDesoeuvres[], rienNeCasse }
 */
export function crashTestSituation(situationId, { reseau, trames, infos }) {
  const s = trames.situation(situationId);
  if (!s) return null;

  // Les conclusions qui pointaient VERS elle : leur auteur les a
  // écrites, elles survivraient à la coupe en redevenant des questions
  // ouvertes (cf. ARCHITECTURE.md §5b). Ce n'est pas une perte sèche,
  // mais c'est du travail qui repasse en attente.
  const conclusionsOrphelinees = trames.conclusionsVers(situationId).map((c) => {
    const source = trames.situation(c.de);
    return {
      id: c.id,
      texte: c.texte || "sans texte",
      depuis: source ? source.titre || "Sans titre" : "situation supprimée",
      depuisId: c.de,
    };
  });

  // Ce qu'elle est SEULE à produire disparaîtrait du monde.
  const informationsPerdues = (s.produitIds || [])
    .map((id) => infos.information(id))
    .filter(Boolean)
    .filter((i) => trames.situationsAvec(i.id).produit.length === 1)
    .map((i) => ({
      id: i.id,
      contenu: i.contenu || "information sans contenu",
      requisePar: trames
        .situationsAvec(i.id)
        .requiert.filter((x) => x.id !== situationId)
        .map((x) => x.titre || "Sans titre"),
    }));

  // Ceux pour qui c'était la seule scène : ils n'auraient plus rien à
  // jouer du tout — c'est le signal `prise:absente` du diagnostic, vu
  // en avance de phase.
  const concernes = new Set([s.pointDeVueId, ...(s.castIds || [])].filter(Boolean));
  const personnagesDesoeuvres = [...concernes]
    .map((id) => reseau.personnage(id))
    .filter(Boolean)
    .filter((p) => {
      const autres = trames
        .situations()
        .filter((x) => x.id !== situationId)
        .some((x) => x.pointDeVueId === p.id || (x.castIds || []).includes(p.id));
      return !autres;
    })
    .map((p) => ({ id: p.id, nom: p.nom, pj: !!p.pj }));

  return {
    situation: s,
    conclusionsOrphelinees,
    informationsPerdues,
    personnagesDesoeuvres,
    rienNeCasse:
      !conclusionsOrphelinees.length &&
      !informationsPerdues.length &&
      !personnagesDesoeuvres.length,
  };
}

/**
 * Si cette information n'était JAMAIS découverte — en cascade.
 *
 * Les situations qui la requièrent n'arrivent pas ; ce qu'elles
 * produisent n'est donc pas produit ; les situations qui en dépendaient
 * tombent à leur tour. On propage jusqu'au point fixe.
 *
 *   { information, situationsEmpechees[], informationsPerdues[],
 *     profondeur, rienNeCasse }
 */
export function crashTestInformation(informationId, { trames, infos }) {
  const depart = infos.information(informationId);
  if (!depart) return null;

  const infosMortes = new Set([informationId]);
  const sitsMortes = new Set();
  // La profondeur dit si l'effet reste local ou traverse le scénario :
  // 1 = un effet direct, au-delà = une vraie cascade.
  let profondeur = 0;

  // ── PROPAGATION PAR VAGUES, ET C'EST NÉCESSAIRE ──
  // Une simple boucle « tant que ça bouge » terminerait aussi, mais sa
  // profondeur dépendrait de l'ORDRE des situations dans le tableau :
  // rangées en ordre de dépendance, trois étages de cascade tombent en
  // un seul tour et l'effet paraîtrait direct. On fige donc l'ensemble
  // des informations mortes au DÉBUT de chaque vague — ce qui meurt
  // pendant ne prend effet qu'à la suivante. Le compte devient celui
  // des étages réellement traversés, quel que soit l'ordre de lecture.
  for (;;) {
    const connues = new Set(infosMortes);
    const vague = trames
      .situations()
      .filter((s) => !sitsMortes.has(s.id))
      .filter((s) => (s.requiertIds || []).some((id) => connues.has(id)));
    if (!vague.length) break;
    profondeur++;
    for (const s of vague) sitsMortes.add(s.id);
    // Ce que ces situations étaient seules à produire meurt avec elles.
    for (const s of vague)
      for (const id of s.produitIds || []) {
        if (infosMortes.has(id)) continue;
        const producteurs = trames.situationsAvec(id).produit;
        if (producteurs.every((x) => sitsMortes.has(x.id))) infosMortes.add(id);
      }
  }

  const situationsEmpechees = [...sitsMortes]
    .map((id) => trames.situation(id))
    .filter(Boolean)
    .map((s) => ({ id: s.id, titre: s.titre || "Sans titre" }));

  const informationsPerdues = [...infosMortes]
    .filter((id) => id !== informationId)
    .map((id) => infos.information(id))
    .filter(Boolean)
    .map((i) => ({ id: i.id, contenu: i.contenu || "information sans contenu" }));

  return {
    information: depart,
    situationsEmpechees,
    informationsPerdues,
    // 1 = effet direct ; au-delà, la perte s'est propagée d'étage en
    // étage — c'est ce qu'aucune relecture à la main ne voit.
    profondeur,
    rienNeCasse: !situationsEmpechees.length,
  };
}

/**
 * Une arrivée tardive : absent de tout ce qui finit avant `heure`.
 *
 * On réutilise `defection()` sur une vue réduite du store plutôt que
 * d'écrire un second calcul de dégâts — pour ce qui se joue avant son
 * arrivée, un retardataire EST un absent. La vue ne masque que les
 * situations concernées ; le réseau et les informations restent
 * entiers, parce que ses liens et ce qu'il sait ne dépendent pas de
 * l'heure à laquelle il entre.
 *
 *   { personnage, heure, manquees[], degats } — `degats` est le rendu
 *   de `defection()`, ou `null` si aucune situation n'est manquée.
 */
export function crashTestArriveeTardive(personnageId, heure, stores) {
  const { reseau, trames, infos } = stores;
  const p = reseau.personnage(personnageId);
  if (!p || heure == null) return null;

  const manquees = trames
    .situations()
    .filter((s) => s.fin != null && s.fin <= heure)
    .filter((s) => s.pointDeVueId === personnageId || (s.castIds || []).includes(personnageId));

  if (!manquees.length)
    return { personnage: p, heure, manquees: [], degats: null };

  const ids = new Set(manquees.map((s) => s.id));
  // Vue réduite : `defection()` ne lit que `situations()`, `situation()`
  // et `situationsAvec()` — on les restreint, le reste passe tel quel.
  const vue = {
    reseau,
    infos,
    trames: {
      ...trames,
      situations: (trameId = null) => trames.situations(trameId).filter((s) => ids.has(s.id)),
      situation: (id) => (ids.has(id) ? trames.situation(id) : null),
      situationsAvec: (infoId) => {
        const r = trames.situationsAvec(infoId);
        return {
          requiert: r.requiert.filter((s) => ids.has(s.id)),
          produit: r.produit.filter((s) => ids.has(s.id)),
        };
      },
    },
  };

  return {
    personnage: p,
    heure,
    manquees: manquees.map((s) => ({ id: s.id, titre: s.titre || "Sans titre" })),
    degats: defection(personnageId, vue),
  };
}
