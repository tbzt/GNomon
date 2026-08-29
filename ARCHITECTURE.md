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
                                        derogations, temps,
                                        castingstore, affectation,
                                        bilancasting, runstore,
                                        conduite, mondestore, livret,
                                        archive
```

### Couche 2b — Rendu (`js/widgets/`)

| Fichier | Objet | Responsabilité |
|---|---|---|
| `reseau.js` | `Reseau` | L'écran du casting, par groupe. Chaque carte porte sa cote de couverture (n/9). |
| `fiche.js` | `Fiche` | L'écran d'écriture : huit champs saisis, jauge calculée, carnet. Rendu **en deux étages** (cf. §6). |
| `journal/markdown.js` | `Markdown` | Gras / italique / code sur du texte **déjà échappé**. Copié tel quel de ShadowHerds. Pas de titres (collision `#`), pas de liens (collision `@[]()` + XSS `href`). |
| `journal/mentions.js` | `Mentions` | Autocomplétion `@`, rendu des puces, et **proposition d'arête**. Réécrit : l'original dépend de six modules propres à son domaine. |
| `monde.js` | `Monde` | L'écran des fondamentaux. Écran de **document** : serif, colonne de lecture. |
| `livrets.js` | `Livrets` | Relecture avant remise, avec l'aperçu réel dans une `iframe`. |
| `conduite.js` | `Conduite` | Le tableau de la nuit. **Son propre monde visuel** (cf. §5g), et un battement qui ne touche qu'au temps. |
| `casting.js` | `Casting` | L'écran des vœux : grille, import à colonne choisie, affectation, bilan. |
| `frise.js` | `Frise` | L'écran du temps : planning, collisions, charge. Un clic sur un bloc ouvre l'atelier **sur cette situation** (`Atelier.viser`). |
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
| `mondestore.js` | `MondeStore` | **Les fondamentaux** — prémisse, propos, thématique, contexte commun, lieux. Les étapes 1 à 3 d'eXpérience, qui manquaient (cf. §5j). |
| `livret.js` | `livret()`, `livretHtml()` | Le background remis à un joueur. **Calculé par soustraction** (cf. §5j). |
| `archive.js` | `Archive`, `telecharger()` | Sauvegarder, exporter, partager. Enveloppe versionnée, deux modes d'import. |
| `runstore.js` | `RunStore` | L'état vivant du GN : fils en cours, main courante, horloge de fiction avec pauses. |
| `conduite.js` | `tableau()` | Ce que le tableau doit montrer : fils triés par urgence, **délaissés**, ce qui vient. Module pur. |
| `castingstore.js` | `CastingStore` | Les candidatures, les vœux, l'affectation. **Ne connaît qu'un libellé** — la ligne rouge RGPD (cf. §5f). |
| `affectation.js` | `hongrois()`, `COUTS` | L'algorithme hongrois (Kuhn-Munkres), O(n³), **exact**. Module pur : des nombres entrent, des nombres sortent. |
| `bilancasting.js` | `caster()`, `bilan()` | Les cinq contrôles d'après-casting — et la correction à la vision (cf. §5f). |
| `temps.js` | `frise()`, `heure()` | La frise, les collisions, la charge. Module pur. Sépare **erreur de PJ** et **besoin de PNJ** (cf. §5e). |
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

## 5e. Le temps — une collision de PJ est une erreur, une de PNJ est un besoin

`tempsDédié` et `espaceDédié` sont deux des treize champs d'eXpérience. Posés sur une frise,
ils montrent ce qu'aucune relecture de quarante fiches ne montre : qui est attendu à deux
endroits en même temps.

**Le calcul est le même, la conclusion ne l'est pas.**

Un **PJ** dans deux situations simultanées, c'est un joueur, un corps, et une scène qui n'aura
pas lieu. Il faut réécrire — décaler, couper, retirer quelqu'un du casting. Rouge.

Un **PNJ** dans trois situations simultanées n'est pas une faute : c'est **trois comédiens à
recruter**. Le PNJ est une fonction, pas une personne ; l'équipe peut en jouer autant qu'elle
en trouve. Violet. **Ce chiffre ne se corrige pas dans l'atelier — il part à l'organisation**,
et c'est le pont entre les deux moitiés du projet.

