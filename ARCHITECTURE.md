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
                                        archive, poids, besoins,
                                        suivistore, liensstore, defection
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
| `reseaugraphe.js` | `ReseauGraphe` | La **seconde lentille** du réseau : arêtes fusionnées par paire, poches de groupe, et le geste de défection. |
| `besoins.js` | `Besoins` | L'écran des besoins dérivés, avec le suivi et les liens attachés. |
| `cockpit.js` | `Cockpit`, `compterOuverts()` | **La porte d'entrée** : ce que GNomon déduit du texte déjà écrit, groupé par objet, cliquable jusqu'à son origine. N'appartient à aucun des quatre moments (cf. §5q). |
| `degats.js` | `degatsHtml()`, `coupeHtml()`, `jamaisSueHtml()` | Le **texte** d'une absence, en un seul endroit. Rendu pur, sans état ni écouteur : le flanc du graphe et la fiche disent la même chose du même calcul (cf. §5r). |
| `espace.js` | `Espace` | L'écran de l'espace partagé : se connecter, rattacher, synchroniser, montrer les conflits (cf. §5t). Le seul écran d'où un GN peut se mettre à parler dehors. |
| `conduite.js` | `Conduite` | Le tableau de la nuit. **Son propre monde visuel** (cf. §5g), et un battement qui ne touche qu'au temps. |
| `casting.js` | `Casting` | L'écran des vœux : grille, import à colonne choisie, affectation, bilan. |
| `frise.js` | `Frise` | L'écran du temps : planning, collisions, charge. Un clic sur un bloc ouvre l'atelier **sur cette situation** (`Atelier.viser`). |
| `conscience.js` | `Conscience` | L'écran des treize règles. Tient les trois interdits **dans le rendu** autant que dans les stores (cf. §5d). |
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
| `conscience.js` | `conscience()` | **Les treize règles, calculées.** Module pur : lit trois stores, n'en mute aucun, ne touche pas au DOM — S6 pourra le rejouer après casting. Ne connaît pas les dérogations : le calcul reste rejouable tel quel. |
| `diagnostic.js` | `diagnostics()`, `parCategorie()` | **La couche d'interprétation.** Traduit `conscience()`, `frise()`, `classementFragilite()` en signaux humains groupés par objet du GN, et ajoute quatre signaux structurels neufs (cf. §5q). Pur, et comme la conscience : ne connaît pas les dérogations. |
| `crashtest.js` | `crashTestSituation()`, `crashTestInformation()`, `crashTestArriveeTardive()` | « Et si… ? » posé sur autre chose qu'une personne — `defection()` couvre déjà ce cas-là et est réutilisée telle quelle (cf. §5r). Pur, et **en lecture seule** : on veut savoir ce que coûterait la coupe avant de la faire. |
| `liaison.js` | `contexteSuite()` | Ce qu'il faut avoir sous les yeux pour écrire la suite d'une conclusion : ce que les présents savent déjà, et les fils tendus sans être rattachés. **Propose, ne décide pas** (cf. §5s). Pur. |
| `espace.js` | `rattachementDe()`, `tour()`, `distantDe()` | Le rattachement d'un GN à un espace — **clé d'appareil**, jamais exportée — et le mariage de `remote.js` avec `sync.js` (cf. §5t). `rattachementDe` prend `Storage` en paramètre, donc s'éprouve avec un faux. |
| `pointdevue.js` | `pointDeVue()`, `trous()` | Le GN vu d'un personnage : ce qu'il sait, peut apprendre, peut provoquer, et **où il risque de n'avoir rien à faire** (cf. §5r). Pur. |
| `mondestore.js` | `MondeStore` | **Les fondamentaux** — prémisse, propos, thématique, contexte commun, lieux, et le **fil de l'histoire** (ce qui s'est passé, jamais dans un livret). Les étapes 1 à 3 d'eXpérience, qui manquaient (cf. §5j). |
| `livret.js` | `livret()`, `livretHtml()` | Le background remis à un joueur. **Calculé par soustraction** (cf. §5j). |
| `defection.js` | `defection()`, `classementFragilite()` | « Et s'il ne vient pas ? » — les quatre dégâts d'une absence. Module pur (cf. §5n). |
| `besoins.js` | `besoins()` | Ce que l'écriture réclame, **dérivé** du texte déjà écrit. Jamais stocké (cf. §5l). |
| `suivistore.js` | `SuiviStore` | La couche humaine posée sur les besoins : **un responsable, un état**. Pas de date (cf. §5l). |
| `liensstore.js` | `LiensStore` | Des **adresses**, jamais leur contenu. Validation d'URL par construction, pas par expression régulière. |
| `projets.js` | `Projets` | **Plusieurs GN sur le même appareil.** Un projet est un préfixe de clés, rien d'autre (cf. §5o). |
| `objets.js` | `decouper()`, `recoudre()`, `empreinte()` | Découper un GN en documents pour l'écrire à plusieurs, et le recoudre. Pur (cf. §5p). |
| `sync.js` | `decider()`, `synchroniser()` | Le moteur de l'espace partagé. Trois interfaces injectées, donc éprouvable hors ligne (cf. §5p). |
| `remote.js` | `connecter()`, `ecrire()`, `garde()` | **Le seul module qui parle à un serveur.** Absent, rien ne casse (cf. §5p). |
| `config.js` | `DB`, `API_KEY` | Les deux valeurs qui branchent l'espace. Publiques, et ce n'est pas un oubli (cf. §5p). |
| `epreuve.js` | `Epreuve` | Tenter ce qui **doit** échouer. Une règle qu'on croit posée ne se voit pas (cf. §5p). |
| `poids.js` | `poids()`, `conseil()` | Ce que pèse le GN et **ce qui pèse dedans**. On mesure ce qu'on écrit plutôt que d'interroger le navigateur (cf. §5k). |
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

### Le fil de l'histoire : ce qui s'est passé, en une seule version

