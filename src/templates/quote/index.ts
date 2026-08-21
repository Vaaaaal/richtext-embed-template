import { CardTemplate } from "@/lib/template-engine";
import html from "./block.html?raw";
import css from "./block.css?raw";

export const quoteCard: CardTemplate = {
  id: "quote",
  label: "Citation",
  fields: [
    {
      id: "theme",
      label: "Thème",
      type: "select",
      default: "light-2",
      options: [
        { value: "light", label: "Light" },
        { value: "light-2", label: "Light 2" },
        { value: "dark", label: "Dark" },
        { value: "brand", label: "Brand" },
      ],
      tokens: {
        light: { class: "theme-light" },
        "light-2": { class: "theme-light-2" },
        dark: { class: "theme-dark" },
        brand: { class: "theme-brand" },
      },
    },
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
    }
  ],
  html,
  css,
};
