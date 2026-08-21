---
name: nouveau-template
description: Crée un nouveau template de card pour le générateur (dossier src/templates/<id>/ avec card.html, card.css, index.ts) en suivant les conventions du projet — placeholders, échappement, thème, JS optionnel — et l'enregistre dans le catalogue. À utiliser quand l'utilisateur veut ajouter un template (citation, CTA, stat, témoignage, simulateur…).
---

# Créer un nouveau template de card

Ce skill s'applique au générateur de cards Webflow de ce repo. Il produit un
dossier `src/templates/<id>/` (`card.html`, `card.css`, `index.ts`) et
l'enregistre dans `src/lib/template-registry.ts`. Le moteur qui interprète
tout ça est `src/lib/template-engine.ts` — générique, il ne change jamais
pour un nouveau template.

**Les deux templates existants, `src/templates/quote/` et
`src/templates/cta/`, sont les exemples vivants à consulter** — plus fiables
que tout ce qui est recopié ici, puisqu'ils évoluent avec le projet. En cas
de doute sur une convention, les relire prime sur ce document.

## Étape 1 — Cerner le besoin

Si ce n'est pas déjà clair dans la demande, établir :
- **id** technique (court, en anglais, ex. `stat`, `testimonial`) et
  **label** affiché dans le panneau (ex. "Statistique")
- la liste des **champs** : id, label, type, valeur par défaut, et pour un
  champ à options la liste des choix
- un **thème** clair/sombre/marque est-il utile pour ce template ? (voir
  Étape 5)
- une **interactivité JS** est-elle nécessaire (compteur, simulateur…) ?
  (voir Étape 6 — rare, à ne construire que si explicitement demandé)

Ne pas (re)poser une question dont la réponse est déjà donnée dans la
demande initiale.

## Étape 2 — Partir d'un exemple existant

Dupliquer le dossier le plus proche du résultat visé plutôt que d'écrire les
trois fichiers de zéro :

- `src/templates/quote/` — racine `{{cls}}` nue, enfants `{{cls}}_partie`.
  Le plus simple, à préférer par défaut.
- `src/templates/cta/` — racine `{{cls}}_nom-composant`, lien en overlay
  toute la carte, bouton conditionnel. À prendre en référence si le
  template a une zone cliquable ou des blocs optionnels imbriqués.

## Étape 3 — `card.html`

Fichier HTML normal (coloration, Emmet, Prettier fonctionnent). Règles :

- **Toute classe commence par `{{cls}}`**, sans exception — c'est ce qui
  isole le CSS généré de celui du site et permet à deux cards du même
  template de cohabiter sur une page. `{{cls}}__partie` ou
  `{{cls}}_partie` sont deux conventions vues dans le repo, choisir l'une
  et rester cohérent dans le fichier.
- `{{champId}}` insère la valeur d'un champ — **déjà échappée
  automatiquement selon son type** par le moteur (voir tableau Étape 4).
  Ne jamais ajouter d'échappement manuel, ne jamais interpoler autre chose
  qu'un champ déclaré.
- `{{#if champId}}…{{/if}}` : le bloc n'est rendu que si le champ résout à
  une valeur non vide. Pour un élément optionnel (photo, lien, bouton),
  combiner avec `urlFallback: ""` sur le champ correspondant (Étape 4) pour
  qu'un champ vide masque l'élément plutôt que de produire un lien/image
  cassé.
- Les commentaires HTML sont libres et bienvenus pour documenter — ils sont
  retirés automatiquement du code copié par le client, aucun risque qu'ils
  fuient.

## Étape 4 — `card.css`

Même placeholders que le HTML. Un point cosmétique à connaître : à cause
des `{{cls}}` dans les sélecteurs, ce n'est pas du CSS syntaxiquement
valide, donc l'éditeur y affiche des soulignements rouges — sans
conséquence, ce fichier n'est jamais parsé comme du CSS, seulement lu comme
texte (`"css.validate": false` dans les réglages VS Code pour les faire
taire si ça gêne).

Référence des types de champ et de leur échappement (défini dans
`src/lib/template-engine.ts`, ne pas dupliquer cette logique dans un
template) :

| Type | Widget | Échappement | Notes |
|---|---|---|---|
| `text` | champ court | HTML | — |
| `textarea` | zone multi-ligne | HTML | — |
| `url` | champ URL | neutralise `javascript:`/schémas exotiques | `urlFallback` : `"#"` par défaut (lien inerte), `""` pour masquer via `{{#if}}` |
| `segmented` | boutons groupés | HTML (+ `tokens` si présent) | 2-3 choix max, au-delà les boutons se compressent |
| `select` | menu déroulant | HTML (+ `tokens` si présent) | dès 4 choix ou plus |