Un GN a trois niveaux de vérité, et ils ne doivent jamais se confondre : **ce qui est arrivé**
(une seule version, que personne en jeu ne connaît en entier), **ce que chaque personnage
croit** (les livrets — une trentaine de versions, presque toutes fausses quelque part), et **ce
que tout le monde sait** (le contexte commun). Le premier n'avait pas de place dans l'outil : il
vivait dans un fichier à côté, et c'est là qu'on cherchait, à 2 h du matin, l'ordre exact des
événements.

Le monde porte donc un champ `fil` : un texte long en Markdown, la chronologie datée de ce qui
s'est réellement passé, avec les conventions que l'équipe s'est données — un fait **[FIXE]**,
un **[INTERRUPTEUR]** que le jeu décide, une **[PROPOSITION]** à valider — et un tableau « qui
sait quoi ». C'est un **document d'organisation** : `livret.js` ne le lit pas, donc il ne sort
ni dans un livret, ni dans une consigne, ni sur la planche, et un test le vérifie sur les quatre
sorties. Il voyage en revanche dans l'archive, qui contient déjà tout et dont l'avertissement le
nomme ; l'inventaire d'import dit s'il est là.

Premier jet volontairement simple : un texte, sans lien vers les informations ni les situations.
Le relier viendra quand on saura ce qu'on veut en tirer — probablement la ligne « qui sait quoi »
générée depuis `InformationStore`, plutôt que tenue à la main.

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
| **Le texte d'équipe d'une information** (`contenu`) | Il est écrit pour l'orga : troisième personne, notes de fabrication. Ce que lit le joueur est l'`enonce`, saisi en face. Sans lui, le livret imprime le contenu faute de mieux et le **signale** — un livret muet sur ce que le personnage sait serait pire, mais un livret qui parle comme l'orga est une fuite, et elle doit se voir. Ce champ ne porte pas un texte par porteur : une information que deux personnes doivent lire différemment est deux informations. |
| **La note privée d'un lieu** (`prive`) | Le lieu a une note pour le joueur (`note`) et une pour l'équipe. « Ne pas y placer de scène avant 45 h de frise » partait dans le livret avec le nom du lieu ; seule la consigne porte désormais les deux. |

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

### Le portrait et le trombinoscope

Le **portrait** est distinct des images de background : c'est le visage, et il sera tiré
quarante fois sur une planche. Il est donc **carré et petit — 360 px** — là où une image de
background peut se permettre 900 px puisqu'il n'y en a qu'une ou deux par fiche. Quarante
portraits à 900 px dépasseraient à eux seuls le quota du `localStorage`. Le recadrage prend le
carré central plutôt que de déformer : un visage étiré est pire qu'un visage coupé.

Le **trombinoscope** obéit à la **même règle que le livret : rien que du public.** Nom, rôle,
groupe, visage. Y glisser la fonction narrative ou un mot sur les intrigues transformerait
l'objet le plus partagé du GN en fuite générale — c'est la planche que tout le monde reçoit et
que personne ne range.

Un portrait manquant **n'est pas masqué** : il devient une silhouette aux initiales, et l'écran
compte combien il en manque. Un trou visible se comble ; un trou caché reste. Impression en
**A4 portrait**, quatre par rangée.

### L'archive contient tout, et ça se dit

Le livret est calculé par soustraction avec beaucoup de soin, la consigne PNJ porte les vérités,
le carnet de l'auteur est privé. **L'archive, elle, contient les trois.** L'envoyer à un joueur
annulerait d'un coup toutes ces précautions.

Le fichier porte donc un champ `avertissement` en clair, lisible dès qu'on l'ouvre dans un
éditeur, et l'export le rappelle à l'écran. Ce n'est pas une protection technique — il n'y en a
pas de possible pour un fichier qu'on s'envoie soi-même — c'en est une humaine, et c'est la
seule qui ait du sens ici.

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

## 5k. Le poids — prévenir avant que le quota morde

`storage.js` sait signaler un échec d'écriture, mais **c'est trop tard** : quand le quota est
atteint, la modification en cours est déjà perdue. L'indicateur monte avant, ce qui laisse le
temps d'exporter.

**On n'interroge pas `navigator.storage.estimate()`.** Il mesure l'origine entière — caches,
IndexedDB, service workers — et renvoie des quotas sans rapport avec la limite propre au
`localStorage`. Il dirait « 2 % utilisés » à un GN sur le point de ne plus pouvoir écrire. On
mesure donc ce qu'on écrit vraiment, et on le compare à une **borne prudente de 5 Mo annoncée
comme telle** : viser bas fait prévenir tôt, ce qui est le but.

Le message **nomme la cause et l'action**, pas seulement l'état : « les images en occupent
100 % (6 portraits) — une adresse web à la place d'un fichier ne pèse rien ». Un indicateur qui
se contente d'un pourcentage laisse l'auteur deviner quoi faire.

---

## 5l. Les besoins — dériver plutôt que gérer

### Pourquoi ce n'est pas un kanban

La question s'est posée d'ajouter un tableau d'organisation — le lieu, l'assurance, la
nourriture. La recherche l'a tranchée, et dans l'autre sens :

- **Electro-GN**, dont le corpus est vaste, n'a **aucun guide de logistique**. Tout est sur
  l'écriture et la sécurité.
- **Pettersson** (« Comment organiser un GN de manière efficiente ») **refuse explicitement**
  de donner un rétroplanning et met la **propriété claire des rôles** au-dessus du calendrier :
  « chacun a un poste clairement défini car cela permet de gérer le stress ».

Un tableau générique serait donc moins bon que Trello et sans lien avec ce que l'outil sait.
**On fait l'inverse : on dérive ce que seul GNomon peut savoir**, parce que ça se calcule
depuis le texte — le matériel et la mise en scène des situations, la charge PNJ, les règles
nécessaires, les contraintes de casting, les documents inachevés.

### Le besoin n'est jamais stocké

Seul **ce qu'on en a fait** l'est — un responsable, un état — indexé par une clé stable dérivée
de la source. Changer le matériel d'une situation change le besoin, et l'affectation suit.
Stocker le besoin en ferait une copie qui divergerait au premier remaniement : c'est exactement
ce qu'un tableur d'équipe finit toujours par devenir, une liste qui ne correspond plus à rien.

