"use client";

import { useState, useEffect, useCallback } from "react";

interface RankedKeyword {
    keyword: string;
    count: number;
    genre: string;
}

interface TrendPoint {
    date: string;
    count: number;
}

interface StatsData {
    ranking: RankedKeyword[];
    trend: TrendPoint[];
    genres: string[];
    period: string;
    currentGenre: string | null;
}

type Period = "all" | "7days" | "today";

export default function AdminDashboard() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [period, setPeriod] = useState<Period>("all");
    const [genre, setGenre] = useState<string>("");
    const [statsLoading, setStatsLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const params = new URLSearchParams({ period });
            if (genre) params.set("genre", genre);
            const res = await fetch(`/api/admin/stats?${params}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error("Failed to fetch stats:", err);
        }
        setStatsLoading(false);
    }, [period, genre]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const maxCount =
        stats?.ranking && stats.ranking.length > 0
            ? Math.max(...stats.ranking.map((r) => r.count))
            : 1;
    const maxTrend =
        stats?.trend && stats.trend.length > 0
            ? Math.max(...stats.trend.map((t) => t.count))
            : 1;

    const periodLabels: Record<Period, string> = {
        all: "全期間",
        "7days": "直近7日",
        today: "今日",
    };

    return (
        <div className="admin-page">
            <header className="admin-header">
                <h1 className="admin-title">📊 キーワード分析</h1>
                <p className="admin-subtitle">ダッシュボード</p>
            </header>

            {/* Period Tabs */}
            <div className="admin-tabs">
                {(["all", "7days", "today"] as Period[]).map((p) => (
                    <button
                        key={p}
                        className={`admin-tab ${period === p ? "active" : ""}`}
                        onClick={() => setPeriod(p)}
                    >
                        {periodLabels[p]}
                    </button>
                ))}
            </div>

            {/* Genre Filter */}
            <div className="admin-filter">
                <label className="admin-filter-label">ジャンル:</label>
                <select
                    className="admin-select"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                >
                    <option value="">すべて</option>
                    {stats?.genres.map((g) => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>
            </div>

            {statsLoading && <div className="admin-loading">読み込み中...</div>}

            {/* Keyword Ranking */}
            <section className="admin-section">
                <h2 className="admin-section-title">
                    🏆 単語ランキング
                    <span className="admin-badge">{periodLabels[period]}</span>
                    {genre && <span className="admin-badge genre">{genre}</span>}
                </h2>

                {stats?.ranking && stats.ranking.length > 0 ? (
                    <div className="admin-ranking">
                        {stats.ranking.map((item, idx) => (
                            <div key={item.keyword} className="admin-rank-row">
                                <span className={`admin-rank-num ${idx < 3 ? `top${idx + 1}` : ""}`}>
                                    {idx + 1}
                                </span>
                                <div className="admin-rank-info">
                                    <span className="admin-rank-keyword">{item.keyword}</span>
                                    <span className="admin-rank-genre">{item.genre}</span>
                                </div>
                                <div className="admin-rank-bar-wrapper">
                                    <div
                                        className="admin-rank-bar"
                                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                                    />
                                </div>
                                <span className="admin-rank-count">{item.count}回</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    !statsLoading && <p className="admin-empty">データがありません</p>
                )}
            </section>

            {/* Daily Trend */}
            <section className="admin-section">
                <h2 className="admin-section-title">📈 日別入力数の推移（直近30日）</h2>
                {stats?.trend && stats.trend.some((t) => t.count > 0) ? (
                    <div className="admin-chart">
                        {stats.trend.map((point) => (
                            <div key={point.date} className="admin-chart-bar-group">
                                <div className="admin-chart-bar-wrapper">
                                    <div
                                        className="admin-chart-bar"
                                        style={{
                                            height: `${maxTrend > 0 ? (point.count / maxTrend) * 100 : 0}%`,
                                        }}
                                    >
                                        {point.count > 0 && (
                                            <span className="admin-chart-value">{point.count}</span>
                                        )}
                                    </div>
                                </div>
                                <span className="admin-chart-label">{point.date.slice(5)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    !statsLoading && <p className="admin-empty">データがありません</p>
                )}
            </section>
        </div>
    );
}
