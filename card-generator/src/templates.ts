/**
 * Configuration des templates de cards.
 *
 * Un CardTemplate est une simple valeur (fields + html + css) : aucune
 * fonction, aucun code exécutable. C'est ce qui permet à `TEMPLATES` d'être
 * demain servi par une source externe (fichier JSON, API) au lieu d'un
 * import statique — même forme, il suffira de remplacer l'un par l'autre.
 * Voir `renderTemplate()` plus bas pour le moteur qui interprète cette
 * donnée ; il ne change jamais quand on ajoute un template.
 *
 * Pour ajouter un template : créer un objet CardTemplate et l'ajouter au
 * tableau `TEMPLATES` (puis, si besoin, le référencer dans
 * `templatesBySite`).
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
   */
  html: string;
  /** Gabarit CSS, mêmes placeholders. */
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
/* Moteur de rendu — interprète un CardTemplate + des valeurs saisies.  */
/* Générique : ne connaît aucun template en particulier.               */
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
  const render = (str: string) => applyPlaceholders(applyConditionals(str, ctx), ctx);
  return { html: render(tpl.html), css: render(tpl.css) };
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const FONT_STACK =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';

const quoteCard: CardTemplate = {
  id: "quote",
  label: "Citation",
  fields: [
    {
      id: "text",
      label: "Citation",
      type: "textarea",
      default:
        "En 6 mois, nous avons consolidé les cartographies de risques de 12 entités sur un même référentiel.",
    },
    { id: "name", label: "Nom de l'auteur", type: "text", default: "Jonathan" },
    { id: "role", label: "Rôle", type: "text", default: "Auteur de l'article" },
    {
      id: "photo",
      label: "Photo (URL)",
      type: "url",
      default: "",
      placeholder: "https://…",
      // "" : pas de photo valide -> {{#if photo}} masque l'avatar plutôt
      // que de pointer vers une image cassée.
      urlFallback: "",
    },
    {
      id: "theme",
      label: "Thème",
      type: "segmented",
      default: "light",
      options: [
        { value: "light", label: "Clair" },
        { value: "dark", label: "Sombre" },
      ],
      tokens: {
        light: {
          bg: "#E7EAEC",
          fg: "#0F1F2E",
          sub: "rgba(15,31,46,.65)",
          icon: "#2E2AE4",
        },
        dark: {
          bg: "#0F1F2E",
          fg: "#ffffff",
          sub: "rgba(255,255,255,.65)",
          icon: "#D7F86C",
        },
      },
    },
  ],
  html: `<div class="{{cls}}">
  <svg class="{{cls}}__mark" width="52" height="32" viewBox="0 0 64 40" fill="none" aria-hidden="true"><path d="M0 40L20 0H28L8 40H0Z" fill="currentColor"/><path d="M28 40L48 0H56L36 40H28Z" fill="currentColor"/></svg>
  <p class="{{cls}}__text">{{text}}</p>
  <div class="{{cls}}__author">
    {{#if photo}}<img class="{{cls}}__avatar" src="{{photo}}" alt="{{name}}">{{/if}}
    <div>
      <strong class="{{cls}}__name">{{name}}</strong>
      <span class="{{cls}}__role">{{role}}</span>
    </div>
  </div>
</div>`,
  css: `.{{cls}}{box-sizing:border-box;border-radius:20px;padding:40px;background:{{theme.bg}};color:{{theme.fg}};font-family:${FONT_STACK};}
.{{cls}} *{box-sizing:border-box;}
.{{cls}}__mark{display:block;margin:0 0 20px;color:{{theme.icon}};}
.{{cls}}__text{font-size:26px;line-height:1.35;font-weight:500;margin:0 0 28px;color:{{theme.fg}};}
.{{cls}}__author{display:flex;align-items:center;gap:14px;}
.{{cls}}__avatar{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#ccc;flex-shrink:0;}
.{{cls}}__name{display:block;font-size:15px;font-weight:600;color:{{theme.fg}};}
.{{cls}}__role{display:block;font-size:13px;color:{{theme.sub}};}`,
};

