import { NextRequest, NextResponse } from "next/server";
import { getSource, updateSource, deleteSource } from "@/lib/sources";
import { getChunksForSource, createChunksForSource } from "@/lib/chunks";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

// GET: ソース詳細
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const source = await getSource(id);
        if (!source) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        const chunks = await getChunksForSource(id);

        return NextResponse.json({ source, chunks });
    } catch (err) {
        console.error("[Source Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to get source" }, { status: 500 });
    }
}

// PUT: ソース更新
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await req.json();

        const updated = await updateSource(id, body);
        if (!updated) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        // 本文が変更された場合はチャンクを再作成
        if (body.extracted_text) {
            await createChunksForSource(id, body.extracted_text);
        }

        return NextResponse.json({ source: updated });
    } catch (err) {
        console.error("[Source Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
    }
}

// DELETE: ソース削除
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const success = await deleteSource(id);
        if (!success) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Source Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
    }
}
