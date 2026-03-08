"use client";

import { useState, useEffect, useCallback } from "react";

interface LogItem {
    id: string; input_word: string; generated_text: string;
    model_name: string; status: string; referenced_source_ids: string[];
    referenced_note_ids: string[]; matched_fixed_answer_id: string;
    fallback_reason: string; created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
    success: "✅ 成功", fixed_answer: "📌 固定回答",
    fallback_no_source: "⚠️ フォールバック", fallback_low_confidence: "⚠️ 低信頼",
    error: "❌ エラー",
};

export default function LogsPage() {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [wordFilter, setWordFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (wordFilter) params.set("input_word", wordFilter);
        if (statusFilter) params.set("status", statusFilter);
        if (sourceFilter === "true") params.set("has_sources", "true");
        if (sourceFilter === "false") params.set("has_sources", "false");
        try {
            const res = await fetch(`/api/admin/logs?${params}`);
            if (res.ok) { const data = await res.json(); setLogs(data.logs || []); setTotal(data.total || 0); }
        } catch (err) { console.error(err); }
        setLoading(false);
    }, [wordFilter, statusFilter, sourceFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    return (
        <div className="admin-page">
            <header className="admin-header">
                <h1 className="admin-title">📋 トリビア生成ログ</h1>
                <p className="admin-subtitle">生成結果と参照ソースの記録 ({total}件)</p>
            </header>

            {/* Filters */}
            <div className="admin-filters">
                <input type="text" className="admin-input admin-input-sm" placeholder="単語で検索..." value={wordFilter} onChange={e => setWordFilter(e.target.value)} />
                <select className="admin-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">全ステータス</option>
                    <option value="success">成功</option>
                    <option value="fixed_answer">固定回答</option>
                    <option value="fallback_no_source">フォールバック</option>
                    <option value="error">エラー</option>
                </select>
                <select className="admin-select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                    <option value="">ソース参照</option>
                    <option value="true">あり</option>
                    <option value="false">なし</option>
                </select>
            </div>

            {loading && <div className="admin-loading">読み込み中...</div>}

            {!loading && logs.length === 0 && (
                <div className="admin-empty-state"><p>生成ログがありません</p></div>
            )}

            {!loading && logs.length > 0 && (
                <div className="admin-log-list">
                    {logs.map(log => (
                        <div key={log.id} className={`admin-log-card admin-log-${log.status}`}>
                            <div className="admin-log-header">
                                <span className="admin-log-word">「{log.input_word}」</span>
                                <span className="admin-log-status">{STATUS_LABELS[log.status] || log.status}</span>
                                <span className="admin-log-time">{new Date(log.created_at).toLocaleString("ja-JP")}</span>
                            </div>
                            <p className="admin-log-text">{log.generated_text}</p>
                            <div className="admin-log-meta">
                                {log.model_name && <span className="admin-tag">モデル: {log.model_name}</span>}
                                {log.referenced_source_ids.length > 0 && <span className="admin-tag">参照ソース: {log.referenced_source_ids.length}件</span>}
                                {log.matched_fixed_answer_id && <span className="admin-tag">固定回答使用</span>}
                                {log.fallback_reason && <span className="admin-tag admin-tag-warn">理由: {log.fallback_reason}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