Les confondre dirait à l'auteur de « réparer » un planning de PNJ qui n'a rien de cassé, et lui
laisserait croire qu'une collision de PJ se règle en recrutant.

**Une situation sans horaire n'est pas une erreur.** Elle n'est pas plaçable, voilà tout —
beaucoup de scènes de GN n'ont pas d'heure, elles ont un déclencheur. Elles sont rangées à
part, jamais signalées comme un défaut.

---

## 5f. Le casting — la ligne rouge, et une correction à la vision

### La ligne rouge

Une candidature de GN collecte de la donnée sensible au sens du RGPD : santé, allergies,
régime, contact d'urgence, lignes et voiles, parfois des mineurs. GNomon est une application
locale, sans serveur, sans authentification et **sans chiffrement** — ce n'est pas un endroit
pour ça, et le prétendre serait pire que de ne rien proposer.

Alors `CastingStore` ne connaît qu'un **libellé**. L'import affiche les en-têtes du feuillet,
demande **quelle colonne** sert de libellé, et n'écrit que celle-là — les autres ne sont jamais
lues. La pseudonymisation (« Joueur 1 », « Joueur 2 »…) est **cochée par défaut**. La
correspondance entre libellé et personne reste dans le tableur de l'organisation, qui est déjà
l'endroit où elle vit.

Vérifié en important un CSV contenant courriels, allergies et numéros de téléphone : aucune de
ces chaînes ne se retrouve dans le `localStorage`.

### Une seule contrainte est modélisée : la disponibilité

Parce qu'elle est **vérifiable** — la frise (§5e) donne l'heure de chaque scène, la candidature
donne l'heure d'arrivée. Les contraintes en texte libre (« sait chanter », « n'a pas peur du
noir ») n'entrent pas dans le coût : les apparier automatiquement à un questionnaire en texte
libre donnerait un résultat faux avec l'air d'être juste.

### Le veto est cher, jamais infini

« Surtout pas ce rôle » coûte 100 quand un rang en coûte 1 : l'algorithme préférera dégrader
dix personnes d'un rang plutôt que d'imposer un seul veto. Mais si le seul appariement possible
l'impose, il rend quand même une réponse, et **le bilan la signale en rouge** — au lieu de
planter en disant « aucune solution ».

### La correction à la vision

Le plan disait « on relance les douze validateurs après casting ». **C'est faux, et je l'ai
corrigé en l'écrivant :** les douze règles portent sur le *matériau écrit*, qui ne change pas
quand on distribue les rôles. Les relancer rendrait exactement les mêmes seize alertes en
donnant l'illusion d'une vérification.

L'intuition de départ reste juste — c'est celle de Kröger, mesurée sur 260 joueurs : dix
personnages mal notés à un run ont tous été adorés à un autre, donc **la qualité d'un
personnage est relationnelle**. Simplement, elle se vérifie avec des contrôles *de joueurs*,
pas avec les règles *du texte*. D'où les cinq de `bilancasting.js` : vœux exaucés · veto
imposé · hors disponibilité · déséquilibre · **miroir désaccordé**.

Le dernier est le plus proche de Kröger : le contact-miroir veut que l'intrigue « pèse autant
des deux côtés », et un joueur enthousiaste face à un joueur tiède la fait pencher quoi qu'en
dise le texte. Sur le jeu d'essai, il trouve que le joueur qui tient Marek ne l'a accepté qu'à
contrecœur — alors que Marek est le miroir de deux enthousiastes.

---

## 5g. La conduite — pourquoi elle ne ressemble pas au reste

L'atelier est un **bureau** : on y écrit à J-30, assis, au calme, fond clair, serif pour la
prose. La conduite est une **salle de veille** : 3 h du matin, sous la pluie, à une main, une
équipe fatiguée qui doit lire un état *en traversant la pièce*. Les deux moments n'ont rien en
commun ; leur donner la même peau serait une économie, pas une cohérence.

