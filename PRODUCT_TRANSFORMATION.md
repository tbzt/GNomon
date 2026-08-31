# GNomon — le test de résistance de votre GN

Document de conception. Aucun fichier de code n'est modifié par ce document ; c'est
volontaire — la roadmap (§11) doit être validée avant la moindre ligne.

Convention de lecture : chaque référence à un fichier ou une fonction (`conscience.js`,
`defection()`, `Derogations.ecarter()`…) désigne du code qui **existe déjà** dans le dépôt,
vérifié en le lisant et en le faisant tourner sur le jeu d'essai « Les Cendres de
Valmorel ». Tout ce qui est proposé comme neuf est marqué explicitement **NOUVEAU**.

---

## 0. Ce qui a déjà été vérifié

Avant d'écrire ce document : lecture intégrale de `README.md`, `ARCHITECTURE.md`,
`index.html`, `css/gnomon.css`, des dix-neuf modules de `js/core/`, des dix-sept widgets de
`js/widgets/`, des neuf fichiers de `tests/`, du fixture `js/data/valmorel.js`. L'application
a été lancée (`python3 -m http.server`), le jeu d'essai chargé, les onze écrans parcourus, et
la suite de tests exécutée dans `tests.html` (128 tests, tous verts avant ce travail).

Constat central : sur Valmorel, l'écran « Conscience » affiche **16 alertes réparties sur
9 des 12 règles**. L'information existe, calculée, sourcée, juste. Mais il faut visiter
quatre écrans différents (Conscience, Frise, Réseau→Graphe, Matrice) pour la réunir, et
chacun suppose qu'on sait déjà quoi y chercher. **Le problème n'est pas le calcul, c'est
l'accès** — c'est le fil conducteur de tout ce document.

---

## 1. Le nouveau cœur produit : qu'est-ce qu'un « Diagnostic GNomon » ?

Un **Diagnostic** est une observation explicable et actionnable produite par un calcul
déterministe sur le modèle déjà écrit. Ce n'est un jugement de qualité ni un score.

Le mot « diagnostic » est aujourd'hui utilisé pour sept choses différentes dans le corpus
GNomon et dans la commande de transformation. Les distinguer est la première décision de
conception — sans quoi le cockpit du §2 mélangerait des objets qui n'ont ni la même durée
de vie ni la même action attendue.

| Concept | Définition | Exemple GNomon | Durée de vie |
|---|---|---|---|
| **Signal** | Un fait brut, neutre, extrait du modèle. Pas encore une alerte. | « Thomas Bru a 2 interlocuteurs déclarés. » | Recalculé à chaque lecture, jamais affiché seul. |
| **Problème** | Un signal qui viole une règle connue et **sourcée**. L'unité de base du diagnostic. | Règle « Personne n'est seul » (`conscience.js`, cle `seul`) : Thomas Bru n'a aucun lien primaire *entrant*. | Permanent tant que le texte ne change pas. Dérogeable. |
| **Fragilité** | Un problème qui expose une **cascade** de conséquences si un événement précis survient. Compose plusieurs problèmes en une histoire causale. | `classementFragilite()` : si Marek manque, 2 scènes perdent leur point de vue, 2 miroirs sont perdus, 1 information n'a plus de porteur. | Permanente (résumé) ou à la demande (Crash Test, §6). |
| **Question ouverte** | Une incomplétude **assumée** de l'écriture — ce n'est **pas** un problème, et la présenter comme tel serait un contresens. | Une conclusion sans cible (`vers: null`) : « et après ? » — le moteur même de l'écriture en trames (cf. `ARCHITECTURE.md` §5b). | Vit dans l'atelier, jamais dans le cockpit comme alerte. |
| **Information manquante** | Cas spécifique où la *circulation* d'une information est incomplète ou dangereuse pour l'intrigue. | Une information requise par une situation, détenue par personne au monde (**NOUVEAU**, §4.D). | Permanente, dérogeable. |
| **Dépendance** | Une relation structurelle neutre entre deux objets du modèle — devient un problème seulement si elle est **unique** (point de défaillance simple) ou sa source **absente**. | « Cette situation requiert l'information i1. » En soi : neutre. Si `detenteurs(i1).length === 1` : ça devient un problème (§4.D, §4.G). | La dépendance elle-même est structurelle et stable (dérivée de `requiertIds`/`produitIds`) ; le problème qu'elle *peut* révéler est recalculé. |
| **Conséquence d'une absence** | Le **résultat** d'une simulation demandée par l'auteur, pas une règle permanente. Produit du Crash Test. | « Si Elena ne vient pas : 3 situations fragilisées, 1 information sans porteur, 1 intrigue sans moteur. » (`defection()`, déjà en place) | Calculée à la demande, jamais stockée, jamais affichée sans que l'auteur l'ait demandée. |

**Pourquoi cette distinction compte concrètement** : la commande de transformation liste
« quelles situations ont une sortie incertaine » et « la boucle et-après » côte à côte avec
des alertes de fragilité. Ce sont deux familles différentes — la première (question
ouverte) doit rester une invitation à écrire, jamais une alerte rouge, sous peine de punir
l'auteur pour un choix d'écriture normal (une trame en cours n'a pas fini toutes ses
suites). Le cockpit (§2) traite les deux séparément.

---

## 2. Le cockpit principal

### La question à laquelle il répond

« Est-ce que mon GN tient debout ? » — en secondes, sans conduire l'auteur à connaître le
nom des douze règles de conscience ni la différence entre une trame et une situation.

### Ce qu'il n'est pas

Pas un tableau de bord de statistiques, pas une note, pas une jauge de complétion. Un GN
qui ne produit aucun problème affiche **une phrase**, pas une grille vide qu'on remplirait
pour se justifier d'exister.

### Architecture d'écran concrète

```
┌─────────────────────────────────────────────────────────────────┐
│  GNomon      [Diagnostic]  Écrire  Vérifier  Distribuer  Jouer   │  ← barre existante,
├─────────────────────────────────────────────────────────────────┤     un item ajouté
│  8 points d'attention · 2 écartées                                │
│  Ce que GNomon déduit du texte déjà écrit — des observations,     │
│  pas une note. Chacune dit pourquoi, renvoie à son origine, et    │
│  s'écarte en écrivant sa propre raison.                           │
│                                                                    │
│  PERSONNAGES                                                      │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ Marek Zilber est un point de fragilité du réseau            │   │
│  │ Si absent : 2 scènes sans point de vue, 2 miroirs perdus…    │   │
│  │ Morningstar — la redondance est un choix de design…          │   │
│  │ [Marek Zilber]                              [Écarter…]      │   │
│  └───────────────────────────────────────────────────────────┘   │
│  … (les autres cartes « personnage »)                             │
│                                                                    │
│  SITUATIONS                                                       │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ « Le chantage au tunnel » ne mène nulle part                 │   │
│  │ …                                                             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
│  INFORMATIONS · LE TEMPS · GROUPES  (mêmes cartes, si présentes)   │
│                                                                    │
│  ▸ Écartées, avec leur justification (repliable, jamais masqué)   │
└─────────────────────────────────────────────────────────────────┘
```

Décisions de cet écran, et pourquoi :

- **Groupé par catégorie de l'objet concerné** (personnage / situation / information /
  temps / groupe), pas par les douze noms de règles. L'auteur pense « Marek a un
  problème », pas « la règle `densite` a une alerte ».
- **Chaque carte cite sa source** — l'auteur qui veut comprendre la théorie clique
  « pourquoi ? » implicite (la phrase de source est déjà là, en petit, jamais cachée
  derrière un second clic obligatoire).
