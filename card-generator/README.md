# Générateur de cards — Designer Extension Webflow

> **Branche `experiment/shadcn-ui`** : test de portage du panneau vers
> React + Tailwind + [shadcn/ui](https://ui.shadcn.com), pour comparer avec
> la version vanilla TS de `main`. Voir [Notes sur l'expérimentation
> shadcn](#notes-sur-lexpérimentation-shadcn) en bas de page.

Panneau Webflow Designer qui génère des cards (citation, CTA) à partir de
templates prédéfinis et fournit un code HTML/CSS autonome à coller dans un
élément Embed ou un champ Rich Text du CMS.

**Capacité utilisée** : Designer Extension uniquement. Pas de Data Client, pas
d'OAuth, pas de backend.

## Flux client

Ouvrir le panneau dans le Designer → choisir un template → remplir le
formulaire (aperçu en direct) → **Copier le code** → coller dans un Embed.
Il n'y a pas d'insertion automatique dans l'élément sélectionné (choix assumé
pour le MVP).

## Développement

```bash
npm install
npm run dev     # vite build --watch + webflow extension serve (http://localhost:1337)
```

Puis, dans le Designer : **Apps & Integrations → l'app en mode développement →
Development URL = `http://localhost:1337`** → lancer l'extension.

Prérequis : l'app doit être installée en dev sur le site (Apps & Integrations →
Develop), et le compte doit avoir accès au **mode Designer** (les Designer
Extensions ne fonctionnent pas en mode Editor seul).

```bash
npm run lint    # eslint
npm run build   # tsc --noEmit + vite build + webflow extension bundle → bundle.zip
```

`bundle.zip` s'uploade ensuite comme nouvelle version de l'app dans le
Developer Portal Webflow.

> `@webflow/webflow-cli` est une devDependency du projet : aucune installation
> globale n'est nécessaire, les scripts npm résolvent le binaire local. Pour
> lancer la CLI à la main : `npx webflow …` depuis ce dossier.
>
> `npm audit` remonte des vulnérabilités transitives (undici) dans l'arbre de
> dépendances de la CLI. Elles concernent l'outillage de dev uniquement — le
> `bundle.zip` ne contient que `public/` — et `npm audit fix --force`
> downgraderait la CLI en 1.7.4. Laissé en l'état.

## Structure

```
src/templates/engine.ts   ← types + moteur de rendu (générique, ne change jamais)
src/templates/quote.ts    ← template "Citation"                (à éditer / dupliquer)
src/templates/cta.ts      ← template "CTA"                      (à éditer / dupliquer)
src/templates/registry.ts ← catalogue TEMPLATES + filtrage par site
src/templates/index.ts    ← barrel (réexporte engine + registry)
src/App.tsx               ← panneau : formulaire, aperçu, copie  (générique)
src/components/ui/*       ← composants shadcn (générés par la CLI, ne pas éditer à la main)
src/index.css             ← Tailwind + tokens de couleur shadcn
index.html, src/main.tsx  ← point d'entrée Vite
public/                   ← sortie du build Vite (générée, jamais éditée)
webflow.json               ← manifest de l'extension (name, publicDir, size)
```

## Ajouter ou modifier un template

Chaque template a son propre fichier dans [`src/templates/`](src/templates/)
(`quote.ts`, `cta.ts`, …) — le plus simple pour en créer un nouveau est de
dupliquer le plus proche de ce que tu veux obtenir. Un template est un objet
`CardTemplate` **entièrement déclaratif** — `fields`, `html`, `css` sont des
chaînes et des tableaux, aucune fonction. C'est ce qui le rend valide en
JSON, donc compatible avec une source de données externe plus tard (voir
plus bas) sans rien changer au moteur de rendu.

```ts
// src/templates/mon-template.ts
import { CardTemplate } from "./engine";

export const monTemplate: CardTemplate = {
  id: "mon-template",
  label: "Mon template",
  fields: [
    { id: "titre", label: "Titre", type: "text", default: "Bonjour" },
    // types disponibles : "text" | "textarea" | "url" | "segmented"
  ],
  html: `<div class="{{cls}}">{{titre}}</div>`,
  css: `.{{cls}}{padding:24px;}`,
};
```

Puis, dans [`src/templates/registry.ts`](src/templates/registry.ts) :
importer le nouveau fichier et l'ajouter au tableau `TEMPLATES` (et à
`DEFAULT_TEMPLATE_IDS` s'il doit être visible par défaut). Le formulaire,
l'aperçu et le code généré se construisent automatiquement à partir de cette
config — aucune autre modification nécessaire.

**Syntaxe des gabarits `html` / `css`** (interprétée par `renderTemplate()`
dans [`src/templates/engine.ts`](src/templates/engine.ts)) :

