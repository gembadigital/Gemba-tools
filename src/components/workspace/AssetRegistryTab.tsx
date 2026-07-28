import React, { useState } from "react";
import { CompanyWorkspaceExtended, FactoryAsset } from "../../types/workspace";
import { Plus, Settings, Hammer, Trash2, ShieldAlert } from "lucide-react";

interface AssetRegistryTabProps {
  workspace: CompanyWorkspaceExtended;
  onUpdateAssets: (assets: FactoryAsset[]) => void;
}

export default function AssetRegistryTab({ workspace, onUpdateAssets }: AssetRegistryTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<FactoryAsset["type"]>("Machine");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<FactoryAsset["status"]>("Active");
  const [capacity, setCapacity] = useState("");
  const [notes, setNotes] = useState("");

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    const newAsset: FactoryAsset = {
      id: "ast_" + Math.random().toString(36).substring(2, 9),
      name,
      code,
      type,
      location,
      status,
      capacity,
      notes,
    };

    onUpdateAssets([...workspace.assets, newAsset]);

    // Reset Form
    setName("");
    setCode("");
    setLocation("");
    setCapacity("");
    setNotes("");
    setShowForm(false);
  };

  const handleDeleteAsset = (id: string) => {
    onUpdateAssets(workspace.assets.filter((a) => a.id !== id));
  };

  const getAssetTypeBadgeClass = (t: FactoryAsset["type"]) => {
    switch (t) {
      case "Machine":
        return "bg-slate-50 text-slate-700 border-slate-100";
      case "ProductionLine":
        return "bg-zinc-50 text-zinc-700 border-zinc-100";
      case "Department":
        return "bg-zinc-100 text-zinc-800 border-zinc-200";
      default:
        return "bg-gray-50 text-gray-600 border-gray-100";
    }
  };

  return (
    <div className="space-y-6" id="asset-registry-module">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fabrika Varlıkları & Ekipman Sicile (Factory Assets)</h4>
          <p className="text-[10px] text-gray-500 mt-1">Makine parkuru, üretim hatları, lojistik depolar ve yardımcı tesislerin tescili.</p>
        </div>
        {!showForm && (
          <button
            id="btn-add-asset-trigger"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Yeni Varlık Kaydet
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAddAsset} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4" id="asset-registry-form">
          <h4 className="font-semibold text-gray-900 text-xs">Varlık Tescil Kaydı</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Varlık Adı</label>
              <input
                id="input-asset-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Ekipman Kodu (Barkod/ID)</label>
              <input
                id="input-asset-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Varlık Sınıfı</label>
              <select
                id="select-asset-type"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-hidden"
              >
                <option value="Machine">Machine (Makine/Teçhizat)</option>
                <option value="ProductionLine">ProductionLine (Üretim / Montaj Hattı)</option>
                <option value="Department">Department (İdari / Üretim Departmanı)</option>
                <option value="Warehouse">Warehouse (Depo / Stok Alanı)</option>
                <option value="Office">Office (Ofis / Laboratuvar)</option>
                <option value="Utility">Utility (Yardımcı Tesis / Jeneratör vb.)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Bulunduğu Lokasyon / Atölye</label>
              <input
                id="input-asset-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Operasyonel Kapasite</label>
              <input
                id="input-asset-capacity"
                type="text"
                placeholder="Örn: 100 vuruş/dak, 5 ton/saat"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Mevcut Durum</label>
              <select
                id="select-asset-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-hidden"
              >
                <option value="Active">Active (Çalışıyor / Sahnede)</option>
                <option value="Maintenance">Maintenance (Bakımda / Arızalı)</option>
                <option value="Idle">Idle (Boşta / Atıl)</option>
                <option value="Planned">Planned (Planlama Aşamasında)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Teknik Detaylar / Açıklama</label>
              <input
                id="input-asset-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              id="btn-asset-cancel"
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              id="btn-asset-save"
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Varlığı Tescil Et
            </button>
          </div>
        </form>
      )}

      {/* Grid listing */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse bg-white rounded-xl border border-gray-100 overflow-hidden" id="assets-registry-table">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="p-4 text-[10px] font-bold text-gray-400 uppercase">Varlık Sınıfı</th>
              <th className="p-4 text-[10px] font-bold text-gray-400 uppercase">İsim / Kod</th>
              <th className="p-4 text-[10px] font-bold text-gray-400 uppercase">Lokasyon / Sahanlık</th>
              <th className="p-4 text-[10px] font-bold text-gray-400 uppercase">Kapasite</th>
              <th className="p-4 text-[10px] font-bold text-gray-400 uppercase">Durum</th>
              <th className="p-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {workspace.assets.map((asset) => (
              <tr key={asset.id} className="text-xs hover:bg-gray-50/20">
                <td className="p-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getAssetTypeBadgeClass(asset.type)}`}>
                    {asset.type}
                  </span>
                </td>
                <td className="p-4 font-semibold text-gray-800">
                  <div className="flex flex-col">
                    <span>{asset.name}</span>
                    <span className="text-[10px] font-mono text-gray-400 mt-0.5">{asset.code}</span>
                  </div>
                </td>
                <td className="p-4 text-gray-600 font-medium">{asset.location || "Saha Tanımsız"}</td>
                <td className="p-4 text-gray-500 font-medium">{asset.capacity || "-"}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    asset.status === "Active"
                      ? "bg-green-50 text-green-700"
                      : asset.status === "Maintenance"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-gray-50 text-gray-500"
                  }`}>
                    {asset.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    id={`btn-delete-asset-${asset.id}`}
                    onClick={() => handleDeleteAsset(asset.id)}
                    className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    title="Varlığı Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {workspace.assets.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-xs text-gray-400 font-medium italic">
                  Fabrikaya ait herhangi bir makine, hat veya departman tescil edilmemiştir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
