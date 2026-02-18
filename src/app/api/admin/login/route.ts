import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { password } = await req.json();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            return NextResponse.json(
                { error: "ADMIN_PASSWORD not configured" },
                { status: 500 }
            );
        }

        if (password !== adminPassword) {
            return NextResponse.json({ error: "Invalid password" }, { status: 401 });
        }

        // Create a simple auth token (hash of password + secret)
        const token = Buffer.from(`admin:${adminPassword}:${Date.now()}`).toString(
            "base64"
        );

        const response = NextResponse.json({ success: true });

        // Set HTTP-only cookie for auth
        response.cookies.set("admin_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 60 * 60 * 24, // 24 hours
            path: "/",
        });

        return response;
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}
