"use strict";

/* ============================================================
   PROJETS — plusieurs GN sur le même appareil.
   ------------------------------------------------------------
   ── LE MANQUE ──
   Les clés du `localStorage` étaient nues : `gnomon_v1_reseau`, une
   fois, pour toujours. Il n'y avait donc qu'**un** GN par navigateur.
   Une équipe qui prépare l'édition suivante pendant que la précédente
   n'est pas encore archivée devait exporter, vider, réimporter à chaque
   bascule — un aller-retour de plusieurs mégaoctets, à faire de tête, et
   dont chaque oubli coûte un GN.

   ── UN PROJET EST UN PRÉFIXE ──
   Rien d'autre. `Storage` range les clés d'un GN sous
   `gnomon_v1_<projet>__<clé>` ; ce module tient la liste et dit laquelle
   est ouverte. Pas de table, pas de jointure, pas de migration à chaque
   clé nouvelle : basculer de projet, c'est déplacer une fenêtre de
   lecture.

   Corollaire tenu par `Storage` : les clés d'**appareil** — le thème, la
   version de schéma, cette liste elle-même, la session distante — ne
   sont pas préfixées. Elles n'appartiennent à aucun GN, et recevoir
   l'archive d'un collègue ne doit pas retourner l'écran de qui la reçoit.

   ── C'EST AUSSI CE QU'UN ESPACE PARTAGÉ DÉSIGNE ──
   Sans identité de projet, rien n'aurait su dire **de quel GN** une
   branche distante porte le contenu. Le projet local est donc l'objet
   que l'espace synchronise, et c'est pour ça qu'il vient d'abord.

   ── SUPPRIMER N'EST PAS OUBLIER ──
   Retirer un projet efface ses clés. Il n'y a pas d'annulation, et il ne
   peut pas y en avoir : l'espace libéré est précisément ce qu'on venait
   chercher. L'appelant doit donc proposer l'export **avant**, jamais
   après — c'est la seule protection possible, et elle est humaine.

   Feuille : ne dépend que de `Storage` et `Debug`.
   ============================================================ */
import { Storage, CLES_PROJET } from "./storage.js";
import { Debug } from "./debug.js";

