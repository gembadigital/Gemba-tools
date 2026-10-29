// VSM Kurulum — standard value-stream data (plan step V2): scope and team, demand / pitch, customer,
// information flow (orders, schedule point) and the raw material / finished goods stock points.
// Everything is entered as observed; nothing is pre-filled.
import React from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { useVsm } from "./VsmContext";
import { NumberField, SelectField, TextField, asOptions } from "./vsmFields";
import { VSM_INFO_CHANNELS, VSM_INVENTORY_TYPES, VSM_ORDER_TYPES, VsmFactorySetup } from "./vsmTypes";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="pt-4 border-t border-slate-100 space-y-3">
    <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider">{title}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{children}</div>
  </div>
);

export default function VsmSetupDetails() {
  const { factorySetup, setFactorySetup, team, setTeam, vsmProcesses, taktTime, pitchTime, endStocks } = useVsm();
  const set = <K extends keyof VsmFactorySetup>(key: K) => (value: VsmFactorySetup[K] | undefined) =>
    setFactorySetup(p => ({ ...p, [key]: value }));
  const fmtDays = (d: number) => (d > 0 ? `${d} gün` : "—");

  return (
    <>
      <Section title="Kapsam & Gözlem">
        <TextField label="Değer akışı başlangıcı" value={factorySetup.scopeStart} onChange={set("scopeStart")} placeholder="ör. Hammadde kabul" />
        <TextField label="Değer akışı bitişi" value={factorySetup.scopeEnd} onChange={set("scopeEnd")} placeholder="ör. Sevkiyat" />
        <TextField label="Mevcut durum gözlem tarihi" type="date" value={factorySetup.observationDate} onChange={set("observationDate")} />
      </Section>

      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" /> Değer Akışı Ekibi
          </h3>
          <button
            type="button"
            onClick={() => setTeam([...team, { name: "", role: "" }])}
            className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Kişi ekle
          </button>
        </div>
        {team.length === 0 && <p className="text-[11px] text-slate-500">Ekip henüz girilmedi.</p>}
        <div className="space-y-2">
          {team.map((m, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <input
                value={m.name}
                placeholder="Ad Soyad"
                onChange={e => setTeam(team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
              />
              <input
                value={m.role ?? ""}
                placeholder="Görev (ör. Değer akışı yöneticisi, Planlama)"
                onChange={e => setTeam(team.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => setTeam(team.filter((_, j) => j !== i))}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer self-start"
                title="Kişiyi çıkar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Section title="Talep, Vardiya & Pitch">
        <NumberField label="Günlük vardiya sayısı" value={factorySetup.shiftsPerDay} onChange={set("shiftsPerDay")}
          hint="Net çalışma süresi ve takt bu sayıyla hesaplanır." />
        <SelectField label="Sipariş tipi" value={factorySetup.orderType} options={asOptions(VSM_ORDER_TYPES)} onChange={set("orderType")} />
        <NumberField label="Ambalaj / paket miktarı (adet)" value={factorySetup.packSize} onChange={set("packSize")}
          hint={pitchTime > 0 ? `Pitch = takt ${taktTime} sn × paket = ${pitchTime} sn (${Math.round(pitchTime / 60 * 10) / 10} dk)` : "Pitch = takt × paket miktarı"} />
      </Section>

      <Section title="Müşteri (Harita Kutusu)">
        <TextField label="Müşteri sevkiyat partisi" value={factorySetup.customerShipmentBatch} onChange={set("customerShipmentBatch")} placeholder="ör. 1 kamyon / 480 adet" />
        <TextField label="Müşteriye taşıma" value={factorySetup.customerTransport} onChange={set("customerTransport")} placeholder="ör. Kamyon" />
      </Section>

      <Section title="Bilgi Akışı">
        <TextField label="Müşteri → Planlama: sipariş / tahmin sıklığı" value={factorySetup.customerOrderFrequency} onChange={set("customerOrderFrequency")} placeholder="ör. 90/60/30 gün tahmin, günlük sipariş" />
        <SelectField label="Müşteri → Planlama: kanal" value={factorySetup.customerOrderChannel} options={asOptions(VSM_INFO_CHANNELS)} onChange={set("customerOrderChannel")} />
        <div className="hidden md:block" />
        <TextField label="Planlama → Tedarikçi: sipariş / tahmin sıklığı" value={factorySetup.supplierOrderFrequency} onChange={set("supplierOrderFrequency")} placeholder="ör. Haftalık sipariş" />
        <SelectField label="Planlama → Tedarikçi: kanal" value={factorySetup.supplierOrderChannel} options={asOptions(VSM_INFO_CHANNELS)} onChange={set("supplierOrderChannel")} />
        <div className="hidden md:block" />
        <SelectField
          label="Üretim çizelgesi nereye gönderiliyor?"
          value={factorySetup.scheduleMode}
          options={[{ value: "each", label: "Her prosese (push)" }, { value: "pacemaker", label: "Tek noktaya — pacemaker" }]}
          onChange={v => set("scheduleMode")(v || "each")}
          emptyLabel="Her prosese (push)"
        />
        {factorySetup.scheduleMode === "pacemaker" && (
          <SelectField
            label="Pacemaker proses"
            value={factorySetup.pacemakerProcessId}
            options={vsmProcesses.map(p => ({ value: p.id, label: p.name }))}
            onChange={set("pacemakerProcessId")}
          />
        )}
      </Section>

      <Section title="Hammadde & Mamul Stoku (lead time'a dahil)">
        <NumberField label="Hammadde stoku (adet)" value={factorySetup.rawMaterialQty} onChange={set("rawMaterialQty")} hint={`Gün karşılığı: ${fmtDays(endStocks.rawDays)}`} />
        <SelectField label="Hammadde stok tipi" value={factorySetup.rawMaterialType} options={VSM_INVENTORY_TYPES} onChange={set("rawMaterialType")} />
        <div className="hidden md:block" />
        <NumberField label="Mamul stoku (adet)" value={factorySetup.finishedGoodsQty} onChange={set("finishedGoodsQty")} hint={`Gün karşılığı: ${fmtDays(endStocks.fgDays)}`} />
        <SelectField label="Mamul stok tipi" value={factorySetup.finishedGoodsType} options={VSM_INVENTORY_TYPES} onChange={set("finishedGoodsType")} />
      </Section>
    </>
  );
}
