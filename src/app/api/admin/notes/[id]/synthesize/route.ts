import { NextRequest, NextResponse } from "next/server";
import { getNote, updateNote, getSourceIdsForNote } from "@/lib/notes";
import { getChunksForSource } from "@/lib/chunks";

const API_KEY = process.env.GEMINI_API_KEY || "";

function isAuthenticated(req: NextRequest): boolean {
    return !!req.cookies.get("admin_token")?.value;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!isAuthenticated(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!API_KEY) {
        return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    try {
        const { id } = await params;
        const note = await getNote(id);

        if (!note) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        const sourceIds = await getSourceIdsForNote(id);
        if (sourceIds.length === 0) {
            return NextResponse.json({ error: "No sources linked to this note" }, { status: 400 });
        }

        // Gather all chunks from all linked sources
        let combinedText = "";
        for (const sourceId of sourceIds) {
            const chunks = await getChunksForSource(sourceId);
            for (const chunk of chunks) {
                combinedText += chunk.chunk_text + "\n\n";
            }
        }

        if (!combinedText.trim()) {
            return NextResponse.json({ error: "No text content found in linked sources" }, { status: 400 });
        }

        // Call Gemini to summarize
        const systemPrompt = `あなたは優秀な編集者です。提供された「参考資料（ソース）」の内容を統合し、このノートの「テーマ解説文（要約）」を作成してください。
【条件】
・だいたい200〜400文字程度で簡潔にまとめる
・箇条書きは使わずプレーンテキストで文章化する
・北九州の何についての情報かが明確に伝わるようにする`;

        const userPrompt = `【ノートのタイトル】\n${note.title}\n\n【参考資料】\n${combinedText.substring(0, 30000) /* Limit to ~30k chars for safety */}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                generationConfig: { temperature: 0.3 }
            }),
            signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error("Failed to extract text from Gemini response");
        }

        const cleanText = generatedText.trim();

        // Update note with new description
        const updated = await updateNote(id, { description: cleanText });

        return NextResponse.json({ success: true, description: cleanText, note: updated });

    } catch (err) {
        console.error("[Note Synthesize API] Error:", err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to synthesize note summary" }, { status: 500 });
    }
}