Suivant Pettersson, on stocke **un nom, pas une date**.

### L'écran alimente votre outil, il ne le remplace pas

L'export produit un markdown à cases à cocher, avec le contexte de chaque besoin, prêt à coller
dans le tableau que l'équipe utilise déjà. Le pont est assumé : refaire Trello serait des
semaines pour faire moins bien, alors que ce qui est dérivé ici ne se calcule nulle part
ailleurs.

## 5m. Le hub — relier sans stocker

GNomon ne veut devenir ni le Drive de l'équipe, ni son tableau d'organisation, ni son dossier
de photos. Mais il peut être le **point de départ** d'où l'on retrouve où sont les choses.
`LiensStore` ne garde donc que des **adresses**. Un lien est général (le hub, sur l'écran du
monde) ou **attaché** à un objet — `besoin:<clé>` aujourd'hui, `personnage:<id>` demain sans
migration.

**La validation d'URL n'est pas du confort.** Ces adresses sont rendues en `<a href>` : un
`javascript:` collé là s'exécuterait au clic, dans une page qui contient tout le GN. On
n'accepte que `http:` et `https:`, vérifiés **en construisant une `URL`** — pas avec une
expression régulière, qui se contourne. Le rendu porte `rel="noopener noreferrer"` : sans
`noopener`, la page ouverte peut réécrire celle qui l'a ouverte. Et le nom d'hôte est affiché à
côté du titre, pour qu'on sache où l'on va avant de cliquer.

---

## 5n. Le graphe du réseau — et le geste qui manquait

### Une arête visuelle par paire, pas par lien

Le modèle est orienté : Elena→Marek et Marek→Elena sont **deux** liens. Dessinés tels quels ils
se superposeraient exactement, et l'un des deux serait invisible. On les **fusionne au rendu**,
et c'est le trait qui dit leur rapport :

| Trait | Sens |
|---|---|
| **plein** | les deux sens existent et concordent |
| **tireté** | les deux existent mais diffèrent — l'asymétrie, qui est le matériau du GN, se voit enfin d'un coup d'œil |
| **pointillé** + flèche | un seul sens : quelqu'un compte pour l'autre sans réciproque |

L'épaisseur porte l'importance (le moteur a été étendu d'un `e.width` — l'original laissait
l'épaisseur à la CSS, ce qui suffit à un graphe homogène mais pas ici), la couleur la tonalité,
`◎` le contact-miroir. Le vocabulaire est **le même que la liste** (⇄ · ⇄̸ · →) : on passe d'une
lentille à l'autre sans réapprendre à lire.

### Pas de simulation de forces

Le moteur en propose une ; on ne s'en sert pas. Un force-layout brouille les groupes et se
réorganise à chaque ouverture, alors que **la structure sociale d'un GN EST ses groupes**. On
arrange donc par groupes, de façon déterministe — groupes sur un cercle, membres en couronne —
et l'auteur déplace ensuite. Sa disposition est persistée (`poserPersonnage`, silencieuse comme
`poserSituation`).

### Le geste

