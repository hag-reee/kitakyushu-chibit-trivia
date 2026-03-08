import Papa from "papaparse";

/**
 * PDF ファイルからテキストを抽出する
 */
export async function extractFromPdf(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (dataBuffer: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text || "";
}

/**
 * txt / md ファイルからテキストを読み込む
 */
export function extractFromText(buffer: Buffer): string {
    return buffer.toString("utf-8");
}

/**
 * CSV ファイルからテキストを抽出する
 * 全行のテキストカラムを結合する
 */
export function extractFromCsv(buffer: Buffer): string {
    const csvText = buffer.toString("utf-8");
    const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    if (!result.data || result.data.length === 0) return "";

    const rows = result.data as Record<string, string>[];
    const lines: string[] = [];

    for (const row of rows) {
        // 全カラムの値を結合
        const values = Object.values(row).filter(v => v && v.trim());
        if (values.length > 0) {
            lines.push(values.join(" "));
        }
    }

    return lines.join("\n");
}

/**
 * URL からテキストを取得する
 */
export async function extractFromUrl(url: string): Promise<string> {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: {
            "User-Agent": "KitakyushuTriviaBot/1.0",
        },
    });

    if (!response.ok) {
        throw new Error(`URL取得に失敗しました (HTTP ${response.status})`);
    }

    const html = await response.text();

    // 簡易HTML→テキスト変換
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return text;
}

/**
 * ファイル種別に応じてテキストを抽出する
 */
export async function extractText(
    buffer: Buffer,
    inputType: "pdf" | "txt" | "md" | "csv"
): Promise<string> {
    switch (inputType) {
        case "pdf":
            return extractFromPdf(buffer);
        case "txt":
        case "md":
            return extractFromText(buffer);
        case "csv":
            return extractFromCsv(buffer);
        default:
            throw new Error(`未対応のファイル形式です: ${inputType}`);
    }
}
