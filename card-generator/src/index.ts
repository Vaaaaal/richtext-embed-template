import {
  CardTemplate,
  TemplateField,
  renderTemplate,
  templatesForSite,
} from "./templates.js";

/* ------------------------------------------------------------------ */
/* État                                                                */
/* ------------------------------------------------------------------ */

interface State {
  templates: CardTemplate[];
  current: CardTemplate | null;
  /** Valeurs du formulaire, par templateId puis fieldId. */
  values: Record<string, Record<string, string>>;
  /** Suffixe de classe unique, par templateId. */
  scopes: Record<string, string>;
  showCode: boolean;
}

const state: State = {
  templates: [],
  current: null,
  values: {},
  scopes: {},
  showCode: false,
};

const $ = (id: string) => document.getElementById(id) as HTMLElement;

function newScopeId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function rootClass(tpl: CardTemplate): string {
  return `dd-${tpl.id}-${state.scopes[tpl.id]}`;
}

function currentValues(): Record<string, string> {
  return state.values[state.current!.id];
}

/* ------------------------------------------------------------------ */
/* Construction du formulaire                                          */
/* ------------------------------------------------------------------ */

function buildTemplatePicker(): void {
  const wrap = $("template-picker-wrap");
  const picker = $("template-picker") as HTMLSelectElement;
  picker.innerHTML = "";

  state.templates.forEach((tpl) => {
    const opt = document.createElement("option");
    opt.value = tpl.id;
    opt.textContent = tpl.label;
    picker.appendChild(opt);
  });

  picker.value = state.current!.id;
  picker.onchange = () => {
    const tpl = state.templates.find((t) => t.id === picker.value);
    if (tpl) selectTemplate(tpl);
  };

  wrap.style.display = state.templates.length > 1 ? "block" : "none";
}

function buildField(field: TemplateField): HTMLElement {
  const values = currentValues();
  const wrap = document.createElement("div");
  wrap.className = "field";

  const label = document.createElement("label");
  label.textContent = field.label;
  label.htmlFor = `f-${field.id}`;
  wrap.appendChild(label);

  if (field.type === "segmented") {
    const seg = document.createElement("div");
    seg.className = "seg";
    (field.options || []).forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = opt.label;
      b.className = values[field.id] === opt.value ? "is-active" : "";
      b.onclick = () => {
        values[field.id] = opt.value;
        Array.prototype.forEach.call(seg.children, (child: HTMLElement) =>
          child.classList.remove("is-active")
        );
        b.classList.add("is-active");
        render();
      };
      seg.appendChild(b);
    });
    wrap.appendChild(seg);
    return wrap;
  }

  const input =
    field.type === "textarea"
      ? document.createElement("textarea")
      : document.createElement("input");

  input.id = `f-${field.id}`;
  if (input instanceof HTMLInputElement) {
    input.type = field.type === "url" ? "url" : "text";
  }
  if (field.placeholder) input.placeholder = field.placeholder;
  input.value = values[field.id] ?? "";
  input.addEventListener("input", () => {
    values[field.id] = input.value;
    render();
  });

  wrap.appendChild(input);
  return wrap;
}

function buildForm(): void {
  const form = $("form-fields");
  form.innerHTML = "";
  state.current!.fields.forEach((f) => form.appendChild(buildField(f)));
}

/* ------------------------------------------------------------------ */
/* Génération du code + aperçu                                         */
/* ------------------------------------------------------------------ */

function generateCode(): string {
  const tpl = state.current!;
  const built = renderTemplate(tpl, currentValues(), rootClass(tpl));
  return `<style>\n${built.css}\n</style>\n${built.html}`;
}

