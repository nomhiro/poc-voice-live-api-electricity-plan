# POC Voice Live API - 電力会社カスタマーサポート

音声を使って Azure OpenAI Realtime API と対話する電力会社カスタマーサポートシステムのプロトタイプ（POC）です。ブラウザから WebRTC を使って Azure OpenAI に直接接続し、リアルタイムでの音声対話を実現します。

## 🎯 概要

このアプリケーションは、以下の機能を提供します：

- **音声対話**: ブラウザのマイクを使用してAIエージェントと日本語で対話
- **電力カスタマーサポート**: AIエージェントが電気料金・契約に関するお問い合わせに対応
- **リアルタイム処理**: WebRTC を使用した低遅延の音声通信
- **関数呼び出し**: AIが必要に応じてバックエンドAPI（顧客情報、請求履歴、プラン変更など）を呼び出し
- **フォールバック機能**: Cosmos DB が利用できない場合はサンプルデータで動作

## 🚀 クイックスタート

### 前提条件

- Node.js 18.x 以上
- Azure OpenAI リソース（Realtime API 対応）

### セットアップ

1. **リポジトリのクローン**
   ```bash
   git clone <repository-url>
   cd poc-voice-live-api-electricity-plan
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **環境変数の設定**
   
   `.env.local.example` を `.env.local` にコピーして必要な値を設定：
   
   ```bash
   cp .env.local.example .env.local
   ```
   
   **必須の環境変数：**
   ```
   AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
   AZURE_OPENAI_API_KEY=<your-api-key>
   ```
   
   **オプションの環境変数：**
   ```
   AZURE_OPENAI_DEPLOYMENT=gpt-realtime
   NEXT_PUBLIC_AZURE_OPENAI_REGION=eastus2
   
   # Cosmos DB（設定しない場合はサンプルデータを使用）
   COSMOS_ENDPOINT=<cosmos-endpoint>
   COSMOS_KEY=<cosmos-key>
   COSMOS_DB=electricity-support-db
   COSMOS_CUSTOMERS_CONTAINER=customers
   COSMOS_BILLINGS_CONTAINER=billings
   COSMOS_USAGES_CONTAINER=usages
   COSMOS_PLANS_CONTAINER=plans
   COSMOS_PLAN_CHANGES_CONTAINER=plan_change_requests
   ```

4. **開発サーバーの起動**
   ```bash
   npm run dev
   ```

5. **ブラウザでアクセス**
   
   http://localhost:3000/realtime にアクセスして音声対話を開始

## 📱 使用方法

1. `/realtime` ページにアクセス
2. 「Start」ボタンをクリックしてマイクアクセスを許可
3. AIエージェント（電力会社カスタマーサポート）と日本語で対話
4. 電気料金の確認やプラン変更の手続きを進める

### サンプル顧客データ

| 顧客ID | 名前 | 電話番号下4桁 | プラン |
|--------|------|--------------|--------|
| C-001 | 野村宏樹 | 5678 | 従量電灯B |
| C-002 | 佐藤花子 | 5432 | スマートエコプラン |
| C-003 | 鈴木一郎 | 2222 | 従量電灯B |

### 対話の流れ（例）

1. **本人確認**
   - お客様：「電気代を教えてください」
   - AI：「お客様番号または電話番号下4桁をお教えください」
   - お客様：「5678です」
   - AI：「ご契約者様のお名前をお教えください」
   - お客様：「野村です」

2. **請求情報の確認**
   - AI：「野村宏樹様、ご本人確認が取れました。先月の電気料金は○○円です...」

3. **プラン変更相談**
   - お客様：「もっと安いプランはありますか？」
   - AI：「お客様の使用実績から、○○プランに変更すると年間約○○円お安くなります...」

## 🏗️ アーキテクチャ

### ディレクトリ構成

```
app/
├── api/
│   ├── functions/           # AI が呼び出す機能エンドポイント
│   │   ├── get_customer_info/       # 顧客情報取得（本人確認）
│   │   ├── get_billing_history/     # 請求履歴取得
│   │   ├── get_current_usage/       # 今月の使用量取得
│   │   ├── list_available_plans/    # 契約可能プラン一覧
│   │   ├── simulate_plan_change/    # プラン変更シミュレーション
│   │   └── submit_plan_change_request/ # プラン変更申請
│   ├── admin/
│   │   └── seed-electricity-data/   # サンプルデータ投入
│   └── realtime/session/    # Azure Realtime セッション作成
├── realtime/               # 音声対話UI
├── layout.tsx
└── page.tsx

lib/
├── cosmosClient.ts         # Cosmos DB クライアント
├── types/
│   └── electricity.ts      # TypeScript型定義
└── sampleData/
    └── electricity.ts      # サンプルデータ

infra/                      # Azure Bicep テンプレート
├── main.bicep
├── main.parameters.json
└── modules/
    └── cosmos-db.bicep
```

### データフロー

1. **セッション作成**: クライアントが `/api/realtime/session` でAzureセッションを作成
2. **WebRTC接続**: ブラウザとAzure間で音声ストリーミング接続を確立
3. **音声処理**: ユーザーの音声 → Azure AI → 機能呼び出し → レスポンス → 音声合成
4. **機能実行**: AIが必要に応じてローカルAPI（顧客情報、請求確認など）を呼び出し

## 🛠️ 開発

### 利用可能なコマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド
npm start        # 本番サーバー起動
npm run lint     # ESLint実行
```

