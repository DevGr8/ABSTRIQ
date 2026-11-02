import React, { useState } from "react";
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  FileCode,
  Globe,
  Clock,
  Hash,
  BookOpen,
} from "lucide-react";

interface ProvenancePanelProps {
  provenance: any;
  originalAbstract?: string;
  currentAbstract?: string;
}

export const ProvenancePanel: React.FC<ProvenancePanelProps> = ({
  provenance,
  originalAbstract,
  currentAbstract,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showOriginalComparison, setShowOriginalComparison] = useState(false);

  if (!provenance) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const version = provenance.provenanceVersion || provenance.provenance_version || "3.2.0";
  const provider = provenance.sourceProvider || provenance.source_provider || "Verified Source";
  const sourceUrl = provenance.sourceUrl || provenance.source_url;
  const doi = provenance.doi;
  const paperTitle = provenance.paperTitle || provenance.paper_title;
  const authors = provenance.authors;
  const venue = provenance.publicationVenue || provenance.venue;
  const year = provenance.publicationYear || provenance.year;
  const retrievedAt = provenance.retrievedAt || provenance.retrieval_timestamp_utc || "N/A";
  const extractionMethod = provenance.extractionMethod || provenance.extraction_method || "automated_extraction";
  const extractionSource = provenance.extractionSource || provenance.extraction_source || "source_pipeline";
  const recordId = provenance.originalApiRecordId || provenance.original_record_id;
  const operationId = provenance.importOperationId || provenance.import_operation_id;
  const origHash = provenance.originalTextHash || provenance.original_text_hash || "";
  const normHash = provenance.normalizedTextHash || provenance.normalized_text_hash || "";
  const docHash = provenance.documentHash || provenance.document_hash;

  const isEdited =
    Boolean(provenance.manuallyEdited || provenance.manually_edited) ||
    Boolean(originalAbstract && currentAbstract && originalAbstract.trim() !== currentAbstract.trim());

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 overflow-hidden text-xs font-sans transition-all">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-emerald-500/10 transition-colors"
      >
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-mono font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Academic Source Provenance</span>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30">
            {provider}
          </span>

          {doi && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] border border-cyan-500/30">
              DOI: {doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}
            </span>
          )}

          {isEdited && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30 flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Edited After Import</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span className="text-[11px] font-mono">
            {isOpen ? "Hide Details" : "View Source & Extraction Details"}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-4 border-t border-emerald-500/20 space-y-4 bg-slate-950/60 font-mono">
          {/* Modification Alert if user altered the abstract */}
          {isEdited && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px] font-sans">
                <div className="font-semibold text-amber-200">
                  Abstract Text Modified After Import
                </div>
                <div className="text-amber-300/80">
                  The evaluated text differs from the original extracted text. Academic integrity
                  is maintained: the original text and its SHA-256 hash are immutably preserved in
                  this provenance record.
                </div>
                {originalAbstract && (
                  <button
                    type="button"
                    onClick={() => setShowOriginalComparison(!showOriginalComparison)}
                    className="text-amber-200 underline hover:text-white pt-1 text-[11px] block font-mono"
                  >
                    {showOriginalComparison ? "Hide Original Text" : "Compare Original Text"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Original Text Drawer */}
          {showOriginalComparison && originalAbstract && (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Original Extracted Abstract:
              </div>
              <p className="text-slate-300 text-[11px] font-sans leading-relaxed italic border-l-2 border-emerald-500/40 pl-3 py-1">
                {originalAbstract}
              </p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Source Identification */}
            <div className="space-y-2 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Source Identification</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div>
                  <span className="text-slate-500">Provider:</span>{" "}
                  <span className="text-white font-medium">{provider}</span>
                </div>
                {paperTitle && (
                  <div>
                    <span className="text-slate-500">Paper Title:</span>{" "}
                    <span className="text-white">{paperTitle}</span>
                  </div>
                )}
                {authors && (
                  <div>
                    <span className="text-slate-500">Authors:</span>{" "}
                    <span className="text-slate-300">
                      {Array.isArray(authors) ? authors.join(", ") : authors}
                    </span>
                  </div>
                )}
                {(venue || year) && (
                  <div>
                    <span className="text-slate-500">Publication:</span>{" "}
                    <span className="text-slate-300">
                      {venue || "N/A"} {year ? `(${year})` : ""}
                    </span>
                  </div>
                )}
                {doi && (
                  <div className="flex items-center space-x-1.5 pt-1">
                    <span className="text-slate-500">DOI:</span>
                    <a
                      href={doi.startsWith("http") ? doi : `https://doi.org/${doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center space-x-1"
                    >
                      <span className="break-all">{doi}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}
                {sourceUrl && (
                  <div className="flex items-center space-x-1.5 pt-0.5">
                    <span className="text-slate-500">URL:</span>
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center space-x-1 truncate max-w-[280px]"
                    >
                      <span className="truncate">{sourceUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Extraction & Retrieval Details */}
            <div className="space-y-2 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold flex items-center space-x-1.5">
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Extraction &amp; Pipeline</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div>
                  <span className="text-slate-500">Extraction Method:</span>{" "}
                  <code className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
                    {extractionMethod}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500">Extraction Source:</span>{" "}
                  <span className="text-slate-300">{extractionSource}</span>
                </div>
                <div>
                  <span className="text-slate-500">Retrieval UTC:</span>{" "}
                  <span className="text-slate-300 flex items-center space-x-1 inline">
                    <Clock className="w-3 h-3 inline text-slate-500" />
                    <span>{retrievedAt}</span>
                  </span>
                </div>
                {recordId && (
                  <div>
                    <span className="text-slate-500">API Record ID:</span>{" "}
                    <span className="text-slate-400 break-all">{recordId}</span>
                  </div>
                )}
                {operationId && (
                  <div>
                    <span className="text-slate-500">Operation ID:</span>{" "}
                    <span className="text-slate-400 break-all">{operationId}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Schema Version:</span>{" "}
                  <span className="text-emerald-400 font-mono">v{version}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Cryptographic Hashes (SHA-256) */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center space-x-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span>SHA-256 Cryptographic Integrity Verification</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Original Hash */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Original Abstract Hash:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(origHash, "orig")}
                    className="hover:text-white flex items-center space-x-1"
                  >
                    {copiedHash === "orig" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedHash === "orig" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-slate-950 font-mono text-[10px] text-slate-300 break-all select-all border border-slate-800">
                  {origHash}
                </div>
              </div>

              {/* Normalized Hash */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Normalized Abstract Hash:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(normHash, "norm")}
                    className="hover:text-white flex items-center space-x-1"
                  >
                    {copiedHash === "norm" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedHash === "norm" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-slate-950 font-mono text-[10px] text-slate-300 break-all select-all border border-slate-800">
                  {normHash}
                </div>
              </div>

              {/* Document Hash if file was uploaded */}
              {docHash && (
                <div className="space-y-1 md:col-span-2">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span>Original Document File SHA-256:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(docHash, "doc")}
                      className="hover:text-white flex items-center space-x-1"
                    >
                      {copiedHash === "doc" ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedHash === "doc" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded bg-slate-950 font-mono text-[10px] text-purple-300 break-all select-all border border-slate-800">
                    {docHash}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
