import { CardTemplate, FONT_STACK } from "./engine";

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