- `{{cls}}` — classe racine unique de la card (suffixe aléatoire). Toujours
  préfixer les classes par `{{cls}}` (ex. `{{cls}}__titre`) : c'est ce qui
  isole le CSS généré des styles du site et permet à deux cards du même
  template de cohabiter sur une page.
- `{{champId}}` — valeur saisie pour ce champ, déjà échappée automatiquement
  (`escapeAttr` pour texte, `safeUrl` pour les champs `"url"`). Ne jamais
  interpoler une valeur client sans passer par un champ déclaré.
- `{{champId.token}}` — pour un champ `"segmented"` avec `tokens` (ex. les
  couleurs du thème clair/sombre de la citation) : valeur dérivée selon
  l'option choisie.
- `{{#if champId}}…{{/if}}` — le bloc n'est rendu que si le champ résout à
  une valeur non vide. Utile pour un champ optionnel (ex. la photo d'auteur) :
  mettre `urlFallback: ""` sur ce champ pour qu'une valeur vide ou invalide
  masque le bloc plutôt que de pointer vers un lien cassé.

Un nouveau suffixe de classe est tiré après chaque copie réussie, pour que la
card suivante ait ses propres classes.

## Filtrage par site (multi-client)

Un seul bundle sert tous les clients. `templatesBySite` associe un `siteId` à
la liste des templates autorisés :

```ts
export const templatesBySite: Record<string, string[]> = {
  "6512ab34cd56ef7890123456": ["quote"],   // ce site n'a que la citation
};
```

Les sites absents de cet objet reçoivent `DEFAULT_TEMPLATE_IDS`.

Pour relever le `siteId` d'un site : ouvrir l'extension dessus, l'ID est
affiché en bas du panneau (sélectionnable). Il vient de
`webflow.getSiteInfo()`.

> **À faire pour Iskera** : l'entrée est encore un placeholder commenté dans
> `templatesBySite`. Tant qu'elle n'est pas renseignée, Iskera voit les deux
> templates via le fallback par défaut — ce qui est le comportement attendu
> pour ce premier test.

## Notes d'implémentation

- **Aperçu en iframe** (`srcdoc`) : le rendu est isolé du CSS du panneau, donc
  fidèle à ce que donnera le code collé. La hauteur s'ajuste au contenu.
- **Copie presse-papier** : `navigator.clipboard` peut être bloqué par la
  permissions policy de l'iframe du Designer. Le code retombe sur
  `document.execCommand("copy")`, puis, en dernier recours, ouvre le panneau de
  code avec le texte présélectionné pour un ⌘C manuel.
- **Photo d'auteur** : si le champ est vide (ou contient une URL au schéma non
  autorisé), l'avatar est simplement omis du markup — pas de service de
  placeholder externe injecté dans du contenu CMS publié.

## Évolution envisagée

Si l'usage est validé, les templates pourront être servis par une source de
données externe plutôt que codés en dur, pour les mettre à jour sans republier
l'extension. Non nécessaire pour ce premier test.

## Notes sur l'expérimentation shadcn

Ce que ce portage change concrètement par rapport à `main` :

- **Stack de build** : `tsc` seul ne suffit plus (JSX + Tailwind). Le projet
  passe par Vite (`vite build` génère `public/` à partir de `index.html` +
  `src/main.tsx`), `webflow.json` (`publicDir: "public"`) est inchangé.
- **UI** : `src/index.ts` (DOM manipulé à la main) devient `src/App.tsx`
  (composants React + hooks d'état) + les primitives shadcn dans
  `src/components/ui/` (Select, Input, Textarea, Label, ToggleGroup, Button).
- **La config des templates n'a pas changé de contenu**, seulement
  d'organisation : `src/templates.ts` (un seul fichier, sur `main`) est
  devenu `src/templates/` (un fichier par template, sur cette branche —
  reorg indépendante de shadcn, faite pour rester lisible en ajoutant des
  templates). Aucune ligne de `fields`/`html`/`css` n'a changé, ni le moteur
  de rendu : seule la répartition entre fichiers diffère. C'est quand même
  la validation concrète de la séparation données/rendu déjà en place — le
  moteur de templates ne dépend pas de la techno du panneau.

**Coût mesuré** : bundle de ~10 Ko (vanilla, `main`) à ~114 Ko (React +
Radix + Tailwind, cette branche) une fois compressé dans `bundle.zip` — reste
très loin de la limite de 5 Mo imposée par Webflow, donc pas un facteur
bloquant en soi.

**Ce que shadcn apporte réellement ici** : des primitives accessibles
(`Select`, `ToggleGroup` au clavier/lecteur d'écran) et une base de composants
réutilisable si le panneau grossit. Le rendu visuel obtenu est très proche de
la version vanilla polie à la main sur `main` — logique, puisque les deux
utilisent la même palette de couleurs.

**Pour comparer** :

```bash
git checkout main               && cd card-generator && npm run dev
git checkout experiment/shadcn-ui && cd card-generator && npm run dev
```
