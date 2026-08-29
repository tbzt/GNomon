"use strict";

/* ============================================================
   La lentille TABLEAU — sa sélection de lignes et de colonnes.

   C'est un widget, pas un module pur : il tient un état et il écrit
   dans le DOM. Mais **ce qu'il montre** — quelles colonnes, quelles
   lignes, dans quel ordre — est du calcul, et c'est ce calcul qui se
   teste. On lui donne un store factice et on lit ce qu'il choisit,
   sans jamais construire une page.

   L'intérêt n'est pas académique : un filtre qui masque en silence la
   ligne qu'on vient de créer, ou un tri qui remonte les cases vides
   au-dessus de ce qui est écrit, rend la vue inutilisable sans jamais
   lever d'erreur.
   ============================================================ */
import { suite, test, eq, ok, pasOk } from "./harnais.js";
import { fauxReseau } from "./faux.js";
import { Tableau } from "../js/widgets/tableau.js";

const CAS = () =>
  fauxReseau({
    groupes: [
      { id: "g1", nom: "La commune" },
      { id: "g2", nom: "Le dispensaire" },
    ],
    personnages: [
      { id: "b", nom: "Bernard", role: "Le maire", groupeId: "g1", moral: "L'ordre" },
      { id: "a", nom: "Ana", role: "", groupeId: "g2", moral: "" },
      { id: "z", nom: "Zoe", role: "La veuve", groupeId: "g1", moral: "Le pardon" },
      { id: "c", nom: "Corvin", role: "Le cure", pj: false, groupeId: null, background: "Il sait." },
    ],
    liens: [
      { id: "l1", de: "b", vers: "z", importance: "primaire", miroir: true },
      { id: "l2", de: "z", vers: "b", importance: "primaire" },
    ],
  });

/** Le tableau est un singleton : chaque cas repart d'un état neuf,
    sinon un filtre laissé par le test précédent fausse le suivant. */
function poser(patch = {}) {
  Object.assign(Tableau, {
    _store: CAS(),
    _hote: null,
    _jeu: "identite",
    _tri: null,
    _q: "",
    _fGroupe: "",
    _fRole: "",
    _fIncomplets: false,
    ...patch,
  });
  return Tableau;
}

const noms = (t) => t._lignes().map((p) => p.nom);
const cles = (t) => t._colonnes().map((c) => c.cle);

suite("Tableau — les colonnes", () => {
  test("le nom est present dans TOUS les jeux : c'est la colonne figee", () => {
    for (const j of ["identite", "ressort", "etat", "tout"]) {
      const t = poser({ _jeu: j });
      eq(cles(t)[0], "nom", `le jeu « ${j} » doit commencer par le nom`);
    }
  });

  test("« Tout » contient toutes les colonnes declarees, sans doublon", () => {
    const c = cles(poser({ _jeu: "tout" }));
    eq(c.length, new Set(c).size, "aucune colonne ne doit apparaitre deux fois");
    ok(c.includes("moral") && c.includes("_couv") && c.includes("archetype"));
  });

  test("« Etat » ajoute role et PJ pour qu'une ligne reste identifiable", () => {
    const c = cles(poser({ _jeu: "etat" }));
    ok(c.includes("role") && c.includes("pj"));
    ok(c.indexOf("role") < c.indexOf("_couv"), "et ils restent devant les derivees");
  });

  test("les colonnes derivees sont marquees, donc non saisissables", () => {
    const cols = poser({ _jeu: "etat" })._colonnes();
    for (const c of cols.filter((x) => x.cle.startsWith("_")))
      ok(c.d, `« ${c.cle} » doit etre declaree derivee`);
  });
});

