"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

const TRUST_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const STATUS_LABELS: Record<string, string> = { draft: "下書き", published: "公開", stopped: "停止" };

interface Source {
    id: string; title: string; source_type: string; description: string;
    source_input_type: string; original_text: string; extracted_text: string;
    source_url: string; trust_level: string; priority: number; status: string;
    area_tags: string[]; keyword_tags: string[]; usage_count: number;
    last_used_at: string; created_at: string; updated_at: string;
}
interface Chunk { id: string; chunk_index: number; chunk_text: string; token_count: number; }

export default function SourceDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [source, setSource] = useState<Source | null>(null);
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/admin/sources/${id}`);
                if (!res.ok) { setError("ソースが見つかりません"); return; }
                const data = await res.json();
                setSource(data.source);
                setChunks(data.chunks || []);
            } catch { setError("読み込みエラー"); }
            finally { setLoading(false); }
        }
        load();
    }, [id]);

    const handleStatusChange = async (status: string) => {
        await fetch(`/api/admin/sources/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        setSource(prev => prev ? { ...prev, status } : prev);
    };

    const handleDelete = async () => {
        if (!confirm("このソースを削除しますか？")) return;
        await fetch(`/api/admin/sources/${id}`, { method: "DELETE" });
        router.push("/admin/sources");
    };

    if (loading) return <div className="admin-page"><div className="admin-loading">読み込み中...</div></div>;
    if (error || !source) return <div className="admin-page"><div className="admin-alert admin-alert-error">{error || "ソースが見つかりません"}</div></div>;

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-row">
                    <div>
                        <h1 className="admin-title">{source.title}</h1>
                        <p className="admin-subtitle">ソース詳細</p>
                    </div>
                    <div className="admin-actions">
                        <button className="admin-btn-ghost" onClick={() => router.back()}>← 戻る</button>
                        <button className="admin-btn-sm admin-btn-danger" onClick={handleDelete}>削除</button>
                    </div>
                </div>
            </header>

            {/* メタ情報 */}
            <div className="admin-detail-grid">
                <div className="admin-detail-card">
                    <h3 className="admin-card-title">基本情報</h3>
                    <dl className="admin-dl">
                        <dt>種別</dt><dd><span className="admin-badge-sm">{source.source_type}</span></dd>
                        <dt>信頼度</dt><dd><span className={`admin-trust admin-trust-${source.trust_level}`}>{TRUST_LABELS[source.trust_level]}</span></dd>
                        <dt>優先度</dt><dd>{source.priority}/5</dd>
                        <dt>状態</dt><dd>
                            <select className="admin-select-sm" value={source.status} onChange={e => handleStatusChange(e.target.value)}>
                                <option value="draft">下書き</option>
                                <option value="published">公開</option>
                                <option value="stopped">停止</option>
                            </select>
                        </dd>
                        <dt>入力方法</dt><dd>{source.source_input_type}</dd>
                        {source.source_url && <><dt>URL</dt><dd><a href={source.source_url} target="_blank" rel="noopener noreferrer" className="admin-link">{source.source_url}</a></dd></>}
                        <dt>使用回数</dt><dd>{source.usage_count}回</dd>
                        <dt>最終参照</dt><dd>{source.last_used_at ? new Date(source.last_used_at).toLocaleString("ja-JP") : "なし"}</dd>
                        <dt>作成日</dt><dd>{new Date(source.created_at).toLocaleString("ja-JP")}</dd>
                        <dt>更新日</dt><dd>{new Date(source.updated_at).toLocaleString("ja-JP")}</dd>
                    </dl>
                </div>
                <div className="admin-detail-card">
                    <h3 className="admin-card-title">タグ・エリア</h3>
                    {source.area_tags.length > 0 && (
                        <div className="admin-form-group">
                            <label className="admin-label-sm">関連エリア</label>
                            <div className="admin-tags">{source.area_tags.map(t => <span key={t} className="admin-tag">{t}</span>)}</div>
                        </div>
                    )}
                    {source.keyword_tags.length > 0 && (
                        <div className="admin-form-group">
                            <label className="admin-label-sm">キーワード</label>
                            <div className="admin-tags">{source.keyword_tags.map(t => <span key={t} className="admin-tag">{t}</span>)}</div>
                        </div>
                    )}
                    {source.description && (
                        <div className="admin-form-group">
                            <label className="admin-label-sm">説明</label>
                            <p className="admin-text-sm">{source.description}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 抽出テキスト */}
            <section className="admin-section">
                <h2 className="admin-section-title">📄 抽出テキスト</h2>
                <pre className="admin-pre">{source.extracted_text || "(テキストなし)"}</pre>
            </section>

            {/* チャンク一覧 */}
            <section className="admin-section">
                <h2 className="admin-section-title">🔗 チャンク一覧 ({chunks.length}件)</h2>
                {chunks.length > 0 ? (
                    <div className="admin-chunks">
                        {chunks.map((chunk) => (
                            <div key={chunk.id} className="admin-chunk-card">
                                <div className="admin-chunk-header">
                                    <span className="admin-chunk-index">#{chunk.chunk_index + 1}</span>
                                    <span className="admin-chunk-meta">{chunk.chunk_text.length}文字 / ~{chunk.token_count}トークン</span>
                                </div>
                                <p className="admin-chunk-text">{chunk.chunk_text}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="admin-empty">チャンクがありません</p>
                )}
            </section>
        </div>
    );
}
