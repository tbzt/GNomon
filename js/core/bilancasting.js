"use strict";

/* ============================================================
   BILAN DE CASTING — ce que l'affectation a coûté, et à qui.
   ------------------------------------------------------------
   ── UNE CORRECTION À LA VISION, ET ELLE EST IMPORTANTE ──
   Le plan disait « on relance les douze validateurs après casting ».
   À l'écrire, c'est faux : **les douze règles portent sur le matériau
   écrit**, et le matériau ne change pas quand on distribue les rôles.
   Les relancer rendrait exactement les mêmes seize alertes, et donnerait
   l'illusion d'une vérification.

   Ce qui change au casting, ce sont des faits de **joueurs** — et ils
   demandent leurs propres contrôles. C'est ce module.

   L'intuition de départ reste juste, et c'est celle de Kröger, mesurée
   sur 260 joueurs : dix personnages mal notés à un run ont tous été
   adorés à un autre. **La qualité d'un personnage est relationnelle.**
   Simplement, elle se vérifie ici, pas là-bas.

   Cinq contrôles :
     1. les vœux exaucés — la distribution des rangs obtenus ;
     2. le veto imposé — quelqu'un a reçu ce qu'il refusait ;
     3. hors disponibilité — des scènes tombent quand il n'est pas là ;
     4. le déséquilibre — rôles non pourvus, candidats non castés ;
     5. **le miroir désaccordé** — deux personnages liés en miroir dont
        les joueurs n'ont pas la même envie. C'est le contrôle le plus
        proche de Kröger : le miroir veut que l'intrigue « pèse autant
        des deux côtés », et un joueur enthousiaste face à un joueur
        indifférent la fait pencher, quoi qu'en dise le texte.

   Module **pur**.
   ============================================================ */
import { COUTS, hongrois } from "./affectation.js";

/** Le coût d'un appariement. Sépare ce qui vient du vœu de ce qui
    vient de la disponibilité, pour que le bilan puisse dire lequel des
    deux a coûté. */
export function coutDe(casting, reseau, trames, candidature, personnage) {
  const etat = casting.etatVoeu(candidature.id, personnage.id);
  const voeu =
    etat === "veto"
      ? COUTS.veto
      : etat === 3
        ? COUTS.adore
        : etat === 2
          ? COUTS.bien
          : etat === 1
            ? COUTS.accepte
            : COUTS.indifferent;

  const horsFenetre = scenesHorsFenetre(trames, candidature, personnage);
  return { total: voeu + horsFenetre.length * COUTS.indisponible, voeu, horsFenetre };
}

/** Les scènes du personnage qui tombent hors de la présence du joueur. */
export function scenesHorsFenetre(trames, candidature, personnage) {
  if (candidature.arrivee == null && candidature.depart == null) return [];
  return trames.situations().filter((s) => {
    if (!(s.castIds || []).includes(personnage.id)) return false;
    if (s.debut == null || s.fin == null) return false;
    if (candidature.arrivee != null && s.debut < candidature.arrivee) return true;
    if (candidature.depart != null && s.fin > candidature.depart) return true;
    return false;
  });
}

/** Calcule l'affectation optimale. Renvoie la carte
    `candidatureId → personnageId`, sans l'écrire. */
export function caster(casting, reseau, trames) {
  const candidats = casting.candidatures();
  const roles = reseau.pj();
  if (!candidats.length || !roles.length) return {};

  const couts = candidats.map((c) =>
    roles.map((p) => coutDe(casting, reseau, trames, c, p).total),
  );
  const { affectation } = hongrois(couts);

  const map = {};
  affectation.forEach((j, i) => {
    if (j >= 0) map[candidats[i].id] = roles[j].id;
  });
  return map;
}

export function bilan(casting, reseau, trames) {
  const candidats = casting.candidatures();
  const roles = reseau.pj();
  const aff = casting.affectation();

  const rangs = { 3: [], 2: [], 1: [], 0: [], veto: [] };
  const horsDispo = [];

  for (const c of candidats) {
    const pid = aff[c.id];
    if (!pid) continue;
    const p = reseau.personnage(pid);
    if (!p) continue;
    const etat = casting.etatVoeu(c.id, pid);
    rangs[etat === "veto" ? "veto" : etat].push({ candidature: c, personnage: p });

    const hors = scenesHorsFenetre(trames, c, p);
    if (hors.length) horsDispo.push({ candidature: c, personnage: p, scenes: hors });
  }

  const castes = new Set(Object.keys(aff));
  const pris = new Set(Object.values(aff));
  const sansRole = candidats.filter((c) => !castes.has(c.id));
  const sansJoueur = roles.filter((p) => !pris.has(p.id));

  /* ---- Miroir désaccordé ---- */
  const desaccords = [];
  const valeur = (etat) => (etat === "veto" ? -1 : Number(etat) || 0);
  // Un miroir déclaré des DEUX côtés porte le drapeau sur ses deux
  // liens : sans ce garde, le même désaccord se compterait deux fois.
  // Le défaut existait depuis le début et ne se voyait pas — aucun
  // écran ne permettait encore de poser un miroir.
  const vus = new Set();
  for (const l of reseau.liens()) {
    if (!l.miroir) continue;
    const paire = [l.de, l.vers].sort().join("|");
    if (vus.has(paire)) continue;
    vus.add(paire);
    const ka = casting.titulaireDe(l.de);
    const kb = casting.titulaireDe(l.vers);
    if (!ka || !kb) continue;
    const va = valeur(casting.etatVoeu(ka, l.de));
    const vb = valeur(casting.etatVoeu(kb, l.vers));
    if (Math.abs(va - vb) < 2) continue;
    const [haut, bas] = va > vb ? [ka, kb] : [kb, ka];
    const [pHaut, pBas] = va > vb ? [l.de, l.vers] : [l.vers, l.de];
    desaccords.push({
      enthousiaste: { candidature: casting.candidature(haut), personnage: reseau.personnage(pHaut) },
      tiede: { candidature: casting.candidature(bas), personnage: reseau.personnage(pBas) },
      ecart: Math.abs(va - vb),
    });
  }

  return {
    rangs,
    horsDispo,
    sansRole,
    sansJoueur,
    desaccords,
    castes: castes.size,
    total: candidats.length,
    roles: roles.length,
  };
}
