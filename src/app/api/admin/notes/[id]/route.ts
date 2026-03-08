import { NextRequest, NextResponse } from "next/server";
import { getNote, updateNote, deleteNote, addSourceToNote, removeSourceFromNote, getSourceIdsForNote } from "@/lib/notes";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

// GET: ノート詳細
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const note = await getNote(id);
        if (!note) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        const sourceIds = await getSourceIdsForNote(id);

        return NextResponse.json({ note, sourceIds });
    } catch (err) {
        console.error("[Note Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to get note" }, { status: 500 });
    }
}

// PUT: ノート更新
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

        // ソース紐付け更新
        if (body.add_source_id) {
            await addSourceToNote(id, body.add_source_id);
        }
        if (body.remove_source_id) {
            await removeSourceFromNote(id, body.remove_source_id);
        }

        const updated = await updateNote(id, {
            title: body.title,
            description: body.description,
            keyword_tags: body.keyword_tags,
            status: body.status,
        });

        if (!updated) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        return NextResponse.json({ note: updated });
    } catch (err) {
        console.error("[Note Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
    }
}

// DELETE: ノート削除
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        await deleteNote(id);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Note Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
    }
}
