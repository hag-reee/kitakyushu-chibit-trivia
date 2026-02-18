import { NextResponse } from "next/server";
import { logKeyword } from "@/lib/redis";

// --- Rate Limiting (in-memory, IP-based) ---
const RATE_LIMIT_PER_MINUTE = 10;
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60_000;
    const timestamps = rateLimitMap.get(ip) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    rateLimitMap.set(ip, recent);

    if (recent.length >= RATE_LIMIT_PER_MINUTE) {
        return true;
    }
    recent.push(now);
    rateLimitMap.set(ip, recent);
    return false;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap.entries()) {
        const recent = timestamps.filter((t) => now - t < 60_000);
        if (recent.length === 0) {
            rateLimitMap.delete(ip);
        } else {
            rateLimitMap.set(ip, recent);
        }
    }
}, 5 * 60_000);

// --- Gemini API ---
const API_KEY_RAW = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `あなたは「北九州に必ず紐づける短文トリビア」作家です。
入力された単語を起点に、北九州の文化・地理・産業・歴史・食・観光のいずれかへ強引に結びつけて、日本語で1段落のトリビアを作ってください。

【絶対条件】
・70文字以上100文字以内（厳守。句読点含む）
・改行なし、箇条書き禁止、プレーンテキストのみ
・必ず文末を「。」で終わらせて完結させること
・北九州の具体的な地名・名物・歴史に言及すること
・不確実な内容は「〜らしい」「〜とも言われる」で濁してOK
・医療助言・違法行為・差別・暴力・個人情報は避ける

【出力例】
入力「カレー」→「カレーの隠し味に醤油を入れる家庭は多いが、北九州の小倉では焼きうどん発祥の地として知られ、うどん出汁にカレーを合わせた一杯が地元民に密かに愛されているらしい。」`;

function buildUserPrompt(keyword: string): string {
    return `単語：「${keyword}」

上記の単語から北九州に紐づくトリビアを1つ書いてください。
必ず70〜100文字で、文末は「。」で完結させてください。途中で切らないでください。`;
}

function getRetryPrompt(currentLength: number): string {
    if (currentLength < 70) {
        return `今の出力は${currentLength}文字で短すぎます。具体的なエピソードを追加して70文字以上にしてください。100文字は超えないでください。文末は「。」で完結させること。`;
    } else {
        return `今の出力は${currentLength}文字で長すぎます。余計な言葉を削って100文字以内に収めてください。70文字は下回らないでください。文末は「。」で完結させること。`;
    }
}

// --- Character count validation: 70-100 ---
function isValidLength(text: string): boolean {
    const len = text.length;
    return len >= 70 && len <= 100;
}

// --- Extract text from Gemini response ---
function extractText(data: Record<string, unknown>): string | null {
    try {
        const candidates = data?.candidates as Array<Record<string, unknown>> | undefined;
        if (!candidates || candidates.length === 0) return null;

        const candidate = candidates[0];
        const content = candidate?.content as Record<string, unknown> | undefined;
        if (!content) return null;

        const parts = content?.parts as Array<Record<string, unknown>> | undefined;
        if (!parts || parts.length === 0) return null;

        // Collect all non-thought text parts
        const textParts: string[] = [];
        for (const part of parts) {
            if (part.thought === true) continue;
            if (typeof part.text === "string" && part.text.trim().length > 0) {
                textParts.push(part.text.trim());
            }
        }

        return textParts.length > 0 ? textParts.join("").trim() : null;
    } catch {
        return null;
    }
}

// --- Check if response completed normally ---
function getFinishReason(data: Record<string, unknown>): string {
    try {
        const candidates = data?.candidates as Array<Record<string, unknown>> | undefined;
        if (!candidates || candidates.length === 0) return "UNKNOWN";
        return (candidates[0]?.finishReason as string) || "UNKNOWN";
    } catch {
        return "UNKNOWN";
    }
}

// --- Model-specific config ---
// gemini-2.5-flash is a "thinking" model that uses tokens for internal reasoning.
// We need to either give it a huge maxOutputTokens or disable thinking.
interface ModelConfig {
    name: string;
    maxOutputTokens: number;
    // Optional: thinkingConfig to control thinking budget
    thinkingConfig?: { thinkingBudget: number };
}

const MODEL_CONFIGS: ModelConfig[] = [
    {
        name: "gemini-2.0-flash",
        maxOutputTokens: 500,
    },
    {
        name: "gemini-2.5-flash",
        maxOutputTokens: 8192, // Needs to be very large because thinking tokens count against this
        thinkingConfig: { thinkingBudget: 0 }, // Disable thinking to save tokens for actual output
    },
    {
        name: "gemini-2.0-flash-lite", // gemini-1.5-flash is retired; use lite variant as fallback
        maxOutputTokens: 500,
    },
];

