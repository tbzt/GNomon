"use strict";

/* ============================================================
   DIAGNOSTIC — la couche d'interprétation, pas un nouveau calcul.
   ------------------------------------------------------------
   GNomon sait déjà calculer treize règles de conscience, ce que coûte
   une absence, les collisions de temps, l'asymétrie de connaissance.
   Le problème n'est pas le calcul, c'est l'accès : chacun vit dans son
   écran, avec son vocabulaire, et il faut déjà savoir ce qu'est un
   « miroir désaccordé » pour aller le chercher.

   Ce module ne recalcule rien de ce qui existe : il lit `conscience()`,
   `frise()`, `classementFragilite()`, et les traduit en une liste
   commune de **diagnostics** — un signal humain, explicable,
   actionnable, jamais un score.

   ── VAGUE 1 : QUATRE SIGNAUX NEUFS, TOUS À HAUTE CONFIANCE ──
   Cf. PRODUCT_TRANSFORMATION.md §4 et §11. Là où aucun module existant
   ne répond, on ajoute — en réutilisant les méthodes déjà exposées par
   les stores, jamais un nouveau moteur — et seulement des signaux
   STRUCTURELS (des faits, pas des heuristiques) :

   1. **Prise absente** (analyse C) — un PJ qui n'apparaît dans aucune
      situation, ni comme point de vue ni comme figurant. Plus sévère
      que la règle « héros » de la conscience (qui ne regarde que le
      point de vue) : quand les deux s'appliquent au même personnage,
      seule celle-ci est montrée, l'autre serait un doublon plus faible
      du même constat.
   2. **Information sans porteur** (analyse D1) — une information
      requise par une situation, que personne au monde ne détient
      encore.
   3. **Référence orpheline** — une situation dont le point de vue ou un
      rôle de casting pointe vers un personnage supprimé. `TrameStore`
      ne purge jamais ces références par choix (cf. ARCHITECTURE.md
      §5b) ; rien ne les remontait jusqu'ici.
   4. **Fragilité résumée** (analyse B) — pas un nouveau calcul :
      `classementFragilite()` fait déjà tout le travail, ceci n'en est
      que l'exposition, bornée aux cas qui comptent (cf. `depuisFragilite`).

   ── VAGUE 4 : LE PREMIER SIGNAL À CONFIANCE MOYENNE ──
   **La promesse narrative** (analyse G) — une situation qui promet une
   révélation (elle `produit` une information) mais dont la clé pour
   l'atteindre (ce qu'elle `requiert`) ne tient qu'à une seule personne
   au monde.

   Ce n'est PAS un fait comme les quatre ci-dessus : une situation peut
   être délibérément écrite comme rare et fragile — un secret voué à ne
   sortir qu'avec un concours de circonstances précis. Elle porte donc
   `confiance: "moyenne"`, et trois conséquences en découlent, tenues
   ici et pas seulement dans le document de conception :

   1. sa formulation est au **conditionnel** (« semble », « risque
      de »), jamais à l'affirmatif ;
   2. son `detail` dit **explicitement** qu'une fragilité peut être
      voulue, pour que l'auteur n'ait pas à deviner qu'on n'affirme
      rien ;
   3. elle est rangée en `a-verifier`, jamais en `attention` — une
      hypothèse ne passe pas devant un fait.

   Le module ne cherche jamais à juger si la promesse est bonne
   dramatiquement : seulement si sa condition d'accès est étroite. La
   limite est structurelle, et c'est voulu.

   ── CE QUE CE MODULE NE FAIT PAS ──
   Il ne connaît pas `Derogations` — comme `conscience()`, il reste
   rejouable tel quel, et c'est l'appelant (le cockpit) qui croise avec
   les dérogations pour savoir ce qui est déjà traité. Il n'attribue
   aucun score global : `gravite` est qualitative, à deux valeurs, pour
   grouper l'affichage, jamais pour l'additionner en note. `confiance`
   distingue un fait structurel d'une heuristique — tous les signaux de
   cette vague sont "haute", pour que l'ajout futur d'une confiance
   "moyenne" (vague 4) ne mélange jamais les deux tons dans le même
   texte sans le dire.

   Module **pur** : lit des stores, n'en mute aucun, ne touche pas au
   DOM.
   ============================================================ */
