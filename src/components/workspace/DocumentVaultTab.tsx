import React, { useState } from "react";
import { CompanyWorkspaceExtended, DocumentItem } from "../../types/workspace";
import { Folder, FolderOpen, File, Plus, Trash2, Search, Upload, Download, AlertTriangle } from "lucide-react";

// Vercel's Node serverless functions cap request body size well below the app's own 20mb Express
// limit (historically ~4.5MB) — this app has no separate blob/object storage, so document content
// is stored as a base64 data URI inside the same JSONB blob as the rest of the customer workspace
// (see saveWorkspaceData in CustomerRecords.tsx). Base64 adds ~33% overhead on top of the raw file
// size, so the real ceiling for the original file is well under 4.5MB — capped conservatively here.
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

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
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Reads the actual file bytes (as a base64 data URI) and appends a real, retrievable document —
  // previously this only ever recorded the filename/size as metadata and never touched the file's
  // content, so nothing was actually stored anywhere.
  const handleUploadFile = (file: File) => {
    setUploadError(null);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`"${file.name}" çok büyük (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maksimum dosya boyutu ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB.`);
      return;
    }
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + " MB";
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const newDoc: DocumentItem = {
        id: "doc_" + Math.random().toString(36).substring(2, 9),
        name: file.name,
        folder: selectedFolder,
        size: sizeMB,
        uploadDate: new Date().toISOString().split("T")[0],
        url: dataUrl
      };
      onUpdateDocuments([...workspace.documents, newDoc]);
    };
    reader.onerror = () => setUploadError(`"${file.name}" okunamadı.`);
    reader.readAsDataURL(file);
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
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(e.target.files[0]);
    }
    e.target.value = "";
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

        {uploadError && (
          <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl font-medium text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

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
                  <td className="py-3 text-right whitespace-nowrap">
                    {doc.url ? (
                      <a
                        href={doc.url}
                        download={doc.name}
                        className="text-gray-400 hover:text-zinc-900 p-1.5 hover:bg-gray-100 rounded-lg transition-colors inline-flex"
                        title="İndir"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-300 italic mr-1" title="Bu belge eski sürümde sadece bilgi olarak kaydedilmiş, dosya içeriği yok.">
                        içerik yok
                      </span>
                    )}
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