export const Projets = {
  /* ================= La liste ================= */

  /** `[{ id, nom, cree, ouvert }]`, du plus récemment ouvert au plus
      ancien — c'est l'ordre dans lequel on les cherche. */
  liste() {
    const brut = Storage.get("projets", null);
    const l = Array.isArray(brut) ? brut.filter((p) => p && p.id) : [];
    return [...l].sort((a, b) => (b.ouvert || 0) - (a.ouvert || 0));
  },

  projet(id) {
    return this.liste().find((p) => p.id === id) || null;
  },

  /** Le projet OUVERT. Une fois `init()` passé, c'est `Storage` qui fait
      foi, pas la clé persistée : celle-ci peut disparaître sous nos pieds
      — un autre onglet qui vide le site, un nettoyage de navigateur —
      sans que le GN chargé en mémoire cesse d'être celui-là. Lire la clé
      renverrait alors `null`, et l'écran nommerait « Sans titre » un GN
      parfaitement ouvert tout en continuant d'écrire dedans. Même
      famille que la garde `_recadrer()` de l'atelier : une sélection ne
      survit pas au vidage de son index, et il faut le voir. */
  actif() {
    return Storage.projet() || Storage.get("projet_actif", null);
  },

  projetActif() {
    return this.projet(this.actif());
  },

  _ecrire(liste) {
    Storage.set("projets", liste);
  },

  _uid() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  },

  /* ================= Démarrage ================= */

  /**
   * À appeler **avant** tout `load()` de store, et après les migrations.
   * Garantit qu'un projet existe et qu'il est ouvert, puis pose la
   * fenêtre de lecture de `Storage`.
   *
   * Un projet vide est créé si la liste l'est : c'est le cas du tout
   * premier lancement. Il ne porte pas de nom — l'accueil demande par où
   * commencer, et nommer le GN à sa place serait répondre pour lui.
   */
  init() {
    let liste = this.liste();
    if (!liste.length) {
      const p = {
        id: this._uid(),
        nom: "",
        cree: Date.now(),
        ouvert: Date.now(),
      };
      liste = [p];
      this._ecrire(liste);
      Storage.set("projet_actif", p.id);
    }
    // L'identifiant retenu peut désigner un projet supprimé depuis un
    // autre onglet : on retombe sur le plus récent plutôt que d'ouvrir
    // un GN vide sans rien dire.
    // Ici, et ici seulement, on lit la clé PERSISTÉE : `actif()` répond
    // désormais d'après `Storage`, qui n'a encore rien reçu.
    let id = Storage.get("projet_actif", null);
    if (!liste.some((p) => p.id === id)) {
      id = liste[0].id;
      Storage.set("projet_actif", id);
    }
    Storage.poserProjet(id);
    Debug.log("storage", "projet ouvert", { id });
    return id;
  },

  /* ================= Mutations ================= */

  creer(nom = "") {
    const p = { id: this._uid(), nom: String(nom).trim(), cree: Date.now(), ouvert: Date.now() };
    this._ecrire([...this.liste(), p]);
    return p;
  },

  renommer(id, nom) {
    const liste = this.liste();
    const p = liste.find((x) => x.id === id);
    if (!p) return null;
    p.nom = String(nom).trim();
    this._ecrire(liste);
    return p;
  },

  /** Ouvre un projet. Renvoie `false` s'il n'existe pas — l'appelant
      doit alors ne rien recharger plutôt que de vider les écrans. */
  ouvrir(id) {
    const liste = this.liste();
    const p = liste.find((x) => x.id === id);
    if (!p) return false;
    p.ouvert = Date.now();
    this._ecrire(liste);
    Storage.set("projet_actif", id);
    Storage.poserProjet(id);
    return true;
  },

  /** Efface un projet et toutes ses clés. Sans annulation possible :
      c'est la place libérée qu'on venait chercher. Renvoie l'identifiant
      du projet désormais actif. */
  supprimer(id) {
    const restants = this.liste().filter((p) => p.id !== id);
    // On retire les clés à la main plutôt que par `Storage.clearAll()` :
    // celui-ci opère sur le projet ACTIF, qui n'est pas forcément celui
    // qu'on supprime.
    for (const c of CLES_PROJET) localStorage.removeItem(`gnomon_v1_${id}__${c}`);
    this._ecrire(restants);
    if (this.actif() !== id) return this.actif();
    // On a supprimé celui qui était ouvert : il en faut un autre, et
    // `init()` en recrée un si la liste est vide.
    Storage.set("projet_actif", restants.length ? restants[0].id : null);
    return this.init();
  },

  /* ================= Ce qu'un projet pèse ================= */

  /** Le poids d'un projet, pour que la liste dise lequel occupe la
      place — c'est la question qu'on se pose au moment d'en supprimer un. */
  octets(id) {
    let n = 0;
    for (const c of CLES_PROJET)
      n += (localStorage.getItem(`gnomon_v1_${id}__${c}`) || "").length;
    return n;
  },

  /** De quoi nommer un projet sans nom : ce qu'il contient. L'appelant
      affiche « Sans titre » plus ce résumé, plutôt qu'une ligne muette. */
  resume(id) {
    const lire = (cle) => {
      try {
        return JSON.parse(localStorage.getItem(`gnomon_v1_${id}__${cle}`)) || null;
      } catch {
        return null;
      }
    };
    const reseau = lire("reseau");
    const trames = lire("trames");
    const n = (v, k) => (Array.isArray(v?.[k]) ? v[k].length : 0);
    return {
      personnages: n(reseau, "personnages"),
      situations: n(trames, "situations"),
      titre: (lire("monde") || {}).titre || "",
    };
  },
};
