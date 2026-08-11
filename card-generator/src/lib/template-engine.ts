/**
 * Types et moteur de rendu des templates de cards.
 *
 * Générique : ce fichier ne connaît aucun template en particulier et ne
 * change jamais quand on en ajoute un. Les templates eux-mêmes vivent dans
 * `src/templates/<nom>/`, le catalogue dans `template-registry.ts`.
 *
 * Un CardTemplate est une simple valeur (fields + html + css) : aucune
 * fonction, aucun code exécutable. C'est ce qui permet au catalogue d'être
 * demain servi par une source externe (fichier JSON, API) au lieu d'imports
 * statiques — même forme, il suffira de remplacer l'un par l'autre.
 */

export type FieldType = "text" | "textarea" | "url" | "segmented";

export interface TemplateField {
  /** Clé utilisée dans les valeurs saisies et dans les placeholders {{id}}. */
  id: string;
  label: string;
  type: FieldType;
  default: string;
  placeholder?: string;
  /** Uniquement pour type "segmented". */
  options?: Array<{ value: string; label: string }>;
  /**
   * Uniquement pour type "segmented" : jeu de valeurs dérivées par option
   * (couleurs, etc.), exposées dans le template comme {{id.clé}}.
   * Ex. { light: { bg: "#E7EAEC" }, dark: { bg: "#0F1F2E" } }
   */
  tokens?: Record<string, Record<string, string>>;
  /**
   * Uniquement pour type "url" : valeur utilisée quand le champ est vide ou
   * invalide. "#" par défaut (lien cliquable mais inerte). Mettre "" pour
   * qu'un bloc {{#if id}}…{{/if}} masque l'élément associé (ex. une photo
   * facultative) plutôt que de pointer vers un lien cassé.
   */
  urlFallback?: string;
}

export interface BuiltCard {
  /** Markup de la card, classes déjà préfixées. */
  html: string;
  /** CSS scopé sur la classe racine (sans la balise <style>). */
  css: string;
}

export interface CardTemplate {
  id: string;
  label: string;
  fields: TemplateField[];
  /**
   * Gabarit HTML avec placeholders {{champId}}, {{champId.token}}, {{cls}}
   * et blocs conditionnels {{#if champId}}…{{/if}}.
   * Importé depuis un fichier .html dédié (voir src/templates/<nom>/).
   */
  html: string;
  /** Gabarit CSS, mêmes placeholders. Importé depuis un fichier .css dédié. */
  css: string;
}

/* ------------------------------------------------------------------ */
/* Helpers d'échappement — le code généré finit dans un Rich Text CMS, */
/* les valeurs client ne doivent jamais casser le markup.             */
/* ------------------------------------------------------------------ */

export function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

/** Neutralise les URLs à schéma exotique (javascript:, data:, …). */
export function safeUrl(url: string, fallback = "#"): string {
  const raw = String(url ?? "").trim();
  if (!raw) return fallback;
  if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(raw)) return escapeAttr(raw);
  // Pas de schéma reconnu : on suppose une URL externe sans protocole.
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) return escapeAttr("https://" + raw);
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

function buildContext(
  tpl: CardTemplate,
  values: Record<string, string>,
  cls: string
): Record<string, string> {
  const ctx: Record<string, string> = { cls };

  for (const field of tpl.fields) {
    const raw = values[field.id] ?? "";

    if (field.type === "url") {
      const fallback = field.urlFallback ?? "#";
      ctx[field.id] = raw ? safeUrl(raw, fallback) : fallback;
    } else {
      ctx[field.id] = escapeAttr(raw);
    }

    if (field.type === "segmented" && field.tokens) {
      const chosen = field.tokens[raw] ?? field.tokens[field.default] ?? {};
      for (const [key, value] of Object.entries(chosen)) {
        ctx[`${field.id}.${key}`] = escapeAttr(value);
      }
    }
  }

  return ctx;
}

/** {{#if champId}}…{{/if}} : rendu seulement si le champ résout à une valeur non vide. */
function applyConditionals(str: string, ctx: Record<string, string>): string {
  return str.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key: string, inner: string) => (ctx[key] ? inner : "")
  );
}

/** {{champId}}, {{champId.token}}, {{cls}} : substitution directe. */
function applyPlaceholders(str: string, ctx: Record<string, string>): string {
  return str.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => ctx[key] ?? "");
}

export function renderTemplate(
  tpl: CardTemplate,
  values: Record<string, string>,
  cls: string
): BuiltCard {
  const ctx = buildContext(tpl, values, cls);
  const render = (str: string) =>
    applyPlaceholders(applyConditionals(str, ctx), ctx).trim();
  return { html: render(tpl.html), css: render(tpl.css) };
}
