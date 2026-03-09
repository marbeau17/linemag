// ============================================================================
// src/lib/line/config.ts
// 設定値の集約管理
// ============================================================================

export const config = {
  blog: {
    url: 'https://meetsc.co.jp/blog/',
    baseUrl: 'https://meetsc.co.jp/blog/',
    siteUrl: 'https://meetsc.co.jp',
    maxArticlesPerScrape: 5,
    userAgent: 'LineMag/1.0',
  },

  gemini: {
    model: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    temperature: 0.7,
    maxOutputTokens: 512,
    topP: 0.9,
    maxBodyLength: 5000,
    get apiKey(): string {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY is not set');
      return key;
    },
  },

  line: {
    broadcastUrl: 'https://api.line.me/v2/bot/message/broadcast',
    pushUrl: 'https://api.line.me/v2/bot/message/push',
    get channelAccessToken(): string {
      const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!t) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
      return t;
    },
    get adminUserId(): string {
      return process.env.ADMIN_LINE_USER_ID || '';
    },
  },

  summary: {
    minLength: 50,
    targetMinLength: 200,
    targetMaxLength: 300,
    absoluteMaxLength: 500,
    truncateAt: 350,
  },

  storage: {
    dataDir: 'data',
    maxSentUrls: 200,
    maxLogEntries: 500,
    maxHistoryEntries: 500,
  },

  retry: {
    scraper: { maxRetries: 1, delayMs: 3000, retryableStatuses: [500, 502, 503, 504] },
    gemini: { maxRetries: 2, delayMs: 5000, retryableStatuses: [429, 500, 502, 503] },
    lineDefault: { maxRetries: 1, delayMs: 5000, retryableStatuses: [500, 502, 503, 504] },
    lineRateLimit: { maxRetries: 1, delayMs: 60000 },
  },

  cron: {
    get secret(): string {
      return process.env.CRON_SECRET || '';
    },
  },
} as const;
