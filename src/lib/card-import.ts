/**
 * Marqueur d'import : permet de recoller un bloc déjà généré dans le
 * panneau pour le modifier, plutôt que de retaper le formulaire ou de
 * bidouiller le HTML à la main dans l'éditeur CMS.
 *
 * Le marqueur encode les valeurs *brutes* du formulaire (pas le HTML/CSS
 * rendu) dans un commentaire HTML ajouté à la fin du code généré :
 *
 *   <!--dd:eyJ0IjoiY3RhIiwidiI6eyJ0aXRsZSI6Ii4uLiJ9fQ==-->
 *
 * Importer se résume donc à décoder ce commentaire — pas besoin de
 * comprendre la structure du HTML produit, qui peut avoir changé entre
 * temps (nouveau champ, gabarit retouché…). Encodé en base64 pour ne
 * jamais casser le commentaire si un champ contient "-->".
 *
 * Ce marqueur est ajouté par App.tsx *après* renderTemplate() : il ne doit
 * jamais faire partie de block.html, où il serait retiré par stripComments()
 * comme n'importe quel commentaire de gabarit.
 */

interface ImportMarker {
  templateId: string;
  values: Record<string, string>;
}

const MARKER_RE = /<!--dd:([A-Za-z0-9+/=]+)-->/;

/** btoa/atob ne gèrent nativement que du Latin1 — passage par des octets
 * UTF-8 explicites pour supporter les accents et emoji sans corruption. */
function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function fromBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeImportMarker(
  templateId: string,
  values: Record<string, string>
): string {
  const json = JSON.stringify({ t: templateId, v: values });
  return `<!--dd:${toBase64Utf8(json)}-->`;
}

/**
 * Décode le premier marqueur trouvé dans `code`, où qu'il soit dans le
 * texte collé. Renvoie `null` si aucun marqueur, ou s'il est illisible
 * (tronqué par un copier-coller partiel, par exemple) — jamais une
 * exception : un import raté doit rester un message clair, pas un plantage.
 */
export function decodeImportMarker(code: string): ImportMarker | null {
  const match = MARKER_RE.exec(code);
  if (!match) return null;

  try {
    const json = fromBase64Utf8(match[1]);
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;

    const { t, v } = parsed as Record<string, unknown>;
    if (typeof t !== "string" || !v || typeof v !== "object") return null;

    return { templateId: t, values: v as Record<string, string> };
  } catch {
    return null;
  }
}
