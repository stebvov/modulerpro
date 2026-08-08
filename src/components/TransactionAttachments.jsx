"use client";

import { useRef, useState } from "react";
import { useFinanceData } from "@/context/FinanceDataContext";
import { useAuth } from "@/context/AuthContext";

export default function TransactionAttachments({ transactionId, attachments }) {
  const { supabase, reload } = useFinanceData();
  const { canWriteFinance } = useAuth();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const path = `${transactionId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("transaction-files").upload(path, file);
      if (upErr) throw upErr;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("transaction_attachments").insert([
        { transaction_id: transactionId, file_name: file.name, storage_path: path, uploaded_by: user?.id || null },
      ]);
      await reload(true);
    } finally {
      setBusy(false);
    }
  }

  async function openAttachment(path) {
    const { data, error } = await supabase.storage.from("transaction-files").createSignedUrl(path, 60);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function removeAttachment(att) {
    if (!confirm(`Видалити файл «${att.file_name}»?`)) return;
    await supabase.storage.from("transaction-files").remove([att.storage_path]);
    await supabase.from("transaction_attachments").delete().eq("id", att.id);
    await reload(true);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {attachments.map((a) => (
        <span key={a.id} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <span onClick={() => openAttachment(a.storage_path)}>📎 {a.file_name}</span>
          {canWriteFinance && <span className="icon-x" style={{ fontSize: 12 }} onClick={() => removeAttachment(a)}>×</span>}
        </span>
      ))}
      {canWriteFinance && (
        <>
          <input ref={inputRef} type="file" style={{ display: "none" }} onChange={handleUpload} />
          <button className="btn small" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "..." : "+ файл"}
          </button>
        </>
      )}
    </div>
  );
}
