import React, { useState } from "react";
import { CompanyWorkspaceExtended, DocumentItem } from "../../types/workspace";
import { Folder, FolderOpen, File, Plus, Trash2, Search, Upload } from "lucide-react";

interface DocumentVaultTabProps {
  workspace: CompanyWorkspaceExtended;
  onUpdateDocuments: (documents: DocumentItem[]) => void;
}

const MODULE_FOLDERS = [
  "Genel",
  "Sözleşmeler",
  "Audits",
  "Kaizen",
  "5S",
  "SMED",
  "Zaman Etütleri",
  "Spaghetti",
  "Layouts",
  "AI Raporları",
  "Eğitim & Sunumlar"
];

export default function DocumentVaultTab({ workspace, onUpdateDocuments }: DocumentVaultTabProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>("Genel");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleUploadFile = (name: string, sizeStr: string) => {
    const newDoc: DocumentItem = {
      id: "doc_" + Math.random().toString(36).substring(2, 9),
      name,
      folder: selectedFolder,
      size: sizeStr,
      uploadDate: new Date().toISOString().split("T")[0]
    };

    onUpdateDocuments([...workspace.documents, newDoc]);
  };

  const handleFileDelete = (id: string) => {
    onUpdateDocuments(workspace.documents.filter((d) => d.id !== id));
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + " MB";
      handleUploadFile(file.name, sizeMB);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + " MB";
      handleUploadFile(file.name, sizeMB);
    }
  };

  // Filtered files count and files list
  const currentFiles = workspace.documents.filter(
    (doc) =>
      doc.folder === selectedFolder &&
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6" id="document-vault-module">
      {/* Sidebar Folders */}
      <div className="md:col-span-1 bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-1.5 h-fit">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Modül Klasörleri</h4>
        {MODULE_FOLDERS.map((folder) => {
          const isSelected = selectedFolder === folder;
          const folderFilesCount = workspace.documents.filter((d) => d.folder === folder).length;

          return (
            <button
              id={`folder-btn-${folder}`}
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={`flex items-start justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left ${
                isSelected
                  ? "bg-zinc-950 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <div className="flex items-start gap-2">
                {isSelected ? <FolderOpen className="w-4 h-4 shrink-0 mt-0.5" /> : <Folder className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{folder}</span>
              </div>
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 ${
                isSelected ? "bg-zinc-800 text-zinc-300" : "bg-gray-100 text-gray-500"
              }`}>
                {folderFilesCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Document Listing Area */}
      <div className="md:col-span-3 bg-white border border-gray-100 rounded-xl p-6 flex flex-col gap-6">
        {/* Search and Action Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              id="input-document-search"
              type="text"
              placeholder="Klasörde ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label
              id="btn-upload-file-trigger"
              className="px-4 py-2 text-xs bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 font-medium cursor-pointer w-full sm:w-auto"
            >
              <Upload className="w-4 h-4" />
              Dosya Yükle
              <input type="file" onChange={handleFileInput} className="hidden" />
            </label>
          </div>
        </div>

        {/* Drag and Drop Container Zone */}
        <div
          id="document-drag-zone"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? "border-zinc-900 bg-gray-50"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <p className="text-xs text-gray-500 font-medium">
            Sürükleyip buraya bırakarak <span className="text-zinc-950 font-semibold">{selectedFolder}</span> klasörüne dosya yükleyin veya yukarıdaki butonu kullanın.
          </p>
        </div>

        {/* Document List View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="documents-table">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">Dosya Adı</th>
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">Yükleme Tarihi</th>
                <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">Boyut</th>
                <th className="py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentFiles.map((doc) => (
                <tr key={doc.id} className="text-xs hover:bg-gray-50/50">
                  <td className="py-3 font-medium text-gray-800 flex items-center gap-2.5">
                    <File className="w-4 h-4 text-gray-400" />
                    {doc.name}
                  </td>
                  <td className="py-3 text-gray-500">{doc.uploadDate}</td>
                  <td className="py-3 text-gray-500">{doc.size}</td>
                  <td className="py-3 text-right">
                    <button
                      id={`btn-delete-doc-${doc.id}`}
                      onClick={() => handleFileDelete(doc.id)}
                      className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {currentFiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-xs text-gray-400 font-medium italic">
                    Bu klasörde dosya bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
