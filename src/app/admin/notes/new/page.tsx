"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewNotePage() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [keywordTags, setKeywordTags] = useState("");
    const [status, setStatus] = useState("draft");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        if (!title.trim()) { setError("ノート名は必須です"); return; }
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/admin/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    keyword_tags: keywordTags.split(/[,、\s]+/).filter(Boolean),
                    status,
                }),
            });
            if (!res.ok) { const d = await res.json(); setError(d.error || "保存に失敗しました"); return; }
            router.push("/admin/notes");
        } catch { setError("保存中にエラー"); }
        finally { setSaving(false); }
    };

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-row">
                    <div>
                        <h1 className="admin-title">📓 ノート作成</h1>
                        <p className="admin-subtitle">新しいノートを作成します</p>
                    </div>
                    <button className="admin-btn-ghost" onClick={() => router.back()}>← 戻る</button>
                </div>
            </header>

            {error && <div className="admin-alert admin-alert-error">{error}</div>}

            <div className="admin-form">
                <div className="admin-form-group">
                    <label className="admin-label">ノート名 <span className="admin-required">必須</span></label>
                    <input type="text" className="admin-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 北九州グルメノート" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-label">説明</label>
                    <textarea className="admin-textarea" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="ノートの説明（任意）" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-label">関連キーワード</label>
                    <input type="text" className="admin-input" value={keywordTags} onChange={e => setKeywordTags(e.target.value)} placeholder="カンマ区切り" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-label">状態</label>
                    <select className="admin-select" value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="draft">下書き</option>
                        <option value="published">公開</option>
                        <option value="stopped">停止</option>
                    </select>
                </div>
                <div className="admin-form-actions">
                    <button className="admin-btn-ghost" onClick={() => router.back()}>キャンセル</button>
                    <button className="admin-btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? "保存中..." : "ノートを作成"}</button>
                </div>
            </div>
        </div>
    );
}
