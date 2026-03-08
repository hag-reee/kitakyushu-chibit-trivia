"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface NoteItem {
    id: string; title: string; description: string;
    keyword_tags: string[]; status: string; updated_at: string;
}

const STATUS_LABELS: Record<string, string> = { draft: "下書き", published: "公開", stopped: "停止" };

export default function NotesPage() {
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/notes");
            if (res.ok) { const data = await res.json(); setNotes(data.notes || []); }
        } catch (err) { console.error(err); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchNotes(); }, [fetchNotes]);

    const handleDelete = async (id: string) => {
        if (!confirm("このノートを削除しますか？")) return;
        await fetch(`/api/admin/notes/${id}`, { method: "DELETE" });
        fetchNotes();
    };

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-row">
                    <div>
                        <h1 className="admin-title">📓 ノート管理</h1>
                        <p className="admin-subtitle">テーマごとにソースをまとめて管理</p>
                    </div>
                    <button className="admin-btn-primary" onClick={() => router.push("/admin/notes/new")}>+ 新規作成</button>
                </div>
            </header>

            {loading && <div className="admin-loading">読み込み中...</div>}

            {!loading && notes.length === 0 && (
                <div className="admin-empty-state">
                    <p>ノートが作成されていません</p>
                    <button className="admin-btn-primary" onClick={() => router.push("/admin/notes/new")}>最初のノートを作成する</button>
                </div>
            )}

            {!loading && notes.length > 0 && (
                <div className="admin-card-grid">
                    {notes.map(note => (
                        <div key={note.id} className="admin-card" onClick={() => router.push(`/admin/notes/${note.id}`)}>
                            <div className="admin-card-header">
                                <h3 className="admin-card-title">{note.title}</h3>
                                <span className={`admin-status admin-status-${note.status}`}>{STATUS_LABELS[note.status]}</span>
                            </div>
                            {note.description && <p className="admin-text-sm">{note.description}</p>}
                            {note.keyword_tags.length > 0 && (
                                <div className="admin-tags">{note.keyword_tags.map(t => <span key={t} className="admin-tag">{t}</span>)}</div>
                            )}
                            <div className="admin-card-footer">
                                <span className="admin-text-xs">{new Date(note.updated_at).toLocaleDateString("ja-JP")}</span>
                                <button className="admin-btn-sm admin-btn-danger" onClick={e => { e.stopPropagation(); handleDelete(note.id); }}>削除</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