`segmented`/`select` acceptent un `tokens: Record<option, Record<clé, valeur>>`
optionnel, exposé comme `{{champId.clé}}` — voir Étape 5 pour l'usage
standard de ce mécanisme (le thème).

## Étape 5 — Thème (si demandé)

Motif standard du projet, identique sur `quote` et `cta` — à reproduire
tel quel plutôt qu'improviser une variante :

```ts
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
```

Sur la racine du HTML : `class="{{cls}} {{theme.class}}"`. Le token ne porte
**jamais** de couleur directement — seulement le nom de la classe. Le CSS
définit les couleurs comme des custom properties sur la racine, que chaque
bloc de thème redéfinit :

```css
.{{cls}} {
  --card-background: #ffffff;
  --card-text-color: #0f242e;
  background: var(--card-background);
  color: var(--card-text-color);
}
.{{cls}}.theme-dark {
  --card-background: #0f242e;
  --card-text-color: #ffffff;
}
```

Pourquoi ce détour par des custom properties plutôt que des couleurs
directement dans les `tokens` (essayé, abandonné) : ça permet au thème de
piloter des propriétés composées (`color-mix()`, des états `:hover`) sans
dupliquer des blocs de règles entiers par thème — un seul jeu de règles,
seules les valeurs des variables changent.

## Étape 6 — JS (rare, seulement si explicitement demandé)

Pour un simulateur ou une interaction (compteur, calcul…), pas pour du
contenu statique. Dans `index.ts` :

```ts
import js from "./card.js?raw";
...
js: withInitGuard("dd-hook-<id>", js),
```

Et dans `card.html`, une classe fixe posée en plus de `{{cls}}` sur la
racine : `class="{{cls}} dd-hook-<id>"`.

**Règle non négociable, jamais d'exception** : **aucun `{{champId}}` dans
`card.js`**. Le moteur ne fait passer `card.js` par aucune substitution — un
`{{champId}}` littéral y resterait tel quel, jamais remplacé. C'est
volontaire : le client n'a jamais d'option pour écrire du JS, mais si un
script recopiait une valeur qu'il a tapée directement dans du code exécuté,
la faille reviendrait par la bande. Si le script a besoin d'une valeur
saisie, il la relit dans le HTML déjà rendu (déjà échappé) :
`component.querySelector(".ma-classe").textContent`.

`hookClass` doit être une classe **fixe**, jamais `{{cls}}` : chaque card
copiée duplique tout son `<script>`, donc deux cards du même template sur
une page dupliquent le même script. `withInitGuard` protège contre cette
collision (chaque exécution retrouve toutes les cards de ce type sur la
page et ignore celles déjà initialisées) — à condition que `hookClass` soit
la même chaîne fixe partout, pas une valeur qui change à chaque copie.

## Étape 7 — `index.ts`

```ts
import { CardTemplate } from "@/lib/template-engine";
import html from "./card.html?raw";
import css from "./card.css?raw";

export const xxxCard: CardTemplate = {
  id: "xxx",
  label: "Nom affiché dans le panneau",
  fields: [ /* … */ ],
  html,
  css,
  // js: withInitGuard("dd-hook-xxx", js), // seulement si Étape 6
};
```

## Étape 8 — Enregistrer le template

Dans `src/lib/template-registry.ts` : importer le nouveau template et
l'ajouter au tableau `TEMPLATES`. C'est la seule autre modification
nécessaire — le formulaire, l'aperçu, le code généré et l'import (voir
`src/lib/card-import.ts`) fonctionnent automatiquement pour tout template
présent dans ce tableau.

## Étape 9 — Vérifier, systématiquement

Après création ou modification :

```bash
npx tsc -p tsconfig.json --noEmit
npx eslint .
npx vite build
```

Pour un template significatif (pas un simple ajustement de texte), vérifier
aussi le rendu réel : `npx webflow extension serve 1337`, ouvrir dans un
navigateur (ou capturer via Playwright), tester au moins un changement de
thème et un champ optionnel vide/rempli. Ne pas se fier uniquement au
type-check — il ne dit rien du rendu visuel ni d'une classe HTML qui ne
correspond à aucune règle CSS.
