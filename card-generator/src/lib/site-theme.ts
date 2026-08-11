/**
 * Extraction des variables du site pour l'aperçu du panneau.
 *
 * Pourquoi : les templates référencent les variables Webflow du site
 * (`var(--_theme---heading)`, …). Sur le site publié elles se résolvent
 * naturellement, mais l'aperçu du panneau est une iframe isolée qui n'y a
 * aucun accès. On lit donc les variables via l'API Designer et on les
 * réinjecte dans l'iframe.
 *
 * Les thèmes du site reposent sur les *modes de variables* Webflow : une
 * classe comme `.u-theme-dark` bascule le mode de la collection, ce qui fait
 * résoudre `--_theme---background` vers une autre valeur. On reproduit donc,
 * pour chaque classe de thème, le bloc `.u-theme-dark { --x: … }`
 * correspondant.
 *
 * Tout est best-effort : en cas d'échec on renvoie "" et les templates
 * retombent sur les valeurs de repli de leurs `var(…, fallback)`.
 */

/** Vue structurelle minimale d'une variable, pour éviter l'union de types. */
interface AnyVariable {
  getCSSName(): Promise<string>;
  get(options?: { mode?: VariableMode }): Promise<unknown>;
}

/**
 * Sérialise une valeur de variable en CSS.
 *
 * Les alias ne sont pas résolus récursivement : on émet `var(--autre)`, ce
 * qui est valide puisque toutes les variables sont injectées dans le même
 * scope. Ça gère aussi gratuitement les valeurs `color-mix(...)` du site,
 * qui contiennent déjà des `var(…)`.
 */
async function serializeValue(value: unknown): Promise<string | null> {
  if (value == null) return null;

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    // Alias vers une autre variable.
    if (typeof obj.getCSSName === "function") {
      return `var(${await (value as AnyVariable).getCSSName()})`;
    }
    // CustomValue : { type: "custom", value: "color-mix(…)" }
    if (typeof obj.value === "string") return obj.value;
    // SizeValue : { value: 2, unit: "rem" }
    if (typeof obj.value === "number" && typeof obj.unit === "string") {
      return `${obj.value}${obj.unit}`;
    }
  }

  return null;
}

/** Déclarations `--nom: valeur;` de toutes les variables, pour un mode donné. */
async function declarationsForMode(
  collection: VariableCollection,
  mode?: VariableMode
): Promise<string> {
  const variables = await collection.getAllVariables();
  const parts = await Promise.all(
    variables.map(async (variable) => {
      const v = variable as unknown as AnyVariable;
      try {
        const [name, raw] = await Promise.all([
          v.getCSSName(),
          v.get(mode ? { mode } : undefined),
        ]);
        const value = await serializeValue(raw);
        return value === null ? "" : `${name}:${value};`;
      } catch {
        return "";
      }
    })
  );
  return parts.join("");
}

/**
 * Construit la feuille de style à injecter dans l'iframe d'aperçu.
 *
 * @param themeClasses classes utilitaires de thème du site à reproduire
 *                     (ex. ["u-theme-light", "u-theme-dark"]). Chacune est
 *                     lue via `getStyleByName` pour retrouver le mode
 *                     qu'elle applique.
 */
export async function buildPreviewThemeCss(
  themeClasses: string[]
): Promise<string> {
  try {
    const collections = await webflow.getAllVariableCollections();
    if (collections.length === 0) return "";

    // Mode de base -> :root, ce qui couvre aussi l'option « Hériter ».
    const base = await Promise.all(
      collections.map((c) => declarationsForMode(c))
    );
    let css = `:root{${base.join("")}}`;

    for (const className of themeClasses) {
      const style = await webflow.getStyleByName(className);
      if (!style) continue;

      let decls = "";
      for (const collection of collections) {
        // Une classe n'impose un mode que sur certaines collections.
        const mode = await style.getVariableMode(collection);
        if (!mode) continue;
        decls += await declarationsForMode(collection, mode);
      }
      if (decls) css += `.${className}{${decls}}`;
    }

    return css;
  } catch (err) {
    console.warn("Variables du site indisponibles pour l'aperçu :", err);
    return "";
  }
}
