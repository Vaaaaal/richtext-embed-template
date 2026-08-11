import { CardTemplate, FONT_STACK } from "./engine";

export const quoteCard: CardTemplate = {
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
