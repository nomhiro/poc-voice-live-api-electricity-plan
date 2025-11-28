# MCP Server - 電力会社カスタマーサポート

Azure Functions ベースの MCP (Model Context Protocol) サーバーです。
Azure OpenAI Realtime API から直接呼び出され、電力会社カスタマーサポートのツールを提供します。

## 前提条件

- Node.js 18 以上
- Azure Functions Core Tools v4
- ngrok（ローカル開発時に Azure からアクセスするため）

### Azure Functions Core Tools のインストール

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

### ngrok のインストール

https://ngrok.com/download からダウンロードしてインストール

## セットアップ

```bash
# 依存関係のインストール
npm install

# TypeScript のビルド
npm run build
```

## ローカル起動手順

### 1. MCP サーバーの起動

```bash
cd mcp-server
npm start
```

起動すると以下のように表示されます：
```
Azure Functions Core Tools
...
Functions:
        getCustomerInfo: mcpToolTrigger
        getBillingHistory: mcpToolTrigger
        getCurrentUsage: mcpToolTrigger
        listAvailablePlans: mcpToolTrigger
        simulatePlanChange: mcpToolTrigger
        submitPlanChangeRequest: mcpToolTrigger

MCP endpoint: http://localhost:7071/runtime/webhooks/mcp
```

### 2. ngrok でインターネットに公開

別のターミナルで実行：

```bash
ngrok http 7071
```

ngrok が起動すると、以下のような URL が表示されます：
```
Forwarding    https://xxxx-xx-xx-xxx-xxx.ngrok-free.app -> http://localhost:7071
```

### 3. 環境変数の設定

プロジェクトルートの `.env.local` を編集し、`MCP_SERVER_URL` を ngrok の URL に更新：

```env
MCP_SERVER_URL="https://xxxx-xx-xx-xxx-xxx.ngrok-free.app/runtime/webhooks/mcp"
```

### 4. Next.js アプリの起動

プロジェクトルートに戻って：

```bash
cd ..
npm run dev
```

### 5. 動作確認

ブラウザで http://localhost:3000/realtime にアクセスし、音声で対話をテストします。

## 提供ツール

| ツール名 | 説明 |
|---------|------|
| `get_customer_info` | 顧客ID/電話番号と名前で本人確認し、契約情報を取得 |
| `get_billing_history` | 過去の請求履歴（使用量・請求金額）を取得 |
| `get_current_usage` | 今月のリアルタイム使用量を取得（スマートメーター限定） |
| `list_available_plans` | 契約可能な電力プラン一覧を取得 |
| `simulate_plan_change` | プラン変更時の料金シミュレーション |
| `submit_plan_change_request` | プラン変更申請の送信 |

## 環境変数

`local.settings.json` で設定可能な環境変数：

| 変数名 | 説明 | デフォルト |
|-------|------|----------|
| `COSMOS_ENDPOINT` | Cosmos DB エンドポイント | - |
| `COSMOS_KEY` | Cosmos DB キー | - |
| `COSMOS_DB` | データベース名 | `electricity-support-db` |
| `COSMOS_CUSTOMERS_CONTAINER` | 顧客コンテナ名 | `customers` |
| `COSMOS_BILLINGS_CONTAINER` | 請求コンテナ名 | `billings` |
| `COSMOS_USAGES_CONTAINER` | 使用量コンテナ名 | `usages` |
| `COSMOS_PLANS_CONTAINER` | プランコンテナ名 | `plans` |
| `COSMOS_PLAN_CHANGES_CONTAINER` | プラン変更コンテナ名 | `plan_change_requests` |
| `GMAIL_USER` | 通知メール送信元 | - |
| `GMAIL_APP_PASSWORD` | Gmail アプリパスワード | - |

※ Cosmos DB が未設定の場合、サンプルデータにフォールバックします。

## トラブルシューティング

### Azure Functions Core Tools が見つからない

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

### ngrok の接続が切れる

無料版の ngrok はセッションが一定時間で切れます。再度 `ngrok http 7071` を実行し、`.env.local` の URL を更新してください。

### MCP サーバーに接続できない

1. MCP サーバーが起動しているか確認
2. ngrok が実行中か確認
3. `.env.local` の `MCP_SERVER_URL` が正しいか確認
4. Next.js アプリを再起動
