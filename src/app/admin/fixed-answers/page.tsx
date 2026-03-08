"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface FixedAnswer {
    id: string; target_word: string; alias_words: string[];
    answer_text: string; priority: number; status: string;
    created_at: string; updated_at: string;
}

export default function FixedAnswersPage() {
    const [answers, setAnswers] = useState<FixedAnswer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [targetWord, setTargetWord] = useState("");
    const [aliasWords, setAliasWords] = useState("");
    const [answerText, setAnswerText] = useState("");
    const [priority, setPriority] = useState(3);
    const [status, setStatus] = useState("published");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const router = useRouter();

    const fetchAnswers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/fixed-answers");
            if (res.ok) { const data = await res.json(); setAnswers(data.answers || []); }
        } catch (err) { console.error(err); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAnswers(); }, [fetchAnswers]);

    const resetForm = () => {
        setTargetWord(""); setAliasWords(""); setAnswerText("");
        setPriority(3); setStatus("published"); setEditId(null); setError("");
    };

    const handleEdit = (a: FixedAnswer) => {
        setEditId(a.id); setTargetWord(a.target_word);
        setAliasWords(a.alias_words.join(", ")); setAnswerText(a.answer_text);
        setPriority(a.priority); setStatus(a.status); setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!targetWord.trim()) { setError("対象単語は必須です"); return; }
        if (!answerText.trim()) { setError("回答文は必須です"); return; }
        setSaving(true); setError("");
        try {
            const body = {
                target_word: targetWord.trim(), answer_text: answerText.trim(),
                alias_words: aliasWords.split(/[,、\s]+/).filter(Boolean),
                priority, status,
            };
            const url = editId ? `/api/admin/fixed-answers/${editId}` : "/api/admin/fixed-answers";
            const method = editId ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok) { const d = await res.json(); setError(d.error || "保存に失敗"); return; }
            resetForm(); setShowForm(false); fetchAnswers();
        } catch { setError("保存中にエラー"); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("この固定回答を削除しますか？")) return;
        await fetch(`/api/admin/fixed-answers/${id}`, { method: "DELETE" });
        fetchAnswers();
    };

    const handleStatusToggle = async (a: FixedAnswer) => {
        const newStatus = a.status === "published" ? "stopped" : "published";
        await fetch(`/api/admin/fixed-answers/${a.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
        });
        fetchAnswers();
    };

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-row">
                    <div>
                        <h1 className="admin-title">📌 固定回答管理</h1>
                        <p className="admin-subtitle">頻出ワードの確定済み回答を管理</p>
                    </div>
                    <button className="admin-btn-primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
                        {showForm ? "✕ 閉じる" : "+ 新規登録"}
                    </button>
                </div>
            </header>

            {/* Form */}
            {showForm && (
                <div className="admin-form admin-form-inline">
                    {error && <div className="admin-alert admin-alert-error">{error}</div>}
                    <div className="admin-form-row">
                        <div className="admin-form-group">
                            <label className="admin-label">対象単語 <span className="admin-required">必須</span></label>
                            <input type="text" className="admin-input" value={targetWord} onChange={e => setTargetWord(e.target.value)} placeholder="例: 門司港" />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-label">表記ゆれ候補</label>
                            <input type="text" className="admin-input" value={aliasWords} onChange={e => setAliasWords(e.target.value)} placeholder="カンマ区切り（例: もじこう, モジコウ）" />
                        </div>
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-label">固定トリビア本文 <span className="admin-required">必須</span></label>
                        <textarea className="admin-textarea" rows={3} value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder="70〜100文字のトリビア文" />
                        {answerText && <p className="admin-hint">{answerText.length}文字</p>}
                    </div>
                    <div className="admin-form-row">
                        <div className="admin-form-group">
                            <label className="admin-label">優先度</label>
                            <select className="admin-select" value={priority} onChange={e => setPriority(Number(e.target.value))}>
                                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-label">状態</label>
                            <select className="admin-select" value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="published">公開</option>
                                <option value="stopped">停止</option>
                            </select>
                        </div>
                        <div className="admin-form-group" style={{ display: "flex", alignItems: "flex-end" }}>
                            <button className="admin-btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving ? "保存中..." : editId ? "更新" : "登録"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading && <div className="admin-loading">読み込み中...</div>}

            {!loading && answers.length === 0 && !showForm && (
                <div className="admin-empty-state"><p>固定回答が登録されていません</p></div>
            )}

            {!loading && answers.length > 0 && (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>対象単語</th>
                                <th>表記ゆれ</th>
                                <th>回答文</th>
                                <th>優先度</th>
                                <th>状態</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {answers.map(a => (
                                <tr key={a.id}>
                                    <td><strong>{a.target_word}</strong></td>
                                    <td className="admin-text-xs">{a.alias_words.join(", ") || "-"}</td>
                                    <td className="admin-text-sm admin-td-text">{a.answer_text}</td>
                                    <td className="admin-td-num">{a.priority}</td>
                                    <td>
                                        <button className={`admin-status-btn admin-status-${a.status}`} onClick={() => handleStatusToggle(a)}>
                                            {a.status === "published" ? "公開" : "停止"}
                                        </button>
                                    </td>
                                    <td>
                                        <div className="admin-actions">
                                            <button className="admin-btn-sm" onClick={() => handleEdit(a)}>編集</button>
                                            <button className="admin-btn-sm admin-btn-danger" onClick={() => handleDelete(a.id)}>削除</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
