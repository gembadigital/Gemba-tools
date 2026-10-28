// Presentation primitives for the CI module. The look is shared with the Kaizen Öneri module
// (2026 design: soft surfaces, 14px body, 36px+ targets, slate + brand emerald), so the primitives
// are re-exported from there; if the modules are ever packaged apart, only this file changes.
import React, { useEffect, useState } from "react";

export {
  SURFACE, Card, SectionTitle, KpiCard, Button, EmptyState, Avatar, FormField, ChoiceChip, PageHeader, TabBar,
  inputCls, areaCls, tableCls, theadCls, thCls, tdCls, trCls
} from "../kaizen/kaizenUi";
export type { Tone } from "../kaizen/kaizenUi";
export { readAndShrink } from "../kaizen/kaizenImage";

// tr-TR grouping ("1.250.000,5"). Empty for null/undefined so optional fields stay blank.
export const formatAmount = (v: number | null | undefined, maxFraction = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "" : v.toLocaleString("tr-TR", { maximumFractionDigits: maxFraction });

// "1.250.000,5" / "1250000.5" / "1 250 000" → 1250000.5; blank or unreadable → null.
export function parseAmount(text: string): number | null {
  const t = text.replace(/\s/g, "");
  if (!t) return null;
  // Comma present → Turkish style: dots group thousands, comma is the decimal mark.
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

// Number field with thousands separators (plan item B5). Shows the grouped value while not
// focused; while typing the raw text is kept so the caret doesn't jump.
export function AmountInput({ value, onChange, suffix, placeholder = "0", disabled, className = "" }: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  suffix?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(formatAmount(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(formatAmount(value)); }, [value, focused]);
  return (
    <div className={`flex items-stretch rounded-xl bg-slate-50/80 ring-1 ring-inset ring-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/40 transition-all ${disabled ? "opacity-60" : ""} ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setText(formatAmount(parseAmount(text))); }}
        onChange={(e) => { setText(e.target.value); onChange(parseAmount(e.target.value)); }}
        className="flex-1 min-w-0 h-12 px-4 bg-transparent text-sm text-slate-900 font-semibold tabular-nums placeholder:text-slate-400 focus:outline-none"
      />
      {suffix && <span className="flex items-center pr-3 text-sm font-semibold text-slate-500">{suffix}</span>}
    </div>
  );
}

// Small rounded label.
export function Pill({ children, tone = "slate", className = "" }: { children: React.ReactNode; tone?: "slate" | "emerald" | "amber" | "red" | "blue" | "violet"; className?: string }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
    red: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    violet: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
  }[tone];
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${tones} ${className}`}>{children}</span>;
}

// Downscales an image data URL (JPEG, longest edge `maxEdge`) — for pictures that leave the project
// record, e.g. the Kaizen showcase. Non-images and failures return the input unchanged.
export function shrinkDataUrl(dataUrl: string | undefined, maxEdge = 1200, quality = 0.8): Promise<string> {
  return new Promise(resolve => {
    if (!dataUrl || !dataUrl.startsWith("data:image/")) return resolve(dataUrl || "");
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}
