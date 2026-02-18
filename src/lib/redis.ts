import { Redis } from "@upstash/redis";
import { classifyGenre } from "./genre";

// Lazy initialization to avoid errors when env vars are not set
let redis: Redis | null = null;

function getRedis(): Redis | null {
    if (redis) return redis;
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
        console.warn("[Redis] UPSTASH_REDIS_REST_URL or TOKEN not set. Logging disabled.");
        return null;
    }
    redis = new Redis({ url, token });
    return redis;
}

// ---------- Key helpers ----------
function todayKey(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function dateKeys(days: number): string[] {
    const keys: string[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        keys.push(`${yyyy}-${mm}-${dd}`);
    }
    return keys;
}

// ---------- Write ----------

/**
 * キーワードをRedisに記録する
 * - keywords:all (Sorted Set) → 全期間ランキング
 * - keywords:daily:{date} (Sorted Set) → 日別ランキング
 * - keywords:genre:{genre} (Sorted Set) → ジャンル別ランキング
 * - stats:daily:{date} (counter) → 日別入力数
 */
export async function logKeyword(keyword: string): Promise<void> {
    const r = getRedis();
    if (!r) return;

    const normalized = keyword.trim();
    if (!normalized) return;

    const genre = classifyGenre(normalized);
    const date = todayKey();

    try {
        // Pipeline for efficiency
        const pipe = r.pipeline();

        // 全期間ランキング
        pipe.zincrby("keywords:all", 1, normalized);

        // 日別ランキング (30日で自動削除)
        pipe.zincrby(`keywords:daily:${date}`, 1, normalized);
        pipe.expire(`keywords:daily:${date}`, 60 * 60 * 24 * 31);

        // ジャンル別ランキング
        pipe.zincrby(`keywords:genre:${genre}`, 1, normalized);

        // 日別入力カウンター (30日で自動削除)
        pipe.incr(`stats:daily:${date}`);
        pipe.expire(`stats:daily:${date}`, 60 * 60 * 24 * 31);

        // ジャンルも記録 (keyword → genre マッピング)
        pipe.hset("keywords:genres", { [normalized]: genre });

        await pipe.exec();
    } catch (err) {
        console.error("[Redis] Failed to log keyword:", err);
    }
}

// ---------- Read ----------

export interface RankedKeyword {
    keyword: string;
    count: number;
    genre: string;
}

/**
 * キーワードランキングを取得
 */
export async function getKeywordRanking(
    period: "all" | "7days" | "today",
    limit = 50,
    genre?: string
): Promise<RankedKeyword[]> {
    const r = getRedis();
    if (!r) return [];

    try {
        let results: { member: string; score: number }[] = [];

        if (genre) {
            // ジャンル別
            const raw = await r.zrange(`keywords:genre:${genre}`, 0, limit - 1, {
                rev: true,
                withScores: true,
            });
            results = parseZrangeResult(raw);
        } else if (period === "all") {
            const raw = await r.zrange("keywords:all", 0, limit - 1, {
                rev: true,
                withScores: true,
            });
            results = parseZrangeResult(raw);
        } else if (period === "today") {
            const date = todayKey();
            const raw = await r.zrange(`keywords:daily:${date}`, 0, limit - 1, {
                rev: true,
                withScores: true,
            });
            results = parseZrangeResult(raw);
        } else {
            // 7days: merge 7 daily keys
            const keys = dateKeys(7);
            const existingKeys: string[] = [];
            for (const k of keys) {
                const exists = await r.exists(`keywords:daily:${k}`);
                if (exists) existingKeys.push(`keywords:daily:${k}`);
            }
            if (existingKeys.length === 0) return [];

            // Use zunionstore to a temp key
            const tmpKey = `tmp:ranking:7days:${Date.now()}`;
            await r.zunionstore(tmpKey, existingKeys.length, existingKeys);
            const raw = await r.zrange(tmpKey, 0, limit - 1, {
                rev: true,
                withScores: true,
            });
            results = parseZrangeResult(raw);
            await r.del(tmpKey);
        }

        // Get genres for each keyword
        const genreMap = await getGenreMap(
            r,
            results.map((r) => r.member)
        );

        return results.map((r) => ({
            keyword: r.member,
            count: r.score,
            genre: genreMap[r.member] || "その他",
        }));
    } catch (err) {
        console.error("[Redis] Failed to get ranking:", err);
        return [];
    }
}

/**
 * 日別入力数の推移を取得（直近N日）
 */
export async function getDailyTrend(
    days = 30
): Promise<{ date: string; count: number }[]> {
    const r = getRedis();
    if (!r) return [];

    try {
        const keys = dateKeys(days);
        const results: { date: string; count: number }[] = [];

        for (const date of keys) {
            const count = await r.get<number>(`stats:daily:${date}`);
            results.push({ date, count: count || 0 });
        }

        return results.reverse(); // 古い→新しい順
    } catch (err) {
        console.error("[Redis] Failed to get daily trend:", err);
        return [];
    }
}

/**
 * 全ジャンルのリストを取得
 */
export async function getAvailableGenres(): Promise<string[]> {
    return ["食べ物", "観光", "歴史", "地名", "文化", "産業", "その他"];
}

// ---------- Helpers ----------

function parseZrangeResult(
    raw: unknown[]
): { member: string; score: number }[] {
    const results: { member: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
        results.push({
            member: String(raw[i]),
            score: Number(raw[i + 1]),
        });
    }
    return results;
}

async function getGenreMap(
    r: Redis,
    keywords: string[]
): Promise<Record<string, string>> {
    if (keywords.length === 0) return {};
    try {
        const all = await r.hgetall<Record<string, string>>("keywords:genres");
        if (!all) return {};
        const result: Record<string, string> = {};
        for (const kw of keywords) {
            if (all[kw]) result[kw] = all[kw];
        }
        return result;
    } catch {
        return {};
    }
}
