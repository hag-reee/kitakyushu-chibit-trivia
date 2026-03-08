import { NextRequest, NextResponse } from "next/server";
import { getFixedAnswer, updateFixedAnswer, deleteFixedAnswer } from "@/lib/fixed-answers";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

// GET: 固定回答詳細
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const answer = await getFixedAnswer(id);
        if (!answer) {
            return NextResponse.json({ error: "Fixed answer not found" }, { status: 404 });
        }
        return NextResponse.json({ answer });
    } catch (err) {
        console.error("[Fixed Answer Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to get fixed answer" }, { status: 500 });
    }
}

// PUT: 固定回答更新
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

        const updated = await updateFixedAnswer(id, body);
        if (!updated) {
            return NextResponse.json({ error: "Fixed answer not found" }, { status: 404 });
        }

        return NextResponse.json({ answer: updated });
    } catch (err) {
        console.error("[Fixed Answer Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to update fixed answer" }, { status: 500 });
    }
}

// DELETE: 固定回答削除
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        await deleteFixedAnswer(id);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[Fixed Answer Detail API] Error:", err);
        return NextResponse.json({ error: "Failed to delete fixed answer" }, { status: 500 });
    }
}
