# Architecture de GNomon — la carte du code

Ce document répond à une seule question : **« où est quoi, et qui appelle qui ? »**
À lire d'abord pour reprendre le code sans avoir à fouiller.

---

## 1. Le modèle mental en 30 secondes

- **Vanilla JavaScript, aucun build.** Pas de bundler, pas de `npm`, aucune étape de
  compilation. On ouvre `index.html`, ça marche. Déploiement GitHub Pages : on édite un
  fichier, `git push`, terminé.
- **Chaque fichier est un module ES natif**, qui `export`e son objet et `import`e ses
  dépendances par URL relative explicite. Pour savoir de quoi dépend un fichier, lisez ses
  `import` — c'est écrit.
- **Un fichier = un domaine = un objet**, dont le nom correspond au nom du fichier :
  `reseaustore.js` exporte `ReseauStore`, `storage.js` exporte `Storage`.
- **Les dépendances ne descendent que vers le bas.** Une couche basse ne connaît jamais une
  couche haute.
- **100 % local.** Aucun serveur, aucun appel réseau. Toute la persistance est dans le
  `localStorage`, derrière `Storage`.

### Le rapport à ShadowHerds : copie, pas fork

GNomon **copie** des briques de [ShadowHerds](https://github.com/tbzt/ShadowHerds) —
`debug.js`, l'idiome de store, plus tard le moteur de graphe, le kit de composants et les
carnets. Il n'en est **pas un fork** et n'y remonte rien.

La raison n'est pas pratique, elle est structurelle : **les deux projets n'ont pas la même
vérité racine.** En JdR, le MJ tient la trame et les PJ la traversent — la vérité racine est
*la scène*. En GN, le joueur **est** la trame — la vérité racine est *l'arête*. Deux modèles
qui divergent dès le socle ne se partagent pas ; les factoriser dans une bibliothèque commune
reviendrait à aplatir la différence qui fait tout le projet.

---

## 2. Les couches

```
3. Orchestration     js/app.js          App : bootstrap, écrans, routage
        ↑
2b. Rendu / widgets  js/widgets/        reçoivent des données → produisent du HTML
                                        et des interactions ; ne persistent rien
        ↑
2. Données d'essai   js/data/           fixtures (valmorel.js)
        ↑
1. Socle             js/core/           storage, debug, utils, reseaustore,
                                        couverture, tramestore,
                                        informationstore, conscience,
                                        derogations
```

### Couche 2b — Rendu (`js/widgets/`)

| Fichier | Objet | Responsabilité |
|---|---|---|
| `reseau.js` | `Reseau` | L'écran du casting, par groupe. Chaque carte porte sa cote de couverture (n/9). |
| `fiche.js` | `Fiche` | L'écran d'écriture : huit champs saisis, jauge calculée, carnet. Rendu **en deux étages** (cf. §6). |
| `journal/markdown.js` | `Markdown` | Gras / italique / code sur du texte **déjà échappé**. Copié tel quel de ShadowHerds. Pas de titres (collision `#`), pas de liens (collision `@[]()` + XSS `href`). |
| `journal/mentions.js` | `Mentions` | Autocomplétion `@`, rendu des puces, et **proposition d'arête**. Réécrit : l'original dépend de six modules propres à son domaine. |
| `conscience.js` | `Conscience` | L'écran des douze règles. Tient les trois interdits **dans le rendu** autant que dans les stores (cf. §5d). |
| `matrice.js` | `Matrice` | L'écran « Qui sait quoi » : informations × personnages, une cellule se règle au clic. |
| `atelier.js` | `Atelier` | L'écran des trames : graphe, éditeur de situation, file « et après ? ». Remonte le graphe **sur signature**, pas sur événement (cf. §6). |
| `graph/graphengine.js` | `GraphEngine` | Moteur de graphe pur — layout de forces ou **layout auteur** (`static` + `onNodeMoved`), formes, motifs de trait, poches, pan/zoom. **Copié tel quel** de ShadowHerds : zéro import, aucune vérité détenue. Seul le pont `window` a sauté. |

---

## 3. Carte fichier → objet → responsabilité

### Couche 1 — Socle (`js/core/`)

| Fichier | Objet | Responsabilité |
|---|---|---|
| `debug.js` | `Debug` (`window.Debug`) | Journalisation par canaux (`reseau`, `storage`, `trame`, `information`, `conscience`), filtrable au runtime via `?debug=` ou depuis la console. Feuille sans dépendance. |
| `storage.js` | `Storage` | **Unique** dépositaire du `localStorage`. Clés `gnomon_v1_<clé>`. Observation des écritures (`subscribe`), entonnoir d'échec d'écriture, versionnement de schéma + migrations. |
| `reseaustore.js` | `ReseauStore` | **La vérité racine.** Personnages, liens orientés, groupes. Détient les trois invariants du modèle (cf. §4). |
| `utils.js` | `Utils` | `escHtml`, `searchNorm` (recherche sans accents), `plur`. Volontairement maigre : la version de ShadowHerds porte la résolution d'édition, dont il n'y a pas ici. |
| `conscience.js` | `conscience()` | **Les douze règles, calculées.** Module pur : lit trois stores, n'en mute aucun, ne touche pas au DOM — S6 pourra le rejouer après casting. Ne connaît pas les dérogations : le calcul reste rejouable tel quel. |
| `derogations.js` | `Derogations` | Les alertes écartées **et leur justification écrite**. `ecarter()` refuse une justification vide — c'est l'invariant du module, pas une validation de formulaire. |
| `informationstore.js` | `InformationStore` | Les **informations** : le fait, son influence, et **qui sait quoi**. `sait` / `croit` par personnage ; **« ignore » n'est jamais stocké — c'est l'absence** (cf. §5c). |
| `tramestore.js` | `TrameStore` | Les **trames**, les **situations** et leurs **conclusions**. Une conclusion sans cible est valide — c'est le moteur de la boucle « et après ? » (cf. §5b). |
| `couverture.js` | `couverture()`, `scoreCouverture()` | Les **neuf composantes de Kröger, calculées** depuis le réseau. Module **pur** : lit le store, ne le mute jamais, ne touche pas au DOM — c'est ce qui permettra à la conscience (S4) de le rejouer après casting. |

### Couche 2 — Données d'essai (`js/data/`)

| Fichier | Objet | Responsabilité |
|---|---|---|
| `valmorel.js` | `VALMOREL`, `chargerValmorel()` | Le fixture « Les Cendres de Valmorel » — sept personnages, trois groupes, dix-neuf liens. **Construit pour porter des défauts vrais**, ceux que les validateurs devront détecter. Ne pas les réparer : ils sont le sujet. |

### Couche 3 — Orchestration (`js/app.js`)

`App` : bootstrap (`Storage.runMigrations` → `ReseauStore.load` → abonnement → rendu), le
routage des deux écrans (hash `#/fiche/<id>`), et la barre. Les deux gardes anti-écrasement
du §6 vivent ici.

---

## 4. Le contrat du modèle — ce qui ne se négocie pas

Ces trois règles sont tenues **dans le store**, pas dans l'interface. Une vue qui les
contournerait produirait une vérité fausse.

### 4.1 Le lien est orienté

Kröger pose la question du contact-miroir en deux temps : « qui est le personnage le plus
important pour le tien ? », puis **« ton personnage est-il aussi important pour lui ? »**.
Cette seconde question n'est vérifiable que si les deux sens existent séparément.

Un lien symétrique s'écrit donc en **deux** liens (`upsertPaire` les pose d'un coup). La
réciprocité se **dérive** (`reciproque`), elle ne se stocke jamais : deux vérités pour un
même fait, c'est une divergence garantie.

