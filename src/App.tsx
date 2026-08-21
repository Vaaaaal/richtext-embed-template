import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Upload } from "lucide-react";

import {
  CardTemplate,
  TemplateField,
  renderTemplate,
} from "./lib/template-engine";
import { TEMPLATES } from "./lib/template-registry";
import { copyToClipboard } from "./lib/clipboard";
import { decodeImportMarker, encodeImportMarker } from "./lib/card-import";
import { cn } from "./lib/utils";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";

type FieldValues = Record<string, string>;
type CopyState = "idle" | "copied" | "error";

function defaultsFor(tpl: CardTemplate): FieldValues {
  const defaults: FieldValues = {};
  tpl.fields.forEach((f) => (defaults[f.id] = f.default));
  return defaults;
}

/**
 * Ne garde, parmi des valeurs importées, que celles correspondant à un champ
 * réellement déclaré sur `tpl`. Sert à la fois à ignorer les champs
 * supprimés/renommés depuis la génération de la card importée (pas
 * d'erreur, juste retombe sur leur défaut), et à ne jamais copier une clé
 * arbitraire venue d'un JSON externe vers l'état — notamment "__proto__",
 * qu'un simple spread de l'objet entier propagerait.
 */
function pickKnownFields(
  tpl: CardTemplate,
  raw: Record<string, string>
): FieldValues {
  const picked: FieldValues = {};
  for (const field of tpl.fields) {
    const value = raw[field.id];
    if (typeof value === "string") picked[field.id] = value;
  }
  return picked;
}

function newScopeId(): string {
  return Math.random().toString(36).slice(2, 8);
}

const firstTemplate = TEMPLATES[0] as CardTemplate | undefined;

