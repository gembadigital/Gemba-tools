import React, { useState, useMemo } from "react";
import { Plus, Trash2, Users, Star, Search, Pencil, X, Save, IdCard, Download, Upload, SlidersHorizontal, Coins, Clock, ListChecks, Gift, GitBranch } from "lucide-react";
import { KaizenPersonnel, KaizenCriteria } from "./kaizenTypes";
import { buildOrg, subordinateIds, managerChain } from "../../utils/kaizenOrg";
import KaizenPersonnelImport, { exportPersonnel, downloadPersonnelTemplate } from "./KaizenPersonnelImport";
import type { KaizenApi } from "./KaizenSuggestionSystem";
import { Card, SectionTitle, Button, EmptyState, PageHeader, TabBar, Avatar, inputCls, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";
import { KaizenSettings, KNOWN_CURRENCIES, IN_KIND_CURRENCY, normalizeKaizenSettings, DEFAULT_KAIZEN_SETTINGS, MAX_OPTIONS, MAX_OPTION_LENGTH } from "../../utils/kaizenSettings";

interface Crud<T> {
  save: (record: Partial<T> & { id?: string }) => Promise<any>;
  remove: (id: string) => Promise<any>;
}

interface Props {
  personnel: KaizenPersonnel[];
  criteria: KaizenCriteria[];
  personnelCrud: Crud<KaizenPersonnel>;
  criteriaCrud: Crud<KaizenCriteria>;
  settings: KaizenSettings;
  onSaveSettings: (s: KaizenSettings) => Promise<any>;
  onPersonnelChanged: () => void;
  canGrantBoardAdmin: boolean; // only Gemba staff may grant/revoke Kurul Yöneticisi
  api: KaizenApi;
  showToast: (m: string) => void;
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>{children}</div>;
}

export default function KaizenSetup({ personnel, criteria, personnelCrud, criteriaCrud, settings, onSaveSettings, onPersonnelChanged, canGrantBoardAdmin, api, showToast }: Props) {
  const [tab, setTab] = useState<"personnel" | "criteria" | "settings">("personnel");
  return (
    <div className="space-y-6">
      <PageHeader title="Kurulum" subtitle="Personel ve amir ilişkileri, Kurul puan kriterleri ve bu müşteriye özel ayarlar." />
      <TabBar<"personnel" | "criteria" | "settings">
        tabs={[
          { key: "personnel", label: "Personel", icon: Users, count: personnel.length },
          { key: "criteria", label: "Değerlendirme kriterleri", icon: Star, count: criteria.length },
          { key: "settings", label: "Ayarlar", icon: SlidersHorizontal }
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "personnel" && <PersonnelTab personnel={personnel} personnelCrud={personnelCrud} onChanged={onPersonnelChanged} canGrantBoardAdmin={canGrantBoardAdmin} api={api} showToast={showToast} />}
      {tab === "criteria" && <CriteriaTab criteria={criteria} criteriaCrud={criteriaCrud} baseCurrency={settings.baseCurrency} />}
      {tab === "settings" && <SettingsTab settings={settings} onSave={onSaveSettings} />}
    </div>
  );
}

const blankPersonnel: Partial<KaizenPersonnel> = {
  employeeNo: "", name: "", email: "", department: "", jobTitle: "", shift: "", managerId: "",
  machineLeaderName: "", machineLeaderEmail: "", isBoardMember: false
};

// Personel listesi (Faz 3.1): sicil no is the identity; the supervisor is picked from the roster
// (no more typing a name + e-mail), which gives an unlimited-depth hierarchy.
function PersonnelTab({ personnel, personnelCrud, onChanged, canGrantBoardAdmin, api, showToast }: { personnel: KaizenPersonnel[]; personnelCrud: Crud<KaizenPersonnel>; onChanged: () => void; canGrantBoardAdmin: boolean; api: KaizenApi; showToast: (m: string) => void }) {
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<Partial<KaizenPersonnel> | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const org = useMemo(() => buildOrg(personnel), [personnel]);
  const byId = useMemo(() => new Map(personnel.map(p => [p.id, p])), [personnel]);
  const missingNo = personnel.filter(p => !p.employeeNo).length;

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return personnel
      .filter(p => !q || `${p.employeeNo || ""} ${p.name} ${p.email} ${p.department} ${p.jobTitle} ${byId.get(org.managerOf.get(p.id) || "")?.name || ""}`.toLocaleLowerCase("tr").includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [personnel, query, org, byId]);

  const set = (k: keyof KaizenPersonnel, v: any) => setForm(f => ({ ...(f || {}), [k]: v }));
  const open = (p: KaizenPersonnel) => setForm({ ...p, managerId: p.managerId ?? org.managerOf.get(p.id) ?? "" });

  // Supervisor choices: anyone except the person and their own team (that would make a loop).
  const managerOptions = useMemo(() => {
    if (!form) return [];
    const blocked = form.id ? subordinateIds(form.id, org) : new Set<string>();
    return personnel.filter(p => p.id !== form.id && !blocked.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [form?.id, personnel, org]);
  const legacyUnmatched = !!form && !form.managerId && !!form.teamLeaderEmail && !personnel.some(p => (p.email || "").toLowerCase() === (form.teamLeaderEmail || "").toLowerCase());

  const canSave = !!form?.name?.trim() && !!form?.employeeNo?.trim();

  const save = async () => {
    if (!form || !canSave) return;
    setSaving(true);
    const res = await personnelCrud.save(form);
    setSaving(false);
    if (res?.success) { setForm(null); onChanged(); }
  };
  const remove = async (p: KaizenPersonnel) => {
    if (!window.confirm(`"${p.name}" kaydını silmek istediğinizden emin misiniz?`)) return;
    const res = await personnelCrud.remove(p.id);
    if (res?.success && form?.id === p.id) setForm(null);
  };

  return (
    <div className="space-y-4">
      {missingNo > 0 && (
        <p className="text-sm bg-amber-50 text-amber-800 ring-1 ring-amber-200/70 rounded-xl px-4 py-3 flex gap-2.5">
          <IdCard className="w-4 h-4 shrink-0 mt-0.5" />{missingNo} personelin sicil no'su eksik. Kayıt düzenlenirken sicil no girilmesi zorunludur.
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card padded={false} className="xl:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Sicil, ad, bölüm veya amir ara…" className={`${inputCls} !h-11 !pl-10`} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => (personnel.length ? exportPersonnel(personnel) : downloadPersonnelTemplate())} title={personnel.length ? "Mevcut listeyi şablon biçiminde indir; düzenleyip geri yükleyebilirsiniz" : "Boş şablonu indir"}><Download className="w-4 h-4" />{personnel.length ? "Excel'e aktar" : "Şablon"}</Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4" />Excel'den yükle</Button>
              <Button variant="primary" onClick={() => setForm({ ...blankPersonnel })}><Plus className="w-4 h-4" />Personel ekle</Button>
            </div>
          </div>
          {list.length === 0 ? <EmptyState icon={Users} title="Personel bulunamadı" text="Personel ekleyerek sicil no, amir ve Kurul üyeliği ilişkilerini tanımlayın." /> : (
            <div className="overflow-x-auto max-h-[70vh]">
              <table className={tableCls}>
                <thead className={`${theadCls} sticky top-0`}><tr><th className={thCls}>Sicil</th><th className={thCls}>Ad Soyad</th><th className={thCls}>Bölüm / Görev</th><th className={thCls}>Amir</th><th className={`${thCls} text-right`}>Ekip</th><th className={thCls}>Rol</th><th className={thCls}></th></tr></thead>
                <tbody>{list.map(p => {
                  const manager = byId.get(org.managerOf.get(p.id) || "");
                  const direct = (org.reportsOf.get(p.id) || []).length;
                  const total = direct ? subordinateIds(p.id, org).size : 0;
                  return (
                    <tr key={p.id} className={`${trCls} cursor-pointer ${form?.id === p.id ? "bg-emerald-50/60" : ""}`} onClick={() => open(p)}>
                      <td className={`${tdCls} font-mono text-xs`}>{p.employeeNo || <span className="font-sans font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">eksik</span>}</td>
                      <td className={tdCls}><div className="flex items-center gap-3"><Avatar name={p.name} size="sm" /><div className="min-w-0"><p className="font-semibold text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.email || "e-posta yok"}</p></div></div></td>
                      <td className={tdCls}>{p.department || "—"}<span className="text-slate-400"> · {p.jobTitle || "—"}</span></td>
                      <td className={tdCls}>{manager ? manager.name : p.teamLeaderName ? <span className="text-amber-700" title="Eski kayıt: amir listede bulunamadı">{p.teamLeaderName} ⚠</span> : "—"}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{direct ? <span title={`${direct} doğrudan, ${total} toplam`}><b className="text-slate-900">{direct}</b>{total > direct && <span className="text-slate-400"> / {total}</span>}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className={tdCls}><RoleChip person={p} isManager={direct > 0} /></td>
                      <td className={`${tdCls} text-right whitespace-nowrap`}>
                        <button className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" title="Düzenle"><Pencil className="w-4 h-4" /></button>
                        <button onClick={e => { e.stopPropagation(); remove(p); }} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer" title="Sil"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </Card>

        {importOpen && <KaizenPersonnelImport api={api} showToast={showToast} onDone={onChanged} onClose={() => setImportOpen(false)} />}
        <Card className="xl:sticky xl:top-20">
          {!form ? (
            <EmptyState icon={Pencil} title="Bir kayıt seçin veya yeni ekleyin" text="Seçtiğiniz personelin bilgileri burada düzenlenir." />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h3 className="text-base font-bold text-slate-900">{form.id ? "Personeli düzenle" : "Yeni personel"}</h3><button onClick={() => setForm(null)} aria-label="Kapat" className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                <Field label="Sicil no *"><input value={form.employeeNo || ""} onChange={e => set("employeeNo", e.target.value)} className={`${inputCls} font-mono uppercase`} placeholder="Örn. 10452" /></Field>
                <Field label="Ad soyad *"><input value={form.name || ""} onChange={e => set("name", e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="E-posta"><input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} className={inputCls} placeholder="Sisteme giriş yapacaksa gerekli" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bölüm"><input value={form.department || ""} onChange={e => set("department", e.target.value)} className={inputCls} /></Field>
                <Field label="Görev"><input value={form.jobTitle || ""} onChange={e => set("jobTitle", e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Vardiya"><input value={form.shift || ""} onChange={e => set("shift", e.target.value)} className={inputCls} /></Field>
              <Field label="Amir (1. derece)">
                <select value={form.managerId || ""} onChange={e => set("managerId", e.target.value)} className={inputCls}>
                  <option value="">Amiri yok (en üst kademe)</option>
                  {managerOptions.map(p => <option key={p.id} value={p.id}>{p.name}{p.employeeNo ? ` · ${p.employeeNo}` : ""}{p.department ? ` — ${p.department}` : ""}</option>)}
                </select>
                {legacyUnmatched && <p className="text-xs text-amber-700 mt-1.5">Eski kayıtta amir "{form.teamLeaderName || form.teamLeaderEmail}" ({form.teamLeaderEmail}) listede yok; listeden seçin.</p>}
                {form.managerId && (() => {
                  const chain = [form.managerId, ...managerChain(form.managerId, org)].map(id => byId.get(id)?.name).filter(Boolean);
                  return chain.length > 1 ? <p className="text-xs text-slate-500 mt-1.5">Kademe: {chain.join(" → ")}</p> : null;
                })()}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Makine lideri"><input value={form.machineLeaderName || ""} onChange={e => set("machineLeaderName", e.target.value)} className={inputCls} /></Field>
                <Field label="Makine lideri e-posta"><input value={form.machineLeaderEmail || ""} onChange={e => set("machineLeaderEmail", e.target.value)} className={inputCls} /></Field>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">Kaizen rolü</p>
                <label className={`flex items-start gap-3 rounded-xl p-3.5 ${form.isBoardAdmin ? "ring-1 ring-slate-200 opacity-60" : "cursor-pointer"} ${form.isBoardMember && !form.isBoardAdmin ? "ring-2 ring-amber-400 bg-amber-50" : "ring-1 ring-slate-200"}`}>
                  <input type="checkbox" className="w-4 h-4 mt-0.5 accent-amber-600" disabled={!!form.isBoardAdmin} checked={!!form.isBoardMember || !!form.isBoardAdmin} onChange={e => set("isBoardMember", e.target.checked)} />
                  <span><span className="block text-sm font-bold text-slate-800">Kurul üyesi</span><span className="block text-xs text-slate-500 mt-0.5">Kurul değerlendirmesi, yaygınlaştırma/ödül takibi ve tüm önerileri görme.</span></span>
                </label>
                <label className={`flex items-start gap-3 rounded-xl p-3.5 ${canGrantBoardAdmin ? "cursor-pointer" : "opacity-70"} ${form.isBoardAdmin ? "ring-2 ring-violet-400 bg-violet-50" : "ring-1 ring-slate-200"}`}>
                  <input type="checkbox" className="w-4 h-4 mt-0.5 accent-violet-600" disabled={!canGrantBoardAdmin} checked={!!form.isBoardAdmin} onChange={e => set("isBoardAdmin", e.target.checked)} />
                  <span><span className="block text-sm font-bold text-slate-800">Kurul Yöneticisi</span><span className="block text-xs text-slate-500 mt-0.5">Kaizen modülünde tam yetki: Kurulum, Ayarlar, personel ve kriterler, her karar aşaması.{!canGrantBoardAdmin && " Yalnızca Gemba danışmanı atayabilir."}</span></span>
                </label>
                <p className="text-xs text-slate-500">Amir rolü otomatik: başkalarının amiri olarak seçilen kişi ekibinin önerilerini görür ve 1. derece onay verir.</p>
              </div>
              <Button variant="brand" onClick={save} disabled={!canSave || saving} className="w-full h-11"><Save className="w-4 h-4" />{saving ? "Kaydediliyor…" : form.id ? "Güncelle" : "Ekle"}</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const blankCriteria: Partial<KaizenCriteria> = { criteria: "", description: "", point: 0, category: "", minIncome: 0, maxIncome: 0 };

function CriteriaTab({ criteria, criteriaCrud, baseCurrency }: { criteria: KaizenCriteria[]; criteriaCrud: Crud<KaizenCriteria>; baseCurrency: string }) {
  const [form, setForm] = useState<Partial<KaizenCriteria> | null>(null);
  const [saving, setSaving] = useState(false);
  const sorted = useMemo(() => [...criteria].sort((a, b) => a.point - b.point), [criteria]);
  const set = (k: keyof KaizenCriteria, v: any) => setForm(f => ({ ...(f || {}), [k]: v }));

  const save = async () => {
    if (!form?.criteria?.trim()) return;
    setSaving(true);
    const res = await criteriaCrud.save(form);
    setSaving(false);
    if (res?.success) setForm(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-500">Kurul, önerileri bu kademelere göre puanlar. Gelir aralığı, değerlendirme ekranında kademe önerisi için kullanılır.</p>
          <Button variant="primary" onClick={() => setForm({ ...blankCriteria })}><Plus className="w-4 h-4" />Kriter Ekle</Button>
        </div>
        {sorted.length === 0 ? <Card><EmptyState icon={Star} title="Henüz kriter yok" text="D / C / B / A / A+ gibi puan kademelerini tanımlayın." /></Card> : sorted.map(c => (
          <Card key={c.id} className="flex items-center gap-5 !p-4 cursor-pointer hover:border-slate-300" >
            <div onClick={() => setForm(c)} className="flex items-center gap-5 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0"><span className="text-lg font-black leading-none">{c.point}</span><span className="text-[11px] opacity-70 mt-0.5">puan</span></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{c.category ? <span className="text-amber-600">{c.category} · </span> : null}{c.criteria}</p>
                {c.description && <p className="text-sm text-slate-500 mt-0.5">{c.description}</p>}
              </div>
              <p className="text-sm font-semibold text-slate-600 tabular-nums whitespace-nowrap hidden md:block">{c.minIncome.toLocaleString("tr-TR")} – {c.maxIncome ? c.maxIncome.toLocaleString("tr-TR") : "∞"} {baseCurrency}</p>
            </div>
            <button onClick={() => { if (window.confirm(`"${c.criteria}" kriterini silmek istediğinizden emin misiniz?`)) criteriaCrud.remove(c.id); }} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer shrink-0" title="Sil"><Trash2 className="w-4 h-4" /></button>
          </Card>
        ))}
      </div>

      <Card className="xl:sticky xl:top-2">
        {!form ? <EmptyState icon={Pencil} title="Bir kriter seçin veya yeni ekleyin" /> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-black text-slate-900">{form.id ? "Kriteri Düzenle" : "Yeni Kriter"}</h3><button onClick={() => setForm(null)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button></div>
            <Field label="Kriter adı *"><input value={form.criteria || ""} onChange={e => set("criteria", e.target.value)} className={inputCls} placeholder="Örn. Hızlı uygulama / minimum yatırım" /></Field>
            <Field label="Açıklama"><textarea value={form.description || ""} onChange={e => set("description", e.target.value)} rows={3} className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Puan"><input type="number" value={form.point ?? 0} onChange={e => set("point", Number(e.target.value))} className={inputCls} /></Field>
              <Field label="Seviye (D, C, B…)"><input value={form.category || ""} onChange={e => set("category", e.target.value)} className={inputCls} /></Field>
              <Field label={`Min. gelir (${baseCurrency})`}><input type="number" value={form.minIncome ?? 0} onChange={e => set("minIncome", Number(e.target.value))} className={inputCls} /></Field>
              <Field label={`Maks. gelir (${baseCurrency}, 0 = sınırsız)`}><input type="number" value={form.maxIncome ?? 0} onChange={e => set("maxIncome", Number(e.target.value))} className={inputCls} /></Field>
            </div>
            <Button variant="brand" onClick={save} disabled={!form.criteria?.trim() || saving} className="w-full"><Save className="w-4 h-4" />{saving ? "Kaydediliyor…" : form.id ? "Güncelle" : "Ekle"}</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// Müşteri bazında ayarlar (Faz 2-B). Inputs are kept as strings while editing; the shared
// normalizeKaizenSettings() (same one the server runs) decides what is actually valid on save.
function SettingsTab({ settings, onSave }: { settings: KaizenSettings; onSave: (s: KaizenSettings) => Promise<any> }) {
  const fromSettings = (st: KaizenSettings) => ({
    baseCurrency: st.baseCurrency,
    currencies: st.currencies,
    fxRates: Object.fromEntries(Object.entries(st.fxRates).map(([k, v]) => [k, String(v)])) as Record<string, string>,
    warning: String(st.waitingWarningDays),
    overdue: String(st.waitingOverdueDays),
    follow1: String(st.followUpDays[0] ?? ""),
    follow2: String(st.followUpDays[1] ?? ""),
    suggestionTypes: st.suggestionTypes,
    stages: st.stages,
    paybackPeriods: st.paybackPeriods,
    reward: st.rewardPerPoint ? String(st.rewardPerPoint) : "",
    managerStageEnabled: st.managerStageEnabled,
    boardThreshold: st.boardThreshold ? String(st.boardThreshold) : "",
    boardScoreRequired: st.boardScoreRequired
  });
  const [d, setD] = useState(() => fromSettings(settings));
  const [saving, setSaving] = useState(false);

  const toggleCurrency = (c: string) => setD(x => ({
    ...x, currencies: x.currencies.includes(c) ? x.currencies.filter(v => v !== c) : [...x.currencies, c]
  }));
  const next = normalizeKaizenSettings({
    baseCurrency: d.baseCurrency,
    currencies: d.currencies,
    fxRates: d.fxRates,
    waitingWarningDays: d.warning,
    waitingOverdueDays: d.overdue,
    followUpDays: [d.follow1, d.follow2].filter(v => v.trim() !== ""),
    suggestionTypes: d.suggestionTypes,
    stages: d.stages,
    paybackPeriods: d.paybackPeriods,
    rewardPerPoint: d.reward,
    managerStageEnabled: d.managerStageEnabled,
    boardThreshold: d.boardThreshold,
    boardScoreRequired: d.boardScoreRequired
  });
  const foreign = next.currencies.filter(c => c !== next.baseCurrency && c !== IN_KIND_CURRENCY);

  const save = async () => {
    setSaving(true);
    const res = await onSave(next);
    setSaving(false);
    if (res?.success) setD(fromSettings(normalizeKaizenSettings(res.data)));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <Card>
        <SectionTitle icon={Coins} title="Para Birimi" hint="Bu müşteri için geçerli; raporlar ana para biriminde toplanır" />
        <div className="space-y-5 mt-4">
          <Field label="Ana para birimi">
            <select value={d.baseCurrency} onChange={e => setD(x => ({ ...x, baseCurrency: e.target.value }))} className={inputCls}>
              {KNOWN_CURRENCIES.filter(c => c !== IN_KIND_CURRENCY).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div>
            <p className="block text-sm font-semibold text-slate-700 mb-1.5">Formlarda seçilebilen para birimleri</p>
            <div className="flex flex-wrap gap-2">
              {KNOWN_CURRENCIES.map(c => {
                const on = c === next.baseCurrency || d.currencies.includes(c);
                return (
                  <button key={c} type="button" disabled={c === next.baseCurrency} onClick={() => toggleCurrency(c)}
                    className={`h-10 px-4 rounded-xl border text-sm font-semibold cursor-pointer disabled:cursor-default ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">Listeden çıkarılan para birimiyle girilmiş eski kayıtlar kendi para birimini korur.</p>
          </div>
          {foreign.length > 0 && (
            <div>
              <p className="block text-sm font-semibold text-slate-700 mb-1.5">Rapor çevrim kurları (sabit)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {foreign.map(c => (
                  <label key={c} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="whitespace-nowrap font-semibold">1 {c} =</span>
                    <input type="number" min={0} step="any" value={d.fxRates[c] ?? ""} placeholder="—"
                      onChange={e => setD(x => ({ ...x, fxRates: { ...x.fxRates, [c]: e.target.value } }))} className={inputCls} />
                    <span className="whitespace-nowrap">{next.baseCurrency}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Kur girilmeyen para birimleri ve "{IN_KIND_CURRENCY}" rapor toplamlarına katılmaz; ayrıca sayılır.</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Clock} title="Eşikler" hint="Onay kuyruğu renkleri ve kalıcılık kontrolleri" />
        <div className="space-y-5 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Uyarı (gün)"><input type="number" min={1} value={d.warning} onChange={e => setD(x => ({ ...x, warning: e.target.value }))} className={inputCls} /></Field>
            <Field label="Gecikme (gün)"><input type="number" min={1} value={d.overdue} onChange={e => setD(x => ({ ...x, overdue: e.target.value }))} className={inputCls} /></Field>
          </div>
          <p className="text-xs text-slate-500 -mt-2">Onay bekleyen öneri bu kadar gün sonra sarı, ardından kırmızı görünür. Kaydedilecek: {next.waitingWarningDays} / {next.waitingOverdueDays} gün.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="1. kalıcılık kontrolü (gün)"><input type="number" min={1} value={d.follow1} onChange={e => setD(x => ({ ...x, follow1: e.target.value }))} className={inputCls} /></Field>
            <Field label="2. kontrol (gün, boş = yok)"><input type="number" min={1} value={d.follow2} onChange={e => setD(x => ({ ...x, follow2: e.target.value }))} className={inputCls} /></Field>
          </div>
          <p className="text-xs text-slate-500 -mt-2">Uygulama tamamlandıktan sonra sayılır. Yeni günler yalnızca bundan sonra tamamlanan uygulamalara uygulanır. Kaydedilecek: {next.followUpDays.join(" ve ")}. gün.</p>
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <SectionTitle icon={GitBranch} title="Onay Akışı" hint="Yeni gönderilen önerilere uygulanır; süreçteki öneriler gönderildikleri andaki akışla devam eder" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <Toggle
            checked={d.managerStageEnabled}
            onChange={v => setD(x => ({ ...x, managerStageEnabled: v }))}
            title="Amir onayı aşaması"
            text={d.managerStageEnabled ? "Öneri önce personelin amirine gider." : "Öneri doğrudan Kaizen Kurulu'na gider; Kurul her öneriye karar verir."}
          />
          <div className={`rounded-xl border p-3.5 ${d.managerStageEnabled ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
            <Field label={`Kurul eşiği (${next.baseCurrency}, boş = Kurul her zaman)`}>
              <input type="number" min={0} step="any" value={d.boardThreshold} placeholder="—" disabled={!d.managerStageEnabled}
                onChange={e => setD(x => ({ ...x, boardThreshold: e.target.value }))} className={inputCls} />
            </Field>
            <p className="text-xs text-slate-500 mt-2">
              {next.managerStageEnabled && next.boardThreshold > 0
                ? `Tahmini kazancı ${next.boardThreshold.toLocaleString("tr-TR")} ${next.baseCurrency} altındaki öneriler (kazanç girilmemiş olanlar dahil) Amir onayıyla sonuçlanır. Çevrilemeyen para birimiyle girilenler Kurul'a gider.`
                : "Tüm öneriler Kurul değerlendirmesinden geçer."}
            </p>
          </div>
          <Toggle
            checked={d.boardScoreRequired}
            onChange={v => setD(x => ({ ...x, boardScoreRequired: v }))}
            title="Kurul onayında puan zorunlu"
            text={d.boardScoreRequired ? "Kurul onaylarken bir değerlendirme kriteri seçmek zorunda." : "Kriter seçimi isteğe bağlı; seçilmezse puan 0 ve ödül tutarı yok."}
          />
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <SectionTitle icon={ListChecks} title="Seçenek Listeleri" hint="Yeni Öneri formunda ve rapor filtrelerinde görünür" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <OptionListEditor label="Öneri Sınıfı" items={d.suggestionTypes} defaults={DEFAULT_KAIZEN_SETTINGS.suggestionTypes} onChange={v => setD(x => ({ ...x, suggestionTypes: v }))} />
          <OptionListEditor label="Öneri Aşaması (PDCA)" items={d.stages} defaults={DEFAULT_KAIZEN_SETTINGS.stages} onChange={v => setD(x => ({ ...x, stages: v }))} />
          <OptionListEditor label="Kazanç Süresi" items={d.paybackPeriods} defaults={DEFAULT_KAIZEN_SETTINGS.paybackPeriods} onChange={v => setD(x => ({ ...x, paybackPeriods: v }))} />
        </div>
        <p className="text-xs text-slate-500 mt-4">Bir seçeneği kaldırmak eski kayıtları değiştirmez; o değer eski önerilerde ve filtrelerde görünmeye devam eder. Yeniden adlandırma yeni bir değer sayılır.</p>
      </Card>

      <Card className="xl:col-span-2">
        <SectionTitle icon={Gift} title="Ödül" hint="Kurul puanını ödüle çevirir" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 items-end">
          <Field label={`Puan başına ödül (${next.baseCurrency}, boş = tutar gösterilmez)`}>
            <input type="number" min={0} step="any" value={d.reward} placeholder="—" onChange={e => setD(x => ({ ...x, reward: e.target.value }))} className={inputCls} />
          </Field>
          <p className="text-xs text-slate-500">Tutar Kurul onayında kayda sabitlenir; oran sonradan değişirse önceki ödüller değişmez. Oran girilmeden önce onaylanmış öneriler ödendi olarak işaretlendiğinde o günkü oranla sabitlenir.</p>
        </div>
      </Card>

      <div className="xl:col-span-2 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">{settings.updatedAt ? `Son değişiklik: ${new Date(settings.updatedAt).toLocaleString("tr-TR")}${settings.updatedBy ? ` · ${settings.updatedBy}` : ""}` : "Bu müşteri için henüz ayar kaydedilmedi; varsayılanlar geçerli."}</p>
        <Button variant="brand" onClick={save} disabled={saving}><Save className="w-4 h-4" />{saving ? "Kaydediliyor…" : "Ayarları Kaydet"}</Button>
      </div>
    </div>
  );
}

function OptionListEditor({ label, items, defaults, onChange }: { label: string; items: string[]; defaults: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const value = text.trim().slice(0, MAX_OPTION_LENGTH);
  const exists = items.some(i => i.toLocaleLowerCase("tr") === value.toLocaleLowerCase("tr"));
  const canAdd = !!value && !exists && items.length < MAX_OPTIONS;
  const add = () => { if (canAdd) { onChange([...items, value]); setText(""); } };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const isDefault = items.length === defaults.length && items.every((v, i) => v === defaults[i]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {!isDefault && <button type="button" onClick={() => onChange(defaults)} className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer">Varsayılana dön</button>}
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={item} className="flex items-center gap-1 rounded-xl border border-slate-200 pl-3.5 pr-1 h-11">
            <span className="flex-1 min-w-0 truncate text-sm text-slate-800">{item}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer" title="Yukarı">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer" title="Aşağı">↓</button>
            <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} disabled={items.length === 1} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30 cursor-pointer" title="Kaldır"><X className="w-4 h-4" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mt-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Yeni seçenek" maxLength={MAX_OPTION_LENGTH} className={inputCls} />
        <Button variant="ghost" onClick={add} disabled={!canAdd} className="shrink-0"><Plus className="w-4 h-4" />Ekle</Button>
      </div>
      {exists && value && <p className="text-xs text-amber-700 mt-1">Bu seçenek zaten listede.</p>}
    </div>
  );
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer ${checked ? "border-emerald-400 bg-emerald-50/60" : "border-slate-200"}`}>
      <input type="checkbox" className="w-4 h-4 mt-0.5 accent-emerald-700" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span><span className="block text-sm font-bold text-slate-800">{title}</span><span className="block text-xs text-slate-500 mt-0.5">{text}</span></span>
    </label>
  );
}

// Kaizen role of a person, shown as one chip (highest wins).
function RoleChip({ person, isManager }: { person: KaizenPersonnel; isManager: boolean }) {
  const [label, cls] = person.isBoardAdmin
    ? ["Kurul Yöneticisi", "bg-violet-50 text-violet-700"]
    : person.isBoardMember
      ? ["Kurul üyesi", "bg-amber-50 text-amber-700"]
      : isManager ? ["Amir", "bg-blue-50 text-blue-700"] : ["Personel", "bg-slate-100 text-slate-600"];
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{label}</span>;
}
