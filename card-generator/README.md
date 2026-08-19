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

`src/templates/` ne contient **que** des templates — un sous-dossier par
template, toute la mécanique est ailleurs :

```
src/templates/quote/       ← template "Citation"   (à éditer / dupliquer)
  ├── card.html            ←   markup, fichier HTML normal
  ├── card.css             ←   styles, fichier CSS normal
  └── index.ts             ←   champs du formulaire + assemblage
src/templates/cta/         ← template "CTA"        (même structure)

src/lib/template-engine.ts   ← types + moteur de rendu (générique, ne change jamais)
src/lib/template-registry.ts ← catalogue TEMPLATES + filtrage par site
src/lib/clipboard.ts         ← copie presse-papier avec fallbacks
src/lib/utils.ts             ← helper `cn` (shadcn)

src/App.tsx               ← panneau : formulaire, aperçu, copie  (générique)
src/components/ui/*       ← composants shadcn (générés par la CLI, ne pas éditer à la main)
src/index.css             ← Tailwind + tokens de couleur shadcn
index.html, src/main.tsx  ← point d'entrée Vite
public/                   ← sortie du build Vite (générée, jamais éditée)
webflow.json               ← manifest de l'extension (name, publicDir, size)
```

## Ajouter ou modifier un template

Chaque template est un dossier dans [`src/templates/`](src/templates/) avec
trois fichiers. Le plus rapide pour en créer un : **dupliquer le dossier le
plus proche** de ce que tu veux obtenir (`quote/` ou `cta/`), le renommer,
puis l'enregistrer dans le catalogue.

```
src/templates/mon-template/
├── card.html    ← markup (fichier HTML normal : coloration, Emmet, Prettier)
├── card.css     ← styles (fichier CSS normal)
└── index.ts     ← champs du formulaire + assemblage
```

```html
<!-- card.html -->
<div class="{{cls}}">
  <h2 class="{{cls}}__titre">{{titre}}</h2>
</div>
```

```css
/* card.css */
.{{cls}} {
  padding: 24px;
}
.{{cls}}__titre {
  font-size: 24px;
}
```

```ts
// index.ts
import { CardTemplate } from "@/lib/template-engine";
import html from "./card.html?raw";
import css from "./card.css?raw";

export const monTemplate: CardTemplate = {
  id: "mon-template",
  label: "Mon template",
  fields: [
    { id: "titre", label: "Titre", type: "text", default: "Bonjour" },
    // types disponibles : "text" | "textarea" | "url" | "segmented"
  ],
  html,
  css,
};
```

Le `?raw` est une fonctionnalité native de Vite : le fichier est lu comme
une simple chaîne de caractères et inliné dans le bundle au build. Le
template reste donc un pur objet de données, sans code exécutable — c'est
ce qui le garde compatible avec une source externe plus tard (voir plus bas).

Puis, dans
[`src/lib/template-registry.ts`](src/lib/template-registry.ts) : importer le
nouveau template et l'ajouter au tableau `TEMPLATES` (et à
`DEFAULT_TEMPLATE_IDS` s'il doit être visible par défaut). Le formulaire,
l'aperçu et le code généré se construisent automatiquement — aucune autre
modification nécessaire.

> **À savoir sur les fichiers `.css`** : à cause des `{{cls}}` dans les
> sélecteurs, ce n'est pas du CSS syntaxiquement valide, et l'éditeur y
> affichera des erreurs (soulignements rouges). C'est cosmétique — le
> fichier n'est jamais parsé comme du CSS, seulement lu comme du texte. Pour
> les faire taire dans VS Code : `"css.validate": false` dans les réglages
> du workspace. Les fichiers `.html`, eux, ne posent aucun problème
> (`class="{{cls}}"` est un attribut parfaitement valide).

**Syntaxe des gabarits `card.html` / `card.css`** (interprétée par
`renderTemplate()` dans
[`src/lib/template-engine.ts`](src/lib/template-engine.ts)) :

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

Les **commentaires** (`/* … */` et `<!-- … -->`) sont retirés au rendu :
documente librement tes gabarits, rien de tout ça n'atterrit dans le code
copié par le client.

## Variables du site (design system)