const ctaCard: CardTemplate = {
  id: "cta",
  label: "CTA",
  fields: [
    {
      id: "title",
      label: "Titre",
      type: "textarea",
      default: "Construisons ensemble la plateforme GRC de référence",
    },
    {
      id: "text",
      label: "Texte",
      type: "textarea",
      default:
        "Découvrez comment Iskera aide les équipes conformité à piloter leurs risques sur un seul référentiel.",
    },
    {
      id: "btnText",
      label: "Texte du bouton",
      type: "text",
      default: "Demander une démo",
    },
    {
      id: "btnLink",
      label: "Lien du bouton",
      type: "url",
      default: "",
      placeholder: "https://…",
    },
  ],
  html: `<div class="{{cls}}">
  <h2 class="{{cls}}__title">{{title}}</h2>
  <p class="{{cls}}__text">{{text}}</p>
  <a class="{{cls}}__btn" href="{{btnLink}}">
    <span class="{{cls}}__arrow" aria-hidden="true">&#8594;</span>
    {{btnText}}
  </a>
</div>`,
  css: `.{{cls}}{box-sizing:border-box;background:#E7EAEC;color:#0F1F2E;border-radius:20px;padding:44px;font-family:${FONT_STACK};}
.{{cls}} *{box-sizing:border-box;}
.{{cls}}__title{font-size:30px;line-height:1.25;margin:0 0 16px;font-weight:600;color:#0F1F2E;}
.{{cls}}__text{font-size:15px;line-height:1.6;color:#4B5560;margin:0 0 26px;}
.{{cls}}__btn{display:inline-flex;align-items:center;gap:12px;background:#0F1F2E;color:#fff;padding:6px 22px 6px 6px;border-radius:999px;text-decoration:none;font-size:14.5px;font-weight:500;}
.{{cls}}__arrow{width:30px;height:30px;border-radius:50%;background:#D7F86C;color:#0F1F2E;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;line-height:1;}`,
};

/**
 * Catalogue complet des templates disponibles dans le bundle.
 *
 * C'est un pur objet de données (chaînes, tableaux, nombres — aucune
 * fonction) : valide en JSON. Le jour où les templates doivent venir d'une
 * source externe, il suffit de remplacer l'import statique ci-dessous par
 * un fetch() qui renvoie un tableau de la même forme ; rien d'autre dans
 * l'extension n'a besoin de changer.
 */
export const TEMPLATES: CardTemplate[] = [quoteCard, ctaCard];

/* ------------------------------------------------------------------ */
/* Filtrage par site                                                   */
/* ------------------------------------------------------------------ */

/** Templates servis aux sites non listés dans `templatesBySite`. */
export const DEFAULT_TEMPLATE_IDS: string[] = ["quote", "cta"];

/**
 * Templates autorisés par site, indexés par siteId (webflow.getSiteInfo()).
 * Le siteId courant est affiché en bas du panneau : ouvrir l'extension sur le
 * site, copier l'ID, ajouter l'entrée ici, republier.
 *
 * Exemple :
 *   "6512ab34cd56ef7890123456": ["quote"],   // ce site n'a que la citation
 */
export const templatesBySite: Record<string, string[]> = {
  // TODO Iskera : remplacer par le siteId réel une fois relevé dans le panneau.
  // "SITE_ID_ISKERA": ["quote", "cta"],
};

/** Résout la liste de templates à afficher pour un site donné. */
export function templatesForSite(siteId?: string | null): CardTemplate[] {
  const allowed =
    (siteId && templatesBySite[siteId]) || DEFAULT_TEMPLATE_IDS;
  return TEMPLATES.filter((t) => allowed.indexOf(t.id) !== -1);
}