`#ecran-conduite` définit donc ses propres tokens et **n'hérite pas du thème** — c'est le cas
« monde délibérément unique » : cet écran est nocturne par nature, pas par préférence.

| Choix | Raison, tirée de l'usage |
|---|---|
| **Fond noir chaud** (`#141110`) | Un écran clair détruit la vision nocturne et éclaire une nuit où la lumière est fictionnelle. Chaud parce que le bleu appartient à l'atelier : on doit savoir dans quelle moitié de l'outil on est, d'un coup d'œil. |
| **Ambre** (`#f2a93b`) | La couleur des instruments de nuit, la plus lisible en basse lumière — et l'opposé exact du bleu de Prusse. |
| **Horloge énorme** (46 px, mono, `tabular-nums`) | C'est la seule chose qu'on lit depuis l'autre bout de la pièce. Les chiffres tabulaires empêchent l'heure de « danser » à chaque battement. |
| **Aucun angle arrondi, barre de signal à gauche** | C'est un tableau, pas un document. La barre est le seul héritage visuel de l'atelier, où elle porte déjà la tonalité d'un lien. |
| **La serif ne survit que dans la main courante** | Elle veut dire « ceci a été écrit par une personne », exactement comme partout ailleurs. Le reste est en sans pour l'état, en mono pour les chiffres. |
| **Une seule animation** | La barre d'un fil bloqué respire. Ce n'est pas de la décoration : c'est ce qu'il faut voir de loin. `prefers-reduced-motion` respecté. |

**Contrastes mesurés, pas estimés.** Les dix couples texte/fond ont été calculés ; deux
échouaient AA sur du petit texte (`encre-faible` à 3,28 · `clos` à 4,38) et ont été corrigés.
Minimum actuel : **4,70**. C'est l'écran où ça compte le plus.

### Ce que le tableau montre, et pourquoi

**Les conclusions écrites en atelier sont les boutons du jeu.** C'est le sens de tout le modèle
depuis S2 : on ne ressaisit rien, on avance dans ce qui a été écrit. Une conclusion sans suite
écrite **bloque** le fil au lieu de sauter dans le vide — en atelier c'était une question
ouverte, en jeu c'est un cul-de-sac qu'il faut voir tout de suite.

**Le tableau se réordonne tout seul** : bloqués, puis impasses, puis les plus immobiles. On
regarde le haut, on ne cherche jamais.

**Les délaissés** sont la mesure la plus utile de l'écran, et le pendant direct de la
conscience : à J-30 la question est « ce texte est-il bon ? », à 3 h du matin c'est « qui est en
train de ne rien vivre ? ». Même intuition de Kröger — la qualité est relationnelle — mesurée
en minutes au lieu de liens. Un fil **bloqué** ne met personne en scène : ses joueurs sont là
mais il ne leur arrive rien, donc ils remontent dans les délaissés. C'est un choix, pas un oubli.

**La main courante est la seule mémoire** : c'est d'elle qu'on dérive qui a joué quand. Tenir
un second registre créerait deux vérités qui divergeraient à la première correction.

---

## 5h. Le système typographique — trois rôles, une règle

Diagnostic **mesuré** avant d'agir : toutes les surfaces de données — cellules de matrice,
libellés de casting, lignes de conscience, noms de la frise et des liens — étaient en serif à
14,5 px. Une serif est faite pour être lue ligne à ligne, pas balayée en diagonale : dans une
grille dense, elle coûte. Et la barre de navigation faisait 1265 px pour dix boutons, donc
débordait sous 375 px.

**La règle, en une phrase :**

| Rôle | Ce qu'il porte | Où |
|---|---|---|
| **serif** | Ce qu'une personne a **rédigé pour être lu comme du texte** | le carnet, un pitch, le contenu d'une information, une citation, la main courante |
| **sans** | Les noms, les états, les données de tableau, l'interface | tout le reste des écrans |
| **mono** | Les chiffres, les étiquettes, les énumérations | compteurs, horloges, libellés en capitales |

