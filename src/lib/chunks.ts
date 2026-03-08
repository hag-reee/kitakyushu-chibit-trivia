import { Redis } from "@upstash/redis";
import type { SourceChunk } from "./types";

let redis: Redis | null = null;
function getRedis(): Redis | null {
    if (redis) return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) return null;
    redis = new Redis({ url, token });
    return redis;
}

function generateChunkId(): string {
    return `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ========== チャンク分割ロジック ==========
const MIN_CHUNK_SIZE = 300;
const MAX_CHUNK_SIZE = 800;

/**
 * テキストをAI参照に適した単位へ分割する。
 * 段落や文脈の区切りを優先して分割。
 */
export function splitTextIntoChunks(text: string): string[] {
    if (!text || text.trim().length === 0) return [];

    // 段落で分割（2つ以上の改行）
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);

    const chunks: string[] = [];
    let buffer = "";

    for (const paragraph of paragraphs) {
        // もしこの段落が最大サイズを超えている場合、文単位で分割
        if (paragraph.length > MAX_CHUNK_SIZE) {
            // バッファに溜まっているものをフラッシュ
            if (buffer.length >= MIN_CHUNK_SIZE) {
                chunks.push(buffer.trim());
                buffer = "";
            } else if (buffer.length > 0) {
                // 短すぎるバッファは段落と結合
            }

            // 文単位で分割（句点で分割）
            const sentences = paragraph.split(/(?<=[。！？\n])/);
            let sentenceBuffer = buffer;
            buffer = "";

            for (const sentence of sentences) {
                if ((sentenceBuffer + sentence).length > MAX_CHUNK_SIZE && sentenceBuffer.length >= MIN_CHUNK_SIZE) {
                    chunks.push(sentenceBuffer.trim());
                    sentenceBuffer = sentence;
                } else {
                    sentenceBuffer += sentence;
                }
            }

            if (sentenceBuffer.length > 0) {
                buffer = sentenceBuffer;
            }
            continue;
        }

        // バッファに段落を追加
        const combined = buffer.length > 0 ? buffer + "\n\n" + paragraph : paragraph;

        if (combined.length > MAX_CHUNK_SIZE) {
            // バッファをフラッシュして新しい段落をバッファに
            if (buffer.length >= MIN_CHUNK_SIZE) {
                chunks.push(buffer.trim());
                buffer = paragraph;
            } else {
                // 短すぎるバッファは結合して投入
                chunks.push(combined.trim());
                buffer = "";
            }
        } else {
            buffer = combined;
        }
    }

    // 残りのバッファをフラッシュ
    if (buffer.trim().length > 0) {
        // 短すぎるなら前のチャンクに結合
        if (buffer.trim().length < MIN_CHUNK_SIZE && chunks.length > 0) {
            const last = chunks.pop()!;
            chunks.push((last + "\n\n" + buffer).trim());
        } else {
            chunks.push(buffer.trim());
        }
    }

    return chunks;
}

// ========== CRUD ==========

/**
 * ソースのチャンクを作成・保存する
 */
export async function createChunksForSource(sourceId: string, text: string): Promise<SourceChunk[]> {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");

    // まず既存チャンクを削除
    await deleteChunksForSource(sourceId);

    const chunkTexts = splitTextIntoChunks(text);
    const chunks: SourceChunk[] = [];
    const pipe = r.pipeline();

    for (let i = 0; i < chunkTexts.length; i++) {
        const chunk: SourceChunk = {
            id: generateChunkId(),
            source_id: sourceId,
            chunk_index: i,
            chunk_text: chunkTexts[i],
            token_count: Math.ceil(chunkTexts[i].length / 2), // 概算
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        pipe.hset(`chunk:${chunk.id}`, { ...chunk });
        pipe.sadd(`source_chunks:${sourceId}`, chunk.id);
        // 全チャンクのインデックス（検索用）
        pipe.sadd("chunks:all", chunk.id);
        chunks.push(chunk);
    }

    await pipe.exec();
    return chunks;
}

/**
 * ソースに紐づくチャンク一覧を取得
 */
export async function getChunksForSource(sourceId: string): Promise<SourceChunk[]> {
    const r = getRedis();
    if (!r) return [];

    const chunkIds = await r.smembers(`source_chunks:${sourceId}`);
    if (!chunkIds || chunkIds.length === 0) return [];

    const pipe = r.pipeline();
    for (const id of chunkIds) {
        pipe.hgetall(`chunk:${id}`);
    }
    const results = await pipe.exec();

    const chunks: SourceChunk[] = [];
    for (const data of results) {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
            const d = data as Record<string, string>;
            chunks.push({
                id: d.id,
                source_id: d.source_id,
                chunk_index: Number(d.chunk_index),
                chunk_text: d.chunk_text,
                token_count: Number(d.token_count),
                created_at: d.created_at,
                updated_at: d.updated_at,
            });
        }
    }

    return chunks.sort((a, b) => a.chunk_index - b.chunk_index);
}

/**
 * ソースの全チャンクを削除
 */
export async function deleteChunksForSource(sourceId: string): Promise<void> {
    const r = getRedis();
    if (!r) return;

    const chunkIds = await r.smembers(`source_chunks:${sourceId}`);
    if (!chunkIds || chunkIds.length === 0) return;

    const pipe = r.pipeline();
    for (const id of chunkIds) {
        pipe.del(`chunk:${id}`);
        pipe.srem("chunks:all", id);
    }
    pipe.del(`source_chunks:${sourceId}`);
    await pipe.exec();
}

/**
 * 全チャンクを取得（検索用）
 */
export async function getAllChunks(): Promise<SourceChunk[]> {
    const r = getRedis();
    if (!r) return [];

    const chunkIds = await r.smembers("chunks:all");
    if (!chunkIds || chunkIds.length === 0) return [];

    const pipe = r.pipeline();
    for (const id of chunkIds) {
        pipe.hgetall(`chunk:${id}`);
    }
    const results = await pipe.exec();

    const chunks: SourceChunk[] = [];
    for (const data of results) {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
            const d = data as Record<string, string>;
            chunks.push({
                id: d.id,
                source_id: d.source_id,
                chunk_index: Number(d.chunk_index),
                chunk_text: d.chunk_text,
                token_count: Number(d.token_count),
                created_at: d.created_at,
                updated_at: d.updated_at,
            });
        }
    }

    return chunks;
}