import { conscience } from "./conscience.js";
import { situationsA, epoqueDeCalcul } from "./epoques.js";
import { frise, heure } from "./temps.js";
import { classementFragilite } from "./defection.js";

/** Gravité qualitative par origine. Deux valeurs, pour grouper
    l'affichage — jamais pour être additionnées en un chiffre. */
const GRAVITE = {
  seul: "attention",
  heros: "a-verifier",
  positif: "a-verifier",
  miroir: "attention",
  armee: "attention",
  chaine: "a-verifier",
  defection: "attention",
  densite: "a-verifier",
  ponts: "a-verifier",
  mixite: "a-verifier",
  suites: "attention",
  differenciation: "a-verifier",
};

/** Titre court par règle de conscience — une phrase humaine, jamais le
    nom technique de la règle. `a` est l'alerte, telle que renvoyée par
    `conscience()`. */
function titreConscience(regleCle, a) {
  switch (regleCle) {
    case "seul":
      return `${a.nom} n'a aucun lien primaire entrant`;
    case "heros":
      return `${a.nom} n'est le point de vue d'aucune situation`;
    case "positif":
      return `${a.nom} n'a aucun contact positif`;
    case "miroir":
      return `« ${a.nom} » a son contact-miroir indisponible au même moment`;
    case "armee":
      return `« ${a.nom} » n'a personne en scène pour porter ce qu'elle nécessite`;
    case "chaine":
      return `Ce qui s'apprend dans « ${a.nom} » ne sert nulle part ensuite`;
    case "defection":
      return `« ${a.nom} » tient à une seule personne`;
    case "densite":
      return `${a.nom} a un réseau de contacts déséquilibré`;
    case "ponts":
      return `Le groupe « ${a.nom} » n'a aucun contact hors de lui-même`;
    case "mixite":
      return `${a.nom} n'a d'intrigue que d'un seul côté`;
    case "suites":
      return `« ${a.nom} » ne mène nulle part`;
    case "differenciation":
      return `${a.nom} pensent pareil dans le même groupe`;
    default:
      return a.nom;
  }
}

/** Catégorie d'affichage par règle — sert à grouper le cockpit sans
    que l'auteur ait à connaître le nom des treize règles. */
function categorieConscience(regleCle) {
  if (["seul", "heros", "positif", "densite", "mixite", "differenciation"].includes(regleCle))
    return "personnage";
  // « miroir » vise la SITUATION où le contact-miroir est pris ailleurs,
  // pas le personnage : `cible` et `nom` sont ceux de la situation
  // (cf. conscience.js, règle 4). La ranger avec « armee/chaine/… » en
  // dessous est donc correcte, pas un choix arbitraire.
  if (["armee", "chaine", "defection", "suites", "miroir"].includes(regleCle)) return "situation";
  if (regleCle === "ponts") return "groupe";
  return "personnage";
}

/** Cibles cliquables pour une alerte de conscience — vers l'écran qui
    l'a produite, sur l'objet exact qu'elle vise. `differenciation` vise
    une PAIRE (`"id1+id2"`), les autres un id seul. */
function ciblesConscience(regleCle, a, reseau) {
  if (regleCle === "differenciation") {
    return a.cible
      .split("+")
      .map((id) => {
        const p = reseau.personnage(id);
        return { id, nom: p ? p.nom : "personnage supprimé", ecran: "fiche" };
      });
  }
  if (["armee", "chaine", "defection", "suites", "miroir"].includes(regleCle))
    return [{ id: a.cible, nom: a.nom, ecran: "atelier", params: { situationId: a.cible } }];
  if (regleCle === "ponts") return [{ id: a.cible, nom: a.nom, ecran: "reseau" }];
  return [{ id: a.cible, nom: a.nom, ecran: "fiche" }];
}

