import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

import {
  CardTemplate,
  TemplateField,
  renderTemplate,
  templatesForSite,
} from "./templates";
import { copyToClipboard } from "./lib/clipboard";
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

function newScopeId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string | undefined>(undefined);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, FieldValues>>({});
  const [scopes, setScopes] = useState<Record<string, string>>({});
  const [showCode, setShowCode] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const frameRef = useRef<HTMLIFrameElement>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await webflow.setExtensionSize("large");
      } catch {
        /* taille par défaut du manifest */
      }

      let info: { siteId?: string; siteName?: string } | null = null;
      try {
        info = await webflow.getSiteInfo();
      } catch (err) {
        console.warn("getSiteInfo() indisponible :", err);
      }
      if (cancelled) return;

      const list = templatesForSite(info?.siteId);
      setTemplates(list);
      setSiteId(info?.siteId ?? null);
      setSiteName(info?.siteName);

      if (list.length > 0) {
        const first = list[0];
        setCurrentId(first.id);
        setValues({ [first.id]: defaultsFor(first) });
        setScopes({ [first.id]: newScopeId() });
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const current = templates.find((t) => t.id === currentId) ?? null;

  function selectTemplate(id: string): void {
    setCurrentId(id);
    const tpl = templates.find((t) => t.id === id);
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
    return `<style>\n${built.css}\n</style>\n${built.html}`;
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

  if (!ready) return null;

  if (templates.length === 0) {
    return (
      <p className="p-8 text-center text-muted-foreground">
        {siteName
          ? `Aucun template n'est configuré pour « ${siteName} ».`
          : "Aucun template n'est configuré pour ce site."}
      </p>
    );
  }

  return (
    <div className="flex h-screen min-h-0">
      <aside className="w-68 shrink-0 overflow-y-auto border-r border-border bg-card p-5">
        {templates.length > 1 && (
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
                {templates.map((tpl) => (
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
        <p className="mt-2.5 text-[10px] break-all text-neutral-600 select-text">
          {siteId ? `siteId : ${siteId}` : "siteId indisponible"}
        </p>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto p-6">
        <p className="mb-2.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          Aperçu
        </p>
        <iframe
          ref={frameRef}
          onLoad={handleFrameLoad}
          title="Aperçu de la card"
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
