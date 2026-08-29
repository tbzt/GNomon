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

**Lots S0, S1 et S2 livrés.**

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

À venir : les informations (qui sait quoi, qui croit autre chose), la conscience (douze
validateurs tirés de la littérature), le temps, le casting.

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