/** Les treize règles, traduites. Un diagnostic par alerte, sans rien
    recalculer : `conscience()` fait tout le travail. */
function depuisConscience(reseau, trames, infos, epoqueId) {
  const out = [];
  for (const r of conscience(reseau, trames, infos, epoqueId))
    for (const a of r.alertes)
      out.push({
        cle: r.cle,
        cible: a.cible,
        categorie: categorieConscience(r.cle),
        gravite: GRAVITE[r.cle] || "a-verifier",
        confiance: "haute",
        titre: titreConscience(r.cle, a),
        detail: a.detail,
        source: r.source,
        cibles: ciblesConscience(r.cle, a, reseau),
      });
  return out;
}

/** Les collisions de PJ — invisibles ailleurs que sur la frise. Une
    collision de PNJ n'est PAS un diagnostic : ce n'est pas une erreur,
    c'est un besoin de recrutement, déjà à sa place dans `besoins()`
    (cf. ARCHITECTURE.md §5e). Mélanger les deux ferait dire à l'auteur
    de « réparer » un planning de PNJ qui n'a rien de cassé. */
function depuisTemps(reseau, trames) {
  const { erreurs } = frise(reseau, trames);

  // ── UNE CARTE PAR PERSONNE, PAS PAR PAIRE ──
  // `frise()` rend les collisions deux à deux, ce qui est le bon
  // modèle : c'est le chevauchement qui est l'erreur. Mais trois scènes
  // simultanées font TROIS paires, donc trois alertes au titre
  // identique — vu sur le jeu d'essai, où Marek en occupait trois à
  // lui seul. Pour l'auteur, c'est UN problème : « il est attendu
  // partout à 21 h ». On regroupe donc par personne, et on nomme toutes
  // les scènes en cause.
  const parPersonne = new Map();
  for (const { personnage, a, b } of erreurs) {
    if (!parPersonne.has(personnage.id))
      parPersonne.set(personnage.id, { personnage, situations: new Map() });
    const e = parPersonne.get(personnage.id);
    for (const s of [a, b]) e.situations.set(s.id, s);
  }

  return [...parPersonne.values()].map(({ personnage, situations }) => {
    const liste = [...situations.values()].sort((x, y) => x.debut - y.debut);
    const debut = Math.min(...liste.map((s) => s.debut));
    const noms = liste.map((s) => `« ${s.titre || "Sans titre"} »`);
    return {
      cle: "temps:collision",
      // La cible reste stable tant que l'ensemble des scènes en cause
      // ne change pas — une dérogation survit donc au réordonnancement.
      cible: `${personnage.id}|${liste.map((s) => s.id).sort().join("-")}`,
      categorie: "temps",
      gravite: "attention",
      confiance: "haute",
      titre:
        liste.length > 2
          ? `${personnage.nom} est attendu dans ${liste.length} scènes qui se chevauchent, dès ${heure(debut)}`
          : `${personnage.nom} est prévu à deux endroits à la fois, vers ${heure(debut)}`,
      detail:
        `${noms.join(", ")} se chevauchent — un joueur, un corps : ` +
        "il faut décaler, couper, ou le retirer d'un des castings.",
      source: "La frise — une collision de PJ est une erreur, une de PNJ est un besoin",
      cibles: [
        { id: personnage.id, nom: personnage.nom, ecran: "fiche" },
        ...liste.map((s) => ({
          id: s.id,
          nom: s.titre || "Sans titre",
          ecran: "atelier",
          params: { situationId: s.id },
        })),
      ],
    };
  });
}

/** Les personnages les plus coûteux à l'absence — en lecture seule.
    Le geste actif (« et s'il ne vient pas ? ») reste sur le graphe ;
    ceci n'en est que le résumé, borné aux cas qui comptent vraiment. */
