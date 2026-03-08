"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import "./admin.css";

interface AdminLayoutProps {
    children: ReactNode;
}

const NAV_ITEMS = [
    { href: "/admin", label: "📊 ダッシュボード", icon: "📊" },
    { href: "/admin/sources", label: "📚 ソース管理", icon: "📚" },
    { href: "/admin/notes", label: "📓 ノート管理", icon: "📓" },
    { href: "/admin/fixed-answers", label: "📌 固定回答", icon: "📌" },
    { href: "/admin/logs", label: "📋 生成ログ", icon: "📋" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Check if already authenticated
    useEffect(() => {
        fetch("/api/admin/stats?period=today")
            .then((res) => {
                if (res.ok) setAuthenticated(true);
            })
            .catch(() => { });
    }, []);

    const handleLogin = useCallback(async () => {
        setLoginError("");
        setLoading(true);
        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                setAuthenticated(true);
            } else {
                setLoginError("パスワードが違います");
            }
        } catch {
            setLoginError("接続エラーが発生しました");
        }
        setLoading(false);
    }, [password]);

    if (!authenticated) {
        return (
            <div className="admin-login">
                <div className="admin-login-card">
                    <h1 className="admin-login-title">管理者ログイン</h1>
                    <p className="admin-login-subtitle">北九州ちびっとトリビア</p>
                    <div className="admin-login-form">
                        <input
                            type="password"
                            className="admin-input"
                            placeholder="パスワード"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            autoFocus
                        />
                        <button
                            className="admin-btn-primary"
                            onClick={handleLogin}
                            disabled={loading || !password}
                        >
                            {loading ? "認証中..." : "ログイン"}
                        </button>
                    </div>
                    {loginError && <p className="admin-error">{loginError}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            {/* Mobile menu toggle */}
            <button
                className="admin-menu-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                {sidebarOpen ? "✕" : "☰"}
            </button>

            {/* Sidebar */}
            <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
                <div className="admin-sidebar-header">
                    <h2 className="admin-sidebar-title">管理画面</h2>
                    <p className="admin-sidebar-subtitle">北九州ちびっとトリビア</p>
                </div>
                <nav className="admin-nav">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.href}
                            className={`admin-nav-item ${pathname === item.href ? "active" : ""}`}
                            onClick={() => {
                                router.push(item.href);
                                setSidebarOpen(false);
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="admin-sidebar-footer">
                    <button
                        className="admin-nav-item"
                        onClick={() => window.open("/", "_blank")}
                    >
                        🌐 サイトを表示
                    </button>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Main content */}
            <main className="admin-main">
                {children}
            </main>
        </div>
    );
}
