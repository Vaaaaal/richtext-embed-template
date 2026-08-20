/**
 * Catalogue des templates.
 *
 * Un repo = un client (voir README) : pas de filtrage par site ici, tous
 * les templates de ce catalogue sont ceux du client propriétaire du repo.
 *
 * Pour ajouter un template : créer son dossier dans `src/templates/<nom>/`
 * (dupliquer `quote/` est le plus rapide), l'importer ci-dessous et
 * l'ajouter à `TEMPLATES`.
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