function depuisFragilite(stores) {
  return classementFragilite(stores)
    .filter((f) => f.gravite >= 2)
    .slice(0, 3)
    .map((f) => ({
      cle: "fragilite:defection",
      cible: f.personnage.id,
      categorie: "personnage",
      gravite: "attention",
      confiance: "haute",
      titre: `${f.personnage.nom} est un point de fragilité du réseau`,
      detail: `Si cette personne manque : ${resumeDegats(f.detail)}.`,
      source: "Morningstar — la redondance est un choix de design, pas un accident",
      cibles: [{ id: f.personnage.id, nom: f.personnage.nom, ecran: "fiche" }],
    }));
}

function resumeDegats(d) {
  const parts = [];
  if (d.orphelines.length) parts.push(`${d.orphelines.length} scène${d.orphelines.length > 1 ? "s" : ""} sans point de vue`);
  const mortes = d.fragilisees.filter((x) => x.morte).length;
  if (mortes) parts.push(`${mortes} scène${mortes > 1 ? "s" : ""} qui ne se joue${mortes > 1 ? "nt" : ""} plus`);
  if (d.miroirsPerdus.length) parts.push(`${d.miroirsPerdus.length} miroir${d.miroirsPerdus.length > 1 ? "s" : ""} perdu${d.miroirsPerdus.length > 1 ? "s" : ""}`);
  if (d.informationsOrphelines.length)
    parts.push(`${d.informationsOrphelines.length} information${d.informationsOrphelines.length > 1 ? "s" : ""} que personne d'autre ne porte`);
  return parts.join(", ") || "rien d'irrécupérable, mais l'écart se creuse";
}

/** Une information requise quelque part, que personne au monde ne
    détient encore. Distinct de « intrigue armée » : cette règle-là
    regarde qui est EN SCÈNE, pas si l'information existe ailleurs dans
    le monde. */
function depuisInformationsSansPorteur(trames, infos) {
  const out = [];
  for (const info of infos.informations()) {
    if (infos.detenteurs(info.id).length) continue;
    const usages = trames.situationsAvec(info.id).requiert;
    if (!usages.length) continue;
    out.push({
      cle: "information:sans-porteur",
      cible: info.id,
      categorie: "information",
      gravite: "attention",
      confiance: "haute",
      titre: `« ${info.contenu || "Information sans contenu"} » n'a encore aucun porteur`,
      detail: `Requise par ${usages.map((s) => `« ${s.titre || "Sans titre"} »`).join(", ")}, mais personne au monde ne la sait — telle quelle, la scène ne peut pas arriver.`,
      source: "L'asymétrie de connaissance — qui sait quoi, avant le jeu",
      cibles: [
        { id: info.id, nom: info.contenu || "Information sans contenu", ecran: "matrice" },
        ...usages.map((s) => ({ id: s.id, nom: s.titre || "Sans titre", ecran: "atelier", params: { situationId: s.id } })),
      ],
    });
  }
  return out;
}

/** Un PJ absent de toute situation, ni comme point de vue ni comme
    figurant — la question « a-t-il réellement quelque chose à faire ? »
    (analyse C). Strictement plus sévère que la règle « héros » de la
    conscience, qui ne regarde que le point de vue : un personnage
    présent au casting d'ailleurs mais jamais point de vue déclenche
    « héros » sans déclencher celui-ci. Le tri est fait par l'appelant
    (`diagnostics()`) pour ne jamais montrer les deux sur la même
    personne — le second ne dirait rien de plus que le premier en pire. */
function depuisPriseAbsente(reseau, trames, epoqueId) {
  const situations = situationsA(trames, epoqueId);
  const existe = (p) => !epoqueId || !reseau.existeA || reseau.existeA(p.id, epoqueId);
  return reseau
    .pj()
    .filter(existe)
    .filter((p) => !situations.some((s) => s.pointDeVueId === p.id || (s.castIds || []).includes(p.id)))
    .map((p) => ({
      cle: "prise:absente",
      cible: p.id,
      categorie: "personnage",
      gravite: "attention",
      confiance: "haute",
      titre: `${p.nom} n'apparaît dans aucune situation écrite`,
      detail: "Ni comme point de vue, ni comme figurant : ce personnage n'a actuellement aucune scène où être incarné.",
      source: "Est-ce que ce personnage a réellement quelque chose à faire ?",
      cibles: [{ id: p.id, nom: p.nom, ecran: "fiche" }],
    }));
}

