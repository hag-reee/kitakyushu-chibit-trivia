import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/extractor";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

// POST: ファイルアップロード → テキスト抽出
export async function POST(req: NextRequest) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
        }

        // 拡張子チェック
        const name = file.name.toLowerCase();
        let inputType: "pdf" | "txt" | "md" | "csv";

        if (name.endsWith(".pdf")) inputType = "pdf";
        else if (name.endsWith(".txt")) inputType = "txt";
        else if (name.endsWith(".md")) inputType = "md";
        else if (name.endsWith(".csv")) inputType = "csv";
        else {
            return NextResponse.json({
                error: "対応していないファイル形式です。PDF, txt, md, csv のみ対応しています。"
            }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        try {
            const text = await extractText(buffer, inputType);

            if (!text || text.trim().length === 0) {
                return NextResponse.json({
                    error: "ファイルからテキストを抽出できませんでした"
                }, { status: 400 });
            }

            return NextResponse.json({
                extracted_text: text,
                file_name: file.name,
                file_size: file.size,
                input_type: inputType,
                char_count: text.length,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "不明なエラー";
            return NextResponse.json({
                error: `テキスト抽出に失敗しました: ${msg}`
            }, { status: 400 });
        }
    } catch (err) {
        console.error("[Upload API] Error:", err);
        return NextResponse.json({ error: "ファイルアップロードに失敗しました" }, { status: 500 });
    }
}
