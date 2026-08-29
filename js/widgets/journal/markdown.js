"use strict";

/* ============================================================
   MARKDOWN EN LIGNE — mise en forme légère des notes/journal.
   Opère sur du texte DÉJÀ ÉCHAPPÉ (Mentions.renderText l'applique aux
   segments de texte simple, jamais aux puces @/#) : n'émet que des balises
   sûres (<strong>/<em>/<code>), aucun href, aucun état, pas de DOM.
   Volontairement restreint (décision B du plan) : pas de titres `#`
   (collision #tag), pas de liens `[]()` (collision @[nom](id) + XSS href).
   ============================================================ */
export const Markdown = {
  /** Applique gras/italique/code à une ligne de texte échappé. Les regex
      sont bornées à `[^\n]` : jamais de mise en forme traversant une ligne. */
  inline(escaped) {
    if (!escaped) return escaped;
    return escaped
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^\n_]+)_/g, "<em>$1</em>");
  },
};