### API エンドポイント

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/realtime/session` | GET | Azure Realtime セッション作成 |
| `/api/functions/get_customer_info` | POST | 顧客情報取得（本人確認） |
| `/api/functions/get_billing_history` | POST | 請求履歴取得 |
| `/api/functions/get_current_usage` | POST | 今月の使用量取得 |
| `/api/functions/list_available_plans` | POST | 契約可能プラン一覧 |
| `/api/functions/simulate_plan_change` | POST | プラン変更シミュレーション |
| `/api/functions/submit_plan_change_request` | POST | プラン変更申請 |
| `/api/admin/seed-electricity-data` | POST | サンプルデータ投入 |

### 技術スタック

- **フロントエンド**: Next.js 14+, React 18.2, TypeScript
- **音声技術**: WebRTC, Web Audio API
- **AI**: Azure OpenAI Realtime API (GPT Realtime)
- **データベース**: Azure Cosmos DB (オプション)
- **インフラ**: Azure Bicep

## 🗄️ Cosmos DB スキーマ

### コンテナー構成

| コンテナー | パーティションキー | 用途 |
|-----------|------------------|------|
| customers | /customerId | 顧客・契約情報 |
| billings | /customerId | 月次請求履歴 |
| usages | /customerId | 今月の使用量 |
| plans | /planType | 電力プランマスター |
| plan_change_requests | /customerId | プラン変更申請 |

### 料金プラン

| プランID | プラン名 | 特徴 |
|---------|---------|------|
| plan-standard-b | 従量電灯B | 標準的な3段階料金 |
| plan-smart-eco | スマートエコプラン | 夜間電力割引 |
| plan-green-plus | グリーンプラスプラン | 再エネ100% |
| plan-family-value | ファミリーバリュープラン | 大家族向け |

## 🔧 設定

### Azure OpenAI設定

1. Azure OpenAI リソースを作成
2. `gpt-realtime` モデルをデプロイ
3. API キーとエンドポイントを取得
4. `.env.local` に設定

### メール通知機能の設定（Gmail）

プラン変更申請時にお客様へメール通知を送信するには、Gmailのアプリパスワードを設定してください。

#### 1. Googleアカウントの2段階認証を有効化

1. [Googleアカウント](https://myaccount.google.com/) にアクセス
2. 左メニューから「セキュリティ」を選択
3. 「Googleにログインする方法」セクションで「2段階認証プロセス」をクリック
4. 画面の指示に従って2段階認証を有効化

#### 2. アプリパスワードを生成

1. 2段階認証が有効な状態で、[アプリパスワード](https://myaccount.google.com/apppasswords) にアクセス
2. 「アプリを選択」で「メール」を選択
3. 「デバイスを選択」で「その他（カスタム名）」を選択し、「電力サポートPOC」など任意の名前を入力
4. 「生成」をクリック
5. 表示された16文字のパスワードをコピー（スペースは除去）

#### 3. 環境変数を設定

`.env.local` に以下を追加：

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

**注意**: アプリパスワードは通常のGmailパスワードとは異なります。必ず生成されたアプリパスワードを使用してください。

#### メール通知が不要な場合

環境変数を設定しなければ、メール送信はスキップされます（プラン変更機能は正常に動作します）。

### Cosmos DB設定（オプション）

Azure Developer CLI (`azd`) を使用してリソースをプロビジョニングできます。

#### 前提条件

- [Azure Developer CLI](https://learn.microsoft.com/ja-jp/azure/developer/azure-developer-cli/install-azd) がインストールされていること
- Azure サブスクリプションへのアクセス権

#### デプロイ手順

1. **Azure にログイン**
   ```bash
   azd auth login
   ```

2. **環境の初期化**
   ```bash
   azd init
   ```
   プロンプトで環境名（例: `dev`）を入力します。

3. **リソースのプロビジョニング**
   ```bash
   azd provision
   ```
   プロンプトで以下を選択/入力します：
   - Azure サブスクリプション
   - デプロイ先のリージョン（例: `japaneast`）

4. **Cosmos DB キーの取得**
   
   Azure Portal で作成された Cosmos DB アカウントを開き、「キー」からプライマリキーをコピーします。

5. **環境変数の設定**
   
   `.env.local` にプロビジョニングされた値を設定：
   ```bash
   # azd provision の出力から取得
   COSMOS_ENDPOINT=https://<your-cosmos-account>.documents.azure.com:443/
   COSMOS_KEY=<Azure Portal から取得したキー>
   COSMOS_DB=electricity-support-db
   COSMOS_CUSTOMERS_CONTAINER=customers
   COSMOS_BILLINGS_CONTAINER=billings
   COSMOS_USAGES_CONTAINER=usages
   COSMOS_PLANS_CONTAINER=plans
   COSMOS_PLAN_CHANGES_CONTAINER=plan_change_requests
   ```

6. **サンプルデータを投入**
   ```bash
   npm run dev
   # 別ターミナルで
   curl -X POST http://localhost:3000/api/admin/seed-electricity-data
   ```

#### リソースの削除

```bash
azd down
```

設定しない場合、アプリケーションはサンプルデータで動作します。

## 🚨 注意事項

- **本番環境**: HTTPS必須（WebRTC要件）
- **APIキー**: 本番環境ではAPIキーを適切に保護してください
- **ブラウザ互換性**: WebRTC対応ブラウザが必要
- **マイクアクセス**: ユーザーのマイクアクセス許可が必要
- **個人情報**: POCのためサンプルデータを使用していますが、本番環境では適切なセキュリティ対策が必要です

## 📄 ライセンス

このプロジェクトはPOC（概念実証）として作成されています。

## 🤝 貢献

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
