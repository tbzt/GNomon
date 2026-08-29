"use strict";

/* ============================================================
   COUVERTURE — les neuf composantes du personnage, CALCULÉES.
   ------------------------------------------------------------
   Laura Kröger (« Plot and Character Design », Knudepunkt 2019) donne
   neuf éléments qui font un bon personnage de GN. La méthode eXpérience
   en donne huit autres, de structure. Dix-sept cases au total.

   **Faire remplir dix-sept cases tue l'écriture.** Alors les huit champs
   d'eXpérience sont saisis (ils sont l'intention de l'auteur), et les
   neuf de Kröger sont **dérivés du réseau** : ce sont des conséquences,
   pas des déclarations. On ne remplit pas la couverture, on l'atteint en
   écrivant.

   Ce module est **pur** : il lit un store, il ne le mute jamais, il ne
   touche pas au DOM. C'est ce qui le rend testable, et c'est ce qui
   permettra à la conscience (S4) de le rejouer après casting.

   Chaque composante renvoie :
       { cle, nom, ok, manque }
   `manque` est le texte affiché quand la pastille est grise — il dit ce
   qui manque ET pourquoi ça compte. Une jauge qui se contente de dire
   « non » est un reproche ; une jauge qui dit pourquoi est un outil.
   ============================================================ */

/** Le fait qu'une composante soit satisfaite est parfois affaire de sens
    de lecture. Deux conventions, tenues ici et pas ailleurs :

    - « contact positif » se lit sur les liens **sortants** — Kröger le
      formule en creux (« tous tes contacts sont négatifs » est le
      symptôme), et les contacts d'un personnage sont ce que sa fiche
      déclare ;
    - « personne n'est seul » se lira sur les liens **entrants** (S4) —
      la question n'est pas qui tu comptes, mais pour qui tu comptes.
    Deux règles, deux sens : c'est voulu. */

export function couverture(store, personnageId) {
  const p = store.personnage(personnageId);
  if (!p) return [];

  const sortants = store.liensDe(personnageId);
  const touchants = store.liensTouchant(personnageId);
  const correspondants = new Set(
    touchants.map((l) => (l.de === personnageId ? l.vers : l.de)),
  );

  const estPnj = (id) => {
    const q = store.personnage(id);
    return q && !q.pj;
  };

  return [
    {
      cle: "miroir",
      nom: "Contact-miroir",
      ok: !!store.miroirDe(personnageId),
      manque:
        "Aucun contact-miroir déclaré. Kröger : le miroir ne sert pas à lier " +
        "tout le jeu à un seul personnage, mais à garantir que personne n'est " +
        "laissé seul et que l'intrigue pèse autant des deux côtés.",
    },
    {
      cle: "positif",
      nom: "Contact positif",
      ok: sortants.some((l) => l.tonalite === "positif"),
      manque:
        "Aucun contact inconditionnellement positif — quelqu'un qui ne le " +
        "trahira pas, à qui il peut confier ses intrigues. « Tous tes contacts " +
        "sont négatifs » figure au catalogue des mauvais personnages.",
    },
    {
      cle: "groupe",
      nom: "Groupe de référence",
      ok:
        !!p.groupeId &&
        touchants.some((l) => {
          const autre = store.personnage(l.de === personnageId ? l.vers : l.de);
          return autre && autre.groupeId === p.groupeId;
        }),
      manque: p.groupeId
        ? "Aucun lien à l'intérieur de son propre groupe : rien ne garantit " +
          "qu'il soit inclus dans les intrigues qui le concernent."
        : "Ce personnage n'appartient à aucun groupe — d'où lui vient son " +
          "sentiment d'appartenance ?",
    },
    {
      cle: "fonction",
      nom: "Métier ou fonction",
      ok: !!(p.role || "").trim(),
      manque:
        "Aucun métier ni fonction. Que fait ce personnage de ses mains " +
        "pendant le jeu — et si la réponse est « rien », que fait-il là ?",
    },
    {
      cle: "agenda",
      nom: "Intrigue ou agenda",
      // Proxy jusqu'à S3 : le désir d'eXpérience tient lieu d'agenda tant
      // que l'objet Intrigue n'existe pas. À rebrancher au lot S3.
      ok: !!(p.desir || "").trim(),
      manque:
        "Aucun désir formulé. Qu'est-ce qui crée du jeu pour lui, et " +
        "a-t-il les moyens de l'obtenir ?",
    },
    {
      cle: "conflit",
      nom: "Conflit",
      ok: touchants.some((l) => l.tonalite === "negatif" || l.tonalite === "complique"),
      manque:
        "Aucune tension, dans aucun sens. Qu'est-ce qui l'empêche d'obtenir " +
        "ce qu'il veut ?",
    },
    {
      cle: "surprise",
      nom: "Surprise",
      ok: !!p.surprise,
      manque:
        "Rien qu'il ignore encore et qui puisse le retourner en cours de jeu. " +
        "Ça peut être petit — à manier avec prudence : certains joueurs " +
        "adorent, d'autres détestent.",
    },
    {
      cle: "reseau",
      nom: "Réseau de contacts",
      ok: correspondants.size >= 3,
      manque:
        `Seulement ${correspondants.size} interlocuteur${correspondants.size > 1 ? "s" : ""}. ` +
        "Risque réel de se retrouver seul si un joueur manque ou si une scène " +
        "s'éternise sans lui.",
    },
    {
      cle: "pnj",
      nom: "Contact PNJ",
      ok: [...correspondants].some(estPnj),
      manque:
        "Aucun lien vers un PNJ : l'équipe d'organisation n'a aucune prise " +
        "sur ce personnage pendant le jeu.",
    },
  ];
}

/** Raccourci : `{ couvert, total }` sans reconstruire les libellés. */
export function scoreCouverture(store, personnageId) {
  const c = couverture(store, personnageId);
  return { couvert: c.filter((x) => x.ok).length, total: c.length };
}
