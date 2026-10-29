// VSM — Kurulum sekmesi: KPI tablosu, fabrika seviyesi parametreler, harita kutuları, birim maliyetler.
// State and calculations come from useVsmWorkspace() through VsmContext.
import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  useFactory, 
} from "../../context/FactoryContext";
import { 
  Building2, Users, BarChart3, Clock, Settings, HelpCircle, 
  CheckCircle2, ChevronRight, Loader2, RefreshCw, FileText,
  User, Percent, GitCommit, Trash2, Plus, AlertTriangle,
  ChevronDown, ChevronUp, Activity, ArrowRight, Play, Save, Check, Award,
  Info, Sparkles, LayoutDashboard, Sliders, PlayCircle, ClipboardList, Zap, ArrowDownUp,
  Maximize2, Minimize2, ZoomIn, ZoomOut, Move, Download, Share2, Printer, CheckCircle,
  Cpu, ArrowUp, ArrowDown, GripVertical, Sun, Moon, DollarSign, Home
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell as RechartsCell
} from "recharts";
import { ProcessRecord, Customer } from "../../types";
import { VsmUserLike, canDeleteVsmProcess, canDeleteVsmProject } from "../../utils/vsmAccess";
import type { VsmConnectionType, VsmFactorySetup, VsmProcess } from "./vsmTypes";
import { getEffectiveSuccessorIds, isLinearFlow } from "./vsmGraph";
import {
  annualWasteCost, applySimulation, bottleneckOf, compareStates, computeAll, demandOf, flowSummary, highestDowntimeOf,
  highestInventoryOf, leadTimeOf, lowestOeeOf, netAvailableSecondsPerDay as netSecondsPerDay, simulationDeltas,
  taktTimeOf, withInventoryDays, workforceAnalysis as computeWorkforce
} from "./vsmCalc";
import { domToCanvas } from "modern-screenshot";
import { jsPDF } from "jspdf";

