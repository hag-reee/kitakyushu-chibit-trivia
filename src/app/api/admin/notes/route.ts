import { NextRequest, NextResponse } from "next/server";
import { listNotes, createNote } from "@/lib/notes";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

// GET: ノート一覧
export async function GET(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const notes = await listNotes();
        return NextResponse.json({ notes });
    } catch (err) {
        console.error("[Notes API] Error:", err);
        return NextResponse.json({ error: "Failed to list notes" }, { status: 500 });
    }
}

// POST: ノート作成
export async function POST(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        if (!body.title?.trim()) {
            return NextResponse.json({ error: "ノート名は必須です" }, { status: 400 });
        }

        const note = await createNote({
            title: body.title.trim(),
            description: body.description || "",
            keyword_tags: body.keyword_tags || [],
            status: body.status || "draft",
        });

        return NextResponse.json({ note }, { status: 201 });
    } catch (err) {
        console.error("[Notes API] Error:", err);
        return NextResponse.json({ error: "ノートの作成に失敗しました" }, { status: 500 });
    }
}
