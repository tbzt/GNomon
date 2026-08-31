"use strict";

/* ============================================================
   CONFIG — les deux valeurs qui branchent l'espace partagé.
   ------------------------------------------------------------
   **Elles sont en clair dans le dépôt, et c'est la manière normale.**
   Un seul déploiement, la page GitHub, donc rien à remplacer nulle
   part : ce fichier est le seul endroit à remplir, une fois.

   ── CE NE SONT PAS DES SECRETS ──
   Une fois remplies, ces valeurs partent dans le JavaScript que le
   navigateur télécharge et s'affichent dans son onglet Réseau. Dans une
   application web, la configuration Firebase est un **identifiant**,
   pas un mot de passe. Un site statique public n'a d'ailleurs aucune
   cachette : tout ce qui doit être lu à l'exécution finit dans les
   fichiers déployés. Les masquer serait un théâtre coûteux, qui
   laisserait croire à une protection inexistante.

   Ce qui protège les données est ailleurs, et c'est vérifiable :
   `firebase.rules.json`, appliqué **côté serveur**, n'accorde ni
   lecture ni écriture à qui n'est pas inscrit dans les membres de
   l'espace. Un inconnu qui récupère ces deux valeurs peut se créer un
   compte ; il ne peut ouvrir aucun GN. C'est la seule barrière qui
   compte, et elle ne dépend pas de l'endroit d'où le fichier est servi.

   ── L'APPLICATION RESTE LOCALE PAR DÉFAUT ──
   Remplir ce fichier ne branche rien tout seul. Un GN ne parle à la
   base que s'il est **rattaché** à un espace, et le rattachement est un
   geste explicite, fait par quelqu'un de connecté. Un projet non
   rattaché n'émet aucune requête — la promesse « 100 % local » du
   README reste donc vraie pour qui ne demande rien, et c'est tenu par
   construction, pas par discipline.
   ============================================================ */

/** L'URL de la Realtime Database. La barre oblique finale est retirée :
    sans ça, chaque chemin construit deviendrait `…app//espaces/…`, que
    Realtime Database lit comme un enfant de nom vide. */
export const DB = "https://gnomon-cace2-default-rtdb.europe-west1.firebasedatabase.app".replace(/\/+$/, "");

/** La clé d'API web du projet Firebase. Identifiant public — voir
    l'en-tête : ce qui protège les données, ce sont les règles. */
export const API_KEY = "AIzaSyBc1c-M860VO3O0dW5ISmm0khOgTevscV0";
