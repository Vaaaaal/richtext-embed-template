import { CardTemplate } from "@/lib/template-engine";
import html from "./card.html?raw";
import css from "./card.css?raw";

export const ctaCard: CardTemplate = {
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
  html,
  css,
};