/** LA PROMESSE NARRATIVE (analyse G) — le seul signal à confiance
    moyenne. Une situation qui promet une révélation (elle PRODUIT une
    information) mais dont une des informations REQUISES pour
    l'atteindre ne tient qu'à une seule personne au monde.

    On ne dit pas que la promesse ne sera pas tenue — on n'en sait rien,
    et une fragilité peut être délibérée. On dit que sa condition
    d'accès est étroite, au conditionnel, et le détail le rappelle. */
function depuisPromesses(reseau, trames, infos) {
  const out = [];
  for (const s of trames.situations()) {
    if (!(s.produitIds || []).length) continue;
    for (const infoId of s.requiertIds || []) {
      const porteurs = infos.detenteurs(infoId);
      if (porteurs.length !== 1) continue;
      const info = infos.information(infoId);
      if (!info) continue;
      const porteur = reseau.personnage(porteurs[0]);
      const nom = porteur ? porteur.nom : "quelqu'un qui n'existe plus";
      out.push({
        cle: "promesse:condition-fragile",
        cible: `${s.id}:${infoId}`,
        categorie: "situation",
        // Une hypothèse ne passe jamais devant un fait.
        gravite: "a-verifier",
        confiance: "moyenne",
        titre: `« ${s.titre || "Sans titre"} » semble promettre une révélation difficile à déclencher`,
        detail:
          `Cette situation produit quelque chose, mais pour y arriver il faut savoir ` +
          `« ${info.contenu || "sans contenu"} » — que seul·e ${nom} sait aujourd'hui. ` +
          "Si cette personne ne le transmet pas, la révélation n'arrive pas. " +
          "Une condition étroite peut être voulue : à vous de dire si c'en est une.",
        source: "Structure du graphe requiert/produit — observation, pas diagnostic certain",
        cibles: [
          { id: s.id, nom: s.titre || "Sans titre", ecran: "atelier", params: { situationId: s.id } },
          ...(porteur ? [{ id: porteur.id, nom: porteur.nom, ecran: "fiche" }] : []),
          { id: info.id, nom: info.contenu || "Information sans contenu", ecran: "matrice" },
        ],
      });
    }
  }
  return out;
}

/** ── L'ACCESSIBILITÉ DU GRAPHE DE TRAME (analyse D2) ──
    « Cette situation peut-elle seulement être atteinte ? »

    La conception avait écarté cette analyse en la formulant comme
    « situation difficile à atteindre », ce qui aurait produit beaucoup
    de faux positifs. En la construisant, la définition s'est resserrée
    d'elle-même, et le signal est devenu bien plus sûr :

    Une situation **sans conclusion entrante est une racine** — elle
    n'est jamais signalée, et c'est le cas de l'immense majorité des
    scènes d'ouverture. Une situation qui a des conclusions entrantes
    est atteignable dès qu'UNE d'elles vient d'une situation
    atteignable. Par récurrence, les seules situations inatteignables
    sont donc celles d'une **boucle fermée où rien n'entre depuis
    l'extérieur** : A mène à B, B ramène à A, et aucune conclusion
    écrite ailleurs ne pointe vers l'une des deux.

    Ce n'est plus une heuristique floue, c'est un fait de structure. Il
    reste néanmoins en `confiance: "moyenne"`, et pour une raison qui
    n'a rien de théorique : **beaucoup de scènes de GN n'ont pas de
    déclencheur écrit** — un PNJ improvise, un orga la lance à la main
    à 2 h du matin. Une boucle peut donc être parfaitement jouable sans
    qu'aucune conclusion n'y mène. On le dit dans le détail plutôt que
    d'affirmer une impossibilité qu'on ne peut pas constater.

    Une carte par BOUCLE, jamais par situation — même leçon que les
    collisions de temps (§5s) : trois scènes qui se renvoient l'une à
    l'autre sont un seul problème pour l'auteur. */
