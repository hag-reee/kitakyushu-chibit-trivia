import { NextRequest, NextResponse } from "next/server";
import { listSources, createSource } from "@/lib/sources";
import { createChunksForSource } from "@/lib/chunks";
import { extractFromUrl } from "@/lib/extractor";
import type { SourceInputType, SourceType, TrustLevel, SourceStatus } from "@/lib/types";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

// GET: ソース一覧
export async function GET(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filters = {
        status: searchParams.get("status") as SourceStatus | undefined || undefined,
        source_type: searchParams.get("source_type") || undefined,
        trust_level: searchParams.get("trust_level") || undefined,
        keyword: searchParams.get("keyword") || undefined,
        limit: Number(searchParams.get("limit")) || 20,
        offset: Number(searchParams.get("offset")) || 0,
    };

    try {
        const result = await listSources(filters);
        return NextResponse.json(result);
    } catch (err) {
        console.error("[Sources API] Error:", err);
        return NextResponse.json({ error: "Failed to list sources" }, { status: 500 });
    }
}

// POST: ソース登録
export async function POST(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        // Validation
        if (!body.title?.trim()) {
            return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
        }
        if (!body.source_type) {
            return NextResponse.json({ error: "ソース種別は必須です" }, { status: 400 });
        }
        if (!body.trust_level) {
            return NextResponse.json({ error: "信頼度は必須です" }, { status: 400 });
        }

        let extractedText = "";
        const inputType: SourceInputType = body.source_input_type || "text";

        // テキスト抽出
        if (inputType === "text") {
            if (!body.original_text?.trim()) {
                return NextResponse.json({ error: "本文テキストは必須です" }, { status: 400 });
            }
            extractedText = body.original_text;
        } else if (inputType === "url") {
            if (!body.source_url?.trim()) {
                return NextResponse.json({ error: "URLは必須です" }, { status: 400 });
            }
            try {
                extractedText = await extractFromUrl(body.source_url);
            } catch (err) {
                return NextResponse.json({
                    error: `URL先の本文取得に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`
                }, { status: 400 });
            }
        } else if (body.extracted_text) {
            // ファイルアップロード経由で既にテキスト抽出済み
            extractedText = body.extracted_text;
        } else {
            return NextResponse.json({ error: "本文・ファイル・URLのいずれかは必須です" }, { status: 400 });
        }

        // ソース作成
        const source = await createSource({
            title: body.title.trim(),
            source_type: body.source_type as SourceType,
            description: body.description || "",
            source_input_type: inputType,
            original_text: body.original_text || "",
            extracted_text: extractedText,
            source_url: body.source_url || "",
            file_path: body.file_path || "",
            trust_level: body.trust_level as TrustLevel,
            priority: Number(body.priority) || 3,
            status: (body.status as SourceStatus) || "draft",
            area_tags: body.area_tags || [],
            keyword_tags: body.keyword_tags || [],
            note_ids: body.note_ids || [],
        });

        // チャンク分割
        try {
            await createChunksForSource(source.id, extractedText);
        } catch (err) {
            console.error("[Sources API] Chunk creation failed:", err);
            // ソースは作成済みなのでエラーは記録のみ
        }

        return NextResponse.json({ source }, { status: 201 });
    } catch (err) {
        console.error("[Sources API] Error:", err);
        return NextResponse.json({ error: "ソースの登録に失敗しました" }, { status: 500 });
    }
}
