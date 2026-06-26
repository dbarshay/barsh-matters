"use client";

import { useMemo, useRef, useState } from "react";
import CreateTemplateMetadataShell from "./CreateTemplateMetadataShell";

type ScanStatus = "checking" | "compatible" | "warning" | "error";

type ZipEntry = {
  name: string;
  compressedSize: number;
  localHeaderOffset: number;
  compressionMethod: number;
};

type ScanResult = {
  fileName: string;
  status: ScanStatus;
  message: string;
  tokens: string[];
  unknownTokens: string[];
  partCount: number;
};

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function utf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function inflate(bytes: Uint8Array) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseZip(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let endOffset = -1;

  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (u32(view, i) === 0x06054b50) {
      endOffset = i;
      break;
    }
  }

  if (endOffset < 0) {
    throw new Error("The selected file is not a readable DOCX zip package.");
  }

  const entryCount = u16(view, endOffset + 10);
  let offset = u32(view, endOffset + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i += 1) {
    if (u32(view, offset) !== 0x02014b50) {
      throw new Error("The DOCX central directory is malformed.");
    }

    const compressionMethod = u16(view, offset + 10);
    const compressedSize = u32(view, offset + 20);
    const fileNameLength = u16(view, offset + 28);
    const extraLength = u16(view, offset + 30);
    const commentLength = u16(view, offset + 32);
    const localHeaderOffset = u32(view, offset + 42);
    const nameStart = offset + 46;
    const name = utf8(bytes.slice(nameStart, nameStart + fileNameLength));

    entries.push({ name, compressedSize, localHeaderOffset, compressionMethod });
    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function extractPart(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const localOffset = entry.localHeaderOffset;

  if (u32(view, localOffset) !== 0x04034b50) {
    throw new Error("A DOCX part has a malformed local file header.");
  }

  const fileNameLength = u16(view, localOffset + 26);
  const extraLength = u16(view, localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return await inflate(compressed);

  throw new Error("Unsupported DOCX compression method: " + entry.compressionMethod);
}

function xmlText(xml: string) {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, String.fromCharCode(39));
}

function findTokens(text: string) {
  const tokens = new Set<string>();
  const regex = /\{\{[^{}\r\n]+\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    tokens.add(match[0].replace(/\s+/g, ""));
  }

  return Array.from(tokens).sort((a, b) => a.localeCompare(b));
}

function pageTokens() {
  const tokens = new Set<string>();

  document.querySelectorAll("[data-template-merge-field-token]").forEach((node) => {
    const token = node.getAttribute("data-template-merge-field-token");
    if (token !== null && token.length > 0) {
      tokens.add(token.replace(/\s+/g, ""));
    }
  });

  if (tokens.size === 0) {
    document.querySelectorAll("code").forEach((node) => {
      const text = node.textContent || "";
      if (text.includes("{{") && text.includes("}}")) {
        tokens.add(text.replace(/\s+/g, ""));
      }
    });
  }

  return tokens;
}

async function scanDocx(file: File): Promise<ScanResult> {
  if (file.name.toLowerCase().endsWith(".docx") === false) {
    return {
      fileName: file.name,
      status: "error",
      message: "Select a .docx file. Legacy .doc, PDF, and image files are not accepted.",
      tokens: [],
      unknownTokens: [],
      partCount: 0,
    };
  }

  const buffer = await file.arrayBuffer();
  const entries = parseZip(buffer);
  const hasContentTypes = entries.some((entry) => entry.name === "[Content_Types].xml");
  const hasMainDocument = entries.some((entry) => entry.name === "word/document.xml");

  if (hasContentTypes === false || hasMainDocument === false) {
    return {
      fileName: file.name,
      status: "error",
      message: "This file is not a valid Word DOCX package with a main document part.",
      tokens: [],
      unknownTokens: [],
      partCount: entries.length,
    };
  }

  const textEntries = entries.filter((entry) => (
    entry.name === "word/document.xml" ||
    /^word\/header\d+\.xml$/.test(entry.name) ||
    /^word\/footer\d+\.xml$/.test(entry.name)
  ));

  let combined = "";
  for (const entry of textEntries) {
    combined += "\n" + xmlText(utf8(await extractPart(buffer, entry)));
  }

  const tokens = findTokens(combined);
  const canonical = pageTokens();
  const unknownTokens = tokens.filter((token) => canonical.has(token) === false);

  if (tokens.length === 0) {
    return {
      fileName: file.name,
      status: "warning",
      message: "DOCX is readable, but no canonical merge fields were found.",
      tokens,
      unknownTokens,
      partCount: entries.length,
    };
  }

  if (unknownTokens.length > 0) {
    return {
      fileName: file.name,
      status: "warning",
      message: "DOCX is readable, but some tokens are not currently visible in the Template Builder canonical field table.",
      tokens,
      unknownTokens,
      partCount: entries.length,
    };
  }

  return {
    fileName: file.name,
    status: "compatible",
    message: "DOCX is readable and all discovered tokens match visible canonical Template Builder fields.",
    tokens,
    unknownTokens,
    partCount: entries.length,
  };
}

export default function TemplateDocxCompatibilityUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);

  const borderColor = useMemo(() => {
    if (isDragging) return "#1d4ed8";
    if (result?.status === "compatible") return "#16a34a";
    if (result?.status === "warning") return "#d97706";
    if (result?.status === "error") return "#dc2626";
    return "#cbd5e1";
  }, [isDragging, result?.status]);

  async function handleFile(file: File | undefined) {
    if (file === undefined) return;

    setShowCreateTemplateModal(false);

    setResult({
      fileName: file.name,
      status: "checking",
      message: "Checking DOCX compatibility locally in this browser.",
      tokens: [],
      unknownTokens: [],
      partCount: 0,
    });

    try {
      const scanResult = await scanDocx(file);
      setResult(scanResult);
      if (scanResult.status === "compatible") {
        setShowCreateTemplateModal(true);
      }
    } catch (error) {
      setResult({
        fileName: file.name,
        status: "error",
        message: error instanceof Error ? error.message : "Unable to inspect the selected DOCX.",
        tokens: [],
        unknownTokens: [],
        partCount: 0,
      });
    }
  }

  return (
    <section aria-label="Upload template compatibility check" style={{ border: "1px solid #cbd5e1", borderRadius: "12px", padding: "16px", margin: "16px 0 18px", background: "#ffffff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: "18px", color: "#111827" }}>Upload Template</h2>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.45 }}>
            Drag a fresh local DOCX here, or pick a file, to check whether its merge fields match the canonical Template Builder fields.
          </p>
        </div>

        <button type="button" onClick={() => inputRef.current?.click()} style={{ border: "1px solid #1e3a8a", borderRadius: "8px", background: "#ffffff", color: "#1e3a8a", fontWeight: 700, padding: "10px 14px", cursor: "pointer" }}>
          Choose DOCX
        </button>
      </div>

      <input ref={inputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => handleFile(event.currentTarget.files?.[0])} style={{ display: "none" }} />

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files?.[0]);
        }}
        style={{ marginTop: "14px", border: "2px dashed " + borderColor, borderRadius: "12px", padding: "22px", textAlign: "center", background: isDragging ? "#eff6ff" : "#f8fafc", color: "#334155", cursor: "pointer" }}
      >
        Drop DOCX here or click to select a local Word document.
      </div>

      {result && (
        <div style={{ marginTop: "14px", border: "1px solid " + borderColor, borderRadius: "10px", padding: "12px", background: result.status === "compatible" ? "#f0fdf4" : result.status === "warning" ? "#fffbeb" : result.status === "error" ? "#fef2f2" : "#f8fafc" }}>
          <div style={{ fontWeight: 700, color: "#111827" }}>{result.fileName}</div>
          <div style={{ marginTop: "4px", color: "#374151" }}>{result.message}</div>

          {result.partCount > 0 && (
            <div style={{ marginTop: "6px", fontSize: "13px", color: "#64748b" }}>
              DOCX package parts inspected: {result.partCount}
            </div>
          )}

          {result.tokens.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>Discovered merge fields</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {result.tokens.map((token) => (
                  <code key={token} style={{ border: "1px solid #cbd5e1", borderRadius: "999px", padding: "4px 8px", background: "#ffffff" }}>{token}</code>
                ))}
              </div>
            </div>
          )}

          {result.unknownTokens.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div style={{ fontWeight: 700, marginBottom: "4px", color: "#92400e" }}>Needs review</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {result.unknownTokens.map((token) => (
                  <code key={token} style={{ border: "1px solid #f59e0b", borderRadius: "999px", padding: "4px 8px", background: "#ffffff" }}>{token}</code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateTemplateModal && result?.status === "compatible" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create Template metadata after compatibility check"
          data-template-create-metadata-popup="phase1j"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "min(1180px, 96vw)",
              maxHeight: "88vh",
              overflow: "auto",
              borderRadius: "16px",
              background: "#ffffff",
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.35)",
              border: "1px solid #1e3a8a",
            }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                background: "#1e3a8a",
                color: "#ffffff",
                padding: "16px 18px",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: "18px" }}>Create Template</div>
                <div style={{ marginTop: "4px", fontSize: "13px", opacity: 0.9 }}>
                  Compatibility check passed for {result.fileName}. Complete the metadata setup next.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTemplateModal(false)}
                style={{
                  border: "1px solid rgba(255,255,255,0.75)",
                  background: "#ffffff",
                  color: "#1e3a8a",
                  borderRadius: "999px",
                  padding: "8px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </header>
            <div style={{ padding: "18px" }}>
              <CreateTemplateMetadataShell />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