On active le mode, on touche quelqu'un, tout ce qui dépend de lui vire au rouge. Quatre dégâts,
et ils ne se valent pas : les **scènes orphelines** (il en est le point de vue — personne ne
peut la porter), les **scènes fragilisées** (il est au casting), les **miroirs perdus**
(quelqu'un se retrouve seul le soir même), et les **informations orphelines** — le plus traître,
parce que rien ne se voit : ce qui devait circuler ne circulera pas et les scènes qui en
dépendent tomberont en silence.

Le classement de fragilité fait le geste quarante fois d'un coup : à J-15, il dit sur qui
prévoir une doublure.

> **Un défaut instructif, corrigé.** Le bouton de mode interpolait son texte et son
> `aria-pressed` depuis l'état, mais gardait sa classe en dur. Deux vérités pour un même état :
> au moindre re-rendu — et l'app en déclenche à chaque écriture — le texte restait juste et la
> couleur disparaissait. Le rendu est redevenu la source unique.

---

## 5o. Les projets — plusieurs GN sur le même appareil

Les clés étaient nues : `gnomon_v1_reseau`, une fois, pour toujours. Il n'y avait donc
**qu'un GN par navigateur**. Une équipe qui prépare l'édition suivante pendant que la
précédente n'est pas archivée devait exporter, vider, réimporter à chaque bascule — un
aller-retour de plusieurs mégaoctets, à faire de tête, et dont chaque oubli coûte un GN.

**Un projet est un préfixe** : `gnomon_v1_<projet>__<clé>`. Pas de table, pas de jointure,
pas de migration à chaque clé nouvelle. Basculer, c'est déplacer une fenêtre de lecture
(`Storage.poserProjet`).

**Les clés d'appareil ne sont pas préfixées** — le thème, la version de schéma, l'index des
projets, la session distante. Elles n'appartiennent à aucun GN, ne s'exportent jamais, et
recevoir l'archive d'un collègue ne doit pas retourner son écran.

La migration v3 déplace l'existant en **renommant** les clés, jamais en recopiant leur
contenu : un GN chargé en images pèse plusieurs mégaoctets, et le dupliquer le temps d'une
migration ferait sauter le quota juste avant de le libérer. Le projet est nommé d'après le
titre du monde s'il est écrit — le redemander serait le demander deux fois.

Corollaire mesuré : `poids()` compte désormais **toute l'origine**, pas le GN ouvert. Le quota
du `localStorage` se compte par origine ; un indicateur qui n'aurait mesuré que le GN courant
aurait annoncé « rien à signaler » à une équipe qui garde trois éditions en réserve.

---

## 5p. L'espace partagé — écrire à plusieurs

Transposé de [RecoHero](https://github.com/tbzt/recohero), dont c'est le module éprouvé :
Realtime Database consommée au simple `fetch` (donc la règle « aucune dépendance, aucune
étape de build » tient), jetons renouvelés en silence, invitation par secret jetable — on
n'est à aucun moment en possession de ce qui authentifie quelqu'un.

### La divergence, et elle n'est pas négociable

Chez RecoHero, `quizzes/.read` vaut `true` : n'importe qui répond sans compte, et c'est le
produit. **Ici, la lecture est aussi fermée que l'écriture.** L'archive d'un GN porte les
vérités que les joueurs ignorent, les consignes PNJ et les carnets privés : un espace lisible
de tous livrerait l'intrigue à qui devine le nom de la branche.

### La maille est l'objet, pas le store

Le `localStorage` range un GN en neuf gros blocs. C'est le bon format pour une lecture-écriture
locale, et le pire pour écrire à plusieurs : deux personnes sur deux personnages touchent le
même bloc. `objets.js` traduit — un document par personnage, par situation, par information :

```
reseau { personnages:[…], liens:[…] }  ↕  reseau~personnages/p1a · reseau~liens/l7c
```

Ce qui n'a **pas** d'identité (le titre du monde, l'horloge de la run, l'affectation du
casting) tient dans un document `_` par clé. On y perd la finesse, et c'est le bon prix :
deux personnes qui écrivent la prémisse écrivent bien la même chose. L'affectation, elle,
voyage entière — deux moitiés de deux castings ne forment pas un casting, comme en local.

### Le garde-fou est dans la base, pas dans notre politesse

Chaque document porte une révision, et la règle exige d'en recevoir **exactement la
suivante**. Deux personnes parties du même point ne peuvent donc pas écrire l'une après
l'autre : la seconde est refusée par la base, ce qui protège même d'un défaut de notre côté.
C'est précisément ce qui manque au mode « fusionner » de l'archive, qui garde le local sans
savoir lequel est le plus récent.

**Supprimer pose une pierre tombale** (`sup: true`) au lieu d'effacer la branche. Effacer
perdrait la révision, et le pair qui détient encore l'objet le repousserait : ce qu'on a
supprimé reviendrait tout seul.

### Ce qu'on fait d'un conflit

Trois réponses possibles, deux sont mauvaises : garder le local perd la version de l'autre en
silence ; prendre le distant sans rien dire perd la sienne. On fait le troisième — **prendre
le distant pour converger, et rendre le local entier dans le rapport**. C'est la règle de
l'archive (« on peut toujours réimporter, jamais ressusciter ce qui a été écrasé »), à chaud.

Deux cas méritent d'être nommés parce qu'ils sont contre-intuitifs. Les deux ont écrit **la
même chose** n'est pas un conflit — crier au conflit là-dessus apprendrait à l'équipe à les
ignorer. Et supprimé d'un côté, modifié de l'autre **est** un conflit, pas une suppression :
suivre aveuglément effacerait le travail de celui qui écrivait.

### Éprouvé hors ligne, puis contre la vraie base

`sync.js` prend trois interfaces injectées (dépôt, distant, registre), donc il se monte sur
une base factice qui applique la vraie règle de révision. C'est ce qui permet de jouer le
**chemin du refus** — celui qu'on ne teste jamais à la main, et celui qui coûte un après-midi
quand il est faux. Deux pairs, dix-neuf cas, convergence vérifiée.

### La configuration est publique, et la protection est ailleurs

`config.js` porte l'URL de la base et la clé d'API en clair. Dans une application web, c'est
un **identifiant**, pas un mot de passe : ces valeurs partent dans le JavaScript que le
navigateur télécharge, et un site statique n'a aucune cachette. Les masquer serait un théâtre
coûteux, qui laisserait croire à une protection inexistante.

Ce qui protège est dans `firebase.rules.json`, appliqué côté serveur. Et **une règle qu'on
croit posée ne se voit pas** : d'où `epreuve.js`, qui tente ce qui doit échouer.

### Le registre n'est pas dans le modèle

Savoir si un objet a changé demande de se souvenir de la dernière fois. On pourrait poser un
`_rev` sur chaque objet — il partirait dans l'archive, dans les livrets, dans le
trombinoscope. Le registre est donc **à côté**, sous une clé d'appareil. Conséquence voulue :
exporter puis réimporter un GN ailleurs perd le registre, et la synchronisation repart de
zéro — elle converge quand même, et c'est testé.

### Lancer l'épreuve

Les règles d'abord, le code ensuite. Depuis n'importe quelle page de l'application :

```js
const { Epreuve } = await import("./js/core/epreuve.js");

// Sans compte : les quinze doivent être refusées.
Epreuve.afficher(await Epreuve.anonyme("nom-de-l-espace"));

// Puis, connecté et membre :
await Epreuve.connexion();
Epreuve.afficher(await Epreuve.membre("nom-de-l-espace"));
```

**L'épreuve anonyme seule ne suffit pas**, et il faut le dire : une base laissée en mode
verrouillé refuse elle aussi tout accès anonyme. De l'extérieur, les deux se ressemblent
exactement. Seul le premier cas de l'épreuve membre — *un membre peut écrire* — distingue
« mes règles sont déployées » de « rien n'est en place et personne ne pourra travailler ».
C'est pour ça qu'il s'arrête net s'il échoue, au lieu de rendre six succès obtenus pour la
mauvaise raison.

Un espace ne se crée **pas** depuis le web : les règles y interdisent l'écriture, et seule la
console peut poser sa branche `membres`. Personne ne se fabrique un espace. Inscrire son
`uid` dans `gerants` en plus de `membres` n'est pas un doublon : les règles empêchent qu'un
gérant soit retiré, sans quoi un membre pourrait verrouiller le propriétaire dehors.

---

## 5q. Le diagnostic — une couche d'interprétation, pas un calcul de plus

La conception complète est dans `PRODUCT_TRANSFORMATION.md`. Ici, seulement ce qu'il faut
pour reprendre le code.

### Le problème que ça résout

GNomon savait déjà tout ce qu'il fallait : treize règles de conscience, le coût d'une
absence, les collisions de temps, l'asymétrie de connaissance. Mais **chaque calcul vivait
dans son écran, avec son vocabulaire** — il fallait visiter quatre écrans, et savoir ce
qu'est un « miroir désaccordé », pour réunir ce que l'outil savait déjà. Le problème
n'était pas le calcul, c'était l'accès.

`diagnostic.js` ne recalcule donc **rien** de ce qui existe : il lit `conscience()`,
`frise()`, `classementFragilite()` et les traduit en une liste commune, groupée par objet
du GN (personnage · situation · information · temps · groupe) plutôt que par nom de règle.

### Quatre signaux neufs, et seulement ceux qu'aucun module ne portait

| Signal | Ce qu'il regarde | Pourquoi ce n'est pas un doublon |
|---|---|---|
| `prise:absente` | Un PJ dans **aucune** situation, ni point de vue ni figurant | La règle `heros` ne regarde que le point de vue |
| `information:sans-porteur` | Une information requise que **personne au monde** ne sait | La règle `armee` regarde qui est *en scène*, pas qui existe |
| `reference:orpheline` | Un `pointDeVueId`/`castIds` vers un personnage supprimé | `TrameStore` ne purge jamais (§5b) — rien ne le remontait |
| `fragilite:defection` | Le résumé de `classementFragilite()`, borné aux cas graves | Pas un calcul : l'exposition d'un calcul déjà écrit |

### Les trois règles tenues, et d'où elles viennent

**1. `gravite` est qualitative, `confiance` distingue le fait de l'heuristique.** Deux
valeurs chacune, **jamais additionnées**. C'est l'interdit de Fredou déjà en vigueur pour
la conscience (§5d), étendu à toute la couche. Tous les signaux livrés sont
`confiance: "haute"` — des faits structurels. Une heuristique (« cette promesse semble
fragile ») entrera en `"moyenne"`, avec une formulation au conditionnel, jamais mélangée
au même ton sans le dire.

**2. Une seule vérité pour les dérogations.** `diagnostic.js` **ne connaît pas
`Derogations`** — exactement comme `conscience()`, pour rester rejouable tel quel. C'est
le widget qui croise. Conséquence voulue et vérifiée : une alerte écartée depuis le
cockpit apparaît écartée sur l'écran de conscience, avec la même justification datée. Un
second mécanisme de « masquage » aurait produit deux vérités qui divergent.

**3. Le doublon se résout dans l'agrégat, pas dans les règles.** `prise:absente` implique
toujours `heros` — le second dirait moins, en pire, de la même personne. `diagnostics()`
retire donc `heros` pour toute cible déjà couverte par `prise:absente`. Le point de
vigilance pour la suite : **chaque signal ajouté doit répondre à « quel signal existant ne
couvre pas déjà ça ? »**, et le dire en commentaire.

### Le cockpit n'appartient à aucun moment

Les quatre moments (Écrire · Vérifier · Distribuer · Jouer) disent l'ordre de fabrication
(§5i). Le diagnostic n'est d'aucun d'eux : le ranger dans « Vérifier » en ferait un écran
qu'on pense à visiter, ce qui est exactement le problème d'origine. `_rendreNav` laisse
donc `modeActif` à `null` quand on y est, et la sous-barre disparaît — aucun onglet à
montrer pour un écran qui n'appartient à aucun moment.

Deux points d'entrée, pas un : **la porte** (sans hash, un projet qui a du contenu ouvre
sur le cockpit ; un projet vierge garde l'accueil, qui n'a rien à diagnostiquer) et **le
lien permanent** dans la barre, avec son badge, pour y revenir depuis n'importe où.

Le cockpit ne route rien lui-même : il connaît `diagnostic.js`, pas `App`. Chaque cible
passe par `onNaviguer(ecran, cible)`, et `App._naviguerDepuisCockpit` réutilise le routage
existant (`ouvrirFiche`, `ouvrirAtelier({situationId})`…) — aucune route nouvelle.

### Le silence est une fonctionnalité

Zéro diagnostic affiche une phrase, pas une grille vide. Un tableau de bord qui se remplit
pour se justifier d'exister apprend à être ignoré.

---

## 5r. Le crash test et le point de vue — poser la question soi-même

Le diagnostic (§5q) dit ce qui **est**. Ces deux modules répondent à ce que l'auteur
**demande** : « et si… ? », et « qu'est-ce que cette personne vit ? ». Ce n'est pas la même
chose, et ils ne vivent donc pas au cockpit : ils vivent là où on se pose la question.

### Le calcul était partagé, le texte ne l'était pas

`defection()` existait depuis longtemps, mais son **rendu** vivait entièrement dans le
flanc du graphe. Ouvrir le geste depuis la fiche aurait voulu dire réécrire le texte —
et deux textes pour un même calcul finissent toujours par dire deux choses différentes.
D'où `widgets/degats.js` : du rendu pur, sans état, sans écouteur, que le graphe et la
fiche consomment tous les deux. Vérifié en le montant des deux côtés : mot pour mot le
même rapport sur le même personnage.

### Trois cas que `defection()` ne sait pas traiter

| Cas | Pourquoi ce n'est pas `defection()` |
|---|---|
| **Couper une situation** | Elle porte sur une scène, pas une personne. En **lecture seule** — contrairement à `supprimerSituation()`, qui écrit : le but est de savoir ce que coûterait la coupe **avant** de la faire |
| **Une information jamais sue** | Effet en **cascade** : les scènes qui la requièrent n'arrivent pas, donc ce qu'elles produisaient n'est pas produit, donc les suivantes tombent aussi |
| **Une arrivée tardive** | Une absence **partielle**. On réutilise `defection()` sur une vue réduite du store — pour ce qui se joue avant son arrivée, un retardataire EST un absent |

### La cascade se propage par vagues, et l'ordre ne doit rien y changer

> **Défaut trouvé par un test, corrigé.** La propagation était une boucle « tant que ça
> bouge », qui termine et donne le bon ensemble — mais dont la **profondeur** dépendait de
> l'ordre des situations dans le tableau. Rangées en ordre de dépendance, trois étages de
> cascade tombaient en un seul tour : l'auteur aurait lu « effet direct » là où la perte
> traverse tout le scénario. On fige donc l'ensemble des informations mortes au **début**
> de chaque vague ; ce qui meurt pendant ne prend effet qu'à la suivante. Un test monte le
> même scénario dans les deux sens et exige la même profondeur.

### Le verdict ne se dit pas pareil pour un PJ et un PNJ

`pointDeVue()` répond à « ce personnage a-t-il quelque chose à vivre ? » — et le seuil est
volontairement exigeant : figurer au casting sans rien porter, rien apprendre ni rien
provoquer, c'est être décor.

Mais **le dire en rouge à un PNJ serait une erreur**, trouvée en le regardant tourner sur
le jeu d'essai : le curé de Valmorel est exactement dans ce cas, et c'est son métier. Un
PNJ est une **fonction**, pas une personne avec un arc — la même distinction que la frise
tient déjà entre une collision de PJ (une erreur) et une de PNJ (un besoin, §5e). Le
verdict rouge est donc réservé aux PJ ; le PNJ reçoit un constat neutre. Une alerte qui se
trompe une fois sur deux apprend à être ignorée là où elle compte.

### Les trous de jeu — le seul calcul vraiment neuf

Un intervalle sans aucune scène programmée, **entre** la première et la dernière : c'est là
qu'un joueur erre sans savoir quoi faire. Avant la première et après la dernière, ce n'est
pas un trou — c'est un début et une fin de GN. Une scène longue couvre celles qu'elle
englobe (on suit le maximum vu, pas la fin de la précédente), et une situation **sans
horaire** ne compte pas : elle n'est pas plaçable, et inventer un trou à partir d'une heure
qu'on n'a pas serait un faux problème (même règle qu'en §5e).

---

## 5s. Le second rang, la réserve, et la suite avec son contexte

### Deux rangs au cockpit, et c'est une correction d'audit

Le cockpit affichait ses vingt-et-un signaux d'un bloc. Mesuré sur le jeu d'essai : un
seul personnage en occupait quatre à lui seul, et les collisions de Marek trois de plus.
La page devenait **une liste qu'on parcourt** au lieu d'une réponse à « qu'est-ce que je
regarde maintenant ? ».

On montre donc d'abord la gravité `attention` (neuf cartes sur Valmorel), et on range les
observations de fond derrière une porte qui les annonce et les déplie. **Rien n'est
supprimé ni résumé** : ce qui est montré l'est en entier, avec son explication et sa
source. C'est « moins d'informations, mais plus pertinentes » — jamais « moins
d'explications ».

Le tiroir reste ouvert s'il l'a été, y compris après recalcul : écarter une alerte du
fond ne doit pas refermer le tiroir sous les doigts.

### Une carte par personne, pas par paire

> **Doublon trouvé à l'audit, corrigé.** `frise()` rend les collisions **deux à deux**, ce
> qui est le bon modèle — c'est le chevauchement qui est l'erreur. Mais trois scènes
> simultanées font trois paires, donc trois cartes au titre identique. Pour l'auteur, c'est
> **un** problème : « Marek est attendu partout à 20h30 ». Le diagnostic regroupe donc par
> personne et nomme toutes les scènes en cause. La clé de dérogation reste stable tant que
> l'ensemble des scènes ne change pas.

### La confiance moyenne porte sa réserve en toutes lettres

La promesse narrative (§4.G du document de transformation) est le premier signal
`confiance: "moyenne"` — une heuristique, pas un fait : une situation peut être
délibérément écrite comme fragile. Trois conséquences, tenues dans le code et pas
seulement dans la conception :

1. la formulation est au **conditionnel** (« semble promettre »), et un test le vérifie ;
2. le détail dit explicitement qu'une condition étroite peut être voulue ;
3. elle est rangée en `a-verifier`, et le tri met **le fait avant l'hypothèse** à gravité
   égale.

Au rendu, la carte porte un trait discontinu **et** une réserve écrite (« Observation — à
confirmer par vous »). Une nuance de couleur seule ne s'apprend pas ; une phrase se lit.

### L'accessibilité du graphe — une boucle fermée se voit enfin

`acces:boucle-fermee` répond à « cette situation peut-elle seulement être atteinte ? ». Le
raisonnement mérite d'être écrit, parce qu'il est plus étroit qu'il n'en a l'air et que
c'est ce qui le rend fiable :

- une situation **sans conclusion entrante est une racine** — jamais signalée, ce qui
  couvre les scènes d'ouverture et toutes les scènes isolées ;
- une situation avec des entrantes est atteignable dès qu'**une seule** vient d'un point
  atteignable ;
- donc, par récurrence, les seules situations inatteignables sont celles d'une **boucle
  fermée où rien n'entre depuis l'extérieur**.

Ce n'est donc pas « une scène qui semble difficile à atteindre » — formulation floue qui
aurait produit du bruit — mais un fait de structure, rare et vérifiable. Une carte par
**boucle**, jamais par situation : même leçon que les collisions de temps ci-dessus.

Le signal reste en `confiance: "moyenne"` pour **une** raison, et il faut la connaître
avant d'y toucher : beaucoup de scènes de GN n'ont pas de déclencheur écrit — un PNJ
improvise, un orga la lance à la main. Une boucle fermée peut donc être parfaitement
jouable. Le détail le dit en toutes lettres et invite à écarter ; un test vérifie que
cette phrase y est.

Six des treize tests de cette règle vérifient qu'elle **ne se déclenche pas** (racine
seule, scénario linéaire, boucle avec une entrée, conclusion sans cible, conclusion vers
une situation supprimée…). Sur un signal à confiance moyenne, ce sont les
non-déclenchements qui comptent.

### Un seul compteur dans la barre

> **Correction.** « Vérifier » portait le compte des alertes de conscience, et c'était juste
> tant qu'il était seul. Depuis le diagnostic, deux nombres se côtoyaient — 16 et 19 — sans
> que rien ne dise que le premier est un **sous-ensemble** du second. Deux chiffres qui se
> contredisent apprennent à n'en croire aucun. Le badge de mode a été retiré ; l'écran de la
> conscience affiche toujours le sien, dans son en-tête, là où il a un sens précis.

### Écrire la suite, avec le contexte sous les yeux

C'était un `prompt()` : une boîte grise qui demande un titre et ne montre rien. Or écrire
la suite d'une scène demande de se rappeler deux choses que les stores savent déjà —
**ce que les présents savent** (pour ne pas leur faire redécouvrir ce qu'ils savent) et
**les informations que la scène produit sans que rien ne les réclame** (les fils tendus,
candidats naturels à ce que la suite exigera).

`core/liaison.js` les calcule ; le panneau les montre ; l'auteur coche, ou pas. **Rien
n'est pré-rempli ni pré-coché** — c'est le geste du `@mention`, qui propose l'arête sans
jamais la poser seul (§5), transposé au moment de la suite. La touche Entrée valide, pour
que le geste rapide ne se perde pas en gagnant du contexte.

---

## 5t. L'écran de l'espace — le moteur avait tout, sauf une porte

Le moteur de synchronisation était livré et éprouvé (§5p) : les règles, la découpe en
documents, la convergence à deux pairs, dix-neuf cas de test. Mais **rien ne permettait de
s'en servir** — ni se connecter, ni rattacher un GN, ni lancer un tour. Du code juste, et
inaccessible. C'est l'écran qui manquait.

### Le rattachement est une clé d'appareil, et ce n'est pas du rangement

`espace_<projetId>`, hors des clés de projet — même forme que le registre de `sync.js`, et
pour une raison qui se dit en une phrase : **une archive qui porterait le rattachement
brancherait le GN d'un collègue sur votre espace à la première fusion**, ou le vôtre sur le
sien. Le rattachement se fait par un geste explicite, fait par quelqu'un de connecté ; il
ne se reçoit pas dans un fichier. Un test le verrouille en vérifiant que la clé n'est pas
dans `CLES_PROJET`.

`rattachementDe(Storage, projetId)` prend `Storage` **en paramètre**, comme `registreDe` :
c'est ce qui permet de l'éprouver avec un faux, sans écrire dans le `localStorage`.

### Quatre états, un seul affiché

Pas configuré · pas connecté · connecté mais non rattaché · rattaché. Montrer
« Synchroniser » à quelqu'un qui n'est pas connecté produirait une erreur qu'on pouvait
éviter en ne l'affichant pas.

### C'est ici, et nulle part ailleurs, que la promesse locale cesse

Le rattachement est le seul moment où un GN se met à parler dehors. L'écran le dit donc en
toutes lettres avant de le faire — **y compris que les libellés de casting partent aussi**,
ce qui durcit la règle de pseudonymisation (§5f) au lieu de l'assouplir. C'est exactement
la conséquence que §9 annonçait et qu'il fallait écrire quelque part.

### Les conflits se montrent, sinon la promesse est fausse

`synchroniser()` prend le distant pour converger et **rend la version locale écartée**. Si
l'écran ne l'affichait pas, « rien n'est détruit » deviendrait un mensonge : la version
serait perdue, simplement plus tard. Elle est donc rendue entière, sans troncature — c'est
la seule copie qui reste.

### Les refus se groupent par cause

> **Défaut trouvé en lançant un vrai tour**, avec un jeton périmé : la base a refusé les
> soixante-trois documents, et l'écran a affiché soixante-trois lignes identiques. La seule
> chose à savoir — « ce compte n'est pas membre » — était noyée dans sa propre répétition.
> Une cause systémique se dit **une** fois, avec le nombre ; les chemins ne sont nommés que
> lorsqu'ils sont peu nombreux, car ils désignent alors un vrai problème par document.
> Même leçon que les collisions de temps (§5s) — deux fois la même, ce qui la rend digne
> d'être écrite ici.

### L'écran ne se re-rend pas sur événement de store

Il porte des champs de saisie et un tour en cours, et c'est **lui** qui provoque les
écritures qu'on observerait. `_surChangement` l'ignore donc explicitement. En revanche, un
tour terminé recharge les stores (`onChange`) : sans ça, l'écran suivant montrerait le GN
d'avant la synchronisation.

---

## 5u. La jouabilité — ce qu'un audit a changé dans le modèle

Un audit de jouabilité mené en septembre 2026 sur un GN réel (« Le Compte n'y est pas »,
67 fiches, 431 liens, 145 situations) a posé une question que l'outil ne posait pas : **le
joueur joue-t-il une situation, ou le rôle de quelqu'un qui doit découvrir ce que l'auteur a
déjà décidé ?** Le GN était plus jouable que ce que l'outil savait en dire — aucun objectif ne
commençait par « apprendre » ou « découvrir » — et la dérive vers le récit venait du modèle
avant de venir de la plume. Cinq corrections en sont sorties, toutes petites, toutes dans les
patrons existants.

### Le lien a deux textes

`Lien.enonce`, à côté de `nature`. Même leçon que `contenu` / `enonce` sur l'information, appliquée
avec deux ans de retard : la nature est la carte de l'auteur, et `livret.js` l'imprimait telle
quelle. Reconstitué depuis l'archive, le livret de Marcel disait « Édouard Brun — Le premier des
cinq à qui l'offre est faite », une information que Marcel ignore. Le livret imprime l'énoncé,
retombe sur la nature faute de mieux, et **le signale** — une ligne par livret, pas une par
contact : 434 liens sans énoncé feraient 434 lignes, et un rapport bruyant s'apprend à s'ignorer.

### Ce qu'il a, ce qui le presse

Deux listes de phrases sur le personnage, `possede` et `pressions`, éditées comme les objectifs
et imprimées dans le livret et la consigne. L'audit avait compté vingt-quatre objets qui
faisaient tout le jeu — une valise, un registre, une liste, une enveloppe, trois armes — et pas
un n'avait de détenteur dans le modèle ; et onze échéances dispersées dans des pitches. Ce sont
des phrases, pas des objets : un modèle d'objet avec détenteur et usage viendra quand on saura
ce qu'on veut en calculer. Pour l'instant, on veut qu'elles soient dans la poche du joueur.

### L'objectif a une cible, et elle se lit

`objectifs.js` lit dans la phrase d'un objectif les personnages qu'elle nomme — nom entier,
prénom ou nom de famille unique à la même époque, mention. **C'est une heuristique**, et tout
ce qui la consomme le dit. Elle sert deux choses : `pointdevue.js` compte désormais **ce qu'il
peut demander** et **ce qu'on viendra lui demander** avant ce qu'il peut apprendre — le verdict
« a-t-il quelque chose à vivre » ne mesurait que des révélations ; et une treizième règle de
conscience, « objectif avec adversaire », signale un PJ dont **aucun** objectif ne nomme quelqu'un
qui puisse refuser. Pas chaque objectif muet : mesuré sur le GN de l'audit, l'alerte par objectif
touchait quarante-huit fiches sur soixante-sept, et un compteur pareil s'apprend à ne plus se
lire. Sa transposition explique ce que la lecture manque (« votre père », deux Édouard) pour
qu'on reformule au lieu d'écarter.

Ce qu'on va demander à un personnage **ne sort pas dans son livret** : ce sont les objectifs des
autres, donc leurs secrets. La proposition initiale de l'audit l'imprimait ; elle a été corrigée
en l'écrivant. C'est un dérivé pour l'auteur, sur la fiche.

### Quatre types de conclusion

`narration` et `interrupteur` rejoignent `normale` et `echappatoire`. Le fil de l'histoire tenait
cette distinction en prose — « tenu par narration, jamais par un pari sur un joueur » — et
l'archive contenait des branches que le fil interdisait (« Jeannot refuse », alors que la rue est
donnée avant que le jeu commence). Le type ne calcule rien encore ; il dit à l'atelier et à la
conduite ce qui est un choix et ce qui n'en est pas.

### L'interrupteur et la feuille de 2 h

`Monde.interrupteurs[]` — question, défaut, personnages touchés, phrase à dire le matin — et
`feuille.js`, pur, qui en tire le Markdown que l'orga imprime. La feuille existait, à la main,
dans le fil ; à 2 h du matin personne ne relit soixante mille signes.

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
3. **`_quitter()` est idempotent.** Il peut être appelé deux fois pour une seule sortie —
   l'import le fait avant d'écrire, puis `ouvrirReseau()` le refait. Sans marque, le second
   `Monde.flush()` réécrivait le DOM **périmé** par-dessus les données fraîchement importées :
   importer depuis l'écran du monde perdait l'archive. Trouvé en testant l'accueil.

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

## 7b. Les tests

Ouvrir **`tests.html`**. Aucun build, aucune dépendance — c'est la même règle d'installation que
l'application : on ouvre le fichier, ça marche.

Ils couvrent les modules **purs** (`couverture`, `defection`, `temps`, `besoins`, `livret`,
`affectation`, `conscience`, `archive`, `liensstore`), alimentés par des **stores factices**
(`tests/faux.js`) plutôt que par les vrais : rien n'est écrit dans le `localStorage`, chaque cas
est monté à la main, et l'exercice **prouve** que ces modules ne dépendent que d'une interface
de lecture. Si l'un d'eux se mettait à appeler un singleton, son test casserait aussitôt.
`faux.js` est accessoirement la documentation du contrat que chaque pur exige.

Le test le plus important du projet est le premier de `documents.test.js` : **une croyance
fausse ne doit jamais sortir accompagnée de la vérité**. C'est la seule régression qui ne se
rattraperait pas — elle ne casse rien à l'écran, elle gâche un GN.

`neContientPas()` compare sur le texte **dé-balisé et dés-échappé**. L'erreur avait déjà été
commise une fois à la main : chercher une chaîne contenant une apostrophe dans du HTML où
`esc()` l'a transformée en `&#39;` fait passer le test pour la mauvaise raison.

Ce qui n'est pas testé ici : le rendu. Il se vérifie dans le navigateur, et l'a été à chaque lot.

## 7c. L'accueil

Un projet entièrement vierge — ni monde, ni personnage — affiche l'ordre de fabrication en
quatre lignes et trois portes. **Pas une visite guidée** : une visite pas-à-pas se subit une
fois, s'annule, et ne revient jamais quand on en aurait besoin.

Il ne réapparaît pas par surprise : vider son casting en cours de route ne ramène pas la page
d'accueil au milieu du travail, parce que la condition regarde aussi le monde.

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

### S7 — écrire à plusieurs

**Posé :** les projets (§ 5o) · la découpe en documents et le moteur de synchronisation,
éprouvés hors ligne à deux pairs (§ 5p) · le transport et l'invitation (`remote.js`) · les
règles (`firebase.rules.json`) et leur épreuve (`epreuve.js`).

**Vérifié contre la vraie base :** quinze requêtes anonymes, quinze refus, sur un espace réel
et peuplé. Sa liste de membres elle-même est illisible sans compte.

**Pas encore vérifié :** l'épreuve membre. Tant qu'elle n'a pas confirmé qu'un membre peut
réellement écrire, on ne sait pas distinguer « les règles sont déployées » de « la base est
verrouillée par défaut » — les deux refusent tout accès anonyme.

**L'écran est écrit** (cf. §5t) : se connecter, rattacher un GN à une branche, lancer un
tour, montrer les versions écartées par un conflit, gérer les membres. Le bouton
« Vérifier la garde » y expose `garde()`, qui n'était atteignable que depuis la console.

**Reste à écrire :** la conduite en direct, qui sera ce même moteur branché sur un
`EventSource` : l'API REST de Realtime Database diffuse en `text/event-stream`, donc
toujours sans SDK.

Une conséquence à ne pas oublier au moment d'écrire ces écrans : la phrase du README qui
justifie la ligne rouge du casting — « une application locale sans serveur ni chiffrement
n'est pas un endroit pour de la donnée de santé » — devient fausse dès qu'un GN est rattaché.
Elle doit être réécrite dans le sens qui **durcit** la règle : ces libellés partent désormais
sur un serveur tiers, donc la pseudonymisation cesse d'être un confort.