Les gabarits peuvent référencer directement les variables Webflow du site
plutôt que des couleurs figées — c'est ce que fait le template Citation :

```css
background: var(--_theme---background-2, #e9ecef);
color: var(--_theme---heading, #0f242e);
```

L'intérêt : une card déjà collée dans le CMS **suit automatiquement** les
changements de charte du client. Avec des hex en dur, chaque card fige les
couleurs au moment de sa création, et une refonte laisse derrière elle des
dizaines de champs Rich Text à corriger à la main.

**Toujours mettre une valeur de repli** dans le `var()`. Elle sert si la card
est collée sur un site sans ces variables, et dans l'aperçu quand l'API
Designer n'a pas pu les fournir.

> Relever les noms exacts : ne pas les reconstituer depuis le nom affiché
> dans le Designer. Une faute de frappe **échoue silencieusement** — le repli
> masque l'erreur, et la card ne suivra jamais le thème sans que personne ne
> s'en aperçoive. Les noms CSS réels s'obtiennent via l'API (`getCSSName()`
> côté Designer, champ `cssName` côté Data API/MCP).

### Thèmes : classes plutôt que couleurs

Le site pilote ses thèmes avec les **modes de variables** Webflow : une classe
comme `.u-theme-dark` bascule le mode de la collection, ce qui fait résoudre
`--_theme---heading` vers une autre valeur.

Un champ `segmented` n'a donc pas à porter de couleurs — juste la classe :

```ts
tokens: {
  inherit: { class: "" },              // la card prend le thème de sa section
  light:   { class: "u-theme-light" },
  dark:    { class: "u-theme-dark" },
}
```

```html
<div class="{{cls}} {{theme.class}}">
```

Le CSS reste identique quel que soit le thème choisi — c'est la classe qui
change tout. À noter : une card en « Sombre » posée sur une section déjà
sombre se confondra avec le fond ; c'est l'option « Section » qui est faite
pour ce cas.

### Aperçu du panneau

L'aperçu est une iframe isolée, sans accès aux variables du site. Au
chargement, [`src/lib/site-theme.ts`](src/lib/site-theme.ts) les lit via
l'API Designer (collections → modes → variables) et reconstruit un bloc
`:root { … }` plus un bloc par classe de thème, injectés dans l'iframe.

Les classes reproduites sont listées dans `PREVIEW_THEME_CLASSES`
([`src/lib/template-registry.ts`](src/lib/template-registry.ts)) — à ajuster
pour un client dont le design system utilise d'autres noms.

Toute la chaîne est best-effort : en cas d'échec, l'aperçu retombe sur les
valeurs de repli des `var()` et le code copié reste correct dans tous les cas.
Vérifié contre le CSS réellement publié par un site Webflow : les modes de
variables se traduisent bien en overrides de custom properties sur la classe
de thème (`.u-theme-dark{--_theme---heading:var(--swatch--white);…}`), ce
que `site-theme.ts` reconstruit.

**Diagnostic** : un échec partiel (classe de thème introuvable sur le site,
lecture d'une variable qui échoue) n'est jamais silencieux. Le bas du
panneau affiche un statut (« synchronisé » / « échec — voir console » / …)
avec un lien **resynchroniser**, et la console du panneau reçoit le détail
complet — nombre de collections trouvées, par classe : trouvée ou non,
nombre de modes résolus, nombre de caractères de CSS produits. En cas de
souci, ouvrir la console du panneau (clic droit → Inspecter dans le
Designer) est le premier réflexe.

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
- **Les templates n'ont pas changé de contenu**, seulement d'organisation :
  `src/templates.ts` (un fichier unique contenant moteur + templates +
  catalogue, sur `main`) est devenu `src/lib/template-engine.ts` +
  `src/lib/template-registry.ts` + un dossier par template avec ses
  `card.html` / `card.css` dédiés. Les réorganisations sont indépendantes de
  shadcn (elles visent la lisibilité à mesure qu'on ajoute des templates) et
  pourraient être reportées sur `main` telles quelles. Le moteur de rendu et
  les gabarits sont fonctionnellement inchangés — vérifié par un script de
  rendu hors navigateur (échappement XSS, `javascript:` neutralisé,
  conditionnels, tokens de thème, scoping des classes).

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
