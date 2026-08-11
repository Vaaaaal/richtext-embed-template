/**
 * Catalogue des templates + filtrage par site.
 *
 * Pour ajouter un template : lui créer un fichier (voir quote.ts / cta.ts
 * comme exemples), l'importer ci-dessous, l'ajouter à `TEMPLATES` (et à
 * `DEFAULT_TEMPLATE_IDS` s'il doit être visible par défaut).
 */

import { CardTemplate } from "./engine";
import { quoteCard } from "./quote";
import { ctaCard } from "./cta";

/**
 * Catalogue complet des templates disponibles dans le bundle.
 *
 * Chaque template est un pur objet de données (chaînes, tableaux, nombres —
 * aucune fonction) : valide en JSON. Le jour où les templates doivent venir
 * d'une source externe, il suffit de remplacer cet import statique par un
 * fetch() qui renvoie un tableau de la même forme ; rien d'autre dans
 * l'extension n'a besoin de changer.
 */
export const TEMPLATES: CardTemplate[] = [quoteCard, ctaCard];

/** Templates servis aux sites non listés dans `templatesBySite`. */
export const DEFAULT_TEMPLATE_IDS: string[] = ["quote", "cta"];

/**
 * Templates autorisés par site, indexés par siteId (webflow.getSiteInfo()).
 * Le siteId courant est affiché en bas du panneau : ouvrir l'extension sur le
 * site, copier l'ID, ajouter l'entrée ici, republier.
 *
 * Exemple :
 *   "6512ab34cd56ef7890123456": ["quote"],   // ce site n'a que la citation
 */
export const templatesBySite: Record<string, string[]> = {
  // TODO Iskera : remplacer par le siteId réel une fois relevé dans le panneau.
  // "SITE_ID_ISKERA": ["quote", "cta"],
};

/** Résout la liste de templates à afficher pour un site donné. */
export function templatesForSite(siteId?: string | null): CardTemplate[] {
  const allowed =
    (siteId && templatesBySite[siteId]) || DEFAULT_TEMPLATE_IDS;
  return TEMPLATES.filter((t) => allowed.indexOf(t.id) !== -1);
}
