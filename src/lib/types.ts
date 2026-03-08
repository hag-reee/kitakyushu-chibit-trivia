// ========== ソース ==========
export type SourceInputType = "text" | "pdf" | "txt" | "md" | "csv" | "url";
export type SourceStatus = "draft" | "published" | "stopped";
export type TrustLevel = "high" | "medium" | "low";
export type SourceType = "歴史" | "観光" | "食" | "地名" | "交通" | "文化" | "施設" | "人物" | "企業";
export type AreaTag =
    | "門司区" | "小倉北区" | "小倉南区" | "若松区"
    | "八幡東区" | "八幡西区" | "戸畑区" | "北九州市全体" | "その他";

export interface Source {
    id: string;
    title: string;
    source_type: SourceType;
    description: string;
    source_input_type: SourceInputType;
    original_text: string;
    extracted_text: string;
    source_url: string;
    file_path: string;
    trust_level: TrustLevel;
    priority: number; // 1-5
    status: SourceStatus;
    area_tags: string[];    // JSON array stored as string
    keyword_tags: string[]; // JSON array stored as string
    note_ids: string[];     // JSON array stored as string
    usage_count: number;
    last_used_at: string;
    created_at: string;
    updated_at: string;
}

// ========== チャンク ==========
export interface SourceChunk {
    id: string;
    source_id: string;
    chunk_index: number;
    chunk_text: string;
    token_count: number;
    created_at: string;
    updated_at: string;
}

// ========== ノート ==========
export interface Note {
    id: string;
    title: string;
    description: string;
    keyword_tags: string[];
    status: SourceStatus;
    created_at: string;
    updated_at: string;
}

// ========== 生成ログ ==========
export type TriviaLogStatus =
    | "success"
    | "fixed_answer"
    | "fallback_no_source"
    | "fallback_low_confidence"
    | "error";

export interface TriviaLog {
    id: string;
    input_word: string;
    matched_fixed_answer_id: string;
    generated_text: string;
    referenced_source_ids: string[];
    referenced_note_ids: string[];
    model_name: string;
    status: TriviaLogStatus;
    fallback_reason: string;
    created_at: string;
}

// ========== 固定回答 ==========
export interface FixedTriviaAnswer {
    id: string;
    target_word: string;
    alias_words: string[];
    answer_text: string;
    priority: number;
    status: "published" | "stopped";
    created_at: string;
    updated_at: string;
}

// ========== 定数 ==========
export const SOURCE_TYPES: SourceType[] = [
    "歴史", "観光", "食", "地名", "交通", "文化", "施設", "人物", "企業",
];

export const AREA_TAGS: AreaTag[] = [
    "門司区", "小倉北区", "小倉南区", "若松区",
    "八幡東区", "八幡西区", "戸畑区", "北九州市全体", "その他",
];

export const TRUST_LEVELS: { value: TrustLevel; label: string }[] = [
    { value: "high", label: "高" },
    { value: "medium", label: "中" },
    { value: "low", label: "低" },
];