function depuisAccessibilite(trames) {
  const situations = trames.situations();
  if (!situations.length) return [];
  const vivantes = new Set(situations.map((s) => s.id));

  // On ne garde que les arêtes dont les DEUX bouts existent. Une
  // conclusion vers une situation supprimée ne mène nulle part, et ne
  // doit pas faire passer sa source pour un point d'entrée.
  const aretes = trames
    .conclusions()
    .filter((c) => c && c.vers && vivantes.has(c.de) && vivantes.has(c.vers));

  const entrantes = new Map();
  const sortantes = new Map();
  for (const c of aretes) {
    if (!entrantes.has(c.vers)) entrantes.set(c.vers, []);
    entrantes.get(c.vers).push(c.de);
    if (!sortantes.has(c.de)) sortantes.set(c.de, []);
    sortantes.get(c.de).push(c.vers);
  }

  // Parcours depuis toutes les racines. Une boucle sur soi-même
  // (`de === vers`) compte comme une entrante : elle n'ouvre rien.
  const atteintes = new Set();
  const file = situations.filter((s) => !(entrantes.get(s.id) || []).length).map((s) => s.id);
  while (file.length) {
    const id = file.pop();
    if (atteintes.has(id)) continue;
    atteintes.add(id);
    for (const v of sortantes.get(id) || []) if (!atteintes.has(v)) file.push(v);
  }

  const isolees = situations.filter((s) => !atteintes.has(s.id));
  if (!isolees.length) return [];

  // Regroupement en composantes, à travers les arêtes prises dans les
  // DEUX sens : ce qui compte est « ces scènes forment un même bloc »,
  // pas le sens dans lequel on les parcourt.
  const dansIsolees = new Set(isolees.map((s) => s.id));
  const voisins = new Map();
  const relier = (a, b) => {
    if (!voisins.has(a)) voisins.set(a, []);
    voisins.get(a).push(b);
  };
  for (const c of aretes)
    if (dansIsolees.has(c.de) && dansIsolees.has(c.vers)) {
      relier(c.de, c.vers);
      relier(c.vers, c.de);
    }

  const vus = new Set();
  const out = [];
  for (const depart of isolees) {
    if (vus.has(depart.id)) continue;
    const bloc = [];
    const pile = [depart.id];
    while (pile.length) {
      const id = pile.pop();
      if (vus.has(id)) continue;
      vus.add(id);
      bloc.push(id);
      for (const v of voisins.get(id) || []) if (!vus.has(v)) pile.push(v);
    }

    const scenes = bloc
      .map((id) => trames.situation(id))
      .filter(Boolean)
      .map((s) => ({ id: s.id, titre: s.titre || "Sans titre" }));
    if (!scenes.length) continue;

    const n = scenes.length;
    out.push({
      cle: "acces:boucle-fermee",
      // Stable tant que l'ensemble des scènes du bloc ne change pas.
      cible: bloc.slice().sort().join("-"),
      categorie: "situation",
      gravite: "a-verifier",
      confiance: "moyenne",
      titre:
        n === 1
          ? `Rien ne mène à « ${scenes[0].titre} », sauf elle-même`
          : `« ${scenes[0].titre} » et ${n - 1} autre${n > 2 ? "s" : ""} se renvoient l'une à l'autre sans entrée`,
      detail:
        (n === 1
          ? `Cette situation n'est la suite d'aucune autre — sa seule conclusion entrante vient d'elle-même.`
          : `Ces ${n} situations (${scenes.map((s) => `« ${s.titre} »`).join(", ")}) se relient entre elles, ` +
            "mais aucune conclusion écrite ailleurs n'y mène.") +
        " Beaucoup de scènes se déclenchent hors du modèle — un PNJ qui improvise, un lancement à la main :" +
        " si c'est le cas ici, écartez cette observation.",
      source: "Structure du graphe de conclusions — observation, pas diagnostic certain",
      cibles: scenes.map((s) => ({
        id: s.id,
        nom: s.titre,
        ecran: "atelier",
        params: { situationId: s.id },
      })),
    });
  }
  return out;
}