suite("Tableau — les filtres", () => {
  test("sans filtre, l'ordre est celui de l'ecriture", () => {
    eq(noms(poser()).join(","), "Bernard,Ana,Zoe,Corvin");
  });

  test("PJ / PNJ", () => {
    eq(noms(poser({ _fRole: "pnj" })).join(","), "Corvin");
    eq(noms(poser({ _fRole: "pj" })).length, 3);
  });

  test("groupe, et « sans groupe » qui n'est pas un groupe", () => {
    eq(noms(poser({ _fGroupe: "g1" })).join(","), "Bernard,Zoe");
    eq(noms(poser({ _fGroupe: "_sans" })).join(","), "Corvin");
  });

  test("la recherche porte sur tous les champs, pas seulement le nom", () => {
    eq(noms(poser({ _q: "veuve" })).join(","), "Zoe", "trouve par le role");
    eq(noms(poser({ _q: "pardon" })).join(","), "Zoe", "trouve par la morale");
    eq(noms(poser({ _q: "il sait" })).join(","), "Corvin", "trouve par le background");
  });

  test("la recherche ignore accents et casse", () => {
    eq(noms(poser({ _q: "CURÉ" })).join(","), "Corvin");
  });

  test("les filtres se combinent", () => {
    eq(noms(poser({ _fGroupe: "g1", _q: "veuve" })).join(","), "Zoe");
    eq(noms(poser({ _fGroupe: "g2", _fRole: "pnj" })).length, 0);
  });
});

suite("Tableau — le tri", () => {
  test("croissant, avec les regles de l'alphabet francais", () => {
    eq(noms(poser({ _tri: { cle: "nom", sens: 1 } })).join(","), "Ana,Bernard,Corvin,Zoe");
  });

  test("decroissant", () => {
    eq(noms(poser({ _tri: { cle: "nom", sens: -1 } })).join(","), "Zoe,Corvin,Bernard,Ana");
  });

  test("les cases VIDES tombent en bas dans les DEUX sens", () => {
    // Trier sert a trouver ce qui est ecrit. Remonter les vides en tete
    // du tri decroissant donnerait une premiere page de rien.
    const asc = noms(poser({ _tri: { cle: "role", sens: 1 } }));
    const desc = noms(poser({ _tri: { cle: "role", sens: -1 } }));
    eq(asc[asc.length - 1], "Ana", "Ana n'a pas de role : elle finit derniere");
    eq(desc[desc.length - 1], "Ana", "et elle y reste dans l'autre sens");
  });

  test("on trie aussi sur une colonne derivee", () => {
    const t = poser({ _tri: { cle: "_contacts", sens: -1 } });
    eq(noms(t)[0], "Bernard", "Bernard et Zoe ont un lien sortant, pas les autres");
  });

  test("trier ne reordonne pas les donnees elles-memes", () => {
    const t = poser({ _tri: { cle: "nom", sens: 1 } });
    const avant = t._store.personnages().map((p) => p.id).join(",");
    t._lignes();
    eq(t._store.personnages().map((p) => p.id).join(","), avant, "le store doit etre intact");
  });
});

suite("Tableau — la signature qui protege le curseur", () => {
  test("ecrire dans un champ ne change PAS la signature", () => {
    const t = poser();
    const cols = t._colonnes();
    const avant = t._signature(t._lignes(), cols);
    t._store.personnage("a").role = "La doctoresse";
    eq(t._signature(t._lignes(), cols), avant, "sinon la grille se reconstruit sous les doigts");
  });

  test("mais un changement de tri, de colonnes ou de lignes, si", () => {
    const t = poser();
    const cols = t._colonnes();
    const avant = t._signature(t._lignes(), cols);
    t._tri = { cle: "nom", sens: 1 };
    pasOk(t._signature(t._lignes(), cols) === avant, "un tri doit provoquer un rendu complet");

    const u = poser();
    const base = u._signature(u._lignes(), u._colonnes());
    u._jeu = "tout";
    pasOk(u._signature(u._lignes(), u._colonnes()) === base);

    const v = poser({ _fRole: "pnj" });
    pasOk(
      v._signature(v._lignes(), v._colonnes()) === base,
      "moins de lignes, donc autre signature",
    );
  });
});
