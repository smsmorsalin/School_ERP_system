import { useEffect, useRef, useState } from "react";
import {
  AppWindow,
  ImagePlus,
  Palette,
  RotateCcw,
  Save,
  School,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { usePageTitle } from "../../lib/usePageTitle";
import { useToast } from "../../context/ToastContext";
import { withEmphasis } from "../../lib/emphasis";
import { api } from "../../lib/api";
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  useSettings,
} from "../../context/SettingsContext";
import {
  Badge,
  Card,
  ErrorBanner,
  Field,
  Notice,
  PageHeader,
  SectionRule,
  Spinner,
  Toggle,
} from "../../components/ui";

const EDITABLE = [
  "school_name",
  "short_name",
  "tagline",
  "address",
  "phone",
  "email",
  "website",
  "login_headline",
  "login_subtext",
  "login_notice",
  "accent",
  "default_theme",
  "compact_tables",
];

function toForm(settings) {
  return EDITABLE.reduce((acc, key) => {
    acc[key] = settings[key] ?? DEFAULT_SETTINGS[key];
    return acc;
  }, {});
}

/** Paint the selected swatches immediately so the admin sees the result. */
function paint(settings) {
  const root = document.documentElement;
  root.setAttribute("data-accent", settings.accent || "forest");
  if (settings.compact_tables) root.setAttribute("data-density", "compact");
  else root.removeAttribute("data-density");
}

