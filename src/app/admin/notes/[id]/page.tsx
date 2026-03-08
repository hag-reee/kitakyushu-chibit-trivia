"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import type { Note, SourceStatus } from "@/lib/types";

// Extended Source Interface
interface Source {
    id: string;
    title: string;
    source_type: string;
    trust_level: string;
    url?: string;
}

export default function NoteDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [note, setNote] = useState<Note | null>(null);
    const [linkedSources, setLinkedSources] = useState<Source[]>([]);

    // For Linking Modal
    const [allSources, setAllSources] = useState<Source[]>([]);
    const [isLinking, setIsLinking] = useState(false);
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [synthesizing, setSynthesizing] = useState(false);
    const [error, setError] = useState("");

    const [editMode, setEditMode] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");

    const fetchNote = async () => {
        try {
            const res = await fetch(`/api/admin/notes/${params.id}`);
            if (!res.ok) throw new Error("Failed to fetch note");
            const data = await res.json();
            setNote(data.note);
            setLinkedSources(data.sources || []);
            setEditTitle(data.note.title);
            setEditDescription(data.note.description);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error loading note");
        } finally {
            setLoading(false);
        }
    };

    const fetchAllSources = async () => {
        try {
            const res = await fetch("/api/admin/sources");
            if (!res.ok) throw new Error("Failed to fetch sources");
            const data = await res.json();
            setAllSources(data.sources || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchNote();
        fetchAllSources();
    }, [params.id]);

    const handleSaveNote = async () => {
        if (!note) return;
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/notes/${note.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editTitle,
                    description: editDescription,
                }),
            });
            if (!res.ok) throw new Error("Failed to save");
            const data = await res.json();
            setNote(data.note);
            setEditMode(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error saving note");
        } finally {
            setSaving(false);
        }
    };

    const handleLinkModalOpen = () => {
        setSelectedSourceIds(new Set(linkedSources.map(s => s.id)));
        setIsLinking(true);
    };

    const handleToggleLink = async (sourceId: string, add: boolean) => {
        if (!note) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/notes/${note.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    [add ? "add_source_id" : "remove_source_id"]: sourceId
                }),
            });
            if (!res.ok) throw new Error("Failed to update link");
            await fetchNote();
        } catch (err) {
            alert("Error linking source");
        } finally {
            setSaving(false);
        }
    };

    const handleSynthesize = async () => {
        if (!note || linkedSources.length === 0) {
            alert("最低でも1つのソースを紐付けてください。");
            return;
        }

        if (!confirm("紐付けられたソースをAIに読み込ませて要約を生成します。現在のノートの説明文は上書きされますがよろしいですか？")) return;

        setSynthesizing(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/notes/${note.id}/synthesize`, {
                method: "POST"
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to synthesize");
            }

            const data = await res.json();
            setNote(data.note);
            setEditDescription(data.note.description);
            alert("AI要約が完了しました！");

        } catch (err) {
            setError(err instanceof Error ? err.message : "AI Error");
        } finally {
            setSynthesizing(false);
        }
    };

    const handleDelete = async () => {
        if (!note || !confirm("このノートを削除しますか？")) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/notes/${note.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            router.push("/admin/notes");
        } catch (err) {
            alert("Failed to delete note");
            setSaving(false);
        }
    };

    if (loading) return <div className="admin-page"><div className="admin-loading">ローディング中...</div></div>;
    if (!note) return <div className="admin-page"><div className="admin-empty">ノートが見つかりません</div></div>;

    return (
        <div className="admin-page">
            <div className="admin-header">
                <button onClick={() => router.push("/admin/notes")} className="admin-btn-ghost" style={{ marginBottom: "16px", padding: "6px 12px" }}>
                    ← ノート一覧に戻る
                </button>
                <div className="admin-header-row">
                    <div>
                        <h1 className="admin-title">📓 ノート詳細</h1>
                        <p className="admin-subtitle">ソースを束ねて文脈を作り、AIに背景知識を与えます。</p>
                    </div>
                </div>
            </div>

            {error && <div className="admin-alert admin-alert-error">{error}</div>}

            <div className="admin-detail-card" style={{ marginBottom: "32px" }}>
                {editMode ? (
                    <div className="admin-form">
                        <div className="admin-form-group">
                            <label className="admin-label">ノート名 <span className="admin-required">*</span></label>
                            <input
                                type="text"
                                className="admin-input"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-label">テーマ解説文（AI生成 または 手動入力）</label>
                            <p className="admin-hint">このテキストがトリビア生成時にAIへ「事前知識」として連携されます。</p>
                            <textarea
                                className="admin-textarea"
                                rows={8}
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                            />
                        </div>
                        <div className="admin-form-actions">
                            <button className="admin-btn-ghost" onClick={() => {
                                setEditTitle(note.title);
                                setEditDescription(note.description);
                                setEditMode(false);
                            }}>キャンセル</button>
                            <button className="admin-btn-primary" onClick={handleSaveNote} disabled={saving}>保存する</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                            <div>
                                <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#fff", marginBottom: "8px" }}>{note.title}</h2>
                                <div className="admin-tags">
                                    <span className={`admin-status admin-status-${note.status}`}>
                                        {note.status === "published" ? "公開中" : "下書き"}
                                    </span>
                                    {note.keyword_tags.map(tag => (
                                        <span key={tag} className="admin-tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="admin-actions">
                                <button className="admin-btn-ghost admin-btn-sm" onClick={() => setEditMode(true)}>基本情報を編集</button>
                                <button className="admin-btn-ghost admin-btn-sm admin-btn-danger" onClick={handleDelete}>削除</button>
                            </div>
                        </div>

                        <div className="admin-form-group" style={{ background: "#0a0a0a", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <label className="admin-label" style={{ margin: 0 }}>テーマ解説文（AI事前知識）</label>
                                <button
                                    className="admin-btn-primary"
                                    style={{ padding: "6px 14px", fontSize: "0.75rem", background: "linear-gradient(45deg, #ff4800, #ff007b)" }}
                                    onClick={handleSynthesize}
                                    disabled={synthesizing || linkedSources.length === 0}
                                >
                                    {synthesizing ? "AI要約生成中..." : "✨ AIで自動生成（要約）"}
                                </button>
                            </div>
                            <div className="admin-pre" style={{ whiteSpace: "pre-wrap", color: note.description ? "#ddd" : "#666", minHeight: "80px" }}>
                                {note.description || "解説文がありません。ソースを紐付けてAI自動生成を実行するか、編集から入力してください。"}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="admin-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 className="admin-section-title">🔗 紐付けられたソース ({linkedSources.length}件)</h3>
                    <button className="admin-btn-ghost admin-btn-sm" onClick={handleLinkModalOpen}>+ 紐付けの管理</button>
                </div>

                {linkedSources.length === 0 ? (
                    <div className="admin-empty-state" style={{ background: "#111", borderRadius: "10px", padding: "30px", border: "1px dashed rgba(255,255,255,0.1)" }}>
                        <p>まだ紐付けられたソースはありません。<br />「紐付けの管理」から関連するソースを追加してください。</p>
                        <button className="admin-btn-primary" onClick={handleLinkModalOpen}>+ ソースを追加する</button>
                    </div>
                ) : (
                    <div className="admin-card-grid">
                        {linkedSources.map(source => (
                            <div key={source.id} className="admin-chunk-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div className="admin-chunk-header">
                                    <span className="admin-badge genre">{source.source_type}</span>
                                    <span style={{ fontSize: "0.7rem", color: "#666" }}>信頼度: {source.trust_level}</span>
                                </div>
                                <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#fff" }}>
                                    {source.title}
                                </div>
                                <div className="admin-actions" style={{ marginTop: "auto", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)", justifyContent: "space-between" }}>
                                    <button
                                        className="admin-btn-ghost admin-btn-sm"
                                        onClick={() => router.push(`/admin/sources/${source.id}`)}
                                    >ソース詳細</button>
                                    <button
                                        className="admin-btn-ghost admin-btn-sm admin-btn-danger"
                                        onClick={() => handleToggleLink(source.id, false)}
                                        disabled={saving}
                                    >解除</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Linking Modal */}
            {isLinking && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div className="admin-card" style={{ width: "90%", maxWidth: "600px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
                        <div className="admin-card-header" style={{ marginBottom: "16px" }}>
                            <h3 className="admin-title" style={{ fontSize: "1.2rem" }}>ソースの紐付け管理</h3>
                            <button className="admin-btn-ghost admin-btn-sm" onClick={() => setIsLinking(false)}>閉じる</button>
                        </div>

                        <div style={{ overflowY: "auto", flex: 1, paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {allSources.length === 0 ? (
                                <p className="admin-empty" style={{ padding: "20px" }}>登録されているソースがありません。</p>
                            ) : (
                                allSources.map(source => {
                                    const isLinked = selectedSourceIds.has(source.id);
                                    return (
                                        <div key={source.id} style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "12px", background: "#1a1a1a", borderRadius: "8px",
                                            border: `1px solid ${isLinked ? "rgba(255, 72, 0, 0.4)" : "rgba(255,255,255,0.05)"}`
                                        }}>
                                            <div style={{ paddingRight: "16px" }}>
                                                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}>
                                                    <span className="admin-badge genre">{source.source_type}</span>
                                                    <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#fff" }}>{source.title}</span>
                                                </div>
                                            </div>
                                            <button
                                                className={`admin-status-btn ${isLinked ? "admin-status-stopped" : "admin-status-published"}`}
                                                onClick={async () => {
                                                    await handleToggleLink(source.id, !isLinked);
                                                    setSelectedSourceIds(prev => {
                                                        const fresh = new Set(prev);
                                                        if (isLinked) fresh.delete(source.id);
                                                        else fresh.add(source.id);
                                                        return fresh;
                                                    });
                                                }}
                                                disabled={saving}
                                            >
                                                {isLinked ? "解除する" : "追加する"}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
