import { Redis } from "@upstash/redis";
import type { TriviaLog, TriviaLogStatus } from "./types";

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
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ========== Create ==========
export async function createTriviaLog(data: Omit<TriviaLog, "id" | "created_at">): Promise<TriviaLog> {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");

    const log: TriviaLog = {
        ...data,
        id: generateId(),
        created_at: new Date().toISOString(),
    };

    const pipe = r.pipeline();
    pipe.hset(`trivia_log:${log.id}`, {
        ...log,
        referenced_source_ids: JSON.stringify(log.referenced_source_ids),
        referenced_note_ids: JSON.stringify(log.referenced_note_ids),
    });
    pipe.lpush("trivia_logs:list", log.id);
    // 90日で自動削除
    pipe.expire(`trivia_log:${log.id}`, 60 * 60 * 24 * 90);
    await pipe.exec();

    return log;
}

// ========== Read ==========
export async function listTriviaLogs(filters?: {
    input_word?: string;
    status?: TriviaLogStatus;
    has_fixed_answer?: boolean;
    has_sources?: boolean;
    limit?: number;
    offset?: number;
}): Promise<{ logs: TriviaLog[]; total: number }> {
    const r = getRedis();
    if (!r) return { logs: [], total: 0 };

    // Get all log IDs (most recent first)
    const allIds = await r.lrange("trivia_logs:list", 0, -1);
    if (!allIds || allIds.length === 0) return { logs: [], total: 0 };

    const pipe = r.pipeline();
    for (const id of allIds) {
        pipe.hgetall(`trivia_log:${id}`);
    }
    const results = await pipe.exec();

    let logs: TriviaLog[] = [];
    for (const data of results) {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
            logs.push(deserialize(data as Record<string, string>));
        }
    }

    // Apply filters
    if (filters?.input_word) {
        const kw = filters.input_word.toLowerCase();
        logs = logs.filter(l => l.input_word.toLowerCase().includes(kw));
    }
    if (filters?.status) {
        logs = logs.filter(l => l.status === filters.status);
    }
    if (filters?.has_fixed_answer !== undefined) {
        if (filters.has_fixed_answer) {
            logs = logs.filter(l => l.status === "fixed_answer");
        } else {
            logs = logs.filter(l => l.status !== "fixed_answer");
        }
    }
    if (filters?.has_sources !== undefined) {
        if (filters.has_sources) {
            logs = logs.filter(l => l.referenced_source_ids.length > 0);
        } else {
            logs = logs.filter(l => l.referenced_source_ids.length === 0);
        }
    }

    const total = logs.length;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    logs = logs.slice(offset, offset + limit);

    return { logs, total };
}

// ========== Helpers ==========
function deserialize(data: Record<string, string>): TriviaLog {
    return {
        id: data.id || "",
        input_word: data.input_word || "",
        matched_fixed_answer_id: data.matched_fixed_answer_id || "",
        generated_text: data.generated_text || "",
        referenced_source_ids: safeJsonParse(data.referenced_source_ids, []),
        referenced_note_ids: safeJsonParse(data.referenced_note_ids, []),
        model_name: data.model_name || "",
        status: (data.status || "success") as TriviaLogStatus,
        fallback_reason: data.fallback_reason || "",
        created_at: data.created_at || "",
    };
}

function safeJsonParse<T>(str: string | undefined, fallback: T): T {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}