import { useVsm } from "./VsmContext";
import VsmSetupDetails from "./VsmSetupDetails";
import VsmSuppliersEditor from "./VsmSuppliersEditor";

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export default function VsmSetupTab() {
  const { factorySetup, setFactorySetup, companyCurrency, workingDays, weeklyDemand, dailyDemand, netAvailableSecondsPerDay, taktTime, estimatedAnnualWasteCost } = useVsm();
  return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
          
          {/* 1. KPI TABLOSU VE KAPASİTE GÖSTERGELERİ (KURULUM PARAMETRELERİNİN ÜZERİNE TAŞINDI) */}
          <div className="space-y-4" id="vsm_kpi_table_section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span>Kapasite ve Takt Göstergeleri</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fabrika kurulum parametreleri ve ürün hacim payına göre anlık hesaplanan temel kapasite, takt ve maliyet kayıp verileri.
                </p>
              </div>
              <span className="text-xs font-mono font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-auto shadow-2xs">
                Ürün Hacim Payı: %{factorySetup.productVolumeShare ?? 0}
              </span>
            </div>

            {/* KPI CARDS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div className="bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 space-y-1 shadow-xs">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block">GÜNLÜK TALEP</span>
                <div className="text-2xl font-mono font-black text-amber-400">
                  {dailyDemand} <span className="text-xs font-normal text-slate-300">adet/gün</span>
                </div>
                <p className="text-[10px] text-slate-400">Haftalık {weeklyDemand} / {workingDays} gün</p>
              </div>

              <div className="bg-indigo-950 text-white rounded-2xl p-4 border border-indigo-900 space-y-1 shadow-xs">
                <span className="text-[10px] text-indigo-300 font-mono font-bold uppercase block">ÜRÜN HACİM PAYI</span>
                <div className="text-2xl font-mono font-black text-indigo-200">
                  %{factorySetup.productVolumeShare ?? 0}
                </div>
                <p className="text-[10px] text-indigo-300 truncate">Fabrika Geneli: ~{(factorySetup.productVolumeShare > 0 ? Math.round(dailyDemand / (factorySetup.productVolumeShare / 100)).toLocaleString() : "—")} ad/gün</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-xs">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block">TEMİZ SÜRE / VARDİYA</span>
                <div className="text-2xl font-mono font-black text-slate-900">
                  {((factorySetup.shiftDuration * 60) - factorySetup.breakTimes - factorySetup.plannedMaintenance)} <span className="text-xs font-normal text-slate-500">dk</span>
                </div>
                <p className="text-[10px] text-slate-500">Molalar &amp; Bakım düşülmüş</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-xs">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block">GÜNLÜK NET SÜRE</span>
                <div className="text-2xl font-mono font-black text-slate-900">
                  {netAvailableSecondsPerDay.toLocaleString()} <span className="text-xs font-normal text-slate-500">sn</span>
                </div>
                <p className="text-[10px] text-slate-500">Net çalışma saniye havuzu</p>
              </div>

              <div className="bg-amber-600 text-white rounded-2xl p-4 shadow-md shadow-amber-50 space-y-1">
                <span className="text-[10px] text-amber-100 font-mono font-bold uppercase block">TAKTI ZAMANI (TAKT)</span>
                <div className="text-2xl font-mono font-black text-white">
                  {taktTime} <span className="text-xs font-semibold text-amber-100">sn/ad</span>
                </div>
                <p className="text-[10px] text-amber-50">Hedef çıkış ritmi</p>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-1 shadow-xs">
                <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase block">ÜRÜN KAYIP MALİYETİ</span>
                <div className="text-xl font-mono font-black text-emerald-400 truncate">
                  {companyCurrency}{estimatedAnnualWasteCost.toLocaleString()}
                </div>
                <p className="text-[10px] text-slate-400">Yıllık tahsis edilen israf</p>
              </div>
            </div>

            {/* DETAILED KPI METRICS SUMMARY TABLE */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-600" />
                  <span>Kapasite &amp; İsraf Kayıp Analizi KPI Özet Tablosu</span>
                </h3>
                <span className="text-[11px] text-indigo-600 font-bold font-mono">Otomatik Dinamik Model</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-500 font-bold border-b border-slate-200 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Performans Metriği (KPI)</th>
                      <th className="py-2.5 px-4 text-center">İlgili Ürün Adet/Süre</th>
                      <th className="py-2.5 px-4 text-center">Ürünün Hacim Payı</th>
                      <th className="py-2.5 px-4 text-center">Fabrika Geneli Toplam Hacim</th>
                      <th className="py-2.5 px-4 text-right">Analitik Etki &amp; Açıklama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-xs">
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Günlük Üretim Talebi</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-amber-600">{dailyDemand} adet/gün</td>
                      <td className="py-2.5 px-4 text-center font-mono font-extrabold text-indigo-700 bg-indigo-50/70 rounded-lg">%{factorySetup.productVolumeShare ?? 0}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">~{(factorySetup.productVolumeShare > 0 ? Math.round(dailyDemand / (factorySetup.productVolumeShare / 100)).toLocaleString() : "—")} adet/gün</td>
                      <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">Haftalık {weeklyDemand} talebe göre hesaplanmıştır</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>Takt Zamanı (Takt Time)</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-amber-600">{taktTime} sn/adet</td>
                      <td className="py-2.5 px-4 text-center font-mono text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-700">{netAvailableSecondsPerDay.toLocaleString()} sn net süre</td>
                      <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">Müşteri talep ritmi gereksinimi</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Yıllık İsraf &amp; Kayıp Maliyeti Tahsisi</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-600">{companyCurrency}{estimatedAnnualWasteCost.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-extrabold text-indigo-700 bg-indigo-50/70 rounded-lg">%{factorySetup.productVolumeShare ?? 0} Pay</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">{companyCurrency}{(factorySetup.productVolumeShare > 0 ? Math.round(estimatedAnnualWasteCost / (factorySetup.productVolumeShare / 100)).toLocaleString() : "—")}</td>
                      <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">Hurda, bekleme, stok taşıma kayıpları</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 2. FABRİKA SEVİYESİ KURULUM PARAMETRELERİ (ŞİMDİ KPI TABLOSUNUN ALTINDA YER ALIYOR) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4" id="vsm_setup_parameters_section">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
              <Building2 className="w-5 h-5 text-slate-800" />
              <h2 className="text-base font-extrabold text-slate-900">Fabrika Seviyesi Kurulum Parametreleri</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Müşteri / Fabrika Adı</label>
                <input 
                  type="text" 
                  value={factorySetup.customerName}
                  onChange={e => setFactorySetup(p => ({ ...p, customerName: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Ürün Ailesi</label>
                <input 
                  type="text" 
                  value={factorySetup.productFamily}
                  onChange={e => setFactorySetup(p => ({ ...p, productFamily: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>

              {/* YENİ FİELD: İLGİLİ ÜRÜNÜN FABRİKA TOPLAM ÜRÜN ADETLERİ İÇERİSİNDEKİ PAYI (% 30) */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800 block">
                  <span>Ürünün Fabrika Üretimindeki Payı (%) *</span>
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1"
                    max="100"
                    value={factorySetup.productVolumeShare ?? 0}
                    onChange={e => setFactorySetup(p => ({ ...p, productVolumeShare: Number(e.target.value) }))}
                    className="w-full bg-indigo-50/30 border border-indigo-200 focus:border-indigo-600 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-hidden transition-all font-mono"
                    placeholder="30"
                  />
                  <span className="absolute right-3 top-2 text-xs font-black text-indigo-600 font-mono">%</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  İlgili ürünün fabrikanın toplam ürün adetleri içerisindeki payı (Kapasiteyi ve maliyetlerdeki kayıpları anlamak için kritik veri).
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Haftalık Talep</label>
                <input 
                  type="number" 
                  value={factorySetup.weeklyDemand}
                  onChange={e => setFactorySetup(p => ({ ...p, weeklyDemand: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Haftalık Çalışma Günü</label>
                <input 
                  type="number" 
                  value={factorySetup.workingDays}
                  onChange={e => setFactorySetup(p => ({ ...p, workingDays: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Vardiya Yapısı</label>
                <input 
                  type="text" 
                  value={factorySetup.shiftStructure}
                  onChange={e => setFactorySetup(p => ({ ...p, shiftStructure: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Vardiya Süresi (Saat)</label>
                <input 
                  type="number" 
                  value={factorySetup.shiftDuration}
                  onChange={e => setFactorySetup(p => ({ ...p, shiftDuration: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Planlı Molalar (Dakika / Vardiya)</label>
                <input 
                  type="number" 
                  value={factorySetup.breakTimes}
                  onChange={e => setFactorySetup(p => ({ ...p, breakTimes: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Planlı Bakımlar (Dakika / Vardiya)</label>
                <input 
                  type="number" 
                  value={factorySetup.plannedMaintenance}
                  onChange={e => setFactorySetup(p => ({ ...p, plannedMaintenance: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Müşteriye Sevk Sıklığı</label>
                <input 
                  type="text" 
                  value={factorySetup.shippingFrequency}
                  onChange={e => setFactorySetup(p => ({ ...p, shippingFrequency: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
            </div>

            <VsmSetupDetails />

            {/* MAP BOXES — TEDARİKÇİ & ÜRETİM PLANLAMA (shown on the VSM map exactly as entered) */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider">Harita Kutuları: Tedarikçiler &amp; Üretim Planlama</h3>
              <VsmSuppliersEditor />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Planlama Sistemi (MRP/ERP/Excel…)</label>
                  <input
                    type="text"
                    value={factorySetup.planningSystem}
                    onChange={e => setFactorySetup(p => ({ ...p, planningSystem: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Planlama Sıklığı</label>
                  <input
                    type="text"
                    value={factorySetup.planningFrequency}
                    onChange={e => setFactorySetup(p => ({ ...p, planningFrequency: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Sıralama Rejimi</label>
                  <input
                    type="text"
                    value={factorySetup.planningSequencing}
                    onChange={e => setFactorySetup(p => ({ ...p, planningSequencing: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Üretim Takvimi</label>
                  <input
                    type="text"
                    value={factorySetup.planningCalendar}
                    onChange={e => setFactorySetup(p => ({ ...p, planningCalendar: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* FINANCIAL & WASTE UNIT COST PARAMETERS SECTION */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider">İsraf &amp; Finansal Birim Maliyet Parametreleri (Finansal Veri Modeli)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                    <span>Hurda / Iskarta Birim Maliyeti ({companyCurrency}/adet)</span>
                    
                  </label>
                  <input 
                    type="number" 
                    value={factorySetup.scrapUnitCost}
                    onChange={e => setFactorySetup(p => ({ ...p, scrapUnitCost: Number(e.target.value) }))}
                    className="w-full bg-emerald-50/30 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500">
                    Proseslerdeki hurda ve tamir edilen hatalı ürünlerin birim maliyet kaybı.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                    <span>WIP Stok Birim Maliyeti ({companyCurrency}/adet/yıl)</span>
                    
                  </label>
                  <input
                    type="number"
                    value={factorySetup.holdingCostPerWipYearly}
                    onChange={e => setFactorySetup(p => ({ ...p, holdingCostPerWipYearly: Number(e.target.value) }))}
                    className="w-full bg-emerald-50/30 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500">
                    Prosesler arası ara stokların (WIP) 1 adedinin yıllık sermaye bağlama ve alan/depo maliyeti — bu birim maliyet, VSM'de hesaplanan toplam WIP adediyle çarpılarak toplam stok maliyetini verir.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                    <span>Saatlik Duruş Kayıp Maliyeti ({companyCurrency}/saat)</span>
                    
                  </label>
                  <input 
                    type="number" 
                    value={factorySetup.downtimeHourlyCost}
                    onChange={e => setFactorySetup(p => ({ ...p, downtimeHourlyCost: Number(e.target.value) }))}
                    className="w-full bg-emerald-50/30 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500">
                    Plansız makine arızaları ve uzun kalıp değişimlerinin (setup) saatlik duruş maliyeti.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}