### 4.2 Les énumérations sont fermées

`tonalite` ∈ `{positif, negatif, neutre, complique}` · `importance` ∈ `{primaire,
secondaire, confort}`. Une valeur inconnue est **refusée**, jamais stockée en douce. Le jour
où un validateur comptera les contacts positifs, il ne doit pas découvrir un `"positif "`
avec une espace.

### 4.3 Un seul contact-miroir par personnage

Poser un nouveau miroir retire le précédent. Sinon la règle « personne n'est laissé seul » se
compterait deux fois.

**Corollaire de suppression :** retirer un personnage purge ses liens et renvoie
`{ personnage, liens }` — de quoi annuler (`restaurer`). L'intégrité référentielle est du
ressort du store, pas de l'appelant.

---

## 5. La mention porte l'arête

Écrire « j'ai vu @Marek sortir du tunnel » dans la fiche d'Elena **propose** de créer le lien
Elena → Marek. C'est la décision d'interaction dont dépend tout le reste : sans elle, le
réseau est une saisie parallèle, tenue en semaine 1 et abandonnée en semaine 3.

**Ancrage par id.** Une mention se stocke `@[nom](id)` ; l'id est la vérité, le nom entre
crochets n'est qu'un cache lisible. Le rendu résout id → nom courant, donc renommer un
personnage met à jour toutes ses mentions, partout, sans migration ni hook.

