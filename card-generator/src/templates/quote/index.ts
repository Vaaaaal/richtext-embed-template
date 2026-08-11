import { CardTemplate } from "@/lib/template-engine";
import html from "./card.html?raw";
import css from "./card.css?raw";

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
  html,
  css,
};
