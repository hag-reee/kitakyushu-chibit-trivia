import { Redis } from "@upstash/redis";
import type { Note, SourceStatus } from "./types";

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
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ========== Create ==========
export async function createNote(data: {
    title: string;
    description?: string;
    keyword_tags?: string[];
    status?: SourceStatus;
}): Promise<Note> {
    const r = getRedis();
    if (!r) throw new Error("Redis not configured");

    const note: Note = {
        id: generateId(),
        title: data.title,
        description: data.description || "",
        keyword_tags: data.keyword_tags || [],
        status: data.status || "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const pipe = r.pipeline();
    pipe.hset(`note:${note.id}`, {
        ...note,
        keyword_tags: JSON.stringify(note.keyword_tags),
    });
    pipe.sadd("notes:all", note.id);
    await pipe.exec();

    return note;
}

// ========== Read ==========
export async function getNote(id: string): Promise<Note | null> {
    const r = getRedis();
    if (!r) return null;

    const data = await r.hgetall(`note:${id}`);
    if (!data || Object.keys(data).length === 0) return null;

    return deserializeNote(data as Record<string, string>);
}

export async function listNotes(): Promise<Note[]> {
    const r = getRedis();
    if (!r) return [];

    const ids = await r.smembers("notes:all");
    if (!ids || ids.length === 0) return [];

    const pipe = r.pipeline();
    for (const id of ids) {
        pipe.hgetall(`note:${id}`);
    }
    const results = await pipe.exec();

    const notes: Note[] = [];
    for (const data of results) {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
            notes.push(deserializeNote(data as Record<string, string>));
        }
    }

    return notes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

// ========== Update ==========
export async function updateNote(id: string, data: Partial<Note>): Promise<Note | null> {
    const r = getRedis();
    if (!r) return null;

    const existing = await getNote(id);
    if (!existing) return null;

    const updated: Note = {
        ...existing,
        ...data,
        id,
        updated_at: new Date().toISOString(),
    };

    await r.hset(`note:${id}`, {
        ...updated,
        keyword_tags: JSON.stringify(updated.keyword_tags),
    });

    return updated;
}

// ========== Delete ==========
export async function deleteNote(id: string): Promise<boolean> {
    const r = getRedis();
    if (!r) return false;

    const pipe = r.pipeline();
    pipe.del(`note:${id}`);
    pipe.srem("notes:all", id);
    pipe.del(`note_sources:${id}`);
    await pipe.exec();

    return true;
}

// ========== Note-Source linking ==========
export async function addSourceToNote(noteId: string, sourceId: string): Promise<void> {
    const r = getRedis();
    if (!r) return;
    await r.sadd(`note_sources:${noteId}`, sourceId);
}

export async function removeSourceFromNote(noteId: string, sourceId: string): Promise<void> {
    const r = getRedis();
    if (!r) return;
    await r.srem(`note_sources:${noteId}`, sourceId);
}

export async function getSourceIdsForNote(noteId: string): Promise<string[]> {
    const r = getRedis();
    if (!r) return [];
    const ids = await r.smembers(`note_sources:${noteId}`);
    return (ids || []) as string[];
}

export async function getNoteIdsForSource(sourceId: string): Promise<string[]> {
    const r = getRedis();
    if (!r) return [];

    // Iterate all notes to find which contain this source
    const noteIds = await r.smembers("notes:all");
    if (!noteIds || noteIds.length === 0) return [];

    const matching: string[] = [];
    for (const noteId of noteIds) {
        const isMember = await r.sismember(`note_sources:${noteId}`, sourceId);
        if (isMember) matching.push(noteId as string);
    }
    return matching;
}

// ========== Helpers ==========
function deserializeNote(data: Record<string, string>): Note {
    return {
        id: data.id || "",
        title: data.title || "",
        description: data.description || "",
        keyword_tags: safeJsonParse(data.keyword_tags, []),
        status: (data.status || "draft") as Note["status"],
        created_at: data.created_at || "",
        updated_at: data.updated_at || "",
    };
}

function safeJsonParse<T>(str: string | undefined, fallback: T): T {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}
