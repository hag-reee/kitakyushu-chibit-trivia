import { NextRequest, NextResponse } from "next/server";
import {
    getKeywordRanking,
    getDailyTrend,
    getAvailableGenres,
} from "@/lib/redis";

/**
 * Verify admin auth cookie
 */
function isAuthenticated(req: NextRequest): boolean {
    const token = req.cookies.get("admin_token")?.value;
    return !!token; // Simple check: cookie exists
}

export async function GET(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") || "all") as
        | "all"
        | "7days"
        | "today";
    const genre = searchParams.get("genre") || undefined;

    try {
        const [ranking, trend, genres] = await Promise.all([
            getKeywordRanking(period, 50, genre),
            getDailyTrend(30),
            getAvailableGenres(),
        ]);

        return NextResponse.json({
            ranking,
            trend,
            genres,
            period,
            currentGenre: genre || null,
        });
    } catch (err) {
        console.error("[Admin Stats] Error:", err);
        return NextResponse.json(
            { error: "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
