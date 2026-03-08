import { Redis } from "@upstash/redis";
import type { Source, SourceStatus } from "./types";

// Lazy Redis initialization (reuse same pattern as redis.ts)
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
    return `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
    return new Date().toISOString();
}

// ========== Create ==========
export async function createSource(data: Omit<Source, "id" | "usage_count" | "last_used_at" | "created_at" | "updated_at">): Promise<Source> {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");

    const source: Source = {
        ...data,
        id: generateId(),
        usage_count: 0,
        last_used_at: "",
        created_at: now(),
        updated_at: now(),
    };

    const pipe = r.pipeline();
    pipe.hset(`source:${source.id}`, {
        ...source,
        area_tags: JSON.stringify(source.area_tags),
        keyword_tags: JSON.stringify(source.keyword_tags),
        note_ids: JSON.stringify(source.note_ids),
    });
    // Index by status for listing
    pipe.sadd("sources:all", source.id);
    pipe.sadd(`sources:status:${source.status}`, source.id);
    // Index by type
    pipe.sadd(`sources:type:${source.source_type}`, source.id);
    await pipe.exec();

    return source;
}

// ========== Read ==========
export async function getSource(id: string): Promise<Source | null> {
    const r = getRedis();
    if (!r) return null;

    const data = await r.hgetall(`source:${id}`);
    if (!data || Object.keys(data).length === 0) return null;

    return deserializeSource(data as Record<string, string>);
}

export async function listSources(filters?: {
    status?: SourceStatus;
    source_type?: string;
    trust_level?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
}): Promise<{ sources: Source[]; total: number }> {
    const r = getRedis();
    if (!r) return { sources: [], total: 0 };

    const allIds = await r.smembers("sources:all");
    if (!allIds || allIds.length === 0) return { sources: [], total: 0 };

    // Fetch all sources
    const pipe = r.pipeline();
    for (const id of allIds) {
        pipe.hgetall(`source:${id}`);
    }
    const results = await pipe.exec();

    let sources: Source[] = [];
    for (const data of results) {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
            sources.push(deserializeSource(data as Record<string, string>));
        }
    }

    // Apply filters
    if (filters?.status) {
        sources = sources.filter(s => s.status === filters.status);
    }
    if (filters?.source_type) {
        sources = sources.filter(s => s.source_type === filters.source_type);
    }
    if (filters?.trust_level) {
        sources = sources.filter(s => s.trust_level === filters.trust_level);
    }
    if (filters?.keyword) {
        const kw = filters.keyword.toLowerCase();
        sources = sources.filter(s =>
            s.title.toLowerCase().includes(kw) ||
            s.keyword_tags.some(t => t.toLowerCase().includes(kw)) ||
            s.description.toLowerCase().includes(kw)
        );
    }

    // Sort by updated_at descending
    sources.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const total = sources.length;
    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;
    sources = sources.slice(offset, offset + limit);

    return { sources, total };
}

// ========== Update ==========
export async function updateSource(id: string, data: Partial<Source>): Promise<Source | null> {
    const r = getRedis();
    if (!r) return null;

    const existing = await getSource(id);
    if (!existing) return null;

    const updated: Source = {
        ...existing,
        ...data,
        id, // prevent id change
        updated_at: now(),
    };

    // If status changed, update indexes
    if (data.status && data.status !== existing.status) {
        const pipe = r.pipeline();
        pipe.srem(`sources:status:${existing.status}`, id);
        pipe.sadd(`sources:status:${data.status}`, id);
        await pipe.exec();
    }

    await r.hset(`source:${id}`, {
        ...updated,
        area_tags: JSON.stringify(updated.area_tags),
        keyword_tags: JSON.stringify(updated.keyword_tags),
        note_ids: JSON.stringify(updated.note_ids),
    });

    return updated;
}

// ========== Delete ==========
export async function deleteSource(id: string): Promise<boolean> {
    const r = getRedis();
    if (!r) return false;

    const existing = await getSource(id);
    if (!existing) return false;

    const pipe = r.pipeline();
    pipe.del(`source:${id}`);
    pipe.srem("sources:all", id);
    pipe.srem(`sources:status:${existing.status}`, id);
    pipe.srem(`sources:type:${existing.source_type}`, id);

    // Delete associated chunks
    const chunkIds = await r.smembers(`source_chunks:${id}`);
    if (chunkIds) {
        for (const cid of chunkIds) {
            pipe.del(`chunk:${cid}`);
        }
        pipe.del(`source_chunks:${id}`);
    }

    await pipe.exec();
    return true;
}

// ========== Usage tracking ==========
export async function incrementSourceUsage(id: string): Promise<void> {
    const r = getRedis();
    if (!r) return;

    await r.hset(`source:${id}`, {
        usage_count: ((await r.hget(`source:${id}`, "usage_count")) as number || 0) + 1,
        last_used_at: now(),
    });
}

// ========== Helpers ==========
function deserializeSource(data: Record<string, string>): Source {
    return {
        id: data.id || "",
        title: data.title || "",
        source_type: (data.source_type || "歴史") as Source["source_type"],
        description: data.description || "",
        source_input_type: (data.source_input_type || "text") as Source["source_input_type"],
        original_text: data.original_text || "",
        extracted_text: data.extracted_text || "",
        source_url: data.source_url || "",
        file_path: data.file_path || "",
        trust_level: (data.trust_level || "medium") as Source["trust_level"],
        priority: Number(data.priority) || 3,
        status: (data.status || "draft") as Source["status"],
        area_tags: safeJsonParse(data.area_tags, []),
        keyword_tags: safeJsonParse(data.keyword_tags, []),
        note_ids: safeJsonParse(data.note_ids, []),
        usage_count: Number(data.usage_count) || 0,
        last_used_at: data.last_used_at || "",
        created_at: data.created_at || "",
        updated_at: data.updated_at || "",
    };
}

function safeJsonParse<T>(str: string | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}
