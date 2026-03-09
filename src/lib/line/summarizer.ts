// ============================================================================
// src/lib/line/summarizer.ts
// Gemini API による記事要約生成
// リトライロジック付き (E-04, E-05, E-06)
// ============================================================================

import type { ScrapedArticle, SummaryResult } from '@/types/line';
import { config } from './config';
import { withRetry, HttpError } from './retry';

// ─── カスタムエラー ──────────────────────────────────────────────────────────

export class GeminiApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly isSafetyBlock: boolean = false,
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

// ─── プロンプト ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたはプロのコピーライターです。
ブログ記事の本文を読み、LINE公式アカウントで配信するための要約文を作成してください。

【出力フォーマット — 必ず以下の2行構成で出力】
1行目: キャッチーなタイトル（原題を元に、読者の興味を引く20文字以内の短いタイトル）
2行目以降: 要約本文

【要約のルール】
- 要約本文は200〜300文字で簡潔にまとめる
- 読者が「続きを読みたい」と思うキャッチーな表現にする
- 記事の核心的な価値提案を必ず含める
- 絵文字を適度に使用して視認性を高める（最大3個）
- 専門用語は避け、平易な日本語で書く
- 最後に「詳しくはこちら」等の誘導文は含めないこと（リンクは別途付与する）
- タイトル行と本文の間に空行を1つ入れること`;

// ─── Gemini API 呼び出し ─────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

async function callGeminiApi(userPrompt: string): Promise<GeminiResponse> {
  const url = `${config.gemini.baseUrl}/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: config.gemini.temperature,
        maxOutputTokens: config.gemini.maxOutputTokens,
        topP: config.gemini.topP,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'unknown');
    throw new HttpError(
      `Gemini API error ${response.status}: ${err.substring(0, 200)}`,
      response.status,
    );
  }

  const data: GeminiResponse = await response.json();

  // E-06: セーフティフィルタブロック — リトライ不可
  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason === 'SAFETY') {
    throw new GeminiApiError(
      'Gemini API: コンテンツがセーフティフィルタによりブロックされました',
      200,
      true,
    );
  }

  return data;
}

function parseSummary(data: GeminiResponse, originalTitle: string): { catchyTitle: string; summaryText: string } {
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('') || '';

  const lines = text.trim().split('\n');
  const catchyTitle = (lines[0] || originalTitle).replace(/^[#*\->\s]+/, '').trim();
  let summaryText = lines.slice(1).filter((l) => l.trim().length > 0).join('\n').trim();

  if (summaryText.length > config.summary.truncateAt) {
    const cutPos = summaryText.lastIndexOf('。', config.summary.truncateAt);
    if (cutPos > 150) summaryText = summaryText.substring(0, cutPos + 1);
  }

  return { catchyTitle, summaryText };
}

// ─── 公開API ─────────────────────────────────────────────────────────────────

export async function summarizeArticle(article: ScrapedArticle): Promise<SummaryResult> {
  const truncatedBody =
    article.body.length > config.gemini.maxBodyLength
      ? article.body.substring(0, config.gemini.maxBodyLength) + '\n\n（以下省略）'
      : article.body;

  const userPrompt = `【記事タイトル】\n${article.title}\n\n【記事本文】\n${truncatedBody}`;

  // E-04: API呼び出し失敗 — 2回リトライ (5秒間隔)
  // E-06: セーフティフィルタはリトライしない (GeminiApiError.isSafetyBlock)
  const data = await withRetry(
    () => callGeminiApi(userPrompt),
    {
      ...config.retry.gemini,
      onRetry: (attempt, error) => {
        console.log(`[summarizer] Gemini API retry #${attempt}: ${error.message}`);
      },
    },
  );

  const usage = data.usageMetadata || {};
  const tokenUsage = {
    promptTokens: usage.promptTokenCount || 0,
    completionTokens: usage.candidatesTokenCount || 0,
    totalTokens: usage.totalTokenCount || 0,
  };

  let { catchyTitle, summaryText } = parseSummary(data, article.title);

  // E-05: 要約結果が不正 — 再生成1回
  if (summaryText.length < config.summary.minLength || summaryText.length > config.summary.absoluteMaxLength) {
    console.log(`[summarizer] Summary invalid (length=${summaryText.length}), regenerating once...`);
    const retryData = await callGeminiApi(userPrompt);
    const retryResult = parseSummary(retryData, article.title);

    if (retryResult.summaryText.length >= config.summary.minLength &&
        retryResult.summaryText.length <= config.summary.absoluteMaxLength) {
      catchyTitle = retryResult.catchyTitle;
      summaryText = retryResult.summaryText;
    } else {
      console.warn(`[summarizer] Retry also produced invalid summary (length=${retryResult.summaryText.length}), using best effort`);
      if (retryResult.summaryText.length > summaryText.length) {
        catchyTitle = retryResult.catchyTitle;
        summaryText = retryResult.summaryText;
      }
    }
  }

  return { catchyTitle, summaryText, tokenUsage };
}
