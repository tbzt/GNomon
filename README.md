# GNomon

**Atelier d'écriture pour jeu de rôle grandeur nature — le réseau de personnages, les trames et leurs embranchements, les fiches.**

Application web à page unique, **100 % locale** : aucun serveur, aucune dépendance externe,
aucune donnée transmise. Tout tourne dans le navigateur et se range dans son `localStorage`.

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

**S3 — les informations.** L'objet qui manquait : non pas des indices qu'on découvre, mais
**l'asymétrie de connaissance** — qui sait, qui ignore, qui croit autre chose, et *quoi* à la
place. Un écran « Qui sait quoi » où une cellule se règle au clic ; et le flux inversé
d'eXpérience rendu mécanique : une situation déclare ce qu'il faut savoir pour qu'elle arrive,
et **le squelette de chaque fiche s'écrit tout seul**. Plus jamais de page blanche — il ne
reste qu'à romancer.

**S4 — la conscience.** Douze règles tirées de la littérature, chacune avec sa source, calculées
en continu — un compteur vivant dans la barre, pas un bouton « vérifier ». **Aucun outil de GN
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
pseudonymisation est cochée par défaut. Une application locale sans serveur ni chiffrement
n'est pas un endroit pour de la donnée de santé.

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

Le **livret** est le seul document qui sorte de l'équipe, et il est calculé pour ça : on en
retire la fonction narrative, la transformation possible, l'importance des liens, le
contact-miroir — et surtout **la vérité derrière une croyance fausse**. Quand un personnage
croit autre chose, son livret n'écrit que ce qu'il croit. Sortir les deux livrerait l'intrigue
au joueur dans le document censé la lui cacher.

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

L'**archive** est un JSON unique qui porte tout le GN : c'est lui qu'on sauvegarde, qu'on
s'envoie, qu'on met dans un dépôt d'équipe. Import en *remplacer* ou en *fusionner* — le second
ajoute ce qui manque sans jamais toucher à l'existant, parce qu'on peut toujours réimporter,
mais pas ressusciter ce qui a été écrasé.

Cet écran a son propre monde visuel — noir chaud, ambre, horloge énorme, aucun angle arrondi —
et ce n'est pas une coquetterie : un bureau à J-30 et une salle de veille à 3 h du matin ne se
lisent pas de la même façon.

---

## Lancer en local

Les modules ES imposent un vrai serveur HTTP — le `file://` ne les charge pas.

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`. Le bouton **Jeu d'essai** charge « Les Cendres de
Valmorel », sept personnages construits pour porter de vrais défauts d'écriture.

---

## Sources du modèle

- Laura Kröger, *Plot and Character Design*, Knudepunkt 2019
- Baptiste Cazes & Vincent Choupaut, *Écrire un scénario de GN : la méthode eXpérience*
- Electro-GN, *Trames et enjeux en GN* · *Les quêtes* · *Approches de la conception d'un scénario*
- Jason Morningstar, *Designing Fault-Tolerant Larps*
- Koljonen, Stenros & al. (dir.), *Larp Design: Creating Role-Play Experiences*, 2019

---

## Licence

MIT. Outil de fan, sans but lucratif. Aucune donnée n'est transmise — tout est stocké
localement dans le navigateur.