async function callGemini(
    modelConfig: ModelConfig,
    apiKey: string,
    messages: { role: string; parts: { text: string }[] }[]
): Promise<{ text: string | null; finishReason: string; rawData: Record<string, unknown> | null }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.name}:generateContent?key=${apiKey}`;

    // Build generation config
    const generationConfig: Record<string, unknown> = {
        temperature: 0.7,
        maxOutputTokens: modelConfig.maxOutputTokens,
    };

    // Add thinkingConfig if specified (for gemini-2.5-flash)
    if (modelConfig.thinkingConfig) {
        generationConfig.thinkingConfig = modelConfig.thinkingConfig;
    }

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: messages,
            generationConfig,
        }),
        signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
        if (response.status === 404) {
            return { text: null, finishReason: "NOT_FOUND", rawData: null };
        }
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const text = extractText(data);
    const finishReason = getFinishReason(data);

    return { text, finishReason, rawData: data };
}

export async function POST(req: Request) {
    const API_KEY = API_KEY_RAW ? API_KEY_RAW.trim() : "";

    if (!API_KEY) {
        return NextResponse.json(
            { error: { code: "config_error", message: "APIキーが設定されていません。" } },
            { status: 500 }
        );
    }

    // Rate limiting
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    if (isRateLimited(ip)) {
        return NextResponse.json(
            { error: { code: "rate_limited", message: "ちょっと落ち着いて、もう一口。（1分あたりの上限に達しました）" } },
            { status: 429 }
        );
    }

    try {
        const body = await req.json();
        const keyword: string = (body.keyword || "").trim();

        // Validation
        if (!keyword) {
            return NextResponse.json(
                { error: { code: "validation_error", message: "単語を入れてください。" } },
                { status: 400 }
            );
        }

        if (keyword.length > 30) {
            return NextResponse.json(
                { error: { code: "validation_error", message: "30文字以内で入力してください。" } },
                { status: 400 }
            );
        }

        let lastError: Error | null = null;
        let generatedTrivia: string | null = null;
        let bestCandidate: string | null = null;
        let retries = 0;
        let usedModel = "";

        const userPrompt = buildUserPrompt(keyword);

        outerLoop:
        for (const modelConfig of MODEL_CONFIGS) {
            try {
                const messages: { role: string; parts: { text: string }[] }[] = [
                    { role: "user", parts: [{ text: userPrompt }] },
                ];

                // First attempt
                const result = await callGemini(modelConfig, API_KEY, messages);

                if (!result.text) {
                    if (result.finishReason === "NOT_FOUND") {
                        console.warn(`Model ${modelConfig.name}: not found, skipping.`);
                        continue;
                    }
                    throw new Error("生成結果が空でした。");
                }

                let candidate = result.text;
                console.log(`Model ${modelConfig.name}: first attempt = "${candidate}" (${candidate.length} chars, finishReason=${result.finishReason})`);

                // If response was truncated (MAX_TOKENS), skip to next model
                if (result.finishReason === "MAX_TOKENS") {
                    console.warn(`Model ${modelConfig.name}: truncated (MAX_TOKENS), skipping.`);
                    if (!bestCandidate || candidate.length > bestCandidate.length) {
                        bestCandidate = candidate;
                    }
                    throw new Error(`レスポンスが途中で切れました (MAX_TOKENS)。`);
                }

                // Track best candidate
                if (!bestCandidate || candidate.length > bestCandidate.length) {
                    bestCandidate = candidate;
                }

                // Character count retry loop (max 3 retries)
                for (let attempt = 0; attempt < 3 && !isValidLength(candidate); attempt++) {
                    retries++;
                    const retryPrompt = getRetryPrompt(candidate.length);

                    messages.push(
                        { role: "model", parts: [{ text: candidate }] },
                        { role: "user", parts: [{ text: retryPrompt }] }
                    );

                    const retryResult = await callGemini(modelConfig, API_KEY, messages);

                    if (!retryResult.text || retryResult.finishReason === "MAX_TOKENS") {
                        break;
                    }

                    candidate = retryResult.text;
                    console.log(`Model ${modelConfig.name}: retry ${attempt + 1} = "${candidate}" (${candidate.length} chars)`);

                    if (!bestCandidate || candidate.length > bestCandidate.length) {
                        bestCandidate = candidate;
                    }
                }

                // Accept if valid length
                if (isValidLength(candidate)) {
                    generatedTrivia = candidate;
                    usedModel = modelConfig.name;
                    break outerLoop;
                }

                // Not valid, try next model
                console.warn(`Model ${modelConfig.name}: final text out of range (${candidate.length} chars).`);
                throw new Error(`文字数が範囲外です（${candidate.length}文字）。`);

            } catch (e: unknown) {
                lastError = e instanceof Error ? e : new Error(String(e));
                console.error(`Model ${modelConfig.name} failed:`, lastError.message);
            }
        }

        // Fallback: use best candidate if available (even if out of range)
        if (!generatedTrivia && bestCandidate && bestCandidate.length >= 10) {
            console.warn(`Using best candidate as fallback (${bestCandidate.length} chars).`);
            generatedTrivia = bestCandidate;
            usedModel = "fallback";
        }

        if (!generatedTrivia) {
            console.error("All models failed. Last error:", lastError);
            return NextResponse.json(
                {
                    error: {
                        code: "generation_failed",
                        message: "トリビアの生成に失敗しました。もう一度お試しください。",
                        details: lastError?.message,
                    },
                },
                { status: 500 }
            );
        }

        // Log keyword to Redis (fire-and-forget, non-blocking)
        logKeyword(keyword).catch((err) =>
            console.error("[Redis] logKeyword failed:", err)
        );

        return NextResponse.json({
            trivia: generatedTrivia,
            keyword,
            mode: "kitakyushu",
            retries,
            model: usedModel,
            createdAt: new Date().toISOString(),
        });
    } catch (error: unknown) {
        console.error("API Error:", error);
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: { code: "generation_failed", message: "サーバーエラーが発生しました。", details: message } },
            { status: 500 }
        );
    }
}
