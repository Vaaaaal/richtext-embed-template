/**
 * Catalogue des templates.
 *
 * Un repo = un client (voir README) : pas de filtrage par site ici, tous
 * les templates de ce catalogue sont ceux du client propriétaire du repo.
 *
 * Pour ajouter un template : voir le skill Claude "nouveau-template"
 * (.claude/skills/nouveau-template/SKILL.md), autosuffisant — pas besoin
 * qu'un template existant serve d'exemple. Sinon, à la main : créer son
 * dossier dans `src/templates/<nom>/`, l'importer ci-dessous et l'ajouter
 * à `TEMPLATES`.
 */

import { CardTemplate } from "./template-engine";
import { quoteCard } from "@/templates/quote";
import { ctaCard } from "@/templates/cta";

/**
 * Catalogue complet des templates disponibles dans le bundle.
 *
 * Chaque template est un pur objet de données (chaînes, tableaux — aucune
 * fonction) : valide en JSON. Le jour où les templates doivent venir d'une
 * source externe, il suffit de remplacer ces imports statiques par un
 * fetch() qui renvoie un tableau de la même forme ; rien d'autre dans
 * l'extension n'a besoin de changer.
 */
export const TEMPLATES: CardTemplate[] = [quoteCard, ctaCard];
