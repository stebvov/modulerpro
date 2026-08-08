"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { roleLabels } from "@/lib/format";
import ChangePasswordModal from "@/components/modals/ChangePasswordModal";

function publicAvatarUrl(supabase, path) {
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

function initials(name, email) {
  const src = (name || email || "?").trim();
  return src.slice(0, 1).toUpperCase();
}

function avatarPath(userId, fileName) {
  return `${userId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export default function ProfileMenu() {
  const supabase = createClient();
  const { profile, user, role, signOut, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [avatars, setAvatars] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [nameEdit, setNameEdit] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [error, setError] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  async function loadAvatars() {
    const { data } = await supabase.from("profile_avatars").select("*").eq("profile_id", user.id).order("created_at");
    setAvatars(data || []);
  }

  function handleOpen() {
    setOpen(true);
    setError("");
    setNameEdit(profile?.full_name || "");
    if (avatars === null) loadAvatars();
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    setError("");
    try {
      const path = avatarPath(user.id, file.name);
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("profile_avatars").insert([{ profile_id: user.id, file_path: path }]);
      if (insErr) throw insErr;
      if (!avatars?.length) {
        await supabase.from("profiles").update({ avatar_url: publicAvatarUrl(supabase, path) }).eq("id", user.id);
      }
      await loadAvatars();
      await refreshProfile();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleSetPrimary(avatar) {
    await supabase.from("profiles").update({ avatar_url: publicAvatarUrl(supabase, avatar.file_path) }).eq("id", user.id);
    await refreshProfile();
  }

  async function handleDelete(avatar) {
    const wasPrimary = profile?.avatar_url === publicAvatarUrl(supabase, avatar.file_path);
    await supabase.storage.from("avatars").remove([avatar.file_path]);
    await supabase.from("profile_avatars").delete().eq("id", avatar.id);
    const remaining = (avatars || []).filter((a) => a.id !== avatar.id);
    if (wasPrimary) {
      const next = remaining[0] ? publicAvatarUrl(supabase, remaining[0].file_path) : null;
      await supabase.from("profiles").update({ avatar_url: next }).eq("id", user.id);
    }
    await loadAvatars();
    await refreshProfile();
  }

  async function handleSaveName() {
    if (!nameEdit.trim()) return;
    setNameSaving(true);
    setError("");
    try {
      const { error: e } = await supabase.from("profiles").update({ full_name: nameEdit.trim() }).eq("id", user.id);
      if (e) throw e;
      await refreshProfile();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setNameSaving(false);
    }
  }

  return (
    <div
      className="profile-menu"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button type="button" className="profile-menu-btn" onClick={() => (open ? setOpen(false) : handleOpen())}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="profile-avatar" />
        ) : (
          <span className="profile-avatar profile-avatar-fallback">{initials(profile?.full_name, user?.email)}</span>
        )}
      </button>

      {open && (
        <div className="profile-menu-panel">
          <div className="profile-menu-head">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="profile-avatar lg" />
            ) : (
              <span className="profile-avatar lg profile-avatar-fallback">{initials(profile?.full_name, user?.email)}</span>
            )}
            <div>
              <div className="profile-menu-name">{profile?.full_name || user?.email}</div>
              <span className={`role-pill ${role}`}>{roleLabels[role] || role}</span>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="form-row">
            <label>Ім&apos;я</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={nameEdit} onChange={(e) => setNameEdit(e.target.value)} />
              <button className="btn small" onClick={handleSaveName} disabled={nameSaving}>Зберегти</button>
            </div>
          </div>

          <div className="form-row">
            <label>Фото профілю</label>
            <div className="profile-avatar-grid">
              {(avatars || []).map((a) => {
                const url = publicAvatarUrl(supabase, a.file_path);
                const isPrimary = profile?.avatar_url === url;
                return (
                  <div key={a.id} className={`profile-avatar-thumb${isPrimary ? " primary" : ""}`}>
                    <button type="button" onClick={() => handleSetPrimary(a)} title={isPrimary ? "Головне фото" : "Зробити головним"}>
                      <img src={url} alt="" />
                    </button>
                    <button type="button" className="profile-avatar-thumb-x" onClick={() => handleDelete(a)} title="Видалити">×</button>
                  </div>
                );
              })}
              <button className="profile-avatar-add" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Завантажити фото">
                {uploading ? "…" : "+"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
            </div>
          </div>

          <div className="profile-menu-actions">
            <button className="btn small" onClick={() => setPasswordModalOpen(true)}>Змінити пароль</button>
            <button className="btn small" onClick={signOut}>Вийти</button>
          </div>
        </div>
      )}

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
}
