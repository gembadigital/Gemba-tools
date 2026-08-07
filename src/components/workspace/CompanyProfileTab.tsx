import React, { useState } from "react";
import { CompanyWorkspaceExtended, FactoryInfo } from "../../types/workspace";
import { Building, Globe, Mail, Phone, Users, Clipboard, Percent, Settings, ShieldAlert, PlusCircle, Trash2 } from "lucide-react";

interface CompanyProfileTabProps {
  workspace: CompanyWorkspaceExtended;
  onSave: (updatedWorkspace: CompanyWorkspaceExtended) => void;
}

export default function CompanyProfileTab({ workspace, onSave }: CompanyProfileTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedWorkspace, setEditedWorkspace] = useState<CompanyWorkspaceExtended>({ ...workspace });
  const [activeSubTab, setActiveSubTab] = useState<"general" | "factories" | "operational" | "workforce" | "opex" | "contacts">("general");

  // React to workspace prop changes
  React.useEffect(() => {
    setEditedWorkspace({ ...workspace });
  }, [workspace]);

  const handleFieldChange = (section: keyof CompanyWorkspaceExtended | null, field: string, value: any) => {
    setEditedWorkspace(prev => {
      if (section === null) {
        return { ...prev, [field]: value };
      }
      const sectionObj = prev[section] as any;
      return {
        ...prev,
        [section]: {
          ...sectionObj,
          [field]: value
        }
      };
    });
  };

  const handleFactoryChange = (index: number, field: keyof FactoryInfo, value: any) => {
    setEditedWorkspace(prev => {
      const factories = [...prev.factories];
      factories[index] = {
        ...factories[index],
        [field]: value
      };
      return { ...prev, factories };
    });
  };

  const handleAddFactory = () => {
    const newFactory: FactoryInfo = {
      name: "Yeni Fabrika Tesisleri",
      plantCode: "FAC-NEW-" + Math.floor(Math.random() * 100),
      buildingName: "A Blok",
      factoryArea: 10000,
      closedArea: 8000,
      openArea: 2000,
      productionArea: 5000,
      warehouseArea: 2000,
      officeArea: 1000,
      floorsCount: 1,
      productionLines: [],
      departments: [],
      mainProcesses: [],
      layoutFiles: []
    };
    setEditedWorkspace(prev => ({
      ...prev,
      factories: [...prev.factories, newFactory]
    }));
  };

  const handleRemoveFactory = (index: number) => {
    setEditedWorkspace(prev => ({
      ...prev,
      factories: prev.factories.filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    onSave(editedWorkspace);
    setIsEditing(false);
  };

  const subTabs = [
    { id: "general", label: "Firma Bilgileri", icon: Building },
    { id: "factories", label: "Fabrika Tesisleri", icon: Settings },
    { id: "operational", label: "Operasyonel Detaylar", icon: Clipboard },
    { id: "workforce", label: "İşgücü & Vardiyalar", icon: Users },
    { id: "opex", label: "Yalın Olgunluk (OpEx)", icon: Percent },
    { id: "contacts", label: "Kontak Kişiler", icon: Mail },
  ] as const;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden" id="company-profile-module">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-lg">
            <Building className="w-5 h-5 text-zinc-600" />
            Şirket Master Kartoteksi (Kurumsal Profil)
          </h3>
          <p className="text-xs text-gray-500 mt-1">Platformun ana veri merkezi. Tüm projeler, zaman etütleri ve OEE analizleri bu profile bağlıdır.</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                id="btn-profile-cancel"
                onClick={() => {
                  setEditedWorkspace({ ...workspace });
                  setIsEditing(false);
                }}
                className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
              <button
                id="btn-profile-save"
                onClick={handleSave}
                className="px-4 py-1.5 text-xs font-medium text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Değişiklikleri Kaydet
              </button>
            </>
          ) : (
            <button
              id="btn-profile-edit"
              onClick={() => setIsEditing(true)}
              className="px-4 py-1.5 text-xs font-medium text-zinc-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              Profili Düzenle
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex border-b border-gray-100 bg-white overflow-x-auto scrollbar-none scroll-smooth">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              id={`subtab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                activeSubTab === tab.id
                  ? "border-zinc-900 text-zinc-900 bg-gray-50/30"
                  : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50/10"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="p-6">
        {/* GENERAL INFO SUB TAB */}
        {activeSubTab === "general" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="general-info-pane">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Şirket Resmi Ünvanı</label>
              <input
                id="input-companyName"
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.companyName || ""}
                onChange={(e) => handleFieldChange(null, "companyName", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Kısa İsim / Kod</label>
              <input
                id="input-shortName"
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.shortName || ""}
                onChange={(e) => handleFieldChange(null, "shortName", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Web Sitesi</label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  id="input-website"
                  type="text"
                  disabled={!isEditing}
                  value={editedWorkspace.website || ""}
                  onChange={(e) => handleFieldChange(null, "website", e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Kuruluş Yılı</label>
              <input
                id="input-yearEstablished"
                type="number"
                disabled={!isEditing}
                value={editedWorkspace.yearEstablished || ""}
                onChange={(e) => handleFieldChange(null, "yearEstablished", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Ülke</label>
              <input
                id="input-country"
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.country || ""}
                onChange={(e) => handleFieldChange(null, "country", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Şehir</label>
              <input
                id="input-city"
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.city || ""}
                onChange={(e) => handleFieldChange(null, "city", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Yıllık Ciro (₺)</label>
              <input
                id="input-annualRevenue"
                type="text"
                inputMode="numeric"
                disabled={!isEditing}
                value={editedWorkspace.annualRevenue ? editedWorkspace.annualRevenue.toLocaleString("tr-TR") : ""}
                onChange={(e) => handleFieldChange(null, "annualRevenue", parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
                placeholder="Örn: 25.000.000"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
          </div>
        )}

        {/* FACTORY INFORMATION SUB TAB */}
        {activeSubTab === "factories" && (
          <div className="space-y-6" id="factories-info-pane">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Fabrikalar ve Üretim Tesisleri</h4>
              {isEditing && (
                <button
                  id="btn-add-factory"
                  onClick={handleAddFactory}
                  className="px-3 py-1.5 text-xs bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Yeni Fabrika Ekle
                </button>
              )}
            </div>

            {editedWorkspace.factories.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <Building className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-medium">Tescilli fabrika bulunmamaktadır.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {editedWorkspace.factories.map((factory, index) => (
                  <div key={index} className="border border-gray-100 rounded-xl p-5 bg-gray-50/30 hover:bg-gray-50/60 transition-all relative">
                    {isEditing && (
                      <button
                        id={`btn-remove-factory-${index}`}
                        onClick={() => handleRemoveFactory(index)}
                        className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Fabrikayı Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <h5 className="font-semibold text-gray-900 text-xs mb-4 flex items-center gap-1.5">
                      <span className="w-5 h-5 bg-zinc-900 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{index + 1}</span>
                      {factory.name} ({factory.plantCode})
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Fabrika Adı</label>
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={factory.name || ""}
                          onChange={(e) => handleFactoryChange(index, "name", e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md disabled:bg-transparent"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Fabrika Kodu</label>
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={factory.plantCode || ""}
                          onChange={(e) => handleFactoryChange(index, "plantCode", e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md disabled:bg-transparent"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Bina / Hol Adı</label>
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={factory.buildingName || ""}
                          onChange={(e) => handleFactoryChange(index, "buildingName", e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md disabled:bg-transparent"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Toplam Alan (m²)</label>
                        <input
                          type="number"
                          disabled={!isEditing}
                          value={factory.factoryArea || ""}
                          onChange={(e) => handleFactoryChange(index, "factoryArea", parseInt(e.target.value) || 0)}
                          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md disabled:bg-transparent"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Kapalı Alan (m²)</label>
                        <input
                          type="number"
                          disabled={!isEditing}
                          value={factory.closedArea || ""}
                          onChange={(e) => handleFactoryChange(index, "closedArea", parseInt(e.target.value) || 0)}
                          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md disabled:bg-transparent"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Açık Sahanlık Alanı (m²)</label>
                        <input
                          type="number"
                          disabled={!isEditing}
                          value={factory.openArea || ""}
                          onChange={(e) => handleFactoryChange(index, "openArea", parseInt(e.target.value) || 0)}
                          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md disabled:bg-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OPERATIONAL INFO SUB TAB */}
        {activeSubTab === "operational" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="operational-info-pane">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Yıllık Toplam Üretim Kapasitesi (Adet/Yıl)</label>
              <input
                id="input-operational-annualProductionQuantity"
                type="number"
                disabled={!isEditing}
                value={editedWorkspace.operational.annualProductionQuantity || ""}
                onChange={(e) => handleFieldChange("operational", "annualProductionQuantity", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Üretim Sipariş Stratejisi</label>
              <select
                id="select-operational-productionStrategy"
                disabled={!isEditing}
                value={editedWorkspace.operational.productionStrategy || "MTO"}
                onChange={(e) => handleFieldChange("operational", "productionStrategy", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 bg-white transition-all"
              >
                <option value="MTO">Make to Order (Siparişe Göre Üretim)</option>
                <option value="MTS">Make to Stock (Stoğa Göre Üretim)</option>
                <option value="ETO">Engineer to Order (Mühendislik Sipariş Üretim)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Montaj Akış Tarzı</label>
              <select
                id="select-operational-assemblyType"
                disabled={!isEditing}
                value={editedWorkspace.operational.assemblyType || "Discrete"}
                onChange={(e) => handleFieldChange("operational", "assemblyType", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 bg-white transition-all"
              >
                <option value="Discrete">Discrete (Ayrık Montaj Düzeni)</option>
                <option value="Continuous">Continuous (Sürekli Konveyör Akışı)</option>
                <option value="Cellular">Cellular (Hücresel Yalın İmalat)</option>
                <option value="FlowLine">FlowLine (Kesintisiz Akış Hattı)</option>
                <option value="Batch">Batch (Kesikli Seri Üretim)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Ürün Aileleri (Virgülle Ayırın)</label>
              <input
                id="input-operational-productFamilies"
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.operational.productFamilies.join(", ") || ""}
                onChange={(e) => handleFieldChange("operational", "productFamilies", e.target.value.split(",").map(x => x.trim()))}
                placeholder="Örn: Ankastre, Solo, Ocak"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">Başlıca Müşteriler (Virgülle Ayırın)</label>
              <input
                id="input-operational-mainCustomers"
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.operational.mainCustomers.join(", ") || ""}
                onChange={(e) => handleFieldChange("operational", "mainCustomers", e.target.value.split(",").map(x => x.trim()))}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 disabled:bg-gray-50 disabled:text-gray-600 transition-all"
              />
            </div>
          </div>
        )}

        {/* WORKFORCE SUB TAB */}
        {activeSubTab === "workforce" && (
          <div className="space-y-6" id="workforce-info-pane">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/20">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Toplam Personel</span>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={editedWorkspace.workforce.totalEmployees || ""}
                  onChange={(e) => handleFieldChange("workforce", "totalEmployees", parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent font-semibold text-zinc-950 text-sm focus:outline-hidden border-b border-transparent focus:border-gray-200 mt-1"
                />
              </div>
              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/20">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Mavi Yaka Personel</span>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={editedWorkspace.workforce.blueCollar || ""}
                  onChange={(e) => handleFieldChange("workforce", "blueCollar", parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent font-semibold text-zinc-950 text-sm focus:outline-hidden border-b border-transparent focus:border-gray-200 mt-1"
                />
              </div>
              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/20">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Beyaz Yaka Personel</span>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={editedWorkspace.workforce.whiteCollar || ""}
                  onChange={(e) => handleFieldChange("workforce", "whiteCollar", parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent font-semibold text-zinc-950 text-sm focus:outline-hidden border-b border-transparent focus:border-gray-200 mt-1"
                />
              </div>
              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/20">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Toplam Mühendis</span>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={editedWorkspace.workforce.engineers || ""}
                  onChange={(e) => handleFieldChange("workforce", "engineers", parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent font-semibold text-zinc-950 text-sm focus:outline-hidden border-b border-transparent focus:border-gray-200 mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Günlük Vardiya Sayısı</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={editedWorkspace.workforce.shiftsCount || ""}
                  onChange={(e) => handleFieldChange("workforce", "shiftsCount", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Vardiya Çalışma Saati</label>
                <select
                  disabled={!isEditing}
                  value={editedWorkspace.workforce.shiftWorkingHours || 8}
                  onChange={(e) => handleFieldChange("workforce", "shiftWorkingHours", parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50 bg-white"
                >
                  <option value={4}>4 Saat</option>
                  <option value={5}>5 Saat</option>
                  <option value={6}>6 Saat</option>
                  <option value={7}>7 Saat</option>
                  <option value={8}>8 Saat (Standart)</option>
                  <option value={9}>9 Saat</option>
                  <option value={10}>10 Saat</option>
                  <option value={11}>11 Saat</option>
                  <option value={12}>12 Saat (Uzun Vardiya)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Haftalık Çalışma Gün Sayısı</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={editedWorkspace.workforce.workingDays || ""}
                  onChange={(e) => handleFieldChange("workforce", "workingDays", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
                />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-3">
                <label className="text-xs font-semibold text-gray-500">Fazla Mesai ve Çalışma Politikaları</label>
                <textarea
                  disabled={!isEditing}
                  rows={2}
                  value={editedWorkspace.workforce.overtimePolicy || ""}
                  onChange={(e) => handleFieldChange("workforce", "overtimePolicy", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* OPEX INFO SUB TAB */}
        {activeSubTab === "opex" && (
          <div className="space-y-6" id="opex-info-pane">
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                <Percent className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>OpEx Assessment Değerlendirme Referansı:</strong> Son yapılan değerlendirme puanı <strong>%{editedWorkspace.opex.opexScore || editedWorkspace.opex.leanMaturity || 55}</strong> olarak kaydedilmiştir.
                </span>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    handleFieldChange("opex", "leanMaturity", editedWorkspace.opex.opexScore || 55);
                  }}
                  className="px-3 py-1 bg-amber-600 text-white text-[10px] font-bold rounded-lg hover:bg-amber-700 transition-colors shrink-0"
                >
                  Son Assessment Puanını Eşitle
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Yalın Olgunluk (Lean Maturity) Seviyesi (%)</label>
                <input
                  id="input-opex-leanMaturity"
                  type="number"
                  disabled={!isEditing}
                  min={0}
                  max={100}
                  value={editedWorkspace.opex.leanMaturity || ""}
                  onChange={(e) => handleFieldChange("opex", "leanMaturity", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
                />
                <span className="text-[10px] text-gray-400">OpEx Assessment modülünde yapılan en son değerlendirme puanını esas alır.</span>
              </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Fabrika OEE Ortalaması (%)</label>
              <input
                id="input-opex-oee"
                type="number"
                disabled={!isEditing}
                min={0}
                max={100}
                value={editedWorkspace.opex.oee || ""}
                onChange={(e) => handleFieldChange("opex", "oee", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Yürürlükteki Yalın İyileştirme Programı</label>
              <input
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.opex.currentImprovementProgram || ""}
                onChange={(e) => handleFieldChange("opex", "currentImprovementProgram", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Kaizen Öneri Sistemi Yapısı</label>
              <input
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.opex.kaizenSystem || ""}
                onChange={(e) => handleFieldChange("opex", "kaizenSystem", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Mevcut 5S Ortalama Seviyesi (1 - 5 Yıldız)</label>
              <input
                id="input-opex-fivesLevel"
                type="number"
                disabled={!isEditing}
                step="0.1"
                min={1}
                max={5}
                value={editedWorkspace.opex.fivesLevel || ""}
                onChange={(e) => handleFieldChange("opex", "fivesLevel", parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Görsel Yönetim Derecesi</label>
              <select
                disabled={!isEditing}
                value={editedWorkspace.opex.visualManagement || "Medium"}
                onChange={(e) => handleFieldChange("opex", "visualManagement", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50 bg-white"
              >
                <option value="Low">Low (Düşük / Başlangıç Seviyesi)</option>
                <option value="Medium">Medium (Standart Göstergeler Mevcut)</option>
                <option value="High">High (Tamamen Canlı Görsel Fabrika Düzeni)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">Kritik Darboğaz Noktaları (Virgülle Ayırın)</label>
              <input
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.opex.currentBottlenecks.join(", ") || ""}
                onChange={(e) => handleFieldChange("opex", "currentBottlenecks", e.target.value.split(",").map(x => x.trim()))}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">Stratejik Hedefler (Virgülle Ayırın)</label>
              <input
                type="text"
                disabled={!isEditing}
                value={editedWorkspace.opex.strategicObjectives.join(", ") || ""}
                onChange={(e) => handleFieldChange("opex", "strategicObjectives", e.target.value.split(",").map(x => x.trim()))}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>
      )}

        {/* CONTACTS SUB TAB */}
        {activeSubTab === "contacts" && (() => {
          const execList = editedWorkspace.contacts.executiveContacts || [
            { id: "exec_1", fullName: editedWorkspace.contacts.generalManager || "Hakan Bulgurlu", departmentTitle: "Genel Müdür", email: "hakan@arcelik.com" },
            { id: "exec_2", fullName: editedWorkspace.contacts.factoryManager || "Oğuzhan Öztürk", departmentTitle: "Fabrika Müdürü", email: "oguzhan@arcelik.com" }
          ];

          const handleAddExecutiveContact = () => {
            const newExec = {
              id: "exec_" + Math.random().toString(36).substring(2, 9),
              fullName: "",
              departmentTitle: "Genel Müdür",
              email: ""
            };
            const updated = [...execList, newExec];
            handleFieldChange("contacts", "executiveContacts", updated);
          };

          const handleExecutiveChange = (index: number, field: string, value: any) => {
            const updated = [...execList];
            updated[index] = { ...updated[index], [field]: value };
            handleFieldChange("contacts", "executiveContacts", updated);
          };

          const handleRemoveExecutive = (index: number) => {
            const updated = execList.filter((_, i) => i !== index);
            handleFieldChange("contacts", "executiveContacts", updated);
          };

          return (
            <div className="space-y-6" id="contacts-info-pane">
              {/* Üst Yönetim Bilgileri (Kişi Ekle Fonksiyonu) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Üst Yönetim Kişi Bilgileri</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">Müşteri kilit yöneticilerinin tanımı. Proje ekibi atamalarında da kullanılır.</p>
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleAddExecutiveContact}
                      className="px-3 py-1.5 bg-zinc-950 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Kişi Ekle
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {execList.map((exec, index) => (
                    <div key={exec.id || index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 items-end">
                      <div className="md:col-span-4 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">İsim Soyisim</label>
                        <input
                          type="text"
                          placeholder="Örn: Ahmet Yılmaz"
                          disabled={!isEditing}
                          value={exec.fullName}
                          onChange={(e) => handleExecutiveChange(index, "fullName", e.target.value)}
                          className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white disabled:bg-gray-100/80 font-medium text-gray-800"
                        />
                      </div>

                      <div className="md:col-span-3 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Bölümü / Görevi</label>
                        <select
                          disabled={!isEditing}
                          value={exec.departmentTitle}
                          onChange={(e) => handleExecutiveChange(index, "departmentTitle", e.target.value)}
                          className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white disabled:bg-gray-100/80 font-medium text-gray-800"
                        >
                          <option value="CEO">CEO</option>
                          <option value="CFO">CFO</option>
                          <option value="COO">COO</option>
                          <option value="Genel Müdür">Genel Müdür</option>
                          <option value="GMY">GMY (Genel Müdür Yrd.)</option>
                          <option value="Fabrika Müdürü">Fabrika Müdürü</option>
                          <option value="Diğer">Diğer (Tanımlama Yap)</option>
                        </select>
                      </div>

                      {exec.departmentTitle === "Diğer" && (
                        <div className="md:col-span-2 flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Özel Bölüm/Unvan</label>
                          <input
                            type="text"
                            placeholder="Örn: Operasyon Lideri"
                            disabled={!isEditing}
                            value={exec.customTitle || ""}
                            onChange={(e) => handleExecutiveChange(index, "customTitle", e.target.value)}
                            className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white disabled:bg-gray-100/80 font-medium text-gray-800"
                          />
                        </div>
                      )}

                      <div className={`${exec.departmentTitle === "Diğer" ? "md:col-span-2" : "md:col-span-4"} flex flex-col gap-1`}>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">E-Posta Adresi</label>
                        <input
                          type="email"
                          placeholder="ahmet@firma.com"
                          disabled={!isEditing}
                          value={exec.email}
                          onChange={(e) => handleExecutiveChange(index, "email", e.target.value)}
                          className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white disabled:bg-gray-100/80 font-medium text-gray-800"
                        />
                      </div>

                      {isEditing && (
                        <div className="md:col-span-1 flex justify-end pb-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveExecutive(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Kişiyi Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 pt-4">Birincil Kontak Bilgileri</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/40 p-4 rounded-xl border border-gray-100">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Kontak İsim</label>
                  <input
                    id="input-contacts-primaryContactName"
                    type="text"
                    disabled={!isEditing}
                    value={editedWorkspace.contacts.primaryContactName || ""}
                    onChange={(e) => handleFieldChange("contacts", "primaryContactName", e.target.value)}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg disabled:bg-white bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Kontak E-posta</label>
                  <input
                    id="input-contacts-primaryContactEmail"
                    type="email"
                    disabled={!isEditing}
                    value={editedWorkspace.contacts.primaryContactEmail || ""}
                    onChange={(e) => handleFieldChange("contacts", "primaryContactEmail", e.target.value)}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg disabled:bg-white bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Kontak Telefon</label>
                  <input
                    id="input-contacts-primaryContactPhone"
                    type="text"
                    disabled={!isEditing}
                    value={editedWorkspace.contacts.primaryContactPhone || ""}
                    onChange={(e) => handleFieldChange("contacts", "primaryContactPhone", e.target.value)}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg disabled:bg-white bg-white"
                  />
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