function renderPreview(code: string): void {
  const frame = $("preview-frame") as HTMLIFrameElement;
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;}body{padding:16px;background:#fff;}</style>
</head><body>${code}</body></html>`;
}

function autoSizePreview(): void {
  const frame = $("preview-frame") as HTMLIFrameElement;
  const doc = frame.contentDocument;
  if (!doc || !doc.body) return;
  frame.style.height = doc.body.scrollHeight + "px";
}

function render(): void {
  const code = generateCode();
  renderPreview(code);
  ($("code-output") as HTMLTextAreaElement).value = code;
}

/* ------------------------------------------------------------------ */
/* Sélection de template                                               */
/* ------------------------------------------------------------------ */

function selectTemplate(tpl: CardTemplate): void {
  state.current = tpl;

  if (!state.values[tpl.id]) {
    const defaults: Record<string, string> = {};
    tpl.fields.forEach((f) => (defaults[f.id] = f.default));
    state.values[tpl.id] = defaults;
  }
  if (!state.scopes[tpl.id]) state.scopes[tpl.id] = newScopeId();

  buildTemplatePicker();
  buildForm();
  render();
}

/* ------------------------------------------------------------------ */
/* Copie presse-papier                                                 */
/* ------------------------------------------------------------------ */

/**
 * L'extension tourne dans une iframe du Designer : navigator.clipboard peut
 * être bloqué par la permissions policy. On retombe alors sur execCommand,
 * puis en dernier recours sur une sélection manuelle.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* on tente le fallback ci-dessous */
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

function flashCopyButton(label: string, ok: boolean): void {
  const btn = $("copy-btn");
  const labelEl = btn.querySelector<HTMLElement>(".copy-btn__label");
  const original = "Copier le code";
  if (labelEl) labelEl.textContent = label;
  btn.classList.toggle("is-copied", ok);
  btn.classList.toggle("is-error", !ok);
  window.setTimeout(() => {
    if (labelEl) labelEl.textContent = original;
    btn.classList.remove("is-copied", "is-error");
  }, 1800);
}

async function handleCopy(): Promise<void> {
  const code = generateCode();
  const ok = await copyToClipboard(code);

  if (ok) {
    // Nouveau suffixe pour que la prochaine card copiée ait ses propres
    // classes : deux cards du même template peuvent cohabiter sur une page.
    state.scopes[state.current!.id] = newScopeId();
    render();
    flashCopyButton("Copié !", true);
  } else {
    setCodeVisible(true);
    const out = $("code-output") as HTMLTextAreaElement;
    out.focus();
    out.select();
    flashCopyButton("Copie manuelle (⌘C)", false);
  }
}

/* ------------------------------------------------------------------ */
/* Affichage du code                                                   */
/* ------------------------------------------------------------------ */

function setCodeVisible(visible: boolean): void {
  state.showCode = visible;
  $("code-panel").classList.toggle("is-open", visible);
  const toggle = $("toggle-code");
  toggle.classList.toggle("is-open", visible);
  toggle.textContent = visible ? "Masquer le code" : "Afficher le code";
}

/* ------------------------------------------------------------------ */
/* Amorçage                                                            */
/* ------------------------------------------------------------------ */

async function getSiteInfoSafe(): Promise<{
  siteId?: string;
  siteName?: string;
} | null> {
  try {
    return await webflow.getSiteInfo();
  } catch (err) {
    console.warn("getSiteInfo() indisponible :", err);
    return null;
  }
}

function showEmptyState(siteName?: string): void {
  $("app").style.display = "none";
  const empty = $("empty-state");
  empty.style.display = "block";
  empty.textContent = siteName
    ? `Aucun template n'est configuré pour « ${siteName} ».`
    : "Aucun template n'est configuré pour ce site.";
}

async function init(): Promise<void> {
  try {
    await webflow.setExtensionSize("large");
  } catch {
    /* taille par défaut du manifest */
  }

  const info = await getSiteInfoSafe();
  const siteId = info?.siteId;

  $("site-id").textContent = siteId ? `siteId : ${siteId}` : "siteId indisponible";

  state.templates = templatesForSite(siteId);
  if (state.templates.length === 0) {
    showEmptyState(info?.siteName);
    return;
  }

  ($("preview-frame") as HTMLIFrameElement).addEventListener(
    "load",
    autoSizePreview
  );
  $("copy-btn").onclick = handleCopy;
  $("toggle-code").onclick = () => setCodeVisible(!state.showCode);

  selectTemplate(state.templates[0]);
}

void init();