Le rôle « sans » manquait entièrement côté atelier — c'est précisément pour ça qu'il a fallu en
inventer un pour la conduite. Il est maintenant déclaré une fois (`--sans`) et appliqué partout,
des deux côtés de l'outil.

Corollaire : partout où des chiffres se comparent en colonne, `font-variant-numeric:
tabular-nums`. Sans ça, une cote qui passe de 9/9 à 10/9 fait sauter toute la colonne.

## 5i. La barre dit l'ordre de fabrication

Huit écrans en rangée ne disent rien de la manière dont on fabrique un GN. Regroupés, ils le
disent — et le regroupement est de **l'information, pas de la décoration** :

**Écrire** (le réseau · les trames · qui sait quoi) → **Vérifier** (la conscience · le temps) →
**Distribuer** (le casting) → **Jouer** (la conduite).

C'est la chronologie réelle. La barre devient une progression, la sous-barre donne les écrans du
moment actif, et elle disparaît quand le moment n'en a qu'un.

Deux conséquences qui valent mieux que ce qu'elles remplacent :

1. **Le compte d'alertes est porté par le moment « Vérifier » lui-même**, au lieu d'un badge
   séparé. Le signal vit là où on ira le traiter.
2. **« La fiche » n'est pas une destination de la barre** — on n'y va pas depuis la navigation,
   on y arrive depuis un personnage. Elle s'affiche en fil d'Ariane, et le bouton
   « + Personnage » redescend sur l'écran du réseau, là où il a du sens.

Enfin, **les écrans-instruments prennent la largeur** (1560 px) ; seule la fiche garde une
colonne de lecture (1160 px), parce que c'est le seul écran qu'on lit vraiment.

---

## 5j. Le monde, le livret, l'archive

### Un manque structurel

Tout l'outil a été bâti sur « la vérité racine est l'arête ». C'était le bon parti — un
personnage de GN n'existe que par ses liens — mais il a laissé un trou : **les étapes 1 à 3 de
la méthode eXpérience** (prémisse, propos, thématique) n'existaient nulle part. Or c'est par
elles qu'on commence, et c'est d'elles que sort le livret de contexte remis à tout le monde.

Le **contexte commun** n'est pas une information au sens d'`InformationStore`. Ce dernier porte
l'*asymétrie* — qui sait ce que les autres ignorent. Le savoir commun est le sol, pas une
asymétrie : le mélanger aux informations noierait les vraies divergences sous le décor.

### Deux documents opposés dans leur principe

· **Le livret** part chez un joueur : calculé par **soustraction**.
· **La consigne PNJ** reste dans l'équipe : calculée par **addition**. On y met tout, y compris
  **ce que les PJ croient de faux, avec la vérité en face**. Un PNJ qui ignore la fausse croyance
  d'un PJ va la contredire sans le vouloir et défaire l'intrigue en une phrase — c'est ce qui
  manque à toute fiche de PNJ écrite à la main.

### Le livret est calculé par soustraction

C'est le seul document de GNomon qui sorte de l'équipe. La question n'est donc pas « que
sait-on ? » mais **« que peut-il lire ? »**. Quatre exclusions, et chacune détruirait le jeu :

| Retiré | Pourquoi |
|---|---|
| La **fonction narrative** | Écrire « tu es le faux allié » dit au joueur comment son histoire finit. |
| La **transformation possible** | C'est le pronostic de l'auteur — la lire, c'est jouer le résultat. |
| L'**importance** d'un lien et le **miroir** | Instruments de construction. Aucun personnage ne pense « ce contact est secondaire » de quelqu'un qu'il connaît. |
| **Le carnet de l'auteur** (`notes`) | Privé depuis la migration v2. C'est `background` qui est publié — sans cette séparation, un « à révéler en S3 » griffonné dans le carnet partait au joueur. |
| **La vérité derrière une croyance fausse** | LE point critique. Quand un personnage *croit autre chose*, le livret n'écrit QUE ce qu'il croit. Sortir les deux — ce que fait tout tableur — livre l'intrigue au joueur dans le document censé la lui cacher. |

Les **avertissements** (carnet vide, croyance sans texte, aucun contact) s'adressent à l'auteur
et ne sortent jamais dans le document.

