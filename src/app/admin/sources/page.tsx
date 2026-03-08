"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SourceListItem {
    id: string;
    title: string;
    source_type: string;
    trust_level: string;
    priority: number;
    status: string;
    area_tags: string[];
    keyword_tags: string[];
    usage_count: number;
    updated_at: string;
}

const STATUS_LABELS: Record<string, string> = { draft: "下書き", published: "公開", stopped: "停止" };
const TRUST_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

export default function SourcesPage() {
    const [sources, setSources] = useState<SourceListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const router = useRouter();

    const fetchSources = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (keyword) params.set("keyword", keyword);
        if (statusFilter) params.set("status", statusFilter);
        if (typeFilter) params.set("source_type", typeFilter);
        try {
            const res = await fetch(`/api/admin/sources?${params}`);
            if (res.ok) {
                const data = await res.json();
                setSources(data.sources || []);
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error("Failed to fetch sources:", err);
        }
        setLoading(false);
    }, [keyword, statusFilter, typeFilter]);

    useEffect(() => { fetchSources(); }, [fetchSources]);

    const handleDelete = async (id: string) => {
        if (!confirm("このソースを削除しますか？")) return;
        await fetch(`/api/admin/sources/${id}`, { method: "DELETE" });
        fetchSources();
    };

    const handleStatusChange = async (id: string, status: string) => {
        await fetch(`/api/admin/sources/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        fetchSources();
    };

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-row">
                    <div>
                        <h1 className="admin-title">📚 ソース管理</h1>
                        <p className="admin-subtitle">登録済みソース: {total}件</p>
                    </div>
                    <button className="admin-btn-primary" onClick={() => router.push("/admin/sources/new")}>
                        + 新規登録
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="admin-filters">
                <input
                    type="text"
                    className="admin-input admin-input-sm"
                    placeholder="キーワード検索..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">全状態</option>
                    <option value="draft">下書き</option>
                    <option value="published">公開</option>
                    <option value="stopped">停止</option>
                </select>
                <select className="admin-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="">全種別</option>
                    {["歴史", "観光", "食", "地名", "交通", "文化", "施設", "人物", "企業"].map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>

            {loading && <div className="admin-loading">読み込み中...</div>}

            {!loading && sources.length === 0 && (
                <div className="admin-empty-state">
                    <p>ソースが登録されていません</p>
                    <button className="admin-btn-primary" onClick={() => router.push("/admin/sources/new")}>
                        最初のソースを登録する
                    </button>
                </div>
            )}

            {!loading && sources.length > 0 && (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>タイトル</th>
                                <th>種別</th>
                                <th>信頼度</th>
                                <th>状態</th>
                                <th>使用</th>
                                <th>更新日</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sources.map((s) => (
                                <tr key={s.id}>
                                    <td>
                                        <button className="admin-link" onClick={() => router.push(`/admin/sources/${s.id}`)}>
                                            {s.title}
                                        </button>
                                        {s.keyword_tags.length > 0 && (
                                            <div className="admin-tags">
                                                {s.keyword_tags.slice(0, 3).map(t => (
                                                    <span key={t} className="admin-tag">{t}</span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td><span className="admin-badge-sm">{s.source_type}</span></td>
                                    <td><span className={`admin-trust admin-trust-${s.trust_level}`}>{TRUST_LABELS[s.trust_level]}</span></td>
                                    <td>
                                        <select
                                            className="admin-select-sm"
                                            value={s.status}
                                            onChange={(e) => handleStatusChange(s.id, e.target.value)}
                                        >
                                            <option value="draft">下書き</option>
                                            <option value="published">公開</option>
                                            <option value="stopped">停止</option>
                                        </select>
                                    </td>
                                    <td className="admin-td-num">{s.usage_count}回</td>
                                    <td className="admin-td-date">{new Date(s.updated_at).toLocaleDateString("ja-JP")}</td>
                                    <td>
                                        <div className="admin-actions">
                                            <button className="admin-btn-sm" onClick={() => router.push(`/admin/sources/${s.id}`)}>詳細</button>
                                            <button className="admin-btn-sm admin-btn-danger" onClick={() => handleDelete(s.id)}>削除</button>
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
