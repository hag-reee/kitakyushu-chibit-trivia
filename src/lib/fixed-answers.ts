import { Redis } from "@upstash/redis";
import type { FixedTriviaAnswer } from "./types";

let redis: Redis | null = null;
function getRedis(): Redis | null {
    if (redis) return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) return null;
    redis = new Redis({ url, token });
    return redis;
}

function generateId(): string {
    return `fa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ========== Create ==========
export async function createFixedAnswer(data: {
    target_word: string;
    alias_words?: string[];
    answer_text: string;
    priority?: number;
    status?: "published" | "stopped";
}): Promise<FixedTriviaAnswer> {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");

    const answer: FixedTriviaAnswer = {
        id: generateId(),
        target_word: data.target_word,
        alias_words: data.alias_words || [],
        answer_text: data.answer_text,
        priority: data.priority || 3,
        status: data.status || "published",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const pipe = r.pipeline();
    pipe.hset(`fixed_answer:${answer.id}`, {
        ...answer,
        alias_words: JSON.stringify(answer.alias_words),
    });
    pipe.sadd("fixed_answers:all", answer.id);
    await pipe.exec();

    return answer;
}

// ========== Read ==========
export async function getFixedAnswer(id: string): Promise<FixedTriviaAnswer | null> {
    const r = getRedis();
    if (!r) return null;

    const data = await r.hgetall(`fixed_answer:${id}`);
    if (!data || Object.keys(data).length === 0) return null;

    return deserialize(data as Record<string, string>);
}

export async function listFixedAnswers(): Promise<FixedTriviaAnswer[]> {
    const r = getRedis();
    if (!r) return [];

    const ids = await r.smembers("fixed_answers:all");
    if (!ids || ids.length === 0) return [];

    const pipe = r.pipeline();
    for (const id of ids) {
        pipe.hgetall(`fixed_answer:${id}`);
    }
    const results = await pipe.exec();

    const answers: FixedTriviaAnswer[] = [];
    for (const data of results) {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
            answers.push(deserialize(data as Record<string, string>));
        }
    }

    return answers.sort((a, b) => b.priority - a.priority);
}

/**
 * 入力単語に対して固定回答を検索する。
 * 完全一致 + 表記ゆれ候補マッチ。
 * 優先度が高い方を返す。
 */
export async function findFixedAnswer(word: string): Promise<FixedTriviaAnswer | null> {
    const normalized = word.trim().toLowerCase();
    if (!normalized) return null;

    const answers = await listFixedAnswers();
    const published = answers.filter(a => a.status === "published");

    // 完全一致 or 表記ゆれ候補マッチ
    const matches = published.filter(a => {
        if (a.target_word.toLowerCase() === normalized) return true;
        return a.alias_words.some(alias => alias.toLowerCase() === normalized);
    });

    if (matches.length === 0) return null;

    // 優先度が高い方を返す
    matches.sort((a, b) => b.priority - a.priority);
    return matches[0];
}

// ========== Update ==========
export async function updateFixedAnswer(id: string, data: Partial<FixedTriviaAnswer>): Promise<FixedTriviaAnswer | null> {
    const r = getRedis();
    if (!r) return null;

    const existing = await getFixedAnswer(id);
    if (!existing) return null;

    const updated: FixedTriviaAnswer = {
        ...existing,
        ...data,
        id,
        updated_at: new Date().toISOString(),
    };

    await r.hset(`fixed_answer:${id}`, {
        ...updated,
        alias_words: JSON.stringify(updated.alias_words),
    });

    return updated;
}

// ========== Delete ==========
export async function deleteFixedAnswer(id: string): Promise<boolean> {
    const r = getRedis();
    if (!r) return false;

    const pipe = r.pipeline();
    pipe.del(`fixed_answer:${id}`);
    pipe.srem("fixed_answers:all", id);
    await pipe.exec();

    return true;
}

// ========== Helpers ==========
function deserialize(data: Record<string, string>): FixedTriviaAnswer {
    return {
        id: data.id || "",
        target_word: data.target_word || "",
        alias_words: safeJsonParse(data.alias_words, []),
        answer_text: data.answer_text || "",
        priority: Number(data.priority) || 3,
        status: (data.status || "published") as FixedTriviaAnswer["status"],
        created_at: data.created_at || "",
        updated_at: data.updated_at || "",
    };
}

function safeJsonParse<T>(str: string | undefined, fallback: T): T {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}