- **Chaque carte a une ou plusieurs cibles cliquables** qui ouvrent l'écran d'origine sur
  l'objet exact — aucune navigation nouvelle à apprendre, le routage de `App` fait déjà ce
  travail pour la frise et le graphe.
- **« Écarter… »** réutilise `Derogations` tel quel (§5) : écarter ici écarte la même
  alerte sur l'écran qui l'a produite (la conscience, par exemple). Une seule vérité.
- **Le compteur ne fait jamais de somme avec un poids** — « 8 points d'attention » est un
  dénombrement, pas un score pondéré. Aucune opération arithmétique au-delà du compte.
- **Silence** : zéro problème affiche `« Rien à signaler. Continuez d'écrire — le
  diagnostic se met à jour à chaque changement. »` et rien d'autre.

### Ce que le cockpit ne montre PAS

- Les **questions ouvertes** (§1) — elles restent dans l'atelier, comptées ailleurs si
  besoin (« 2 questions ouvertes »), jamais comme carte rouge.
- Les **besoins dérivés** (`besoins.js`) — ce sont des tâches de production (accessoires,
  comédiens à trouver), pas des fragilités narratives. Les mélanger ferait du cockpit un
  fourre-tout et détruirait la promesse « ce qui mérite mon attention narrativement ».
- Les **contrôles de casting** (`bilancasting.js`) — pertinents seulement une fois un
  casting affecté ; ils apparaissent au cockpit seulement à partir de ce moment-là.

---

## 3. Cartographie des capacités existantes vers le diagnostic

| Module | Données lues | Diagnostic permis | UI actuelle | UI cible | Lacune identifiée |
|---|---|---|---|---|---|
| `couverture.js` | `ReseauStore` (liens, groupes) | Personnage sous-couvert sur une des 9 composantes de Kröger | Pastille n/9 sur la carte réseau + tableau ; clic → texte d'explication | Traduit en cartes du cockpit, catégorie « Personnages », une par composante manquante | Aucune dérogation possible aujourd'hui sur une pastille — contrairement à la conscience, un manque « voulu » (pas de surprise, c'est un choix d'auteur) ne peut pas être justifié et disparaître de la vue |
| `conscience.js` | `ReseauStore`, `TrameStore`, `InformationStore` | Les 12 règles sourcées — la colonne vertébrale du diagnostic | Écran dédié, accordéon par règle, dérogation déjà intégrée | Alimente directement le cockpit (mapping quasi 1:1, alerte → carte) | Le regroupement actuel est *par règle* ; l'auteur doit connaître les 12 noms pour trouver ce qui concerne « Marek » |
| `defection()` + `classementFragilite()` | `ReseauStore`, `TrameStore`, `InformationStore` | Fragilité et conséquence d'une absence (personnage) | Geste manuel sur le graphe réseau (mode défection, un clic par personnage testé) | (a) résumé passif au cockpit pour les cas graves, (b) Crash Test généralisé et accessible partout (§6) | Ne couvre que les personnages ; rien pour une situation ou une information prise isolément (comblé en §6) |
| `temps.js` (`frise`, `pic`, `erreurs`) | `ReseauStore`, `TrameStore` | Collision PJ (erreur) distincte de la charge PNJ (besoin) | Écran Frise dédié, planning visuel | Alimente le cockpit, catégorie « Le temps » ; la charge PNJ reste dans « Besoins », jamais mélangée | Aucune — la distinction PJ/PNJ est déjà le bon modèle, juste invisible ailleurs que sur la frise |
| `InformationStore` + `TrameStore.requiert/produit/situationsAvec` | Les deux stores | Asymétrie de connaissance, chaîne requiert→produit | Matrice « Qui sait quoi », lecture ligne par ligne | Cockpit catégorie « Informations » + nouvelles analyses D et G (§4) | Rien n'agrège aujourd'hui « cette information ne peut atteindre personne » à l'échelle du GN entier |
| `TrameStore.orphelines()` / `conclusionsDe()` | `TrameStore` | Question ouverte (« et après ? ») | File dédiée dans l'atelier | Reste dans l'atelier (ce n'est **pas** un problème, §1) ; un compte neutre peut apparaître au cockpit, jamais une carte | Aucune — le risque est de la transformer à tort en alerte, ce que ce document évite explicitement |
| `bilancasting.js` | `CastingStore`, `ReseauStore`, `TrameStore` | Déséquilibre post-casting, miroir désaccordé | Écran dédié après affectation | Alimente le cockpit uniquement quand un casting existe (contexte-dépendant) | Aucune sur le calcul ; simplement jamais visible ailleurs que sur cet écran |
| `besoins.js` | `ReseauStore`, `TrameStore`, `MondeStore` | *Pas* un diagnostic narratif — une liste de tâches de production | Écran dédié avec suivi | Reste hors cockpit narratif ; éventuel compte neutre, jamais une carte de fragilité | Aucune — bien à sa place, à ne pas y toucher |
| `archive.js`, `poids.js` | — | Hors périmètre du diagnostic narratif (technique/fonctionnel) | Barre du haut | Inchangé | — |

**Conclusion de la cartographie** : sept capacités sur neuf alimentent directement le
diagnostic sans qu'aucun calcul nouveau soit nécessaire. Les deux lacunes réelles (pas de
dérogation sur la couverture, rien n'agrège les informations à l'échelle globale) sont
adressées respectivement en note du cockpit et en §4.D — jamais en dupliquant un calcul.

---

## 4. Les nouvelles analyses réellement nécessaires

Passées au crible d'une question unique : *quel signal existant ne couvre pas déjà ça ?*
Si la réponse est « un signal existant, recombiné autrement », ce n'est pas un nouvel
algorithme — juste une nouvelle présentation (documenté comme tel ci-dessous).

### A. Analyse d'absence — « Que se passe-t-il si Elena ne vient pas ? »

- **Données nécessaires** : aucune de plus que `defection()` n'utilise déjà (`ReseauStore`,
  `TrameStore`, `InformationStore`).
- **Algorithme** : **déjà écrit**, `js/core/defection.js`. Rien à ajouter au calcul.
- **Ce qui manque réellement** : l'exposition. Aujourd'hui, un seul point d'entrée (le
  mode défection du graphe réseau). Généraliser = factoriser le rendu déjà écrit dans
  `reseaugraphe.js` (`_flancDefection`) en composant réutilisable, appelable depuis la
  fiche, le tableau, le cockpit (§6).
- **Faux positifs possibles** : quasiment aucun — c'est un calcul structurel exact, pas une
  heuristique. Le seul risque est *interprétatif* : une gravité élevée peut être un choix
  d'auteur assumé (un protagoniste central l'est par construction). D'où la dérogation.
- **Niveau de confiance** : haut (déterministe, zéro approximation).
- **Explication fournie** : déjà le texte de `_flancDefection` — orphelines, fragilisées,
  miroirs perdus, informations orphelines, chacune listée nommément.
- **Justification/dérogation** : oui, via `Derogations` avec une nouvelle clé
  (`fragilite:defection`, déjà utilisée dans le brouillon de `diagnostic.js`).

### B. Analyse de fragilité — « Qu'est-ce qui dépend trop d'un seul personnage ? »

- **Données nécessaires** : identiques à A.
- **Algorithme** : `classementFragilite()` (**déjà écrit**) fait exactement ce calcul pour
  tout le monde d'un coup — c'est littéralement sa description dans `defection.js`
  (« utile à J-15 pour savoir sur qui prévoir une doublure »). Rien à ajouter.
