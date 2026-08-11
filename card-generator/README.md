# Générateur de cards — Designer Extension Webflow

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
npm run dev     # tsc --watch + webflow extension serve (http://localhost:1337)
```

Puis, dans le Designer : **Apps & Integrations → l'app en mode développement →
Development URL = `http://localhost:1337`** → lancer l'extension.

Prérequis : l'app doit être installée en dev sur le site (Apps & Integrations →
Develop), et le compte doit avoir accès au **mode Designer** (les Designer
Extensions ne fonctionnent pas en mode Editor seul).

```bash
npm run lint    # eslint
npm run build   # tsc + webflow extension bundle → bundle.zip
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
src/templates.ts   ← config des templates + filtrage par site   (à éditer)
src/index.ts       ← panneau : formulaire, aperçu, copie        (générique)
public/index.html  ← coquille du panneau
public/styles.css  ← UI du panneau (thème sombre du Designer)
public/*.js        ← sortie de tsc (ne pas éditer)
webflow.json       ← manifest de l'extension (name, publicDir, size)
```

## Ajouter ou modifier un template

Tout se passe dans [`src/templates.ts`](src/templates.ts). Un template est
un objet `CardTemplate` **entièrement déclaratif** — `fields`, `html`, `css`
sont des chaînes et des tableaux, aucune fonction. C'est ce qui le rend
valide en JSON, donc compatible avec une source de données externe plus tard
(voir plus bas) sans rien changer au moteur de rendu.

```ts
const monTemplate: CardTemplate = {
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

Puis l'ajouter au tableau `TEMPLATES` (et à `DEFAULT_TEMPLATE_IDS` s'il doit
être visible par défaut). Le formulaire, l'aperçu et le code généré se
construisent automatiquement à partir de cette config — aucune modification
ailleurs.

**Syntaxe des gabarits `html` / `css`** (interprétée par `renderTemplate()`
dans [`src/templates.ts`](src/templates.ts)) :

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
