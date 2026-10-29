// Small form fields in the VSM setup style (same classes as the existing Kurulum inputs).
import React from "react";

const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden";

export function FieldShell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-500 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextField({ label, value, onChange, hint, placeholder, type = "text" }: {
  label: string; value?: string; onChange: (v: string) => void; hint?: string; placeholder?: string; type?: "text" | "date";
}) {
  return (
    <FieldShell label={label} hint={hint}>
      <input type={type} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={inputCls} />
    </FieldShell>
  );
}

// Empty input = not entered (undefined), a typed 0 stays 0.
export function NumberField({ label, value, onChange, hint, min = 0 }: {
  label: string; value?: number; onChange: (v: number | undefined) => void; hint?: string; min?: number;
}) {
  return (
    <FieldShell label={label} hint={hint}>
      <input
        type="number"
        min={min}
        value={value ?? ""}
        onChange={e => onChange(e.target.value.trim() === "" ? undefined : Math.max(min, Number(e.target.value)))}
        className={`${inputCls} font-mono`}
      />
    </FieldShell>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, hint, emptyLabel = "— seçiniz —" }: {
  label: string; value?: T | ""; options: { value: T; label: string }[]; onChange: (v: T | undefined) => void; hint?: string; emptyLabel?: string;
}) {
  return (
    <FieldShell label={label} hint={hint}>
      <select value={value ?? ""} onChange={e => onChange((e.target.value || undefined) as T | undefined)} className={inputCls}>
        <option value="">{emptyLabel}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  );
}

export const asOptions = (values: string[]) => values.map(v => ({ value: v, label: v }));
