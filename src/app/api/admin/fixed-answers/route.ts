import { NextRequest, NextResponse } from "next/server";
import { listFixedAnswers, createFixedAnswer } from "@/lib/fixed-answers";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

// GET: 固定回答一覧
export async function GET(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const answers = await listFixedAnswers();
        return NextResponse.json({ answers });
    } catch (err) {
        console.error("[Fixed Answers API] Error:", err);
        return NextResponse.json({ error: "Failed to list fixed answers" }, { status: 500 });
    }
}

// POST: 固定回答登録
export async function POST(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        if (!body.target_word?.trim()) {
            return NextResponse.json({ error: "対象単語は必須です" }, { status: 400 });
        }
        if (!body.answer_text?.trim()) {
            return NextResponse.json({ error: "回答文は必須です" }, { status: 400 });
        }

        const answer = await createFixedAnswer({
            target_word: body.target_word.trim(),
            alias_words: body.alias_words || [],
            answer_text: body.answer_text.trim(),
            priority: Number(body.priority) || 3,
            status: body.status || "published",
        });

        return NextResponse.json({ answer }, { status: 201 });
    } catch (err) {
        console.error("[Fixed Answers API] Error:", err);
        return NextResponse.json({ error: "固定回答の登録に失敗しました" }, { status: 500 });
    }
}