### La sécurité émotionnelle n'est pas une option

Un livret de GN contemporain porte, en plus de la fiction : la **note d'intention**, les
**avertissements de contenu** et les **mécaniques de sécurité** en usage — lignes et voiles,
« coupez », « freinez », le regard baissé, « hors-jeu », un·e référent·e, un débriefing.

Ce ne sont pas des formalités : ce sont les outils qui permettent de jouer des choses dures sans
casser quelqu'un, et ils ne servent **que si tout le monde les a lus avant**. Ils sont donc
portés par le monde, actifs par défaut — le défaut sûr est celui qui protège — et repris
automatiquement dans **chaque livret et chaque consigne**, sans que l'auteur ait à y penser.

Leur formulation est **fermée et pré-écrite** : demander à chaque équipe de les reformuler
produirait quarante variantes approximatives d'outils qui ne valent que s'ils sont dits de la
même façon partout. Un champ libre reste pour ce qui est propre au GN (« la référente est
Claire, gilet orange »).

Sources : le guide *Pour un GN plus sécurisant* d'Electro-GN et le corpus nordique sur la
calibration.

### Le background n'est pas le carnet

`background` est le texte **remis** : long, en pages (`---` seul sur sa ligne = saut de page à
l'impression), avec ses images et ses indications de style. `notes` est le carnet de l'auteur,
qui ne sort **jamais**. La migration v2 déplace l'ancien `notes` vers `background` — c'est lui
qui était publié, il reste publié, aucun changement de comportement — et rend `notes` privé.

Les **images** sont soit une URL (gratuite, mais le livret aura besoin du réseau), soit un
`data:` embarqué (livret autonome, mais qui pèse sur le quota). Les fichiers sont **réduits à
900 px** avant embarquement : une photo de téléphone fait 4 Mo et le quota du `localStorage` en
fait 5 au total — sans cette étape, la première image ferait échouer toutes les écritures
suivantes.

L'impression est en **A5 portrait**, la convention des livrets de GN français.

### L'archive : deux modes aux sémantiques opposées

- **remplacer** — le fichier devient la vérité. Pour restaurer, ou reprendre le travail de
  quelqu'un en entier.
- **fusionner** — le fichier *complète* : ce qui manque est ajouté, **ce qui existe n'est pas
  touché**. Deux personnes qui ont écrit chacune de leur côté ne doivent pas se voir écraser par
  l'ordre d'import. Le prix est qu'un objet modifié des deux côtés garde la version locale — et
  c'est le bon prix : on peut toujours réimporter en « remplacer », jamais ressusciter ce qui a
  été écrasé.

L'enveloppe (`format`, `version`) est lue **avant** le contenu. Un fichier étranger ou d'une
version future est refusé avec une phrase claire plutôt qu'importé à moitié : un import partiel
laisserait un GN incohérent qu'on croirait entier.

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

Troisième garde, du même genre, posée après avoir vu le bug : **la sélection d'un module ne
survit pas au vidage de son store.** L'atelier garde son `_trameId` entre deux montages, ce qui
est voulu — mais recharger le jeu d'essai détruit les trames et en crée de nouvelles, et l'id
mémorisé pointait alors sur une trame morte : le graphe s'affichait **vide, sans rien dire**.
`_recadrer()` revalide la sélection au montage et à chaque rafraîchissement.

La conduite a la même maladie sous une quatrième forme : son battement rafraîchit toutes les
15 s, et reconstruire l'écran écraserait la saisie de la main courante en pleine frappe.
`battre()` ne touche qu'aux nœuds qui dépendent du temps. La minuterie est arrêtée à la sortie
de l'écran (`demonter()`) — vérifié : trois allers-retours, trois minuteries posées, trois
libérées.

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
(douze validateurs) *(livré)* · **S5** le temps *(livré)* · **S6** le casting *(livré)*.

**L'épine est complète, et la salle de conduite est livrée.** Elle ne réutilise finalement
*pas* le cockpit de ShadowHerds : le contexte d'usage n'est pas le même, et la peau a été
refaite pour la nuit (§ 5g).
