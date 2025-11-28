import { NextRequest, NextResponse } from 'next/server';
import { AzureOpenAI } from 'openai';
import { getEmailTransporter } from '@/lib/emailClient';
import type { ConversationEmailRequest, ConversationEmailResponse, ErrorResponse } from '@/lib/types/electricity';

// Azure OpenAI client for summary generation
function getAzureOpenAIClient(): AzureOpenAI | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  if (!endpoint || !apiKey) {
    console.warn('Azure OpenAI not configured for summary generation');
    return null;
  }

  return new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion: '2024-08-01-preview'
  });
}

// Generate conversation summary using GPT-4.1
async function generateSummary(conversationText: string): Promise<string | null> {
  const client = getAzureOpenAIClient();
  if (!client) {
    return null;
  }

  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4.1';

  try {
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        {
          role: 'system',
          content: `あなたは電力会社カスタマーサポートの会話をまとめるアシスタントです。
以下の会話内容を簡潔に要約してください。

要約に含める内容：
- お客様のお問い合わせ内容
- 対応結果（確認した情報、手続きの有無など）
- 今後の対応事項があれば記載

箇条書きで3〜5項目程度にまとめてください。`
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
}

// Format transcript to readable text
function formatTranscriptText(transcript: ConversationEmailRequest['transcript']): string {
  return transcript
    .map(msg => {
      const speaker = msg.speaker === 'user' ? 'お客様' : 'オペレーター';
      return `${speaker}: ${msg.text}`;
    })
    .join('\n\n');
}

// Format transcript to HTML
function formatTranscriptHtml(transcript: ConversationEmailRequest['transcript']): string {
  return transcript
    .map(msg => {
      const speaker = msg.speaker === 'user' ? 'お客様' : 'オペレーター';
      return `<p><strong>${speaker}:</strong> ${escapeHtml(msg.text)}</p>`;
    })
    .join('\n');
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Create email HTML
function createEmailHtml(customerName: string, summary: string | null, transcriptHtml: string): string {
  const summarySection = summary
    ? `<h3>【会話のサマリー】</h3>
<div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; white-space: pre-wrap;">
${escapeHtml(summary)}
</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.6; color: #333; }
    h2 { color: #2c5aa0; }
    h3 { color: #444; margin-top: 24px; }
    .transcript { border-left: 3px solid #2c5aa0; padding-left: 16px; margin: 16px 0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h2>お問い合わせ内容のご確認</h2>

  <p>${escapeHtml(customerName)} 様</p>
  <p>本日はお電話いただきありがとうございました。</p>
  <p>以下に本日の会話内容をお送りいたします。</p>

  ${summarySection}

  <h3>【会話の全文】</h3>
  <div class="transcript">
    ${transcriptHtml}
  </div>

  <div class="footer">
    <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
    <p>株式会社 電力サポート</p>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConversationEmailRequest = await request.json();
    const { customerId, customerEmail, customerName, transcript } = body;

    // Validate required fields
    if (!customerId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'お客様番号が指定されていません。',
        errorCode: 'INVALID_INPUT'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!customerEmail) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'メールアドレスが指定されていません。',
        errorCode: 'INVALID_INPUT'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!customerName) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '顧客名が指定されていません。',
        errorCode: 'INVALID_INPUT'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!transcript || transcript.length === 0) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '会話内容がありません。',
        errorCode: 'INVALID_INPUT'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Check if email is configured
    const emailTransporter = getEmailTransporter();
    if (!emailTransporter) {
      console.log('Email skipped: transporter not configured');
      const response: ConversationEmailResponse = {
        success: true,
        message: 'メール送信機能が設定されていないため、送信をスキップしました。',
        skipped: true
      };
      return NextResponse.json(response);
    }

    // Format transcript for summary generation and email
    const conversationText = formatTranscriptText(transcript);
    const transcriptHtml = formatTranscriptHtml(transcript);

    // Generate summary using GPT-4.1
    const summary = await generateSummary(conversationText);

    // Create email HTML
    const emailHtml = createEmailHtml(customerName, summary, transcriptHtml);

    // Send email
    try {
      await emailTransporter.sendMail({
        from: process.env.GMAIL_USER,
        to: customerEmail,
        subject: '【電力サポート】本日のお問い合わせ内容のご確認',
        html: emailHtml
      });

      console.log(`Conversation email sent successfully to ${customerEmail}`);

      const response: ConversationEmailResponse = {
        success: true,
        message: `${customerName}様のメールアドレス（${customerEmail}）に会話内容をお送りしました。`,
        sentTo: customerEmail
      };
      return NextResponse.json(response);

    } catch (emailError) {
      console.error('Failed to send conversation email:', emailError);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'メール送信に失敗しました。',
        errorCode: 'SYSTEM_ERROR'
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

  } catch (error) {
    console.error('Error in send_conversation_email:', error);
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'システムエラーが発生しました。',
      errorCode: 'SYSTEM_ERROR'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'send_conversation_email',
    description: '会話終了時に、本日の会話内容のサマリーと全文をお客様にメールで送信します。',
    method: 'POST',
    parameters: {
      customerId: '顧客ID（必須）',
      customerEmail: '顧客のメールアドレス（必須）',
      customerName: '顧客名（必須）',
      transcript: '会話内容の配列（フロントエンドから自動注入）'
    }
  });
}