export default function SettingsPage() {
  usePageTitle("Customisation");
  const { settings, refreshSettings } = useSettings();
  const toast = useToast();
  const fileRef = useRef(null);
  const faviconRef = useRef(null);
  const saved = useRef(settings);

  const [form, setForm] = useState(() => toForm(settings));
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [faviconFile, setFaviconFile] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [removeFavicon, setRemoveFavicon] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    saved.current = settings;
    setForm(toForm(settings));
    setLogoFile(null);
    setRemoveLogo(false);
    setFaviconFile(null);
    setRemoveFavicon(false);
    setDirty(false);
  }, [settings]);

  // Live preview while editing.
  useEffect(() => {
    paint(form);
  }, [form]);

  // Leaving without saving must restore the persisted palette.
  useEffect(
    () => () => {
      paint(saved.current);
    },
    []
  );

  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview]
  );

  useEffect(
    () => () => {
      if (faviconPreview) URL.revokeObjectURL(faviconPreview);
    },
    [faviconPreview]
  );

  const set = (key) => (event) => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("The logo must be 2 MB or smaller.");
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
    setDirty(true);
  };

  const clearLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    setDirty(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const chooseFavicon = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("The favicon must be 2 MB or smaller.");
      return;
    }
    if (faviconPreview) URL.revokeObjectURL(faviconPreview);
    setFaviconFile(file);
    setFaviconPreview(URL.createObjectURL(file));
    setRemoveFavicon(false);
    setDirty(true);
  };

  const clearFavicon = () => {
    if (faviconPreview) URL.revokeObjectURL(faviconPreview);
    setFaviconFile(null);
    setFaviconPreview(null);
    setRemoveFavicon(true);
    setDirty(true);
    if (faviconRef.current) faviconRef.current.value = "";
  };

  const discard = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (faviconPreview) URL.revokeObjectURL(faviconPreview);
    setForm(toForm(settings));
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
    setFaviconFile(null);
    setFaviconPreview(null);
    setRemoveFavicon(false);
    setDirty(false);
    setError(null);
    paint(settings);
  };

  const restoreDefaults = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (faviconPreview) URL.revokeObjectURL(faviconPreview);
    setForm(toForm(DEFAULT_SETTINGS));
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    setFaviconFile(null);
    setFaviconPreview(null);
    setRemoveFavicon(true);
    setDirty(true);
    if (fileRef.current) fileRef.current.value = "";
    if (faviconRef.current) faviconRef.current.value = "";
  };

  const save = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (logoFile || removeLogo || faviconFile || removeFavicon) {
        const payload = new FormData();
        EDITABLE.forEach((key) => payload.append(key, form[key] ?? ""));
        if (logoFile) payload.append("logo", logoFile);
        if (removeLogo) payload.append("remove_logo", "true");
        if (faviconFile) payload.append("favicon", faviconFile);
        if (removeFavicon) payload.append("remove_favicon", "true");
        await api.patch("/settings/", payload);
      } else {
        await api.patch("/settings/", { ...form });
      }
      await refreshSettings();
      toast.success("Customisation saved for everyone.");
      setDirty(false);
    } catch (err) {
      setError(err);
      toast.error(err.message);
      paint(settings);
    } finally {
      setBusy(false);
    }
  };

  const shownLogo = logoPreview || (removeLogo ? null : settings.logo_url);
  const shownFavicon =
    faviconPreview || (removeFavicon ? null : settings.favicon_url);

  return (
    <form onSubmit={save}>
      <PageHeader
        title="Customisation"
        subtitle="Make the console feel like your school — identity, colour and defaults"
        actions={
          <Badge tone="green" dot>
            Admin only
          </Badge>
        }
        meta={
          settings.updated_by_name ? (
            <span className="cell-sub">
              Last saved {new Date(settings.updated_at).toLocaleString()} by{" "}
              {settings.updated_by_name}
            </span>
          ) : (
            <span className="cell-sub">Built-in defaults in use — not customised yet</span>
          )
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="settings-layout">
        <div className="settings-body">
          <Card
            title="School identity"
            subtitle="Shown on the sign-in screen, sidebar and documents"
          >
            <div className="field-row">
              <Field label="School name" required>
                <input
                  className="input"
                  value={form.school_name}
                  onChange={set("school_name")}
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Short name" hint="Sidebar label. Leave blank to use the full name.">
                <input
                  className="input"
                  value={form.short_name}
                  onChange={set("short_name")}
                  maxLength={40}
                  placeholder="e.g. GVH"
                />
              </Field>
            </div>
            <Field label="Tagline" hint="One calm line under the school name.">
              <input
                className="input"
                value={form.tagline}
                onChange={set("tagline")}
                maxLength={160}
                placeholder="Management console"
              />
            </Field>
            <div className="field-row">
              <Field label="Contact email">
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="office@school.example"
                />
              </Field>
              <Field label="Phone">
                <input
                  className="input"
                  value={form.phone}
                  onChange={set("phone")}
                  maxLength={40}
                  placeholder="+880 …"
                />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Website">
                <input
                  className="input"
                  type="url"
                  value={form.website}
                  onChange={set("website")}
                  placeholder="https://school.example"
                />
              </Field>
              <Field label="Postal address">
                <input
                  className="input"
                  value={form.address}
                  onChange={set("address")}
                  placeholder="Street, city"
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Sign-in screen"
            subtitle="The message people see before they sign in"
          >
            <Field
              label="Headline"
              hint="Wrap words in *asterisks* to tint them brass."
            >
              <input
                className="input"
                value={form.login_headline}
                onChange={set("login_headline")}
                maxLength={140}
                placeholder="Everything your school needs, *in one calm place.*"
              />
            </Field>
            <Field label="Supporting text" hint="One or two sentences under the headline.">
              <textarea
                className="textarea"
                rows={3}
                value={form.login_subtext}
                onChange={set("login_subtext")}
                maxLength={400}
                placeholder="Admissions, attendance, examinations and finance — in one place."
              />
            </Field>
            <Field
              label="Notice banner"
              hint="Optional short message shown above the sign-in form. Leave blank to hide."
            >
              <input
                className="input"
                value={form.login_notice}
                onChange={set("login_notice")}
                maxLength={200}
                placeholder="e.g. Admissions for 2026–27 are now open."
              />
            </Field>
          </Card>

          <Card
            title="Logo & favicon"
            subtitle="Your mark in the sidebar, on the sign-in screen and in the browser tab"
          >
            <div className="logo-row">
              <div className="logo-preview" aria-hidden="true">
                {shownLogo ? (
                  <img src={shownLogo} alt="" />
                ) : (
                  <School size={30} />
                )}
              </div>
              <div className="logo-copy">
                <strong>{shownLogo ? "Current logo" : "No logo uploaded"}</strong>
                <span className="cell-sub">
                  JPG, PNG or WebP · up to 2 MB · square images look best.
                </span>
                <div className="logo-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus size={14} /> {shownLogo ? "Replace" : "Upload logo"}
                  </button>
                  {shownLogo ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={clearLogo}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  ) : null}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseLogo}
                  hidden
                />
              </div>
            </div>

            <div className="settings-divider" />

            <div className="logo-row">
              <div className="logo-preview logo-preview-sm" aria-hidden="true">
                {shownFavicon ? (
                  <img src={shownFavicon} alt="" />
                ) : (
                  <AppWindow size={26} />
                )}
              </div>
              <div className="logo-copy">
                <strong>{shownFavicon ? "Current favicon" : "Default favicon"}</strong>
                <span className="cell-sub">
                  Square PNG or WebP · at least 64 × 64 px looks sharp in browser tabs.
                </span>
                <div className="logo-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => faviconRef.current?.click()}
                  >
                    <ImagePlus size={14} />{" "}
                    {shownFavicon ? "Replace" : "Upload favicon"}
                  </button>
                  {shownFavicon ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={clearFavicon}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  ) : null}
                </div>
                <input
                  ref={faviconRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseFavicon}
                  hidden
                />
              </div>
            </div>
          </Card>

          <Card
            title="Colour theme"
            subtitle="Recolours buttons, links, charts, focus rings and the sidebar"
          >
            <fieldset className="accent-fieldset">
              <legend className="sr-only">Console colour theme</legend>
              <div className="accent-grid">
                {ACCENTS.map((accent) => (
                  <label
                    key={accent.id}
                    className={`accent-card ${form.accent === accent.id ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="accent"
                      value={accent.id}
                      checked={form.accent === accent.id}
                      onChange={set("accent")}
                    />
                    <span
                      className="accent-swatch"
                      style={{ background: accent.color }}
                      aria-hidden="true"
                    />
                    <span className="accent-name">{accent.label}</span>
                    {form.accent === accent.id ? (
                      <span className="accent-check" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </fieldset>
            <Notice tone="info" icon={Palette}>
              Palettes are contrast-checked in light and dark mode, so text stays
              readable on every page.
            </Notice>
          </Card>

          <Card
            title="Console defaults"
            subtitle="A starting point for new visitors — each person's own choice still wins"
          >
            <div className="field-row">
              <Field label="Default appearance" hint="Used until someone picks light or dark themselves.">
                <select
                  className="select"
                  value={form.default_theme}
                  onChange={set("default_theme")}
                >
                  <option value="system">Match the device</option>
                  <option value="light">Light paper</option>
                  <option value="dark">Dark chalkboard</option>
                </select>
              </Field>
              <Field label="Table density" hint="Compact rows fit more records on screen.">
                <div className="density-row">
                  <Toggle
                    checked={form.compact_tables}
                    onChange={(checked) => {
                      setForm((current) => ({ ...current, compact_tables: checked }));
                      setDirty(true);
                    }}
                    label="Compact tables"
                  />
                </div>
              </Field>
            </div>
          </Card>

          <SectionRule>Preview &amp; save</SectionRule>
        </div>

        <aside className="settings-preview" aria-label="Live preview">
          <div className="preview-shell">
            <div className="preview-side">
              <span className="preview-brand">
                {form.short_name || form.school_name || "School ERP"}
              </span>
              <span className="preview-nav active">Overview</span>
              <span className="preview-nav">Students</span>
              <span className="preview-nav">Finance</span>
              <span className="preview-nav">Attendance</span>
            </div>
            <div className="preview-main">
              <div className="preview-head">
                <div>
                  <strong>{form.school_name || "School ERP"}</strong>
                  <span>{form.tagline || "Management console"}</span>
                </div>
                <span className="preview-dot" />
              </div>
              <div className="preview-actions">
                <span className="btn btn-primary btn-sm">Primary action</span>
                <span className="badge badge-green">Active</span>
              </div>
              <div className="preview-table">
                <div className="preview-row head">
                  <span>Student</span>
                  <span>Status</span>
                </div>
                <div className="preview-row">
                  <span>Amara Rahman</span>
                  <span className="preview-pill">Enrolled</span>
                </div>
                <div className="preview-row">
                  <span>Jonas Lee</span>
                  <span className="preview-pill">Enrolled</span>
                </div>
              </div>
            </div>
          </div>

          <div className="preview-login">
            <div className="preview-login-brand">
              {shownLogo ? (
                <img className="preview-login-logo" src={shownLogo} alt="" />
              ) : (
                <span className="preview-login-mark" aria-hidden="true" />
              )}
              <span>{form.short_name || form.school_name || "School ERP"}</span>
            </div>
            <strong>{withEmphasis(form.login_headline)}</strong>
            {form.login_notice ? (
              <span className="preview-login-notice">{form.login_notice}</span>
            ) : null}
          </div>

          <Notice tone="info" icon={SlidersHorizontal}>
            Changes apply to every signed-in user as soon as you save, and are
            written to the audit log with before/after values.
          </Notice>

          <div className="settings-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>
              {busy ? <Spinner size={16} light /> : <Save size={16} />}
              {busy ? "Saving…" : "Save customisation"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={discard}
              disabled={busy || !dirty}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={restoreDefaults}
              disabled={busy}
            >
              <RotateCcw size={14} /> Restore defaults
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
