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
        { value: "inherit", label: "Section" },
        { value: "light", label: "Clair" },
        { value: "dark", label: "Sombre" },
      ],
      // Le thème n'est plus une liste de couleurs : on pose simplement la
      // classe utilitaire du site, qui bascule le mode des variables Webflow
      // (voir card.css). "inherit" n'émet aucune classe, la card prend donc
      // le thème de la section qui l'entoure.
      tokens: {
        inherit: { class: "" },
        light: { class: "u-theme-light" },
        dark: { class: "u-theme-dark" },
      },
    },
  ],
  html,
  css,
};