**La tonalité n'est jamais devinée.** Un défaut « neutre » posé en douce remplirait le réseau
d'arêtes sans intention — et ferait passer pour couvert un personnage qui n'a en réalité aucun
contact positif, désarmant le validateur qu'il est censé nourrir. L'auteur choisit d'un clic,
ou remet à plus tard : la mention reste, le lien n'existe pas. Un silence honnête vaut mieux
qu'une valeur inventée. L'importance, elle, a un défaut au milieu (`secondaire`), qui ne
fausse aucun compte.

---

## 5b. La conclusion porte l'embranchement

Chaque **conclusion potentielle** d'une situation est une arête sortante — le modèle vient de
la méthode eXpérience, il n'y avait rien à inventer.

**Une conclusion sans cible (`vers: null`) est valide.** Ce n'est pas un état dégradé : c'est
la question « et après ? », en attente. eXpérience la pose en contrôle qualité — « a-t-elle
des suites envisageables ? Lesquelles ? Vous devriez alors trouver d'autres situations de
jeu ». `creerSuite()` y répond en un geste : la situation suivante naît dans la même trame,
posée à droite, et la conclusion s'y relie. La checklist devient une file de travail.

**Une conclusion appartient à sa situation d'origine.** Supprimer une situation emporte ses
conclusions *sortantes*, mais les conclusions qui pointaient *vers* elle redeviennent
orphelines au lieu d'être détruites. L'auteur les a écrites ; elles survivent à la
disparition de leur cible, et la question se repose d'elle-même.

**Les références aux personnages ne sont jamais purgées.** `TrameStore` ne connaît pas
`ReseauStore`. Un personnage supprimé laisse une référence morte, affichée comme telle — même
convention que les puces de mention. Purger silencieusement détruirait du travail écrit et ne
survivrait pas à l'annulation d'une suppression. Une référence cassée doit se voir.

---

## 5c. L'information porte l'asymétrie

ShadowHerds a des *indices* — des faits qu'on découvre. Il lui manque **l'asymétrie de
connaissance**, qui est ce qui fait marcher une intrigue de GN. Kröger en fait une question
obligatoire : « tous les participants savent-ils la même chose ? Y avait-il un témoin dont les
autres ignorent la présence ? Est-ce un malentendu ? »

**« Ignore » n'est jamais stocké.** C'est l'absence d'entrée : l'état par défaut du monde est
un monde où l'on ne sait pas. Le stocker pour quarante personnages × trente informations
remplirait la base de mille deux cents façons de ne rien dire. L'invariant se tient dans
`poser()`, et nulle part ailleurs — deux portes pour écrire la même chose finiraient par
diverger.

**La croyance porte du texte.** Sans lui, « croit autre chose » ne serait qu'un drapeau, or
c'est la fausse croyance qui se joue à table : Lucie ne croit pas autre chose dans l'abstrait,
elle croit que son fils est mort de la fièvre. Et une croyance ne survit pas à la sortie de
l'état « croit » — la garder produirait un texte fantôme qu'aucun écran n'affiche.

**Requiert ≠ produit.** Une situation *requiert* ce qu'il faut savoir pour qu'elle arrive, et
*produit* ce qui s'y apprend. Confondre les deux rendrait impossible la seule question qui
compte au moment d'écrire les fiches : **qui doit savoir quoi AVANT le jeu ?**

### Le squelette de fiche — dérivé, jamais écrit

C'est le gain du lot. eXpérience décrit le mouvement : poser une information préliminaire sur
une situation, c'est « commencer à rédiger le squelette de sa future fiche ». GNomon
l'automatise — la fiche affiche ce que le personnage sait, et ce qu'il croit de faux, calculé
depuis `InformationStore`.

Le squelette **n'écrit pas dans le carnet**. Écrire à la place de l'auteur produirait du texte
à démêler du sien, et qui se désynchroniserait au premier changement. Il est affiché à côté,
toujours juste, et sert de liste de courses.

Corollaire tenu après l'avoir vu casser : **le marqueur « croyance fausse » suit l'état, pas
le fait qu'on ait déjà écrit la croyance.** Le lier au texte affichait un personnage qui croit
autre chose comme s'il savait, tant que la croyance était vide — soit exactement le contraire
de ce que l'auteur doit voir.

---

## 5d. La conscience — trois interdits, et ils viennent du corpus

Douze règles tirées de la littérature, chacune avec sa source nommée. **Aucun outil de GN
existant n'en implémente une seule** : c'est le produit.

**1. Jamais bloquant.** Rien n'empêche d'écrire. La conscience signale, elle n'arrête pas.