export default function App() {
  const [currentId, setCurrentId] = useState<string | null>(firstTemplate?.id ?? null);
  const [values, setValues] = useState<Record<string, FieldValues>>(() =>
    firstTemplate ? { [firstTemplate.id]: defaultsFor(firstTemplate) } : {}
  );
  const [scopes, setScopes] = useState<Record<string, string>>(() =>
    firstTemplate ? { [firstTemplate.id]: newScopeId() } : {}
  );
  const [showCode, setShowCode] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      try {
        await webflow.setExtensionSize("large");
      } catch {
        /* taille par défaut du manifest, ou webflow indisponible (hors Designer) */
      }
    })();
  }, []);

  const current = TEMPLATES.find((t) => t.id === currentId) ?? null;

  function selectTemplate(id: string): void {
    setCurrentId(id);
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setValues((v) => (v[id] ? v : { ...v, [id]: defaultsFor(tpl) }));
    setScopes((s) => (s[id] ? s : { ...s, [id]: newScopeId() }));
  }

  function setFieldValue(fieldId: string, value: string): void {
    if (!current) return;
    setValues((v) => ({
      ...v,
      [current.id]: { ...v[current.id], [fieldId]: value },
    }));
  }

  const code = useMemo(() => {
    if (!current) return "";
    const vals = values[current.id] ?? {};
    const cls = `dd-${current.id}-${scopes[current.id] ?? ""}`;
    const built = renderTemplate(current, vals, cls);
    // current.js n'est jamais passé par renderTemplate() : il ne contient
    // aucun placeholder à substituer, c'est un texte figé (voir
    // lib/template-engine.ts).
    const script = current.js ? `\n<script>\n${current.js}\n</script>` : "";
    // Marqueur d'import : permet de recoller ce code plus tard dans le
    // panneau pour le modifier (voir lib/card-import.ts). Toujours ajouté
    // après le rendu, jamais dans les gabarits eux-mêmes.
    const marker = encodeImportMarker(current.id, vals);
    return `<style>\n${built.css}\n</style>\n${built.html}${script}\n${marker}`;
  }, [current, values, scopes]);

  function handleFrameLoad(): void {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body && frameRef.current) {
      frameRef.current.style.height = `${doc.body.scrollHeight}px`;
    }
  }

  async function handleCopy(): Promise<void> {
    const ok = await copyToClipboard(code);
    window.clearTimeout(copyTimeout.current);

    if (ok && current) {
      // Nouveau suffixe pour que la prochaine card copiée ait ses propres
      // classes : deux cards du même template peuvent cohabiter sur une page.
      setScopes((s) => ({ ...s, [current.id]: newScopeId() }));
      setCopyState("copied");
    } else {
      setShowCode(true);
      setCopyState("error");
    }
    copyTimeout.current = setTimeout(() => setCopyState("idle"), 1800);
  }

  function handleImport(): void {
    const marker = decodeImportMarker(importText);
    if (!marker) {
      setImportError("Aucun bloc reconnu dans ce code.");
      return;
    }

    const tpl = TEMPLATES.find((t) => t.id === marker.templateId);
    if (!tpl) {
      setImportError(`Template "${marker.templateId}" introuvable ici.`);
      return;
    }

    const merged = { ...defaultsFor(tpl), ...pickKnownFields(tpl, marker.values) };
    setCurrentId(tpl.id);
    setValues((v) => ({ ...v, [tpl.id]: merged }));
    // Nouveau suffixe : l'import démarre une nouvelle instance éditable,
    // pas une reprise en main de la card déjà collée ailleurs.
    setScopes((s) => ({ ...s, [tpl.id]: newScopeId() }));

    setImportOpen(false);
    setImportText("");
    setImportError(null);
  }

  return (
    <div className="flex h-screen min-h-0">
      <aside className="w-68 shrink-0 overflow-y-auto border-r border-border bg-card p-5">
        <div className="mb-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              setImportOpen((v) => !v);
              setImportError(null);
            }}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <Upload className="size-3" />
            Importer un bloc existant
          </button>

          {importOpen && (
            <div className="space-y-2 rounded-lg border border-border bg-input/20 p-2.5">
              <Textarea
                autoFocus
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError(null);
                }}
                placeholder="Colle ici un code précédemment copié…"
                className="h-20 bg-transparent font-mono text-[11px]"
              />
              {importError && (
                <p className="text-[11px] text-destructive">{importError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  onClick={handleImport}
                  disabled={!importText.trim()}
                >
                  Charger
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setImportOpen(false);
                    setImportText("");
                    setImportError(null);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>

        {TEMPLATES.length > 1 && (
          <div className="mb-4.5 space-y-1.5 border-b border-border pb-4">
            <Label
              htmlFor="template-picker"
              className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Template
            </Label>
            <Select value={currentId ?? undefined} onValueChange={selectTemplate}>
              <SelectTrigger id="template-picker" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {current && (
          <div className="space-y-3.5">
            {current.fields.map((field) => (
              <FieldControl
                key={field.id}
                field={field}
                value={values[current.id]?.[field.id] ?? field.default}
                onChange={(v) => setFieldValue(field.id, v)}
              />
            ))}
          </div>
        )}

        <Button
          onClick={() => void handleCopy()}
          variant={copyState === "error" ? "destructive" : "default"}
          className={cn(
            "mt-5.5 w-full",
            copyState === "copied" && "bg-[#2fbf71] text-white hover:bg-[#2fbf71]/90"
          )}
        >
          {copyState === "copied" ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copyState === "copied"
            ? "Copié !"
            : copyState === "error"
              ? "Copie manuelle (⌘C)"
              : "Copier le code"}
        </Button>

        <Button
          variant="link"
          className="mt-2.5 w-full text-muted-foreground"
          onClick={() => setShowCode((v) => !v)}
        >
          {showCode ? "Masquer le code" : "Afficher le code"}
          <ChevronDown
            className={cn("size-3 transition-transform", showCode && "rotate-180")}
          />
        </Button>

        <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          Le code copié est autonome (styles isolés dans une balise
          &lt;style&gt; préfixée) : colle-le dans un élément Embed ou dans un
          champ Rich Text du CMS.
        </p>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto p-6">
        <p className="mb-2.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          Aperçu
        </p>
        <iframe
          ref={frameRef}
          onLoad={handleFrameLoad}
          title="Aperçu du bloc"
          className="block w-full rounded-xl border border-white/6 bg-white shadow-[0_1px_2px_rgba(0,0,0,.3),0_16px_32px_rgba(0,0,0,.3)]"
          style={{ height: 240 }}
          srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;}body{padding:16px;background:#fff;}</style></head><body>${code}</body></html>`}
        />

        {showCode && (
          <div className="mt-7">
            <p className="mb-2.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Code généré
            </p>
            <Textarea
              readOnly
              spellCheck={false}
              value={code}
              className="h-45 resize-y bg-[#161616] font-mono text-[11px] leading-relaxed text-[#c9d4dc]"
            />
          </div>
        )}
      </main>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (value: string) => void;
}) {
  const labelEl = (
    <Label
      htmlFor={`f-${field.id}`}
      className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase"
    >
      {field.label}
    </Label>
  );

  if (field.type === "segmented") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <ToggleGroup
          type="single"
          value={value}
          onValueChange={(v) => {
            if (v) onChange(v);
          }}
          className="w-full rounded-lg border border-input bg-input/20 p-0.5"
        >
          {(field.options ?? []).map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={`f-${field.id}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <Textarea
          id={`f-${field.id}`}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-16"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {labelEl}
      <Input
        id={`f-${field.id}`}
        type={field.type === "url" ? "url" : "text"}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
