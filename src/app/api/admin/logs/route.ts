import { NextRequest, NextResponse } from "next/server";
import { listTriviaLogs } from "@/lib/trivia-logs";
import type { TriviaLogStatus } from "@/lib/types";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

// GET: 生成ログ一覧
export async function GET(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    try {
        const result = await listTriviaLogs({
            input_word: searchParams.get("input_word") || undefined,
            status: (searchParams.get("status") as TriviaLogStatus) || undefined,
            has_fixed_answer: searchParams.get("has_fixed_answer") === "true"
                ? true : searchParams.get("has_fixed_answer") === "false"
                    ? false : undefined,
            has_sources: searchParams.get("has_sources") === "true"
                ? true : searchParams.get("has_sources") === "false"
                    ? false : undefined,
            limit: Number(searchParams.get("limit")) || 50,
            offset: Number(searchParams.get("offset")) || 0,
        });

        return NextResponse.json(result);
    } catch (err) {
        console.error("[Logs API] Error:", err);
        return NextResponse.json({ error: "Failed to list logs" }, { status: 500 });
    }
}
