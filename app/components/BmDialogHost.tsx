"use client";

// BM-styled replacements for native confirm()/alert()/prompt() ("localhost:3000 says…").
// Imperative API so call sites swap with minimal churn:
//     if (await bmConfirm("Delete this?")) { ... }
//     await bmAlert("Something went wrong.");
//     const reason = await bmPrompt("Reason?", "default");   // string | null
// A single <BmDialogHost/> mounted in the root layout renders the actual BarshModal.

import React, { useEffect, useState } from "react";
import BarshModal from "@/app/components/BarshModal";

type DialogKind = "confirm" | "alert" | "prompt";

type DialogOptions = {
  title?: string;
  message: React.ReactNode;
  submitLabel?: string;
  closeLabel?: string;
  defaultValue?: string;
};

type PendingDialog = DialogOptions & {
  id: number;
  kind: DialogKind;
  resolve: (value: boolean | string | null) => void;
};

let seq = 0;
let listener: ((d: PendingDialog | null) => void) | null = null;

function normalize(input: string | DialogOptions): DialogOptions {
  return typeof input === "string" ? { message: input } : input;
}

function request(kind: DialogKind, input: string | DialogOptions): Promise<boolean | string | null> {
  const opts = normalize(input);
  return new Promise((resolve) => {
    const dialog: PendingDialog = { ...opts, id: ++seq, kind, resolve };
    if (listener) listener(dialog);
    else resolve(kind === "alert" ? true : kind === "prompt" ? null : false); // no host mounted
  });
}

/** BM-styled confirm. Resolves true on the primary action, false on cancel/backdrop. */
export function bmConfirm(input: string | DialogOptions): Promise<boolean> {
  return request("confirm", input).then((v) => v === true);
}

/** BM-styled alert. Resolves when dismissed. */
export function bmAlert(input: string | DialogOptions): Promise<void> {
  return request("alert", input).then(() => undefined);
}

/** BM-styled prompt. Resolves the typed value, or null if cancelled. */
export function bmPrompt(input: string | DialogOptions, defaultValue?: string): Promise<string | null> {
  const opts = normalize(input);
  return request("prompt", { ...opts, defaultValue: defaultValue ?? opts.defaultValue ?? "" }).then((v) =>
    typeof v === "string" ? v : null,
  );
}

export default function BmDialogHost() {
  const [dialog, setDialog] = useState<PendingDialog | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    listener = (d) => {
      setDialog(d);
      setText(d?.kind === "prompt" ? d.defaultValue ?? "" : "");
    };
    return () => {
      if (listener) listener = null;
    };
  }, []);

  if (!dialog) return null;

  const resolveAndClose = (value: boolean | string | null) => {
    dialog.resolve(value);
    setDialog(null);
  };

  const isConfirm = dialog.kind === "confirm";
  const isPrompt = dialog.kind === "prompt";
  const isAlert = dialog.kind === "alert";

  // Cancel value differs by kind: prompt → null, confirm → false, alert → true (dismiss).
  const cancelValue: boolean | string | null = isPrompt ? null : isAlert ? true : false;
  const submitValue: boolean | string | null = isPrompt ? text : true;

  return (
    <BarshModal
      open
      title={dialog.title ?? (isConfirm ? "Please confirm" : isPrompt ? "Enter a value" : "Notice")}
      onClose={() => resolveAndClose(cancelValue)}
      onSubmit={() => resolveAndClose(submitValue)}
      submitLabel={dialog.submitLabel ?? "OK"}
      closeLabel={isAlert ? undefined : dialog.closeLabel ?? "Cancel"}
      initialWidth={440}
      dataModalId="bm-dialog-host"
    >
      <div style={{ padding: 4, fontSize: 14, color: "#1b2a3d", lineHeight: 1.5, whiteSpace: "pre-line" }}>
        {dialog.message}
      </div>
      {isPrompt && (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") resolveAndClose(text); }}
          style={{ marginTop: 10, width: "100%", padding: "8px 10px", border: "1px solid #cdd6e0", borderRadius: 6, fontSize: 14 }}
        />
      )}
    </BarshModal>
  );
}