**2. Toute alerte s'écarte avec une justification écrite, et reste affichée.** Kröger : « si tu
peux argumenter pourquoi ce personnage n'a pas besoin de cet élément, il n'en a probablement
pas besoin ; sinon, il en a besoin. » Toute la valeur est dans l'argument — d'où le refus
d'une justification vide, tenu dans `Derogations.ecarter()`. Un bouton « ignorer » nu
transformerait la conscience en gêne à faire taire, et au bout de trois semaines toutes les
alertes seraient éteintes sans qu'aucune décision n'ait été prise. Une alerte écartée est une
**décision prise** : elle reste visible, avec sa date et son motif, à l'intention du
*crosschecker* que Kröger nomme dans son processus.

**3. Jamais de score global.** Fredou avertit explicitement contre les barèmes de points
artificiels. Douze compteurs indépendants, jamais une moyenne.

> **Argument empirique, trouvé en vérifiant le lot.** Rendre un lien de Marek positif au lieu
> de compliqué fait tomber une alerte « pas que du noir » et en lève une « personne n'est
> seul » — le total reste à seize pendant que la nature des problèmes change entièrement. Une
> note unique aurait dit « rien n'a bougé ». C'est faux, et c'est précisément ce qu'un barème
> ferait croire.

### Les transpositions sont écrites, pas dissimulées

Là où la donnée du projet ne permet pas de vérifier une règle *à la lettre*, le champ
`transpose` le dit à l'écran. Deux règles en portent une : **Défection** (mesurée comme « une
situation dont la jouabilité tient à un seul PJ » — les nombres exacts de Morningstar restent à
vérifier à la source) et **Mixité des intrigues** (l'objet Intrigue n'existe pas ; « interne »
est lu comme un désir écrit ou une situation portée, « externe » comme une situation qu'un
autre porte). Une règle qui prétend mesurer autre chose que ce qu'elle mesure est pire que pas
de règle du tout.

---

## 6. Le rendu en deux étages — et pourquoi ce n'est pas de l'optimisation

`Fiche.rendre()` construit tout ; `Fiche.rafraichirDerives()` ne remet à jour que la jauge et
les liens. Le store émet à **chaque** écriture, y compris pendant que l'auteur tape (le carnet
est sauvegardé avec un débounce de 400 ms). Reconstruire l'écran à ce moment-là écrase le
textarea sous le curseur : sélection perdue, position perdue.

Deux gardes découlent de là, et toutes deux ont été posées après avoir vu le bug :

1. **`App.ouvrirFiche` ne re-monte pas la fiche déjà ouverte.** Elle écrit le hash, le
   `hashchange` rappelle `_lireHash` → `ouvrirFiche` sur le même personnage : sans garde, la
   fiche se reconstruit depuis un store dont la sauvegarde débouncée n'est pas encore arrivée,
   et le texte à l'écran disparaît.
2. **`Fiche.flush()` avant toute navigation et au blur du carnet.** Quitter l'écran dans les
   400 ms perdrait les dernières frappes.

L'atelier a la même maladie sous une autre forme : `GraphEngine.mount()` se remonte
entièrement et **remet la vue à zéro**, donc un auteur qui a cadré son fil le perdrait à
chaque champ sauvegardé. La parade est une **signature** de ce qui est réellement dessiné
(titres, formes, positions, arêtes) : on ne remonte que si elle change. Modifier le matériel
ou les règles d'une situation ne fait pas sauter le graphe ; déplacer un nœud non plus
(`poserSituation` persiste **sans émettre**).

---

## 7. Émission sémantique

`ReseauStore.subscribe(cb)` émet **ce qui** a changé, pas « quelque chose a changé » :
`{ type: "lien:upsert", id, de, vers }`. Une lentille ouverte doit pouvoir re-projeter le
seul nœud touché plutôt que de tout redessiner — sinon on écrase l'état de l'écran sous le
curseur de l'auteur pendant qu'il écrit.

`subscribe` renvoie une fonction de désabonnement.

---

## 8. Lancer en local

Site statique. Les modules ES imposent un vrai serveur HTTP (le `file://` ne les charge pas) :

```bash
python3 -m http.server 8000
```

---

## 9. La suite

L'épine est décrite hors dépôt dans `PLANS/VISION_ATELIER_DE_TRAMES.md`. En résumé :
**S0** l'arête typée *(livré)* · **S1** la fiche, la jauge de couverture et le `@mention` qui
crée l'arête *(livré)* · **S2** l'atelier de trames *(livré)* · **S3** les informations *(livré)* · **S4** la conscience
(douze validateurs) *(livré)* · **S5** le temps · **S6** le casting.
