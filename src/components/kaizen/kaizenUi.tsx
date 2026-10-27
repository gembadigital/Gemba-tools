import React from "react";
import { ApprovalStatus } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from "./kaizenCalc";

// Shared presentation primitives for the Kaizen Öneri module.
//
// Design rules (2026 redesign): the module fills the whole page frame (no max-w-2xl islands),
// body text is 14px (text-sm), table cells 14px, small labels never go below 12px, and every
// interactive target is at least 36px tall. Colors stay inside the Gemba Tools language:
// slate neutrals + brand emerald (#00A280) + amber for Kaizen. These primitives are
// host-agnostic (no Gemba Tools imports) so the module can later be lifted into a standalone
// package / other hosts without touching the screens.

export const BRAND = "#00A280";

export function Card({ children, className = "", padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-xs ${padded ? "p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, hint, right }: { icon?: any; title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 leading-tight">{title}</h3>
          {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

const TONES = {
  slate: { bg: "bg-slate-900", soft: "bg-slate-100 text-slate-700", ring: "text-slate-900" },
  emerald: { bg: "bg-emerald-600", soft: "bg-emerald-50 text-emerald-700", ring: "text-emerald-700" },
  red: { bg: "bg-red-500", soft: "bg-red-50 text-red-600", ring: "text-red-600" },
  amber: { bg: "bg-amber-500", soft: "bg-amber-50 text-amber-700", ring: "text-amber-600" },
  teal: { bg: "bg-teal-600", soft: "bg-teal-50 text-teal-700", ring: "text-teal-700" },
  blue: { bg: "bg-blue-600", soft: "bg-blue-50 text-blue-700", ring: "text-blue-700" }
} as const;
export type Tone = keyof typeof TONES;

export function KpiCard({ label, value, icon: Icon, tone = "slate", hint, onClick }: {
  label: string; value: React.ReactNode; icon: any; tone?: Tone; hint?: string; onClick?: () => void;
}) {
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between gap-3 ${onClick ? "cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all" : ""}`}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-3xl font-black text-slate-900 mt-1.5 tabular-nums leading-none">{value}</p>
        {hint && <p className="text-xs text-slate-500 mt-2">{hint}</p>}
      </div>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TONES[tone].soft}`}>
        <Icon className="w-5 h-5" />
      </span>
    </Wrapper>
  );
}

export function StatusBadge({ status }: { status: ApprovalStatus }) {
  const color = APPROVAL_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ backgroundColor: `${color}1f`, color: status === "Pending" ? "#a16207" : color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {APPROVAL_STATUS_LABELS[status]}
    </span>
  );
}

export function Button({ children, variant = "primary", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "brand" | "danger" }) {
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    brand: "bg-emerald-700 text-white hover:bg-emerald-600",
    danger: "bg-red-600 text-white hover:bg-red-500",
    ghost: "bg-slate-100 text-slate-700 hover:bg-slate-200"
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500">
      <span className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><Icon className="w-6 h-6 text-slate-400" /></span>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {text && <p className="text-sm mt-1 max-w-sm">{text}</p>}
    </div>
  );
}

// Table helpers — one consistent density across every screen.
export const tableCls = "w-full text-sm";
export const theadCls = "text-left text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200";
export const thCls = "py-3 px-4 font-semibold";
export const tdCls = "py-3.5 px-4 text-slate-700";
export const trCls = "border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors";