- **Ce qui manque** : un seuil d'affichage. Montrer les quarante personnages serait du
  bruit ; ne montrer que `gravite >= 2`, plafonné à trois, garde le signal pertinent (cf.
  principe « moins d'informations mais plus pertinentes »).
- **Faux positifs possibles** : le même que A — une centralité voulue n'est pas une erreur.
- **Niveau de confiance** : haut.
- **Explication fournie** : le détail structuré de `defection()`, résumé en une phrase
  (« 2 scènes sans point de vue, 2 miroirs perdus, 1 information sans autre porteur »).
- **Justification/dérogation** : oui.

### C. Analyse de prise — « Ce personnage a-t-il réellement quelque chose à faire ? »

- **Données nécessaires** : `TrameStore.situations()`, filtrées sur `pointDeVueId` et
  `castIds`.
- **Algorithme existant à recombiner** : la règle `heros` de `conscience.js` (« aucune
  situation dont il est le point de vue ») et la règle `mixite` (« aucune intrigue interne
  ET externe ») couvrent l'essentiel. **NOUVEAU**, le trou qu'aucune des deux ne couvre :
  un personnage absent de **toute** situation, ni comme point de vue ni comme figurant
  (`castIds`) — distinct de `heros`, qui ne regarde que le point de vue. Calcul trivial :
  `!trames.situations().some(s => s.pointDeVueId === id || (s.castIds||[]).includes(id))`.
- **Faux positifs possibles** : un rôle volontairement périphérique (un contact
  logistique, un nom cité mais jamais mis en scène) — rare mais existe. D'où la
  dérogation, comme pour toute règle de conscience.
- **Niveau de confiance** : haut (booléen, pas d'heuristique).
- **Explication fournie** : « Ce personnage n'apparaît dans aucune situation écrite —
  ni comme point de vue, ni comme figurant. »
- **Justification/dérogation** : oui, même mécanisme.

### D. Analyse d'information — « Cette information peut-elle réellement atteindre quelqu'un ? »

Question en deux temps, avec deux niveaux de confiance différents :

**D1 — Personne ne la détient (fort).**
- **Données** : `InformationStore.detenteurs()`, `TrameStore.situationsAvec().requiert`.
- **Algorithme (NOUVEAU, petit)** : une information requise par au moins une situation,
  dont `detenteurs().length === 0`.
- **Faux positifs** : aucun — c'est un fait, pas une heuristique (soit quelqu'un la sait,
  soit personne).
- **Confiance** : haute.
- **Explication** : « Requise par « X », mais personne au monde ne la sait — telle
  quelle, la scène ne peut pas arriver. »

**D2 — Le chemin qui y mène est incertain.**

> **Analyse corrigée en l'implémentant.** Ce paragraphe disait « faux positifs réels,
> confiance faible, formulation floue » et concluait à repousser, puis à exclure. **C'était
> une erreur d'analyse, et elle venait d'une mauvaise formulation de la question.** En
> construisant l'algorithme, la définition s'est resserrée d'elle-même et le signal est
> devenu bien plus sûr que prévu. Le raisonnement qui suit remplace l'ancien.

- **Données** : `TrameStore.conclusions()` et l'ensemble des situations. Rien de plus.
- **Ce que le raisonnement a révélé** : une situation **sans conclusion entrante est une
  racine** — elle n'est jamais signalée, ce qui couvre l'immense majorité des scènes
  d'ouverture et des scènes isolées. Une situation qui a des conclusions entrantes est
  atteignable dès qu'**une** d'elles vient d'une situation atteignable. Par récurrence,
  les seules situations inatteignables sont celles d'une **boucle fermée où rien n'entre
  depuis l'extérieur**. Ce n'est pas « une scène qui semble difficile à atteindre » — c'est
  un fait de structure, étroit et vérifiable.
- **Algorithme** : parcours depuis toutes les racines en suivant `conclusion.vers`, puis
  regroupement des situations non atteintes en **composantes** (arêtes prises dans les
  deux sens). Une carte par boucle, jamais par situation — la leçon des collisions de
  temps (§5s d'`ARCHITECTURE.md`).
- **Le faux positif qui reste, et il est unique** : beaucoup de scènes de GN **n'ont pas
  de déclencheur écrit** — un PNJ improvise, un orga la lance à la main. Une boucle peut
  donc être parfaitement jouable. C'est la seule raison pour laquelle ce signal n'est pas
  en confiance haute.
- **Niveau de confiance** : **moyenne**, pour cette raison-là et pas une autre.
- **Explication fournie** : elle nomme toutes les scènes du bloc, puis rappelle
  explicitement qu'une scène peut se déclencher hors du modèle et **invite à écarter** si
  c'est le cas. Un test vérifie que cette phrase est présente.
- **Décision** : D1 en vague 1 (fait certain), **D2 livré après la vague 4**, une fois
  l'analyse refaite.

### E. Analyse de situation — « Cette situation peut-elle réellement se produire ? »

Ce n'est **pas** un nouveau calcul de fond : c'est l'**agrégation**, par situation, de
signaux déjà proposés ou existants :
1. La règle `armee` (**existante**) — quelqu'un en scène détient ce qu'il faut savoir.
2. D2 ci-dessus (accessibilité du graphe de conclusions).
3. Une collision de temps (`temps.js`, **existante**) touchant son casting.
4. Une référence orpheline — `pointDeVueId` ou un `castIds` pointant vers un personnage
   supprimé (**NOUVEAU**, calcul trivial : `!reseau.personnage(id)`), déjà repéré comme
   trou par `ARCHITECTURE.md` §5b sans jamais être remonté à l'écran.

**Proposition concrète** : une vue « diagnostic de situation », miroir de la fiche
personnage, qui n'ajoute **aucun calcul** au-delà des quatre listés — elle les rassemble
pour un seul objet. Priorité basse (vague 4) : elle a plus de valeur une fois D2 et le
cockpit éprouvés.

### F. Analyse temporelle — « Ce qui est demandé au joueur est-il physiquement possible ? »

- **Ce qui est déjà couvert, et bien couvert** : la collision stricte entre deux situations
  d'un même PJ (`temps.js`, `erreurs`). C'est la réponse exacte à « peut-il être à deux
  endroits en même temps ? ».
- **Ce qui manquerait pour aller plus loin** : le temps de *déplacement* entre deux
  espaces (« a-t-il le temps physique de traverser le site entre deux scènes proches ? »).
- **Pourquoi ce n'est PAS proposé** : GNomon ne modélise aucune notion de lieu structuré —
  `espace` est un champ texte libre (cf. `tramestore.js`). Calculer une distance
  supposerait un graphe de lieux qui n'existe nulle part dans le modèle actuel. Le
  construire violerait le principe « réutiliser l'existant plutôt que créer une nouvelle
  abstraction » : ce serait un sous-projet en soi (modéliser une carte), pas une
  interprétation de ce qui est déjà écrit.
- **Faux positifs si on le tentait quand même** : majeurs — deux libellés différents
  (« le presbytère », « chez le curé ») peuvent désigner le même lieu ; un texte libre ne
  permet aucune comparaison fiable.
- **Décision** : **hors périmètre, explicitement**. F est déjà résolu par l'exposition de
  `temps.js` au cockpit ; aucun nouvel algorithme.

### G. Analyse de promesse narrative — « Cette situation promet-elle ce que le scénario ne permet pas de tenir ? »

- **Données nécessaires** : `TrameStore.produitIds`/`requiertIds`,
  `InformationStore.detenteurs()`.
- **Algorithme (NOUVEAU, petit)** : une situation qui **produit** une information (elle
  promet une révélation) dont l'une des informations **requises** pour l'atteindre n'a
  qu'**un seul porteur au monde** (`detenteurs().length === 1`). Si cette personne ne la
  transmet pas, la promesse ne se tient jamais.
- **Faux positifs possibles** : une situation peut être délibérément écrite comme rare et
  fragile — un secret voué à ne sortir qu'avec un concours de circonstances précis. Ce
  n'est pas nécessairement une erreur.
- **Niveau de confiance** : moyen. Formulation en « semble » obligatoire (jamais « cette
  promesse ne sera pas tenue »).
- **Explication fournie** : « Seul·e X sait « … », qui conditionne cette situation. Si
  cette personne ne la transmet pas, la révélation promise n'arrive jamais. »
- **Reste dans le structurel, pas dans l'interprétation littéraire** : le module ne
  cherche jamais à deviner si la « promesse » est bonne ou mauvaise dramatiquement — 
  seulement si sa condition d'accès est étroite. C'est exactement la limite fixée par la
  commande initiale (« reste sur les conséquences structurelles observables »).
- **Justification/dérogation** : oui, et attendue plus souvent que pour les autres
  signaux — c'est une heuristique, pas un fait.

---

## 5. Le système d'alertes

### Le modèle proposé, adapté à l'architecture réelle

```js
{
  cle,        // stable — namespace de dérogation : "seul", "temps:collision",
              // "fragilite:defection", "information:sans-porteur",
              // "promesse:condition-fragile", "reference:orpheline", "prise:absente"…
  cible,      // id (ou id composite stable) — seconde moitié de la clé de dérogation
  categorie,  // "personnage" | "situation" | "information" | "temps" | "groupe"
              // — l'axe de regroupement du cockpit, pas les 12 noms de règles
  gravite,    // "attention" | "a-verifier" — QUALITATIF, jamais numérique, jamais sommé
  confiance,  // "haute" | "moyenne" — NOUVEAU par rapport au schéma de la commande :
              // nécessaire dès qu'une analyse est une heuristique (D2, G) plutôt qu'un
              // fait structurel (A, B, C, D1) ; commande le ton de la phrase ("semble" vs
              // affirmation directe)
  titre,      // une phrase humaine, jamais le nom technique de la règle
  detail,     // le raisonnement — souvent directement le texte déjà produit par le
              // module source (conscience(), defection()…)
  source,     // la provenance : l'auteur cité, ou la structure de données en cause
  cibles,     // [{ id, nom, ecran, params }] — remplace à la fois "entities" ET
              // "suggestedActions" de la proposition initiale : la navigation EST
              // l'action, on ne invente pas d'actions automatiques qui écriraient à la
              // place de l'auteur
}
```

### Différences assumées avec le schéma `{type, severity, title, explanation, entities,
consequences, suggestedActions, dismissable, justification}` proposé, et pourquoi

- **Pas de champ `dismissable` ni `justification` sur l'alerte elle-même.** Ce n'est pas un
  oubli : `Derogations` (déjà écrit, déjà testé, déjà compris de l'auteur via l'écran
  Conscience) porte cet état sous la clé `cle::cible`. Le dupliquer créerait deux vérités
  qui divergeraient — exactement l'erreur que l'architecture évite déjà pour la
  réciprocité des liens (`reciproque()` n'est jamais stockée). Toute alerte est donc
  *nativement* dérogeable, sans champ à ajouter.
- **Pas de `suggestedActions` séparé.** Les `cibles` cliquables portent déjà l'action
  (« aller voir, et corriger si vous le souhaitez »). Suggérer une correction *automatique*
  violerait un principe déjà en vigueur dans le projet : le squelette de fiche
  (`InformationStore` → `Fiche`) *n'écrit jamais dans le carnet à la place de l'auteur*
  (`ARCHITECTURE.md` §5c). Un « suggestedAction » qui proposerait un texte irait à
  l'encontre de cette doctrine.
- **Pas de `consequences` séparé pour les diagnostics simples** — le `detail` porte déjà la
  conséquence en une phrase. Un champ `consequences` structuré n'a de sens que pour le
  Crash Test (§6), qui produit un **rapport**, pas une alerte unique : voir la distinction
  du §1 entre « problème » et « conséquence d'une absence ».
- **`confiance` ajouté** — absent du schéma proposé, nécessaire dès qu'on introduit des
  heuristiques (D2, G) à côté de faits structurels (A–D1). Sans lui, une alerte à haute
  confiance et une alerte spéculative se liraient avec la même autorité, ce qui violerait
  le principe « pas de vérité absolue ».

### Recalcul

Toutes les analyses restent des **modules purs** au sens du projet — elles lisent des
stores, n'en mutent aucun, et sont rejouées à chaque notification (`_surChangement` dans
`app.js`, déjà le mécanisme pour la conscience). Rien n'est mis en cache : à l'échelle
d'un GN (quelques dizaines de personnages, quelques centaines de situations), le coût est
négligeable — `conscience()` le fait déjà à chaque frappe sans qu'on l'ait jamais mesuré
comme un problème.

### Éviter les doublons

Règle de conception, appliquée à chaque analyse candidate du §4 : *quel signal existant ne
couvre pas déjà ça ?* Documenté explicitement pour chacune (§3, §4) plutôt que laissé
implicite — c'est ce qui a évité, par exemple, de dupliquer la règle `armee` (qui regarde
qui est *en scène*) avec D1 (qui regarde si quelqu'un la sait *au monde*, scène ou pas) :
les deux se complètent sans se recouvrir.

### Tri et regroupement

Tri : `gravite` (« attention » avant « à vérifier »), puis stable par catégorie. Jamais par
un score composite. Regroupement : par `categorie`, parce que l'auteur pense en objets de
son GN (Marek, la scène du tunnel), pas en noms de règles.

### Navigation

`cibles[].ecran` + `params` réutilisent le routage déjà présent dans `App`
(`ouvrirFiche(id)`, `ouvrirAtelier({situationId})`, `ouvrirMatrice()`…). Aucune route
nouvelle à inventer.

### Justification utilisateur

`Derogations.ecarter(cle, cible, justification)` — refuse déjà une justification vide,
horodate déjà, reste déjà affichée avec sa raison plutôt que masquée. Le cockpit ne fait
qu'appeler ce mécanisme existant avec les clés du nouveau système.

---

## 6. Le Crash Test

### Ce qui existe déjà (90 % du travail)

`defection(personnageId, stores)` répond déjà, exactement, à « absence d'un personnage » —
PJ ou PNJ indifféremment, la fonction ne fait aucune distinction dans son code. Le seul
travail restant est **l'exposition** : aujourd'hui un geste manuel sur le graphe réseau ;
demain accessible depuis la fiche, le tableau, le cockpit — même fonction, rendu
factorisé (aujourd'hui dupliqué en germe dans `_flancDefection` de `reseaugraphe.js`).

### Ce qui est réellement nouveau

**Suppression d'une situation (NOUVEAU, petit).** `defection()` simule l'absence d'une
*personne*, pas la disparition d'une *situation*. Nouvel algorithme pur,
`crashTestSituation(situationId, stores)`, en lecture seule (il ne mute jamais
`TrameStore`, contrairement à `supprimerSituation()`) :
- quelles conclusions **entrantes** (`conclusionsVers(id)`) perdraient leur cible ;
- quelles informations **produites ici** (`produitIds`) ne seraient plus produites nulle
  part ailleurs (`situationsAvec(infoId).produit.length === 1`) ;
- quels personnages perdent **leur seule scène** comme point de vue.

Chaque sous-calcul réutilise une méthode déjà exposée par `TrameStore`
(`conclusionsVers`, `situationsAvec`) — aucun nouveau parcours de données à inventer,
seulement une composition différente.

**Information jamais découverte (NOUVEAU, petit, récursif).** Différent de D1 (§4) :
D1 dit « personne ne la détient *aujourd'hui* ». Le Crash Test simule « et si elle
n'était **jamais** sue ». Algorithme : parcours en largeur sur `requiert`/`produit` —
les situations qui la requièrent ne se produisent jamais ⇒ les informations qu'*elles*
produisent ne se produisent jamais non plus ⇒ récursif. Petite fonction pure,
`simulerInformationManquante(infoId, stores)`.

**Arrivée tardive d'un personnage (NOUVEAU, mais une simple variante de `defection()`).**
Généraliser `defection()` avec un filtre optionnel `{ apresHeure }` : les situations dont
`s.debut != null && s.debut < apresHeure` sont ignorées dans le calcul des dégâts (le
personnage les aurait de toute façon manquées), le reste du calcul est identique.

### Ce que le Crash Test rend, précisément — et ce qu'il ne rend pas

Une liste structurée de conséquences par catégorie (scènes orphelines, scènes
fragilisées, miroirs perdus, informations orphelines, conclusions désormais sans cible),
**jamais un chiffre unique**. Le rendu déjà écrit dans `_flancDefection` (widget
`reseaugraphe.js`) est le gabarit direct — même vocabulaire, même absence de score, la
même phrase de sortie (« Rien ne casse. Le GN tient sans cette personne. ») quand c'est le
cas.

---

## 7. La simulation « Jouer Elena »

### Ce que ce n'est pas

Pas un moteur de jeu, pas un mode narratif interactif. Une **fiche de lecture**, dérivée,
qui répond à une question : *ce personnage risque-t-il de ne rien vivre ?*

### Le modèle minimal (NOUVEAU module de composition, aucun nouveau store)

Une fonction pure `pointDeVue(personnageId, stores)` qui **assemble des lectures déjà
disponibles** :

| Ce qu'elle sait / croit | `InformationStore.parPersonnage(id)` — **déjà écrit**, renvoie `{sait, croit}` |
|---|---|
| Qui elle peut contacter | `ReseauStore.liensDe(id)` — **déjà écrit** |
| Quelles situations elle peut atteindre | `TrameStore.situations().filter(s => s.pointDeVueId===id \|\| (s.castIds\|\|[]).includes(id))` — trivial, pas de nouvelle méthode |
| Quelles conséquences elle peut provoquer | `TrameStore.conclusionsDe(situationId)` sur ses situations — **déjà écrit** |
| Où elle risque de rester sans prise | **NOUVEAU, petit** : sur sa ligne de `frise()` (déjà calculée par personnage), un intervalle sans scène programmée au-delà d'un seuil (ex. 1h30) est un « trou de jeu » |

### Où ça vit dans l'interface

Pas un douzième écran : un onglet dans la **fiche existante**, à côté du carnet — « Ce
qu'il vit ». La fiche est déjà « ce personnage » ; y ajouter « ce qu'il traverse » est un
prolongement naturel, pas une nouvelle destination de barre (cohérent avec la doctrine
existante : « la fiche n'est pas une destination de la barre », `ARCHITECTURE.md` §5i).

Rien n'est stocké — 100 % dérivé, exactement dans l'esprit de `besoins.js` et
`couverture.js`.

---

## 8. « Et ensuite ? » comme boucle d'écriture

### Ce qui existe déjà et qu'il ne faut pas transformer en alerte

`TrameStore.orphelines()` + `creerSuite()` sont déjà, littéralement, la boucle demandée :
situation → conclusion sans cible → `creerSuite()` → nouvelle situation reliée. Le §1 de
ce document insiste : ceci est une **question ouverte**, pas un problème. La transformer
en diagnostic rouge punirait l'auteur pour l'état normal d'une trame en cours d'écriture.

### Ce qui manque réellement — un assistant de liaison, pas un nouveau calcul

Au moment où l'auteur clique « Écrire la suite » sur une conclusion orpheline
(`creerSuite()`), lui présenter, en lecture seule et sans rien imposer :
- ce que les personnages déjà présents dans la situation d'origine **savent déjà**
  (`InformationStore.parPersonnage` sur chaque `castIds` de la situation d'origine) — pour
  ne pas re-raconter ce qui est déjà su ;
- les informations **produites** par la situation d'origine et pas encore **liées** en
  `requiert` nulle part (`situationsAvec().requiert.length === 0`) — candidates
  naturelles à rattacher à la nouvelle situation d'un clic.

C'est exactement le geste déjà validé pour le `@mention` qui **propose** une arête sans
jamais la créer seule (`ARCHITECTURE.md` §5) — transposé au moment de `creerSuite()`.
Aucun nouvel algorithme : une recombinaison d'`InformationStore.parPersonnage` et
`TrameStore.situationsAvec`, déjà écrits.

### La limite tenue

Le système ne rédige jamais une suite, ne choisit jamais une conclusion à la place de
l'auteur, et ne propose aucun texte de situation. Il réduit uniquement le travail de
*retrouver ce qui est déjà su* — exactement le rôle déjà assumé par le squelette de fiche.

---

## 9. Architecture

### Ce qui ne change pas

Le store central, les modules purs, l'absence de dépendance serveur, le fonctionnement
100 % local, les tests déterministes avec stores factices, la séparation calcul/rendu, les
trois invariants de `ReseauStore` (§4 d'`ARCHITECTURE.md`). Aucune vague de la roadmap
(§11) n'y touche.

### Ce qui s'ajoute — en suivant le patron exact de `conscience.js`/`defection.js`

| Nouveau module | Rôle | Dépendances | Mutabilité |
|---|---|---|---|
| `core/diagnostic.js` | Agrège conscience/temps/défection existants + signaux neufs (D1, G, référence orpheline, C) | Lit `ReseauStore`, `TrameStore`, `InformationStore` | Pur, zéro mutation |
| `core/crashtest.js` | Suppression de situation, information jamais découverte, arrivée tardive (généralisation de `defection()`) | Idem + `defection()` réutilisé | Pur |
| `core/pointdevue.js` | Composition pour « Jouer Elena » (§7) | Idem + `temps.js` réutilisé | Pur |

Chacun suit exactement le contrat déjà en vigueur : fonction(s) exportée(s), stores en
paramètre, aucune touche au DOM, aucun accès à `Derogations` (comme `conscience()`, il
reste rejouable tel quel — c'est le widget appelant qui croise avec les dérogations).

### Ce qui s'ajoute côté rendu

Un widget `cockpit.js` (écran), une factorisation du rendu de défection déjà existant dans
`reseaugraphe.js` en composant partagé, un onglet supplémentaire dans `fiche.js`. Aucun
widget existant n'est réécrit — seulement complété par un point d'entrée (bouton, onglet).

### Tests

Même harnais (`tests/harnais.js`), mêmes stores factices (`tests/faux.js`), un fichier de
test par nouveau module pur (`tests/diagnostic.test.js`, `tests/crashtest.test.js`,
`tests/pointdevue.test.js`), enregistrés dans `tests.html` à côté des neuf existants.
Chaque nouvelle analyse structurelle (A, B, C, D1, référence orpheline) doit avoir un cas
positif et un cas négatif ; chaque analyse heuristique (D2, G) doit en plus avoir un test
qui vérifie que la formulation reste au conditionnel.

---

## 10. UX — la hiérarchie d'interface

### Réponse directe à la question posée

Ni la liste plate proposée (« Écrire / Réseau / Trames / Savoir / Temps / Casting /
Documents / Conduite / DIAGNOSTIC ») ni un onzième onglet isolé. La première option
recrée exactement le problème diagnostiqué au §0 — le diagnostic redeviendrait *un écran
parmi d'autres* qu'il faut penser à visiter. La seconde a le même défaut sous une autre
forme.

### La proposition

1. **Garder les quatre moments actuels** (Écrire / Vérifier / Distribuer / Jouer) — ils
   encodent une chronologie de fabrication déjà éprouvée à l'usage (`ARCHITECTURE.md`
   §5i), et rien dans cette transformation ne la remet en cause.
2. **Le cockpit est une porte d'entrée, pas un mode de plus dans la même rangée.** Il
   occupe la place que l'Accueil (`accueil.js`) occupe déjà pour un projet vide — le
   cockpit prend le relais dès qu'il y a du contenu à diagnostiquer. Cohérent avec
   l'existant plutôt qu'un cinquième bouton ajouté à une rangée qui en a déjà quatre.
3. **Des points d'ancrage locaux**, pas un donjon à visiter : un bouton Crash Test sur la
   fiche et sur le tableau (le geste existe déjà sur le graphe, §6) ; le badge de comptage
   déjà présent sur le mode « Vérifier » (conservé tel quel) ; un lien permanent vers le
   cockpit complet, quelque part dans la barre, pour y revenir sans repasser par l'accueil.

C'est la traduction concrète du principe « le diagnostic doit accompagner l'auteur
partout » : pas en dupliquant l'écran onze fois, mais en semant des portes vers la même
vérité depuis les endroits où l'auteur travaille déjà.

---

## 11. Roadmap — quatre vagues

### Vague 1 — Le socle du diagnostic (zéro UI nouvelle visible)

- **Objectif utilisateur** : aucun changement visible ; condition de tout le reste.
- **Fonctionnalités** : `core/diagnostic.js` — agrège conscience/temps/défection existants
  + signaux A, B, C, D1, référence orpheline (les cinq à haute confiance du §4).
- **Modules impactés** : un seul fichier nouveau, zéro modification de l'existant.
- **Tests** : `tests/diagnostic.test.js`, stores factices, cas positifs et négatifs pour
  chaque signal neuf.
- **Risques** : sur-multiplier les signaux neufs « pendant qu'on y est » — discipline du
  §4 à tenir strictement (cinq signaux neufs, pas dix).
- **Critère « terminé »** : sur Valmorel, la fonction produit une liste cohérente, sans
  doublon avec les 12 règles de conscience (vérifié explicitement en test), et la suite
  complète de tests reste verte.

### Vague 2 — Le cockpit

- **Objectif utilisateur** : voir en dix secondes ce qui mérite attention à l'ouverture
  d'un projet.
- **Fonctionnalités** : écran cockpit (§2), intégration à la barre comme porte d'entrée
  (§10), dérogation intégrée en réutilisant `Derogations`.
- **Modules impactés** : nouveau `widgets/cockpit.js` ; petites additions à `app.js`
  (routage) et `index.html` (hôte d'écran) ; ajout de classes CSS suivant les conventions
  déjà en place (`cs-*` de la conscience comme gabarit direct).
- **Tests** : le calcul est déjà couvert par la vague 1 ; vérification du rendu dans le
  navigateur (convention du projet : le rendu ne se teste pas en automatique, cf. §7c
  d'`ARCHITECTURE.md`).
- **Risques** : surcharge visuelle si les catégories ne sont pas hiérarchisées ; formuler
  par erreur une observation comme une vérité absolue (relecture systématique des textes
  d'alerte contre ce risque avant de livrer).
- **Critère « terminé »** : sur Valmorel, un lecteur qui n'a jamais ouvert GNomon trouve
  au cockpit, en moins d'une minute, un problème qu'il n'aurait pas vu sur l'accueil
  actuel.

### Vague 3 — Crash Test généralisé et simulation de personnage

- **Objectif utilisateur** : répondre activement à « et si… ? » et « a-t-il quelque chose
  à vivre ? » depuis n'importe quel écran, pas seulement le graphe.
- **Fonctionnalités** : factorisation du rendu de défection en composant partagé ;
  `core/crashtest.js` (suppression de situation, information jamais découverte, arrivée
  tardive) ; onglet « Ce qu'il vit » dans la fiche (`core/pointdevue.js`).
- **Modules impactés** : `reseaugraphe.js` (factorisation, pas de réécriture), `fiche.js`
  (ajout d'onglet), deux nouveaux modules purs.
- **Tests** : `tests/crashtest.test.js`, `tests/pointdevue.test.js`.
- **Risques** : dupliquer le rendu de défection au lieu de le factoriser réellement —
  point de vigilance explicite en revue de code de cette vague.
- **Critère « terminé »** : « Et si Marek ne vient pas ? » donne exactement le même
  résultat depuis la fiche de Marek, le cockpit, et le graphe.

### Vague 4 — Signaux affinés, boucle d'écriture, audit

- **Objectif utilisateur** : fermer les analyses à confiance moyenne sans jamais les faire
  passer pour des certitudes ; enrichir la boucle « et après ? » sans automatiser
  l'écriture ; auditer l'ensemble.
- **Fonctionnalités** : D2 (accessibilité du graphe de trame) et G (promesse fragile),
  toujours formulées au conditionnel ; l'assistant de liaison au moment de `creerSuite()`
  (§8) ; audit multi-casquettes final (auteur, QA, architecte, nouveau venu — méthode
  déjà décrite dans la commande initiale).
- **Modules impactés** : extension de `core/diagnostic.js` ; petit ajout dans `atelier.js`
  au moment de la création de suite ; pas de nouveau store.
- **Tests** : extension de `tests/diagnostic.test.js`, avec un test dédié qui vérifie que
  les alertes à confiance moyenne utilisent une formulation prudente.
- **Risques** : le signal d'accessibilité (D2) est le plus exposé aux faux positifs de
  tout ce document — sa formulation et sa dérogation par défaut doivent être revues avec
  un soin particulier avant livraison.
- **Critère « terminé »** : audit complet effectué, zéro diagnostic jugé trompeur sur
  Valmorel après relecture à froid, document mis à jour avec les décisions prises.

---

## 12. Ce qu'il ne faut surtout pas faire

- **Ajouter une fonctionnalité qui ne renforce pas la proposition de valeur.** Chaque
  vague ci-dessus a été jaugée contre une question unique : *cela aide-t-il l'auteur à
  voir ce qu'il ne voyait pas ?* Un compteur de plus qui n'y répond pas n'entre pas dans
  la roadmap, même s'il est facile à coder.
- **Transformer GNomon en dashboard analytique froid.** Aucune carte du cockpit ne doit se
  lire sans un verbe et un sujet humains (« Marek risque… », jamais « Densité : 2/9 »).
  C'est un choix de rédaction à tenir à chaque nouvelle phrase de diagnostic, pas une
  fois pour toutes.
- **Sur-noter le scénario.** Répété à dessein dans ce document : aucun score, nulle part,
  jamais sommé. Le jour où quelqu'un proposera un total, la réponse est non — c'est
  explicitement l'erreur que Fredou et ce projet évitent déjà pour la conscience.
- **Produire trop d'alertes.** Discipline tenue dans ce document : cinq signaux neufs, pas
  dix ; seuils explicites (`gravite >= 2` pour la fragilité, par exemple) plutôt que tout
  montrer « au cas où ». Le silence (§2) est un principe d'interface, pas un cas limite.
- **Automatiser l'écriture au lieu d'aider à la penser.** Aucun texte n'est jamais
  généré à la place de l'auteur — ni dans le cockpit, ni dans l'assistant de liaison du
  §8, ni ailleurs. Le système montre ce qui est su, jamais ce qui devrait être écrit.
- **Introduire de l'IA là où un raisonnement déterministe suffit.** Toutes les analyses de
  ce document sont des parcours de graphe et des comparaisons d'ensembles — rien qui
  nécessite un modèle probabiliste. L'introduire ajouterait de l'opacité exactement là où
  l'explicabilité est le principe numéro un.
- **Casser les invariants existants.** Les trois invariants de `ReseauStore` (§4
  d'`ARCHITECTURE.md`), l'immutabilité des modules purs, l'absence de purge des
  références mortes dans `TrameStore` (dont ce document se sert, §4.E, plutôt que de la
  « corriger ») : aucun n'est touché par la roadmap.
- **Rendre l'outil plus complexe que le problème qu'il résout.** Chaque nouveau module
  proposé (§9) est un fichier pur de la même forme que ceux qui existent déjà — aucune
  nouvelle couche d'abstraction générale, aucun framework interne, aucun système de
  plugins. Si une future vague en réclamait un, ce serait le signal qu'elle va trop loin.

---

## Journal — Vague 1 : terminée

**Décision** : roadmap validée telle quelle, brouillon conservé comme base.

**Fait** : `core/diagnostic.js` conforme au périmètre de la Vague 1 — signaux A
(fragilité résumée, réutilise `classementFragilite()` sans rien recalculer), B (même
fonction, c'est le même signal sous deux noms dans la commande initiale), C (prise
absente, nouveau, petit), D1 (information sans porteur, nouveau, petit), référence
orpheline (nouveau, petit), plus la traduction complète des douze règles de conscience et
des collisions de temps. Champ `confiance` ajouté au schéma (§5) : `"haute"` partout dans
cette vague, aucune heuristique.

**Retiré de cette vague** : la promesse narrative sur condition fragile (G) avait été
écrite dans le brouillon initial ; elle a été retirée du fichier et sera réintroduite en
Vague 4 avec `confiance: "moyenne"` et la formulation prudente exigée par le §4.G — la
laisser mélangée aux signaux à haute confiance de cette vague aurait brouillé la
distinction que ce document introduit.

**Décision prise en cours de route, non anticipée dans la conception** : la règle
`heros` de la conscience (« n'est le point de vue d'aucune situation ») et le nouveau
signal `prise:absente` (« n'apparaît nulle part, ni en point de vue ni en figurant »)
peuvent viser la même personne — `prise:absente` implique toujours `heros`
mathématiquement. Pour ne pas produire deux cartes qui disent la même chose à deux degrés
de sévérité, `diagnostics()` supprime `heros` pour toute cible déjà couverte par
`prise:absente`, qui est strictement plus informatif. Vérifié par construction (tests) et
en conditions réelles.

**Vérifié sur Valmorel** : 21 diagnostics, tous à confiance haute, aucun doublon
heros/prise. Le signal `prise:absente` trouve un cas réel et jusqu'ici invisible :
**Lucie Roux** (une PJ) n'apparaît dans aucune situation écrite du jeu d'essai — ni comme
point de vue, ni comme figurante. Aucun écran existant ne le disait aussi nettement.

**Tests** : `tests/diagnostic.test.js`, 22 cas, tous verts. Suite complète du projet :
**133/133**, aucune régression.

## Journal — Vague 2 : terminée

**Livré** : `widgets/cockpit.js` branché — écran, routage (`#/diagnostic`), lien permanent
dans la barre avec badge, styles CSS suivant les conventions de l'écran conscience
(`.ck-*` calqué sur `.cs-*`). Documenté dans `ARCHITECTURE.md` §5q.

**Décisions prises pendant l'implémentation**

1. **Deux points d'entrée, pas un.** La conception ne tranchait pas comment on *revient*
   au cockpit une fois qu'on l'a quitté. Réponse : la porte (sans hash, un projet non
   vierge y ouvre) **et** un lien permanent dans la barre avec son badge. Le second était
   nécessaire — sans lui, revenir au diagnostic aurait demandé de vider le hash à la main.

2. **`modeActif` peut valoir `null`.** Le cockpit n'appartenant à aucun des quatre
   moments (§10), `_rendreNav` devait pouvoir n'en marquer aucun comme actif — le code
   supposait jusqu'ici qu'un mode était toujours trouvé. La sous-barre se masque alors,
   puisqu'il n'y a pas d'onglets à montrer.

3. **`compterOuverts()` exporté à côté du widget.** Le badge de la barre doit rester juste
   quel que soit l'écran affiché, donc sans que le cockpit soit monté. Une seule formule,
   partagée avec `Cockpit.etat()`, plutôt que deux comptes qui divergeraient.

**Vérifié dans le navigateur, sur Valmorel**

- Ouverture sans hash → cockpit, 21 diagnostics groupés par catégorie.
- Clic sur une cible (« Thomas Bru ») → ouvre bien sa fiche (`#/fiche/…`).
- Lien permanent → retour au cockpit, badge « Diagnostic 21 ».
- **Dérogation partagée, le point critique** : écarter « Personne n'est seul / Thomas Bru »
  depuis le cockpit avec une justification écrite fait passer le badge à 20 **et** affiche
  l'alerte comme « traitée » sur l'écran Conscience, avec la même justification datée. Une
  seule vérité, comme prévu au §5.
- **Silence** : un GN sans diagnostic affiche « Rien à signaler » et un badge sans chiffre.
- **Non-régression** : un projet vierge affiche toujours l'accueil, pas le cockpit.
- Une coquille de pluriel (« 21 points d'attentions ») trouvée à l'écran et corrigée.

**Tests** : suite complète **133/133**, aucune régression. Le rendu se vérifie dans le
navigateur, conformément à la convention du projet (`ARCHITECTURE.md` §7b).

## Journal — Vague 3 : terminée

**Livré** : `core/crashtest.js` (coupe d'une situation, information jamais découverte,
arrivée tardive) · `core/pointdevue.js` (« ce personnage a-t-il quelque chose à vivre ? »,
et les trous de jeu) · `widgets/degats.js` (le rendu d'une absence, factorisé) · le bloc
« Ce qu'il vit » dans la fiche, avec le crash test à un clic. Documenté dans
`ARCHITECTURE.md` §5r.

**Décisions prises pendant l'implémentation**

1. **La factorisation portait sur le texte, pas sur le calcul.** `defection()` était déjà
   partagée ; c'est son *rendu* qui était prisonnier du flanc du graphe. `degats.js` est
   donc du rendu pur, sans état ni écouteur — vérifié en le montant des deux côtés : mot
   pour mot le même rapport.

2. **La profondeur de cascade se compte par vagues.** Défaut trouvé par un test : la
   propagation « tant que ça bouge » donnait le bon ensemble mais une profondeur qui
   dépendait de l'ordre des situations dans le tableau — trois étages de cascade
   paraissaient un effet direct si les situations étaient rangées en ordre de dépendance.
   Corrigé, et verrouillé par un test qui monte le même scénario dans les deux sens.

3. **Le verdict « rien à vivre » ne s'applique en rouge qu'aux PJ.** Trouvé en le regardant
   tourner sur Valmorel : le curé (PNJ) figure sans rien porter — et c'est son métier. Un
   PNJ est une fonction, pas une personne avec un arc, exactement la distinction que la
   frise tient déjà (§5e). Le PNJ reçoit donc un constat neutre. Une alerte qui se trompe
   une fois sur deux apprend à être ignorée.

4. **Le crash test reste un geste, pas un état.** Le bloc de dégâts se replie en changeant
   de personnage — c'est une question qu'on pose, pas une propriété permanente de la fiche.

**Vérifié dans le navigateur, sur Valmorel**

- Fiche de **Lucie Roux** : « Ce personnage n'a rien à jouer […] présent, mais
  spectateur » — cohérent avec le signal `prise:absente` de la vague 1, vu d'un autre bout.
- Fiche de **Marek** : « 4 scènes — 2 portées, 2 en figuration · 1 chose à découvrir ·
  4 conséquences possibles (2 sans suite écrite) ».
- « Et s'il ne vient pas ? » depuis la fiche de Marek rend **exactement** le même rapport
  que le mode défection du graphe — c'était le critère de fin de vague.
- Fiche du **Père Corvin** (PNJ) : constat neutre, pas d'alarme.

**Tests** : `tests/crashtest.test.js`, 31 cas (crash test + point de vue + trous). Suite
complète **165/165**, aucune régression.

**Reste pour la Vague 4** : la promesse narrative (G) en confiance moyenne, l'assistant de
liaison au moment de `creerSuite()`, et l'audit multi-casquettes. À noter pour cette
vague : `crashTestSituation` et `crashTestInformation` sont écrits, testés, mais n'ont
**pas encore de point d'entrée dans l'interface** — l'atelier et la matrice sont leurs
places naturelles (un bouton « et si je coupe ça ? » sur la situation ouverte, un « et si
personne ne l'apprend ? » sur l'information). C'est un choix de cadrage, pas un oubli : la
vague 3 avait pour critère de fin le crash test *de personnage* accessible partout, et
l'ajouter aurait mélangé deux vérifications.

---

## Journal — Vague 4 : terminée

**Livré** : la promesse narrative (analyse G) en `confiance: "moyenne"` · les deux portes
manquantes du crash test (atelier et matrice) · `core/liaison.js` et le panneau « écrire la
suite » qui remplace le `prompt()` · l'audit et ses corrections. Documenté dans
`ARCHITECTURE.md` §5s.

### Ce que l'audit a trouvé, et corrigé

C'est la partie la plus utile de cette vague : trois défauts réels, tous invisibles en
lisant le code, tous trouvés en regardant l'écran ou en écrivant un test.

1. **Surcharge du cockpit (casquette « nouveau venu »).** Vingt-et-une cartes d'un bloc ;
   Thomas Bru en occupait quatre à lui seul. La page était devenue une liste qu'on
   parcourt. Corrigé par deux rangs : neuf points d'attention visibles, dix observations de
   fond derrière une porte qui les annonce. Rien n'est supprimé ni résumé.

2. **Un doublon dans les collisions (casquette « QA »).** `frise()` rend les collisions
   deux à deux — le bon modèle — mais trois scènes simultanées font trois paires, donc
   trois cartes au titre identique. Marek en produisait trois. Pour l'auteur c'est **un**
   problème. Regroupé par personne, avec toutes les scènes nommées.

3. **Un faux positif sur les PNJ**, corrigé en vague 3 mais du même ordre : une alerte qui
   se trompe une fois sur deux apprend à être ignorée.

### Décisions de conception

- **La réserve d'une hypothèse s'écrit, elle ne se code pas en couleur.** La carte à
  confiance moyenne porte un trait discontinu *et* la phrase « Observation — à confirmer
  par vous ». Une nuance visuelle seule ne s'apprend pas.
- **Le tri met le fait avant l'hypothèse** à gravité égale. Sans ce second critère, une
  observation prudente pouvait s'afficher au-dessus d'un constat certain.
- **Le panneau de suite ne pré-remplit rien.** Ni titre, ni case cochée. C'est le geste du
  `@mention` (§5 d'`ARCHITECTURE.md`) transposé : proposer n'est pas décider.
- **`_coupePour` / `_crashPour` / `_suitePour` retiennent *pour quel objet* un panneau est
  ouvert**, plutôt qu'un booléen à remettre à zéro aux huit endroits où la sélection
  change — un oubli et l'auteur verrait les dégâts d'une scène en regardant une autre.

### Vérifié dans le navigateur, sur Valmorel

- Cockpit : **9 points d'attention** (contre 21 cartes indifférenciées avant), les trois
  collisions de Marek fusionnées en « attendu dans 3 scènes qui se chevauchent, dès
  20h30 ». Le tiroir de fond s'ouvre, et reste ouvert après recalcul.
- Atelier, « Et si je la coupe ? » sur *La négociation du rachat* : « Joseph Cavaillé
  n'aurait plus aucune scène ». Le panneau se replie en changeant de situation.
- Matrice, « Et si personne ne l'apprend ? » sur *Le rapport truqué* : « 1 situation
  empêchée — effet direct, sans cascade ».
- « Écrire la suite » sur *Le registre a disparu* : le panneau rappelle ce qu'Elena et
  Augustine savent déjà ; créer la suite la relie bien à la conclusion et ouvre l'éditeur
  dessus.
- **La promesse narrative ne se déclenche pas sur Valmorel** — vrai négatif vérifié à la
  main : la seule information à porteur unique alimente une scène qui ne produit rien. Le
  rendu de la carte a donc été vérifié sur un cas construit, puis les données restaurées.

**Tests** : 182/182, aucune régression. Les nouveaux verrous notables : la formulation
prudente de G, l'ordre fait-avant-hypothèse, le regroupement des collisions, et le fait que
`contexteSuite()` ne mute rien.

### État de la transformation

Les quatre vagues de la roadmap sont livrées.

---

## Journal — D2, après coup : l'analyse était fausse

**Ce qui s'est passé.** D2 (« cette situation peut-elle être atteinte ? ») avait été
repoussée en vague 4, puis écartée, sur la base d'un raisonnement écrit au §4.D de ce
document : trop de faux positifs, confiance faible. **Demandée explicitement, elle a été
reprise — et l'analyse initiale s'est révélée fausse.**

**Pourquoi elle était fausse.** J'avais formulé la question comme « quelles situations
semblent difficiles à atteindre ? », ce qui est effectivement flou et bruyant. La bonne
question, celle que la structure impose, est plus étroite : une situation sans conclusion
entrante est une **racine**, donc jamais suspecte ; une situation avec des entrantes est
atteignable dès qu'une seule vient d'un point atteignable. Par récurrence, **seules les
boucles fermées sans entrée extérieure sont inatteignables**. Ce n'est plus une
heuristique — c'est un fait de structure, et il est rare.

La leçon vaut d'être notée : *le faux positif que je redoutais venait de ma formulation,
pas du domaine.* Écarter une analyse sur la foi d'un raisonnement non implémenté est un
mauvais réflexe, et ce document en portait la trace.

**Ce qui reste incertain, et c'est la seule chose.** Beaucoup de scènes de GN n'ont pas de
déclencheur écrit — un PNJ improvise, un orga lance la scène à la main. Une boucle fermée
peut donc être parfaitement jouable. D'où `confiance: "moyenne"`, un détail qui le dit en
toutes lettres, et une invitation explicite à écarter. C'est verrouillé par un test.

**Livré** : `depuisAccessibilite()` dans `core/diagnostic.js`, une carte par boucle (jamais
par situation), cible stable pour que la dérogation survive au réordonnancement.

**Vérifié** : **zéro déclenchement sur Valmorel** — vrai négatif, les trames y sont
linéaires avec des racines. Le rendu a donc été vérifié sur une boucle construite
volontairement (« L'aveu » rebouclant sur « L'ouverture du registre ») : une seule carte
pour les trois scènes, réserve affichée, invitation à écarter. Données restaurées ensuite.

**Tests** : 13 cas, dont **six qui vérifient qu'il ne se déclenche PAS** — racine seule,
scénario linéaire, situations sans conclusions, boucle avec une entrée, conclusion sans
cible, conclusion vers une situation supprimée. Sur un signal à confiance moyenne, ce sont
les non-déclenchements qui comptent. Suite complète : **195/195**.

### Ce qui reste hors périmètre, et le reste vraiment

- **L'analyse F** (temps de déplacement entre deux lieux) : GNomon ne modélise aucun lieu
  structuré, `espace` est un texte libre. La raison tient toujours — ce serait modéliser
  une carte, pas interpréter ce qui est écrit.
- **Le score global, l'IA, la dépendance réseau** : exclus par principe, et rien dans ces
  vagues n'a donné envie d'y revenir.
