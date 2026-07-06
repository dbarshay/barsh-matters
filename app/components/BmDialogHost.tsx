"use client";

// BM-styled replacements for the native browser confirm()/alert() ("localhost:3000 says…").
// Imperative API so call sites can swap with minimal churn:
//     if (await bmConfirm("Delete this?")) { ... }
//     await bmAlert("Something went wrong.");
// A single <BmDialogHost/> mounted in the root layout renders the actual BarshModal.

import React, { useEffect, useState } from "react";
import BarshModal from "@/app/components/BarshModal";

type DialogKind = "confirm" | "alert";

type DialogOptions = {
  title?: string;
  message: React.ReactNode;
  submitLabel?: string;
  closeLabel?: string;
};

type PendingDialog = DialogOptions & {
  id: number;
  kind: DialogKind;
  resolve: (value: boolean) => void;
};

let seq = 0;
let listener: ((d: PendingDialog | null) => void) | null = null;

function normalize(input: string | DialogOptions): DialogOptions {
  return typeof input === "string" ? { message: input } : input;
}

function request(kind: DialogKind, input: string | DialogOptions): Promise<boolean> {
  const opts = normalize(input);
  return new Promise<boolean>((resolve) => {
    const dialog: PendingDialog = { ...opts, id: ++seq, kind, resolve };
    if (listener) listener(dialog);
    else resolve(kind === "alert"); // no host mounted → don't hard-block
  });
}

/** BM-styled confirm. Resolves true on the primary action, false on cancel/backdrop. */
export function bmConfirm(input: string | DialogOptions): Promise<boolean> {
  return request("confirm", input);
}

/** BM-styled alert. Resolves when dismissed. */
export function bmAlert(input: string | DialogOptions): Promise<void> {
  return request("alert", input).then(() => undefined);
}

export default function BmDialogHost() {
  const [dialog, setDialog] = useState<PendingDialog | null>(null);

  useEffect(() => {
    listener = setDialog;
    return () => {
      if (listener === setDialog) listener = null;
    };
  }, []);

  if (!dialog) return null;

  const close = (value: boolean) => {
    dialog.resolve(value);
    setDialog(null);
  };

  const isConfirm = dialog.kind === "confirm";

  return (
    <BarshModal
      open
      title={dialog.title ?? (isConfirm ? "Please confirm" : "Notice")}
      onClose={() => close(false)}
      onSubmit={() => close(true)}
      submitLabel={dialog.submitLabel ?? (isConfirm ? "OK" : "OK")}
      closeLabel={isConfirm ? dialog.closeLabel ?? "Cancel" : undefined}
      hideFooter={false}
      footer={
        isConfirm
          ? undefined
          : (
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px", gap: 10 }}>
              <button
                type="button"
                onClick={() => close(true)}
                style={{ minWidth: 96, height: 38, border: "1px solid #00346e", borderRadius: 10, background: "#00346e", color: "#fff", fontWeight: 900, cursor: "pointer" }}
              >
                {dialog.submitLabel ?? "OK"}
              </button>
            </div>
          )
      }
      initialWidth={440}
      dataModalId="bm-dialog-host"
    >
      <div style={{ padding: 4, fontSize: 14, color: "#1b2a3d", lineHeight: 1.5, whiteSpace: "pre-line" }}>{dialog.message}</div>
    </BarshModal>
  );
}