/** Une situation dont le point de vue ou un rôle de casting pointe
    vers un personnage supprimé. `TrameStore` ne purge jamais ces
    références par choix — une référence cassée doit se voir, dit
    ARCHITECTURE.md §5b ; ceci est l'endroit où elle se voit enfin. */
function depuisReferencesOrphelines(reseau, trames) {
  const out = [];
  for (const s of trames.situations()) {
    const morts = [];
    if (s.pointDeVueId && !reseau.personnage(s.pointDeVueId)) morts.push(s.pointDeVueId);
    for (const id of s.castIds || []) if (!reseau.personnage(id)) morts.push(id);
    if (!morts.length) continue;
    out.push({
      cle: "reference:orpheline",
      cible: `${s.id}:${morts.join(",")}`,
      categorie: "situation",
      gravite: "a-verifier",
      confiance: "haute",
      titre: `« ${s.titre || "Sans titre"} » référence un personnage qui n'existe plus`,
      detail: `${morts.length} référence${morts.length > 1 ? "s" : ""} pointe${morts.length > 1 ? "nt" : ""} vers un personnage supprimé — à recadrer ou à retirer.`,
      source: "Les références aux personnages ne sont jamais purgées automatiquement",
      cibles: [{ id: s.id, nom: s.titre || "Sans titre", ecran: "atelier", params: { situationId: s.id } }],
    });
  }
  return out;
}

/**
 * Tous les diagnostics, dans un ordre stable (gravité, puis catégorie).
 * `stores` porte au moins `{ reseau, trames, infos }` — le même paquet
 * que celui que `App._stores()` construit déjà.
 */
export function diagnostics(stores, epoqueId = undefined) {
  const ep = epoqueDeCalcul(stores.reseau, epoqueId);
  const { reseau, trames, infos } = stores;
  const prise = depuisPriseAbsente(reseau, trames, ep);
  // « héros » dirait moins, en pire, de la même personne : on ne garde
  // que le signal le plus sévère plutôt que d'afficher deux fois le
  // même constat sous deux noms différents.
  const sansPrise = new Set(prise.map((d) => d.cible));
  const conscienceSansDoublon = depuisConscience(reseau, trames, infos, ep).filter(
    (d) => !(d.cle === "heros" && sansPrise.has(d.cible)),
  );
  const tous = [
    ...conscienceSansDoublon,
    ...depuisTemps(reseau, trames),
    ...depuisFragilite(stores),
    ...depuisInformationsSansPorteur(trames, infos),
    ...depuisReferencesOrphelines(reseau, trames),
    ...prise,
    ...depuisPromesses(reseau, trames, infos),
    ...depuisAccessibilite(trames),
  ];
  // Gravité d'abord, puis confiance : à gravité égale, un fait passe
  // devant une hypothèse. Sans ce second critère, une observation
  // prudente pourrait s'afficher au-dessus d'un constat certain.
  const ordreG = { attention: 0, "a-verifier": 1 };
  const ordreC = { haute: 0, moyenne: 1 };
  return tous.sort(
    (a, b) =>
      (ordreG[a.gravite] ?? 9) - (ordreG[b.gravite] ?? 9) ||
      (ordreC[a.confiance] ?? 9) - (ordreC[b.confiance] ?? 9),
  );
}

/** Groupé par catégorie, pour l'affichage du cockpit — l'auteur pense
    en « personnages / situations / informations », pas en règles. */
export function parCategorie(stores) {
  const groupes = { personnage: [], situation: [], information: [], temps: [], groupe: [] };
  for (const d of diagnostics(stores)) (groupes[d.categorie] || (groupes[d.categorie] = [])).push(d);
  return groupes;
}
