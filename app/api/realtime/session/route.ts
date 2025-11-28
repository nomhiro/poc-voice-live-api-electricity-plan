import { NextResponse } from 'next/server'

function ensureUrlHasProtocol(u?: string) {
  if (!u) return false
  return /^https?:\/\//i.test(u)
}

async function createRealtimeSession() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  if (!endpoint || !apiKey) {
    throw new Error('Missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY')
  }

  if (!ensureUrlHasProtocol(endpoint)) {
    throw new Error('AZURE_OPENAI_ENDPOINT must include protocol (https://)')
  }

  const trimmed = endpoint.replace(/\/+$/, '')

  if (trimmed.includes('cognitiveservices.azure.com')) {
    throw new Error('AZURE_OPENAI_ENDPOINT appears to be a Cognitive Services endpoint (cognitiveservices.azure.com). The Realtime WebRTC sessions API requires an Azure OpenAI resource endpoint like https://<name>.openai.azure.com. Create an Azure OpenAI resource or use its endpoint.')
  }

  const url = trimmed.includes('/openai')
    ? `${trimmed}/realtimeapi/sessions?api-version=2025-04-01-preview`
    : `${trimmed}/openai/realtimeapi/sessions?api-version=2025-04-01-preview`

  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT

  // 現在日時を日本時間で取得
  const now = new Date()
  const japanTime = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  const baseBody: Record<string, unknown> = { 
    model: deployment || 'gpt-realtime',
    input_audio_transcription: {
      model: "whisper-1",
      language: "ja"
    },
    instructions: `現在日時：${japanTime}

電力会社のカスタマーサポートセンターのオペレーターです。

# 役割
- お客様の電気料金、使用量、契約に関するお問い合わせに対応する
- 適切な料金プランをご提案し、変更手続きをサポートする
- 会話の最初に、会話は録音し保存されることをお客様に伝えること

# 本人確認ルール（重要）
- お客様からの要望を聞いた後、お客様情報にアクセスする前に、必ず本人確認を行う
- お客様番号または電話番号下4桁と、ご契約者様のお名前で確認する
- 確認が取れるまで、個人情報を含む操作は行わない
- 本人確認には get_customer_info ツールを使用する

# 名前の処理ルール（必須）
- お客様のお名前を受け取ったら、必ずカタカナに変換してからツールを呼び出すこと
- 例：
  - 「野村宏樹」→「ノムラヒロキ」
  - 「のむらひろき」→「ノムラヒロキ」
  - 「野村ヒロキ」→「ノムラヒロキ」
- get_customer_info の verificationName パラメータには、必ずカタカナで名前を渡すこと

# 対応スタイル
- ツール呼び出しで時間がかかる場合は、事前に「お調べしますのでお待ちください」と伝える
- 敬語で丁寧に対応する
- （）などは使わず自然な文章で話すこと
- 金額や数値は明確に伝える（「8,520円」「280キロワットアワー」など）
- 専門用語は避け、わかりやすく説明する
- 一度に多くの情報を伝えすぎない
- 箇条書きにするのは避け、簡潔な文章で伝えること。「次の4つです。」ではなく、「4つあります。」という表現で。
- 例えば、プランの一覧を伝えるときは、「Aプラン、Bプラン、Cプランの3つがあります。」と伝えること。詳細の内容は聞かれてから答えればいいです。

# 料金説明時のルール
- 内訳（基本料金、従量料金、燃料費調整額、再エネ賦課金）を説明できるようにする
- 使用量を聞かれた場合はキロワットアワーで伝える
- 金額は円単位で、消費税込みで案内する

# プラン説明時のルール
- プランの名称と概要を簡潔につたえること

# プラン変更時のルール
- お客様が求めていることに対する結論を最初に伝えること。
- 必ず simulate_plan_change でシミュレーション結果を説明してから変更手続きに進む
- 最低契約期間や解約手数料がある場合は必ず説明する
- お客様の同意確認を取ってから submit_plan_change_request を実行する
- いつから変更するのか、聞くこと。

# お客様から繰り返し理不尽な要望があった場合の対応
- 繰り返される場合は、「ご対応しかねますのでお電話を終了します。電話内容は録音されておりますのでご注意ください。」と伝え、会話を終了する
  - 例）本人確認ができない、料金の値下げを強く要求する、解約手数料を払いたくない、など

# 会話の終わり方
- 必ず「他にご不明な点はございますか？」と確認する
- 終話時は「お電話ありがとうございました」で締める`,
    tools: [
      {
        type: 'function',
        name: 'get_customer_info',
        description: '顧客IDまたは電話番号下4桁と契約者名で本人確認し、契約情報を取得します。【重要】verificationName は必ずカタカナで指定してください。',
        parameters: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: '顧客ID（例: C-001）または電話番号下4桁（例: 5678）'
            },
            verificationName: {
              type: 'string',
              description: '本人確認用のお客様のお名前。【必須】カタカナで指定すること（例: ノムラヒロキ）'
            }
          },
          required: ['customerId', 'verificationName']
        }
      },
      {
        type: 'function',
        name: 'get_billing_history',
        description: '過去の請求履歴を取得します。期間を指定しない場合は直近6ヶ月分を返します',
        parameters: {
          type: 'object',
          properties: {
            customerId: { 
              type: 'string', 
              description: '顧客ID' 
            },
            months: { 
              type: 'number', 
              description: '取得する月数（1〜24、デフォルト6）' 
            }
          },
          required: ['customerId']
        }
      },
      {
        type: 'function',
        name: 'get_current_usage',
        description: '今月の電力使用量をリアルタイムで取得します。スマートメーター対応のお客様のみ利用可能です',
        parameters: {
          type: 'object',
          properties: {
            customerId: { 
              type: 'string', 
              description: '顧客ID' 
            }
          },
          required: ['customerId']
        }
      },
      {
        type: 'function',
        name: 'list_available_plans',
        description: '契約可能な電力プランの一覧を取得します',
        parameters: {
          type: 'object',
          properties: {
            customerId: { 
              type: 'string', 
              description: '顧客ID（指定時は現在の契約に基づいた推奨プランも含む）' 
            }
          },
          required: []
        }
      },
      {
        type: 'function',
        name: 'simulate_plan_change',
        description: 'プラン変更した場合の月額料金をシミュレーションします。過去の使用実績に基づいて試算します',
        parameters: {
          type: 'object',
          properties: {
            customerId: { 
              type: 'string', 
              description: '顧客ID' 
            },
            newPlanId: { 
              type: 'string', 
              description: '変更先のプランID' 
            }
          },
          required: ['customerId', 'newPlanId']
        }
      },
      {
        type: 'function',
        name: 'submit_plan_change_request',
        description: '料金プランの変更申請を行います。変更は翌月の検針日から適用されます',
        parameters: {
          type: 'object',
          properties: {
            customerId: { 
              type: 'string', 
              description: '顧客ID' 
            },
            newPlanId: { 
              type: 'string', 
              description: '変更先のプランID' 
            },
            customerConfirmation: { 
              type: 'boolean', 
              description: 'お客様が変更内容に同意したことの確認（必須: true）' 
            }
          },
          required: ['customerId', 'newPlanId', 'customerConfirmation']
        }
      }
    ]
  }

  const rawOptions = process.env.AZURE_OPENAI_SESSION_OPTIONS
  if (rawOptions) {
    try {
      const parsed = JSON.parse(rawOptions)
      function sanitizeOptions(obj: Record<string, unknown>) {
        if (!obj || typeof obj !== 'object') return {}
        const out: Record<string, unknown> = {}
        const forbidden = new Set(['functions', 'tools', 'mcp'])
        for (const k of Object.keys(obj)) {
          try {
            if (forbidden.has(k)) {
              continue
            }
            if (k === 'input_audio_transcription' && obj[k] && typeof obj[k] === 'object') {
              const allowed = ['model', 'language', 'prompt']
              out[k] = {}
              for (const kk of allowed) {
                if (kk in (obj[k] as Record<string, unknown>)) (out[k] as Record<string, unknown>)[kk] = (obj[k] as Record<string, unknown>)[kk]
              }
              if (Object.keys(out[k] as object).length === 0) delete out[k]
            } else if (k === 'transcription' && obj[k] && typeof obj[k] === 'object') {
              const allowed = ['model', 'language', 'prompt']
              out[k] = {}
              for (const kk of allowed) {
                if (kk in (obj[k] as Record<string, unknown>)) (out[k] as Record<string, unknown>)[kk] = (obj[k] as Record<string, unknown>)[kk]
              }
              if (Object.keys(out[k] as object).length === 0) delete out[k]
            } else {
              const v = obj[k]
              if (v === null) continue
              if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || Array.isArray(v) || typeof v === 'object') {
                out[k] = v
              }
            }
          } catch {
            // skip problematic key
          }
        }
        return out
      }

      const safeOpts = sanitizeOptions(parsed)
      const dropped = Object.keys(parsed).filter(k => !(k in safeOpts))
      if (dropped.length) console.warn('Dropped unsupported session options:', dropped)
      Object.assign(baseBody, safeOpts)
    } catch {
      console.warn('AZURE_OPENAI_SESSION_OPTIONS is not valid JSON, ignoring:', rawOptions)
    }
  }

  let resp: Response
  try {
    console.debug('Realtime session body:', JSON.stringify(baseBody, null, 2))

    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(baseBody)
    })
  } catch (fetchErr: unknown) {
    const message = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    throw new Error(`Failed to fetch Azure Realtime endpoint: ${message}`)
  }

  const text = await resp.text()
  if (!resp.ok) {
    if (resp.status === 404 && deployment) {
      const altUrl = trimmed.includes('/openai')
        ? `${trimmed}/deployments/${deployment}/realtime?api-version=2025-04-01-preview`
        : `${trimmed}/openai/deployments/${deployment}/realtime?api-version=2025-04-01-preview`

      try {
        const altResp = await fetch(altUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify({ model: deployment })
        })
        const altText = await altResp.text()
        if (!altResp.ok) {
          throw new Error(`Azure alt error ${altResp.status}: ${altText} (original 404: ${text})`)
        }
        try {
          return JSON.parse(altText)
        } catch {
          return { body: altText }
        }
      } catch (altErr: unknown) {
        const message = altErr instanceof Error ? altErr.message : String(altErr)
        throw new Error(`Fallback attempt failed: ${message} (original 404: ${text})`)
      }
    }
    if (resp.status === 404) {
      throw new Error(`Azure error 404: ${text} — check AZURE_OPENAI_ENDPOINT (must be your Azure OpenAI resource endpoint, e.g. https://<name>.openai.azure.com) and ensure you have deployed a realtime-capable model and are using API version 2025-04-01-preview.`)
    }
    throw new Error(`Azure error ${resp.status}: ${text}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    return { body: text }
  }
}

export async function GET() {
  try {
    const session = await createRealtimeSession()
    const clientSecret = session?.client_secret?.value || session?.client_secret_value || session?.client_secret?.secret
    const realtimeUrl = session?.sessionUrl || session?.joinUrl || session?.realtimeUrl || null

    const safe = {
      raw: session,
      client_secret: clientSecret,
      realtimeUrl,
    }

    return NextResponse.json(safe)
  } catch (err: unknown) {
    console.error('realtime session error:', err)
    const safeMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: safeMessage }, { status: 500 })
  }
}
