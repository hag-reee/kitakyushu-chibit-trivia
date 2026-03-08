import { getSource, listSources, incrementSourceUsage } from "./sources";
import { getAllChunks, getChunksForSource } from "./chunks";
import { listNotes, getSourceIdsForNote } from "./notes";
import type { Source, SourceChunk } from "./types";

interface SearchResult {
    source: Source;
    chunks: SourceChunk[];
    score: number;
    matchedNoteIds: string[];
}

/**
 * 入力単語に対して関連ソースを検索し、スコア順に返す。
 * 検索優先順位:
 * 1. 入力単語と紐づくノート配下ソース
 * 2. 公開状態の高信頼ソース
 * 3. 中信頼ソース
 * 4. 低信頼ソース
 */
export async function searchSources(keyword: string, maxResults = 5): Promise<SearchResult[]> {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return [];

    // 1. 公開ソース一覧を取得
    const { sources } = await listSources({ status: "published", limit: 500 });
    if (sources.length === 0) return [];

    // 2. ノート一覧を取得してキーワードマッチ
    const notes = await listNotes();
    const matchedNoteIds: string[] = [];
    const noteSourceIds = new Set<string>();

    for (const note of notes) {
        if (note.status !== "published") continue;
        const titleMatch = note.title.toLowerCase().includes(normalized);
        const kwMatch = note.keyword_tags.some(t => t.toLowerCase().includes(normalized) || normalized.includes(t.toLowerCase()));
        if (titleMatch || kwMatch) {
            matchedNoteIds.push(note.id);
            const sids = await getSourceIdsForNote(note.id);
            sids.forEach(id => noteSourceIds.add(id));
        }
    }

    // 3. 各ソースをスコアリング
    const results: SearchResult[] = [];

    for (const source of sources) {
        let score = 0;

        // タイトル一致
        if (source.title.toLowerCase().includes(normalized)) score += 10;
        if (source.title.toLowerCase() === normalized) score += 5;

        // キーワード一致
        for (const tag of source.keyword_tags) {
            if (tag.toLowerCase().includes(normalized) || normalized.includes(tag.toLowerCase())) {
                score += 8;
            }
        }

        // エリア一致
        for (const area of source.area_tags) {
            if (normalized.includes(area.toLowerCase().replace("区", ""))) {
                score += 3;
            }
        }

        // ノート一致（ノート配下ソース優先）
        if (noteSourceIds.has(source.id)) {
            score += 15;
        }

        // 信頼度
        if (source.trust_level === "high") score += 5;
        else if (source.trust_level === "medium") score += 2;
        else score += 0;

        // 優先度 (1-5)
        score += source.priority;

        // チャンクテキスト内でキーワードマッチ（追加ボーナス）
        const chunks = await getChunksForSource(source.id);
        let chunkMatchCount = 0;
        for (const chunk of chunks) {
            if (chunk.chunk_text.toLowerCase().includes(normalized)) {
                chunkMatchCount++;
            }
        }
        if (chunkMatchCount > 0) {
            score += Math.min(chunkMatchCount * 3, 12);
        }

        if (score > 0) {
            // 関連チャンクのみ抽出（マッチしたもの優先、なければ先頭チャンク）
            const relevantChunks = chunks.filter(c => c.chunk_text.toLowerCase().includes(normalized));
            const selectedChunks = relevantChunks.length > 0
                ? relevantChunks.slice(0, 3)
                : chunks.slice(0, 2);

            results.push({
                source,
                chunks: selectedChunks,
                score,
                matchedNoteIds: matchedNoteIds.filter(nid =>
                    source.note_ids.includes(nid) || noteSourceIds.has(source.id)
                ),
            });
        }
    }

    // スコア順にソート
    results.sort((a, b) => b.score - a.score);

    // 上位のソースの使用回数を更新
    const topResults = results.slice(0, maxResults);
    for (const result of topResults) {
        incrementSourceUsage(result.source.id).catch(() => { });
    }

    return topResults;
}

/**
 * 検索結果からAIプロンプト用のコンテキストを生成する
 */
export function buildContextFromSearchResults(results: SearchResult[]): string {
    if (results.length === 0) return "";

    const parts: string[] = ["【参照ソース情報】"];

    for (const result of results) {
        parts.push(`\n--- ソース: ${result.source.title} (信頼度: ${result.source.trust_level}, 種別: ${result.source.source_type}) ---`);
        for (const chunk of result.chunks) {
            parts.push(chunk.chunk_text);
        }
    }

    return parts.join("\n");
}

/**
 * 根拠が十分かどうかを判定する
 * @returns true = 十分, false = 不十分（フォールバック）
 */
export function hasEnoughEvidence(results: SearchResult[]): boolean {
    if (results.length === 0) return false;

    // 高信頼ソースが1件以上あるか
    const highTrustCount = results.filter(r => r.source.trust_level === "high").length;
    if (highTrustCount > 0) return true;

    // 総合スコアが一定以上か
    const topScore = results[0]?.score || 0;
    return topScore >= 10;
}
