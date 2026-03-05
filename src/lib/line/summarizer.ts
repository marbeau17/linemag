// ============================================================================
// src/lib/line/summarizer.ts
// Gemini API による記事要約生成
// ============================================================================

import type { ScrapedArticle, SummaryResult } from '@/types/line';

const GEMINI_MODEL = 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return key;
}

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

export async function summarizeArticle(article: ScrapedArticle): Promise<SummaryResult> {
  const apiKey = getApiKey();
  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const truncatedBody =
    article.body.length > 5000 ? article.body.substring(0, 5000) + '\n\n（以下省略）' : article.body;

  const userPrompt = `【記事タイトル】\n${article.title}\n\n【記事本文】\n${truncatedBody}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        topP: 0.9,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'unknown');
    throw new Error(`Gemini API error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || '')
    .join('') || '';

  const usage = data.usageMetadata || {};
  const tokenUsage = {
    promptTokens: usage.promptTokenCount || 0,
    completionTokens: usage.candidatesTokenCount || 0,
    totalTokens: usage.totalTokenCount || 0,
  };

  // タイトルと要約を分離
  const lines = text.trim().split('\n');
  let catchyTitle = (lines[0] || article.title).replace(/^[#*\->\s]+/, '').trim();
  let summaryText = lines.slice(1).filter((l: string) => l.trim().length > 0).join('\n').trim();

  // 長すぎる場合は句点で切る
  if (summaryText.length > 350) {
    const cutPos = summaryText.lastIndexOf('。', 350);
    if (cutPos > 150) summaryText = summaryText.substring(0, cutPos + 1);
  }

  return { catchyTitle, summaryText, tokenUsage };
}
