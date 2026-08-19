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
 * résoudre `--_theme---background` vers une autre valeur. Vérifié contre le
 * CSS publié du site : Webflow génère bien
 *   .u-theme-dark{ --_theme---heading:var(--swatch--white); … }
 * — on reproduit donc, pour chaque classe de thème, le bloc équivalent.
 *
 * Tout est best-effort : en cas d'échec on renvoie une CSS vide et les
 * templates retombent sur les valeurs de repli de leurs `var(…, fallback)`.
 * Le résultat inclut un rapport de diagnostic (voir SyncReport) pour rendre
 * les échecs partiels visibles au lieu de silencieux.
 */

/** Vue structurelle minimale d'une variable, pour éviter l'union de types. */
interface AnyVariable {
  getCSSName(): Promise<string>;
  get(options?: {
    mode?: VariableMode;
    customValues?: boolean;
  }): Promise<unknown>;
}

export interface ClassSyncReport {
  /** false si `getStyleByName` n'a pas trouvé cette classe sur le site. */
  styleFound: boolean;
  /** Nombre de collections pour lesquelles cette classe impose un mode. */
  collectionsWithMode: number;
  /** Nombre de déclarations `--x: y;` effectivement produites. */
  declarationCount: number;
}

export interface SyncReport {
  ok: boolean;
  collectionCount: number;
  /** Variables dont la lecture a échoué (nom de collection ignoré : anonyme côté API). */
  variableFailures: number;
  perClass: Record<string, ClassSyncReport>;
  /** Message d'erreur si tout l'appel a échoué (ex. API indisponible hors Designer). */
  error?: string;
}

export interface SyncResult {
  css: string;
  report: SyncReport;
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
  mode: VariableMode | undefined,
  onFailure: () => void
): Promise<string> {
  const variables = await collection.getAllVariables();
  const parts = await Promise.all(
    variables.map(async (variable) => {
      const v = variable as unknown as AnyVariable;
      try {
        const [name, raw] = await Promise.all([
          v.getCSSName(),
          v.get({ mode, customValues: true }),
        ]);
        const value = await serializeValue(raw);
        if (value === null) {
          onFailure();
          return "";
        }
        return `${name}:${value};`;
      } catch {
        onFailure();
        return "";
      }
    })
  );
  return parts.join("");
}

/**
 * Construit la feuille de style à injecter dans l'iframe d'aperçu, et un
 * rapport de diagnostic pour identifier précisément un échec partiel
 * (ex. classe de thème introuvable, collection sans mode correspondant).
 *
 * @param themeClasses classes utilitaires de thème du site à reproduire
 *                     (ex. ["u-theme-light", "u-theme-dark"]). Chacune est
 *                     lue via `getStyleByName` pour retrouver le mode
 *                     qu'elle applique.
 */
export async function buildPreviewThemeCss(
  themeClasses: string[]
): Promise<SyncResult> {
  const report: SyncReport = {
    ok: false,
    collectionCount: 0,
    variableFailures: 0,
    perClass: {},
  };
  const fail = () => {
    report.variableFailures++;
  };

  try {
    const collections = await webflow.getAllVariableCollections();
    report.collectionCount = collections.length;
    if (collections.length === 0) return { css: "", report };

    // Mode de base -> :root, ce qui couvre aussi l'option « Hériter ».
    const base = await Promise.all(
      collections.map((c) => declarationsForMode(c, undefined, fail))
    );
    let css = `:root{${base.join("")}}`;

    for (const className of themeClasses) {
      const style = await webflow.getStyleByName(className);
      const classReport: ClassSyncReport = {
        styleFound: !!style,
        collectionsWithMode: 0,
        declarationCount: 0,
      };
      report.perClass[className] = classReport;
      if (!style) continue;

      let decls = "";
      for (const collection of collections) {
        // Une classe n'impose un mode que sur certaines collections.
        const mode = await style.getVariableMode(collection);
        if (!mode) continue;
        classReport.collectionsWithMode++;
        decls += await declarationsForMode(collection, mode, fail);
      }
      classReport.declarationCount = decls.length;
      if (decls) css += `.${className}{${decls}}`;
    }

    report.ok = true;
    return { css, report };
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
    return { css: "", report };
  }
}

/** Résumé du rapport en une ligne, pour la console ou l'UI. */
export function summarizeSyncReport(report: SyncReport): string {
  if (report.error) return `échec : ${report.error}`;
  if (report.collectionCount === 0) return "aucune collection de variables trouvée";

  const classSummary = Object.entries(report.perClass)
    .map(([name, c]) =>
      c.styleFound
        ? `${name} (${c.collectionsWithMode} mode(s), ${c.declarationCount} car.)`
        : `${name} (classe introuvable)`
    )
    .join(", ");

  return `${report.collectionCount} collection(s), ${report.variableFailures} lecture(s) en échec — ${classSummary}`;
}
