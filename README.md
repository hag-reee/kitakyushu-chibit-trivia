# ひと口トリビア（Hitokuchi Trivia）

単語を1つ入力すると、"なんとなく関係がありそうな、役に立たない雑学"を1件表示するWebサービスです。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルをプロジェクトルートに作成し、以下を設定してください（`.env.example`を参照）：

```
GEMINI_API_KEY=your_gemini_api_key_here
```

- **GEMINI_API_KEY**（必須）: Google AI Studio で取得した Gemini API キー

### 3. ローカル起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアクセスできます。

## 機能

- **雑学生成**: 単語を入力して「ひと口もらう」ボタンで雑学を生成
- **おかわり**: 「もう一口」ボタンで同じ単語から別の雑学を再生成
- **コピー**: 雑学をクリップボードにコピー
- **X(Twitter)シェア**: 生成した雑学をXに共有
- **履歴**: 直近10件をlocalStorageに保存（全削除可能）

## レート制限

- IP単位で **1分あたり10回** のリクエスト制限
- 制限到達時は「ちょっと落ち着いて、もう一口。」と表示されます

## 技術スタック

- Next.js (App Router)
- Gemini API (REST / v1beta)
- TypeScript

## デプロイ

Vercelへのデプロイに対応しています。環境変数 `GEMINI_API_KEY` をVercelのダッシュボードで設定してください。
