"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import logoSvg from "../../asset/logo.svg";
import lightPng from "../../asset/light.png";
import denkyuSvg from "../../asset/denkyu.svg";

import bgPng from "../../asset/bg.png";
import objectSvg from "../../asset/object.svg";
import closePng from "../../asset/close.svg";
import copySvg from "../../asset/copy.svg";
import shareSvg from "../../asset/share.svg";
import mouikkaiSvg from "../../asset/もう一回.svg";
import logoOrangeSvg from "../../asset/logo_orange.svg";
import objectModalSvg from "../../asset/object_modal.svg";
import closeModalBottomSvg from "../../asset/close_modal_bottom.svg";


// --- Types ---
interface TriviaItem {
  keyword: string;
  trivia: string;
  createdAt: string;
}

interface ApiError {
  code: string;
  message: string;
}

// --- localStorage helpers ---
const HISTORY_KEY = "kitakyushu-chibit-trivia-history";
const MAX_HISTORY = 10;

function loadHistory(): TriviaItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: TriviaItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // silently fail
  }
}

// --- Component ---
export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [trivia, setTrivia] = useState<TriviaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<TriviaItem[]>([]);
  const [modalItem, setModalItem] = useState<TriviaItem | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (modalItem) {
      const scrollY = window.scrollY;
      document.body.dataset.modalScrollY = String(scrollY);
      document.body.style.top = `-${scrollY}px`;
      document.body.classList.add("modal-open");
    } else {
      const savedScrollY = Number(document.body.dataset.modalScrollY || 0);
      document.body.classList.remove("modal-open");
      document.body.style.top = "";
      delete document.body.dataset.modalScrollY;
      if (savedScrollY > 0) {
        window.scrollTo(0, savedScrollY);
      }
    }
    return () => {
      document.body.classList.remove("modal-open");
      document.body.style.top = "";
      delete document.body.dataset.modalScrollY;
    };
  }, [modalItem]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [bgUrl, setBgUrl] = useState("");

  // Load history + noise url on mount
  useEffect(() => {
    setHistory(loadHistory());
    setBgUrl(bgPng.src);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2200);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  // Generate trivia
  const generateTrivia = useCallback(
    async (isRetry = false) => {
      const trimmed = keyword.trim();
      if (!trimmed) {
        setError("単語を入れてください。");
        return;
      }
      if (trimmed.length > 30) {
        setError("30文字以内で入力してください。");
        return;
      }

      setLoading(true);
      setError(null);
      if (!isRetry) setTrivia(null);

      try {
        const res = await fetch("/api/trivia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: trimmed,
            nonce: Date.now().toString(),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const err: ApiError = data.error;
          setError(err?.message || "エラーが発生しました。");
          return;
        }

        const item: TriviaItem = {
          keyword: data.keyword,
          trivia: data.trivia,
          createdAt: data.createdAt,
        };

        setTrivia(item);

        // Add to history
        const newHistory = [item, ...history.filter(
          (h) => !(h.keyword === item.keyword && h.trivia === item.trivia)
        )].slice(0, MAX_HISTORY);
        setHistory(newHistory);
        saveHistory(newHistory);
      } catch {
        setError("通信エラーが発生しました。もう一度お試しください。");
      } finally {
        setLoading(false);
      }
    },
    [keyword, history]
  );

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!trivia) return;
    try {
      await navigator.clipboard.writeText(trivia.trivia);
      showToast("コピーしました ✓");
    } catch {
      showToast("コピーに失敗しました");
    }
  }, [trivia, showToast]);

  // Share on X
  const handleShare = useCallback(() => {
    if (!trivia) return;
    const text = `【北九州ちびっとトリビア】『${trivia.keyword}』：${trivia.trivia}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [trivia]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    showToast("履歴を削除しました");
  }, [showToast]);

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !loading) {
        generateTrivia();
      }
    },
    [generateTrivia, loading]
  );

  // Copy modal trivia
  const handleModalCopy = useCallback(async () => {
    if (!modalItem) return;
    try {
      await navigator.clipboard.writeText(modalItem.trivia);
      showToast("コピーしました ✓");
    } catch {
      showToast("コピーに失敗しました");
    }
  }, [modalItem, showToast]);

  // Share modal trivia
  const handleModalShare = useCallback(() => {
    if (!modalItem) return;
    const text = `【北九州ちびっとトリビア】『${modalItem.keyword}』：${modalItem.trivia}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [modalItem]);

  return (
    <>
      <div className="app-container">
        {/* Background */}
        {bgUrl && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundImage: `url(${bgUrl})`,
              backgroundRepeat: "repeat",
              backgroundSize: "cover",
              pointerEvents: "none",
              zIndex: -1,
            }}
          />
        )}

        {/* Header */}
        <header className="header">
          <div className="header__logo-wrapper">
            <Image
              className="header__logo"
              src={logoSvg}
              alt="北九州ちびっとトリビア"
              width={180}
              height={169}
              priority
              unoptimized
            />
            <Image
              className="header__glow"
              src={lightPng}
              alt=""
              width={120}
              height={120}
              priority
            />
          </div>
          <p className="header__subtitle">
            単語一つで、北九州にまつわる
            <br />
            豆知識をちびっと紹介。
          </p>
        </header>

        {/* Input */}
        <div className="input-area">
          <input
            ref={inputRef}
            type="text"
            className="input-field"
            placeholder="例）小倉、門司港、関門海峡"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            maxLength={31}
            disabled={loading}
            id="keyword-input"
          />
          <button
            className="btn btn-primary"
            onClick={() => generateTrivia()}
            disabled={loading || !keyword.trim()}
            id="generate-btn"
          >
            北九州のトリビアをひねり出す
          </button>
          {error && <div className="error-message">{error}</div>}
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading-area">
            <div className="spinner" />
            <span className="loading-text">北九州に接続中・・・</span>
          </div>
        )}

        {/* Trivia Card */}
        {trivia && !loading && (
          <div className="trivia-card">
            {/* Close button */}
            <button
              className="trivia-close-btn"
              onClick={() => setTrivia(null)}
              aria-label="閉じる"
            >
              <Image
                src={closePng}
                alt="CLOSE"
                width={170}
                height={50}
                unoptimized
              />
            </button>

            {/* Yellow blob background */}
            <div className="trivia-blob-wrapper">
              <Image
                className="trivia-blob"
                src={objectSvg}
                alt=""
                width={364}
                height={464}
                unoptimized
              />
            </div>

            {/* Content */}
            <div className="trivia-content">
              <h2 className="trivia-keyword">{trivia.keyword}</h2>
              <p className="trivia-text">{trivia.trivia}</p>
            </div>

            {/* Action buttons */}
            <div className="action-buttons">
              <button
                className="action-btn"
                onClick={() => generateTrivia(true)}
                disabled={loading}
                id="regenerate-btn"
              >
                <Image src={mouikkaiSvg} alt="もう1回" width={80} height={80} unoptimized />
              </button>
              <button
                className="action-btn"
                onClick={handleCopy}
                id="copy-btn"
              >
                <Image src={copySvg} alt="コピー" width={80} height={80} unoptimized />
              </button>
              <button
                className="action-btn"
                onClick={handleShare}
                id="share-btn"
              >
                <Image src={shareSvg} alt="シェア" width={80} height={80} unoptimized />
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="history-section">
            <div className="history-header">
              <span className="history-title">履歴</span>
              <button className="btn btn-ghost" onClick={clearHistory} id="clear-history-btn">
                全削除
              </button>
            </div>
            <p className="history-note">※最大10件表示され、古いものから順に削除されます。</p>
            <div className="history-list">
              {history.map((item, i) => (
                <div
                  key={`${item.keyword}-${item.createdAt}-${i}`}
                  className="history-item"
                  onClick={() => setModalItem(item)}
                >
                  <div className="history-item__left">
                    <Image
                      className="history-item__denkyu"
                      src={denkyuSvg}
                      alt=""
                      width={8}
                      height={14}
                    />
                    <span className="history-item__keyword">{item.keyword}</span>
                  </div>
                  <div className="history-item__arrow">
                    <svg viewBox="0 0 10 10">
                      <path d="M3 1L7 5L3 9" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="footer">
          <p className="footer__note">※軽めの雑学です。諸説あります。</p>
          <p className="footer__text">©kitakyushu-chibit-trivia</p>
        </footer>
      </div>

      {/* Toast - outside app-container (z-index: 1) to overlay modal (z-index: 100) */}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>

      {/* History Detail Modal - outside app-container for proper fixed positioning */}
      {modalItem && (
        <>
          {/* Noise overlay - fixed full screen */}
          <div className="modal-noise" />
          {/* Backdrop - independent full-screen dark overlay */}
          <div className="modal-backdrop" onClick={() => setModalItem(null)} />
          {/* Modal Content */}
          <div className="modal-overlay" onClick={() => setModalItem(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              {/* Logo top-right */}
              <div className="modal-logo">
                <Image
                  src={logoOrangeSvg}
                  alt="北九州ちびっとトリビア"
                  width={185}
                  height={216}
                  unoptimized
                />
              </div>

              {/* Group wrapper for Blob, Text, and Buttons */}
              <div className="modal-blob-group">
                {/* Yellow blob background */}
                <div className="modal-blob-wrapper">
                  <Image
                    src={objectModalSvg}
                    alt=""
                    width={364}
                    height={464}
                    unoptimized
                  />
                </div>

                {/* Content */}
                <div className="modal-text-content">
                  <h2 className="modal-keyword">{modalItem.keyword}</h2>
                  <p className="modal-trivia">{modalItem.trivia}</p>
                </div>

                {/* Action Buttons */}
                <div className="modal-action-buttons">
                  <div className="action-btn-wrapper">
                    <button
                      className="action-btn"
                      onClick={() => setModalItem(null)}
                    >
                      <Image src={closeModalBottomSvg} alt="CLOSE" width={90} height={90} unoptimized />
                    </button>
                  </div>
                  <div className="action-btn-wrapper">
                    <button className="action-btn" onClick={handleModalCopy}>
                      <Image src={copySvg} alt="コピー" width={90} height={90} unoptimized />
                    </button>
                  </div>
                  <div className="action-btn-wrapper">
                    <button className="action-btn" onClick={handleModalShare}>
                      <Image src={shareSvg} alt="シェア" width={90} height={90} unoptimized />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
