"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const SOURCE_TYPES = ["歴史", "観光", "食", "地名", "交通", "文化", "施設", "人物", "企業"];
const AREAS = ["門司区", "小倉北区", "小倉南区", "若松区", "八幡東区", "八幡西区", "戸畑区", "北九州市全体", "その他"];
const INPUT_TYPES = [
    { value: "text", label: "テキスト直接入力" },
    { value: "pdf", label: "PDFアップロード" },
    { value: "txt", label: "txtファイル" },
    { value: "md", label: "mdファイル" },
    { value: "csv", label: "csvファイル" },
    { value: "url", label: "URL登録" },
];

export default function NewSourcePage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState("");
    const [sourceType, setSourceType] = useState("歴史");
    const [description, setDescription] = useState("");
    const [inputType, setInputType] = useState("text");
    const [originalText, setOriginalText] = useState("");
    const [extractedText, setExtractedText] = useState("");
    const [sourceUrl, setSourceUrl] = useState("");
    const [areaTags, setAreaTags] = useState<string[]>([]);
    const [keywordTags, setKeywordTags] = useState("");
    const [trustLevel, setTrustLevel] = useState("medium");
    const [priority, setPriority] = useState(3);
    const [status, setStatus] = useState("draft");
    const [memo, setMemo] = useState("");

    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [uploadedFileName, setUploadedFileName] = useState("");

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "アップロードに失敗しました");
                return;
            }

            setExtractedText(data.extracted_text);
            setUploadedFileName(data.file_name);
        } catch {
            setError("アップロード中にエラーが発生しました");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        setError("");

        if (!title.trim()) { setError("タイトルは必須です"); return; }
        if (inputType === "text" && !originalText.trim()) { setError("本文テキストは必須です"); return; }
        if (inputType === "url" && !sourceUrl.trim()) { setError("URLは必須です"); return; }
        if (["pdf", "txt", "md", "csv"].includes(inputType) && !extractedText) { setError("ファイルをアップロードしてください"); return; }

        setSaving(true);

        try {
            const res = await fetch("/api/admin/sources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    source_type: sourceType,
                    description: description.trim(),
                    source_input_type: inputType,
                    original_text: inputType === "text" ? originalText : "",
                    extracted_text: inputType === "text" ? originalText : extractedText,
                    source_url: sourceUrl,
                    trust_level: trustLevel,
                    priority,
                    status,
                    area_tags: areaTags,
                    keyword_tags: keywordTags.split(/[,、\s]+/).filter(Boolean),
                    note_ids: [],
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "登録に失敗しました");
                return;
            }

            router.push(`/admin/sources/${data.source.id}`);
        } catch {
            setError("保存中にエラーが発生しました");
        } finally {
            setSaving(false);
        }
    };

    const toggleArea = (area: string) => {
        setAreaTags(prev =>
            prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
        );
    };

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-row">
                    <div>
                        <h1 className="admin-title">📝 ソース登録</h1>
                        <p className="admin-subtitle">新しいソースを登録します</p>
                    </div>
                    <button className="admin-btn-ghost" onClick={() => router.back()}>← 戻る</button>
                </div>
            </header>

            {error && <div className="admin-alert admin-alert-error">{error}</div>}

            <div className="admin-form">
                {/* タイトル */}
                <div className="admin-form-group">
                    <label className="admin-label">タイトル <span className="admin-required">必須</span></label>
                    <input type="text" className="admin-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 北九州の焼きうどん文化" />
                </div>

                {/* ソース種別 */}
                <div className="admin-form-row">
                    <div className="admin-form-group">
                        <label className="admin-label">ソース種別 <span className="admin-required">必須</span></label>
                        <select className="admin-select" value={sourceType} onChange={e => setSourceType(e.target.value)}>
                            {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-label">信頼度 <span className="admin-required">必須</span></label>
                        <select className="admin-select" value={trustLevel} onChange={e => setTrustLevel(e.target.value)}>
                            <option value="high">高</option>
                            <option value="medium">中</option>
                            <option value="low">低</option>
                        </select>
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-label">優先度 <span className="admin-required">必須</span></label>
                        <select className="admin-select" value={priority} onChange={e => setPriority(Number(e.target.value))}>
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}{n === 5 ? " (最優先)" : ""}</option>)}
                        </select>
                    </div>
                </div>

                {/* 説明文 */}
                <div className="admin-form-group">
                    <label className="admin-label">説明文</label>
                    <input type="text" className="admin-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="このソースの概要" />
                </div>

                {/* 入力方法 */}
                <div className="admin-form-group">
                    <label className="admin-label">入力方法</label>
                    <div className="admin-radio-group">
                        {INPUT_TYPES.map(it => (
                            <label key={it.value} className={`admin-radio-label ${inputType === it.value ? "active" : ""}`}>
                                <input type="radio" name="inputType" value={it.value} checked={inputType === it.value} onChange={() => setInputType(it.value)} />
                                {it.label}
                            </label>
                        ))}
                    </div>
                </div>

                {/* テキスト入力 */}
                {inputType === "text" && (
                    <div className="admin-form-group">
                        <label className="admin-label">本文テキスト <span className="admin-required">必須</span></label>
                        <textarea className="admin-textarea" rows={10} value={originalText} onChange={e => setOriginalText(e.target.value)} placeholder="ソースの本文を入力してください..." />
                        {originalText && <p className="admin-hint">{originalText.length}文字</p>}
                    </div>
                )}

                {/* ファイルアップロード */}
                {["pdf", "txt", "md", "csv"].includes(inputType) && (
                    <div className="admin-form-group">
                        <label className="admin-label">ファイル <span className="admin-required">必須</span></label>
                        <div className="admin-upload-area" onClick={() => fileInputRef.current?.click()}>
                            <input ref={fileInputRef} type="file" accept={`.${inputType}`} onChange={handleFileUpload} style={{ display: "none" }} />
                            {uploading ? (
                                <p>アップロード中...</p>
                            ) : uploadedFileName ? (
                                <p>✓ {uploadedFileName} ({extractedText.length}文字抽出)</p>
                            ) : (
                                <p>クリックしてファイルを選択<br /><small>.{inputType} ファイルのみ</small></p>
                            )}
                        </div>
                        {extractedText && (
                            <details className="admin-details">
                                <summary>抽出テキストプレビュー</summary>
                                <pre className="admin-pre">{extractedText.slice(0, 1000)}{extractedText.length > 1000 ? "..." : ""}</pre>
                            </details>
                        )}
                    </div>
                )}

                {/* URL */}
                {inputType === "url" && (
                    <div className="admin-form-group">
                        <label className="admin-label">URL <span className="admin-required">必須</span></label>
                        <input type="url" className="admin-input" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." />
                    </div>
                )}

                {/* 関連エリア */}
                <div className="admin-form-group">
                    <label className="admin-label">関連エリア</label>
                    <div className="admin-checkbox-group">
                        {AREAS.map(area => (
                            <label key={area} className={`admin-checkbox-label ${areaTags.includes(area) ? "active" : ""}`}>
                                <input type="checkbox" checked={areaTags.includes(area)} onChange={() => toggleArea(area)} />
                                {area}
                            </label>
                        ))}
                    </div>
                </div>

                {/* キーワードタグ */}
                <div className="admin-form-group">
                    <label className="admin-label">関連キーワード</label>
                    <input type="text" className="admin-input" value={keywordTags} onChange={e => setKeywordTags(e.target.value)} placeholder="カンマ区切りで入力（例: 焼きうどん, 小倉, B級グルメ）" />
                </div>

                {/* 公開状態 */}
                <div className="admin-form-group">
                    <label className="admin-label">公開状態</label>
                    <select className="admin-select" value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="draft">下書き</option>
                        <option value="published">公開</option>
                        <option value="stopped">停止</option>
                    </select>
                </div>

                {/* メモ */}
                <div className="admin-form-group">
                    <label className="admin-label">管理者メモ</label>
                    <textarea className="admin-textarea" rows={3} value={memo} onChange={e => setMemo(e.target.value)} placeholder="管理者用のメモ（任意）" />
                </div>

                {/* Submit */}
                <div className="admin-form-actions">
                    <button className="admin-btn-ghost" onClick={() => router.back()}>キャンセル</button>
                    <button className="admin-btn-primary" onClick={handleSubmit} disabled={saving}>
                        {saving ? "保存中..." : "ソースを登録"}
                    </button>
                </div>
            </div>
        </div>
    );
}
