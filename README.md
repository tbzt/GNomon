# GNomon

**Atelier d'écriture pour jeu de rôle grandeur nature — le réseau de personnages, les trames
et leurs embranchements, les fiches. Et un instrument qui vous montre ce que votre scénario
ne vous montre pas.**

Application web à page unique, **locale par défaut** : aucun serveur, aucune dépendance
externe, rien qui sorte de votre navigateur. Un GN peut être rattaché à un espace partagé
pour l'écrire à plusieurs — mais c'est un geste explicite, et tant qu'il n'est pas fait,
GNomon ne parle à personne (cf. *L'espace partagé*, plus bas).

Le *gnomon* est la tige du cadran solaire : un instrument qui projette une ombre et donne
l'heure. C'est ce qu'on demande à l'outil — être un instrument, et rendre visible ce qui
n'apparaît pas autrement.

---

## Le problème

Les plateformes de GN existantes ([LarpManager](https://larpmanager.com/), Créa'GN, JoinRPG)
couvrent bien la logistique : inscriptions, paiements, listes d'attente, casting. Elles
s'arrêtent toutes à l'écriture, et elles s'arrêtent toutes à J−1.

Elles modélisent des intrigues **distribuées** — une intrigue × N personnages qui en tiennent
un fil — jamais des trames **branchées avec états et conséquences**. Et aucune ne dit à
l'auteur ce qui manque à son réseau.

GNomon ne fait donc pas d'inscriptions ni de paiements. Il fait ce que personne ne fait.

---

## Le parti pris

**La vérité racine est l'arête, pas le personnage.**

En JdR, le meneur tient la trame et les PJ la traversent. En GN, le joueur *est* la trame :
un personnage n'existe que par ses liens. Toute la littérature converge là-dessus — Kröger
(« aucun contact pertinent » est le premier symptôme d'un mauvais personnage), la méthode
eXpérience (« créer un réseau plutôt qu'une somme d'individualités »).

Conséquence : le lien est **orienté**, il porte une **tonalité** (positif · négatif · neutre ·
compliqué) et une **importance** (primaire · secondaire · confort), et la réciprocité se
dérive au lieu de se stocker. Un lien qui n'existe que dans un sens est une information, pas
une erreur.

---

## Le diagnostic — ce que vous ne voyez pas

C'est ce qu'on rencontre en ouvrant un GN qui a du contenu, et c'est le cœur de l'outil.

GNomon savait déjà beaucoup de choses : douze règles tirées de la littérature, ce que coûte
l'absence d'un joueur, qui est attendu à deux endroits à la fois, qui sait quoi. Le problème
n'était pas le calcul — **c'était l'accès**. Chacune vivait dans son écran, avec son
vocabulaire, et il fallait déjà savoir ce qu'est un « miroir désaccordé » pour aller le
chercher.

Le **diagnostic** est une couche d'interprétation, pas un moteur de plus : il ne recalcule
rien, il traduit. Une phrase par observation, groupée par ce qu'elle concerne, avec sa source
citée et un bouton vers l'endroit où l'on agit.

> **Lucie Roux n'apparaît dans aucune situation écrite.**
> Ni comme point de vue, ni comme figurante : ce personnage n'a actuellement aucune scène
> où être incarné.

Trois règles, et elles ne se négocient pas :

- **Aucun score global.** Jamais. Un GN n'est pas une note, et un chiffre unique inviterait à
  l'optimiser plutôt qu'à écrire. La gravité est qualitative et ne s'additionne pas.
- **Un fait et une hypothèse ne se lisent pas pareil.** Les observations structurelles sont
  affirmées ; celles qui reposent sur une heuristique portent leur réserve en toutes lettres
  et se formulent au conditionnel. Une alerte qui se trompe une fois sur deux apprend à être
  ignorée.
- **Le silence est une fonctionnalité.** Rien à signaler affiche une phrase, pas une grille
  vide qu'on remplirait pour se justifier d'exister.

Et rien ne bloque : une observation s'écarte **en écrivant pourquoi**, la justification reste
lisible, et l'écarter ici l'écarte partout — c'est la même décision.

**« Et si… ? »** se pose sur trois objets. Sur une **personne** (« si Elena ne vient pas » —
ou « si elle n'arrive qu'à 22 h », qui est le message qu'on reçoit vraiment) ; sur une
**situation**, en lecture seule, parce qu'on veut savoir ce que la coupe emporte *avant* de la
faire ; sur une **information**, avec la cascade — les scènes qui la réclament n'arrivent pas,
donc ce qu'elles produisaient n'est pas produit, donc les suivantes tombent aussi. C'est la
propagation qu'aucune relecture à la main ne fait.

**« Ce qu'il vit »**, sur chaque fiche, répond à la question que personne n'outille : *ce
personnage a-t-il réellement quelque chose à jouer ?* Les scènes qu'il porte, ce qu'il peut y
apprendre, ce qu'il peut provoquer — et les heures où rien n'est prévu pour lui.

---

## État

**L'épine S0 → S6 est complète.**

**S0 — la vérité racine.** Personnages, liens orientés, groupes, avec les trois invariants du
modèle tenus dans le store.

**S1 — la fiche.** Huit champs de structure (méthode eXpérience), un carnet en markdown léger,
et surtout deux choses :

- **La jauge de couverture** — neuf pastilles *calculées* depuis le réseau, jamais saisies.
  Kröger donne neuf composantes qui font un bon personnage ; les faire remplir à la main
  tuerait l'écriture. On clique une pastille grise, elle dit ce qui manque et pourquoi.
- **Le `@mention` qui propose l'arête** — écrire « j'ai vu @Marek sortir du tunnel » dans la
  fiche d'Elena propose de créer le lien. Le réseau s'entretient pendant qu'on rédige, au lieu
  d'être une saisie parallèle qu'on abandonne. La tonalité n'est jamais devinée : un « neutre »
  posé en douce désarmerait le validateur qu'il est censé nourrir.

**S2 — l'atelier de trames.** Plusieurs fils en parallèle, comme en GN, et non un arbre de
décision unique. Chaque **conclusion potentielle** d'une situation est une arête sortante ;
une conclusion **sans cible** est valide, et c'est elle qui fait avancer l'écriture — la file
« et après ? » liste les questions ouvertes, et y répondre crée la situation suivante et la
relie. Les échappatoires se lisent en pointillé.

Y répondre ne se fait plus à l'aveugle : au moment d'écrire la suite, l'outil rappelle **ce
que les personnes présentes savent déjà** — pour ne pas leur faire redécouvrir ce qu'elles
savent — et propose de rattacher les informations que la scène vient de produire sans que
rien ne les réclame encore. Il propose ; il ne coche rien à votre place.

**S3 — les informations.** L'objet qui manquait : non pas des indices qu'on découvre, mais
**l'asymétrie de connaissance** — qui sait, qui ignore, qui croit autre chose, et *quoi* à la
place. Un écran « Qui sait quoi » où une cellule se règle au clic ; et le flux inversé
d'eXpérience rendu mécanique : une situation déclare ce qu'il faut savoir pour qu'elle arrive,
et **le squelette de chaque fiche s'écrit tout seul**. Plus jamais de page blanche — il ne
reste qu'à romancer.

**S4 — la conscience.** Douze règles tirées de la littérature, chacune avec sa source, calculées
en continu — un compteur vivant, pas un bouton « vérifier ». **Aucun outil de GN
existant n'en implémente une seule.** Trois interdits, et ils viennent du corpus lui-même :
jamais bloquant ; toute alerte s'écarte **avec une justification écrite**, qui reste lisible
pour le crosschecker ; et jamais de score global — douze compteurs, jamais une moyenne.

**S5 — le temps.** Une frise, une ligne par personnage. Elle montre ce qu'aucune relecture ne
montre : qui est attendu à deux endroits à la fois. Avec une distinction qui commande tout —
une collision de **PJ** est une erreur (un joueur, un corps : il faut réécrire), une
simultanéité de **PNJ** est un **besoin de recrutement** (trois scènes en même temps, trois
comédiens). Le second chiffre ne se corrige pas dans l'atelier : il part à l'organisation.

**S6 — le casting.** Une grille de vœux, et le problème d'assignation résolu **exactement**
par l'algorithme hongrois — pas approché. Avec une ligne rouge tenue : le store **ne connaît
qu'un libellé**, l'import demande quelle colonne lire et ignore toutes les autres, et la
pseudonymisation est cochée par défaut. Une candidature de GN collecte de la donnée sensible ;
ce n'est pas ce qu'on range dans un navigateur — ni, le jour où un GN est partagé, ce qu'on
envoie sur le serveur de quelqu'un d'autre.

Puis cinq contrôles d'après-casting, dont le plus utile est le **miroir désaccordé** : deux
personnages liés en miroir dont les joueurs n'ont pas la même envie. Le miroir veut que
l'intrigue pèse autant des deux côtés — là, elle penchera.

**La conduite** — le tableau de la nuit. Les conclusions écrites à J-30 deviennent les boutons
qu'on presse à 3 h du matin ; le tableau se réordonne par ce qui a le plus besoin d'attention ;
et il dit **qui est en train de ne rien vivre** — la question que remplace « ce texte est-il
bon ? » une fois que le jeu a commencé.

**Le monde, les livrets, l'archive.** Les étapes 1 à 3 de la méthode eXpérience — prémisse,
propos, thématique, contexte commun — manquaient : l'outil était bâti sur le réseau, et un GN
a aussi une histoire générale. Elles ont maintenant leur écran, et c'est le **contexte commun**
qui ouvre chaque livret.

Le même écran porte le **fil de l'histoire** : ce qui s'est *réellement* passé, daté, en une
seule version — distinct du contexte (ce que tout le monde sait) et des livrets (ce que chacun
croit). C'est un document d'organisation, en Markdown, avec ses conventions — [FIXE],
[INTERRUPTEUR], [PROPOSITION] — et son tableau « qui sait quoi ». Il ne sort jamais dans un
livret ; il part avec l'archive, qui contient déjà tout.

Le **livret** est le seul document qui sorte de l'équipe, et il est calculé pour ça : on en
retire la fonction narrative, la transformation possible, l'importance des liens, le
contact-miroir — et surtout **la vérité derrière une croyance fausse**. Quand un personnage
croit autre chose, son livret n'écrit que ce qu'il croit. Sortir les deux livrerait l'intrigue
au joueur dans le document censé la lui cacher.

Une information a deux textes : son **contenu**, écrit pour l'équipe, et sa **formulation pour
le joueur**, la seule que le livret imprime — et il signale chaque fois qu'elle manque. Un lieu
a de même une note publique et une note d'équipe. Ces deux séparations viennent d'un GN réel où
« Ange a six semaines à vivre » et « ne pas y placer de scène avant 45 h » étaient partis dans
les livrets.

Le **background** remis est distinct du **carnet de l'auteur**, qui ne sort jamais : sans cette
séparation, un « à révéler plus tard » griffonné en écrivant partait au joueur. Le background
prend la place qu'il faut (une ligne `---` commence une nouvelle page), accepte des images, et
s'imprime en A5.

Chaque document porte aussi la **note d'intention**, les **avertissements de contenu** et les
**mécaniques de sécurité** — lignes et voiles, « coupez », le regard baissé, un·e référent·e.
Actives par défaut, reprises automatiquement : ces outils ne servent que si tout le monde les a
lus avant.

Les **PNJ** ont leur propre document, opposé au livret : la **consigne d'équipe**, calculée par
*addition*. Elle dit ce qu'il porte, où il entre, combien de comédiens il faudra — et surtout
**ce que les autres croient de faux, avec la vérité en face**. Un PNJ qui ignore la fausse
croyance d'un PJ la contredit sans le vouloir et défait l'intrigue en une phrase.

Chaque personnage a un **portrait**, et la planche de **trombinoscope** s'imprime en A4 — avec
la même règle que le livret : rien que du public. Un portrait manquant devient une silhouette
aux initiales plutôt que d'être masqué, parce qu'un trou caché ne se comble jamais.

**Le réseau se lit en trois lentilles.** La liste met les couvertures côte à côte ; le graphe
montre la forme du réseau, les groupes, et surtout **ce qui casse si quelqu'un ne vient pas** ;
le tableau est la seule des trois où l'on écrit, quand la question porte sur l'ensemble. Une
arête par paire, et le trait dit si les deux personnes sont d'accord sur ce qui les lie :
plein, tireté, pointillé.

Les **besoins** ne se saisissent pas : ils se **dérivent** du texte déjà écrit — le matériel et
la mise en scène des situations, le nombre de comédiens par PNJ, les règles à trancher, les
contraintes de casting, les documents inachevés. On y pose seulement un responsable et un état,
et l'export produit une liste à cocher prête à coller dans Trello. L'écran n'y remplace pas
votre tableau d'équipe : il l'alimente avec ce qui ne se calcule nulle part ailleurs.

Le **hub** garde des adresses, jamais leur contenu : le Drive, le tableau d'organisation, le
dossier de photos. Relier sans stocker.

**Plusieurs GN sur le même appareil.** Un projet est un préfixe de clés, rien d'autre — et
chacun a son propre stockage. Rien ne circule entre eux : pour reprendre du matériel d'un
autre, on exporte son archive et on la fusionne.

L'**archive** est un JSON unique qui porte tout le GN : c'est lui qu'on sauvegarde, qu'on
s'envoie, qu'on met dans un dépôt d'équipe. Import en *remplacer* ou en *fusionner* — le second
ajoute ce qui manque sans jamais toucher à l'existant, parce qu'on peut toujours réimporter,
mais pas ressusciter ce qui a été écrasé.

Cet écran a son propre monde visuel — noir chaud, ambre, horloge énorme, aucun angle arrondi —
et ce n'est pas une coquetterie : un bureau à J-30 et une salle de veille à 3 h du matin ne se
lisent pas de la même façon.

---

## L'espace partagé — et ce qu'il change

Écrire un GN à plusieurs, sans que personne n'écrase le travail d'un autre. La maille est
**l'objet, pas le fichier** : un document par personnage, par situation, par information. Deux
personnes qui écrivent deux personnages n'entrent jamais en conflit.

Le garde-fou est **dans la base, pas dans notre politesse** : chaque document porte une
révision, et la règle serveur exige d'en recevoir exactement la suivante. Deux personnes
parties du même point ne peuvent pas écrire l'une après l'autre — la seconde est refusée, ce
qui protège même d'un défaut de notre côté. Et quand un vrai conflit survient, la version de
l'autre est retenue pour que tout le monde converge, **mais la vôtre vous est rendue
entière** : rien n'est détruit en silence.

### Ce qu'il faut savoir avant de rattacher un GN

C'est le seul endroit d'où GNomon parle à un serveur, alors autant l'écrire noir sur blanc :

- **Tant qu'un GN n'est pas rattaché, il n'émet aucune requête.** C'est l'état par défaut, et
  il le reste pour tous les GN que vous ne rattachez pas.
- **Rattacher est un geste explicite**, fait par quelqu'un de connecté, sur un GN à la fois.
- **Une fois rattaché, le GN entier part sur le serveur** — personnages, trames, informations,
  carnets privés de l'auteur, consignes PNJ. Il n'est lisible que des membres de l'espace : la
  lecture y est aussi fermée que l'écriture, parce qu'un espace lisible de tous livrerait
  l'intrigue à qui devine le nom de la branche.
- **Les libellés de casting partent aussi.** La pseudonymisation cesse donc d'être un confort :
  c'est le moment de vérifier qu'aucun nom réel n'y figure.

Un espace ne se crée pas depuis le web — les règles l'interdisent, et c'est délibéré : personne
ne se fabrique un espace. On y est inscrit par quelqu'un qui en est déjà membre.

L'adresse de la base et la clé d'API sont en clair dans `js/core/config.js`, et ce n'est pas un
oubli : dans une application web, la configuration Firebase est un **identifiant**, pas un mot
de passe — ces valeurs partent de toute façon dans le JavaScript que le navigateur télécharge.
Ce qui protège les GN est ailleurs, et c'est vérifiable : `firebase.rules.json`, appliqué côté
serveur. L'écran de l'espace porte d'ailleurs un bouton **« Vérifier la garde »**, qui tente
une écriture qui *doit* être refusée — parce qu'une règle qu'on croit posée et qui ne l'est pas
ne se voit pas, jusqu'au jour où quelqu'un perd son après-midi.

---

## Les tests

Ouvrir **`tests.html`**. Aucun build, aucune dépendance : la même règle que l'application.
Ils couvrent les modules purs, alimentés par des stores factices — ce qui prouve au passage
qu'ils ne dépendent que d'une interface de lecture. Le premier d'entre eux vérifie qu'une
croyance fausse ne sort jamais accompagnée de la vérité.

Deux familles méritent d'être signalées. Le moteur de synchronisation est éprouvé **hors
ligne**, deux pairs contre une base factice qui applique la vraie règle de révision : c'est ce
qui permet de jouer le chemin du refus, celui qu'on ne teste jamais à la main. Et sur les
observations à confiance moyenne, ce sont les **non-déclenchements** qui sont testés en
priorité — une alerte prudente vaut surtout par les cas où elle sait se taire.

Ce qui n'est pas testé ici : le rendu. Il se vérifie dans le navigateur, et l'a été à chaque lot.

## Lancer en local

Les modules ES imposent un vrai serveur HTTP — le `file://` ne les charge pas.

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`. Le bouton **Jeu d'essai** charge « Les Cendres de
Valmorel », sept personnages construits pour porter de vrais défauts d'écriture — ceux que le
diagnostic doit trouver. Ne les réparez pas : ils sont le sujet.

---

## Sources du modèle

- Laura Kröger, *Plot and Character Design*, Knudepunkt 2019
- Baptiste Cazes & Vincent Choupaut, *Écrire un scénario de GN : la méthode eXpérience*
- Electro-GN, *Trames et enjeux en GN* · *Les quêtes* · *Approches de la conception d'un scénario*
- Jason Morningstar, *Designing Fault-Tolerant Larps*
- Koljonen, Stenros & al. (dir.), *Larp Design: Creating Role-Play Experiences*, 2019

---

## Licence

MIT. Outil de fan, sans but lucratif. Tout est stocké localement dans le navigateur, et rien
n'en sort tant qu'un GN n'a pas été explicitement rattaché à un espace partagé.
