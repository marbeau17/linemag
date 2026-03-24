// ============================================================================
// src/lib/line/templates-business.ts
// LINE Flex Message テンプレート — クーポン・予約通知
// ============================================================================

import type {
  FlexContainer,
  FlexBox,
  FlexText,
  FlexImage,
  FlexButton,
  FlexAction,
  FlexComponent,
  FlexSeparator,
} from '@/types/line';

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function formatDiscount(discountType: string, discountValue: number): string {
  if (discountType === 'percent') {
    return `${discountValue}% OFF`;
  }
  return `¥${discountValue.toLocaleString()} OFF`;
}

// ============================================================================
// 1. クーポン配信通知
// altText: `クーポンプレゼント: ${params.couponName}`
// ============================================================================

export function buildCouponDeliveryMessage(params: {
  couponName: string;
  couponCode: string;
  discountType: string;
  discountValue: number;
  validUntil: string;
  description?: string;
}): FlexContainer {
  const bodyContents: FlexComponent[] = [
    // クーポン名
    {
      type: 'text',
      text: params.couponName,
      weight: 'bold',
      size: 'lg',
      color: '#1A1A2E',
      wrap: true,
    },
    // 割引表示
    {
      type: 'text',
      text: formatDiscount(params.discountType, params.discountValue),
      weight: 'bold',
      size: '3xl',
      color: '#1E8449',
      align: 'center',
      margin: 'lg',
    },
    { type: 'separator', color: '#E8E8E8', margin: 'lg' },
  ];

  // 説明文（任意）
  if (params.description) {
    bodyContents.push({
      type: 'text',
      text: params.description,
      size: 'sm',
      color: '#555555',
      wrap: true,
      margin: 'lg',
    });
  }

  // クーポンコード（破線ボックス風）
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: 'クーポンコード',
        size: 'xxs',
        color: '#888888',
        align: 'center',
      },
      {
        type: 'text',
        text: params.couponCode,
        size: 'xl',
        weight: 'bold',
        color: '#1E8449',
        align: 'center',
        margin: 'sm',
      },
    ],
    margin: 'lg',
    paddingAll: 'lg',
    backgroundColor: '#F0FFF4',
    cornerRadius: 'md',
    borderWidth: 'normal',
    borderColor: '#1E8449',
  } as FlexComponent);

  // 有効期限
  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: '有効期限',
        size: 'xs',
        color: '#888888',
        flex: 0,
      },
      {
        type: 'text',
        text: params.validUntil,
        size: 'xs',
        color: '#555555',
        align: 'end',
      },
    ],
    margin: 'lg',
  } as FlexComponent);

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '🎁 クーポンプレゼント',
          size: 'md',
          weight: 'bold',
          color: '#FFFFFF',
          align: 'center',
        },
      ],
      paddingAll: 'lg',
      backgroundColor: '#1E8449',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingAll: 'xl',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'message',
            label: 'クーポンを使う',
            text: `coupon:${params.couponCode}`,
          },
          style: 'primary',
          color: '#1E8449',
          height: 'sm',
        },
      ],
      paddingAll: 'lg',
    },
    styles: { footer: { separator: true } },
  };
}

// ============================================================================
// 2. 予約確定通知
// altText: `予約確定: ${params.date} ${params.startTime}〜${params.endTime}`
// ============================================================================

export function buildReservationConfirmMessage(params: {
  date: string;
  startTime: string;
  endTime: string;
  consultantName: string;
  serviceType: string;
  meetUrl: string;
}): FlexContainer {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '✅ 予約確定',
          size: 'md',
          weight: 'bold',
          color: '#FFFFFF',
          align: 'center',
        },
      ],
      paddingAll: 'lg',
      backgroundColor: '#2471A3',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'ご予約が確定しました',
          size: 'sm',
          color: '#555555',
          align: 'center',
        },
        { type: 'separator', color: '#E8E8E8', margin: 'lg' },
        // 日時
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '日時', size: 'sm', color: '#888888', flex: 2 },
            {
              type: 'text',
              text: `${params.date} ${params.startTime}〜${params.endTime}`,
              size: 'sm',
              color: '#1A1A2E',
              weight: 'bold',
              flex: 5,
              wrap: true,
            },
          ],
          margin: 'lg',
        } as FlexComponent,
        // 担当者
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '担当', size: 'sm', color: '#888888', flex: 2 },
            {
              type: 'text',
              text: params.consultantName,
              size: 'sm',
              color: '#1A1A2E',
              flex: 5,
            },
          ],
          margin: 'md',
        } as FlexComponent,
        // サービス種別
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '内容', size: 'sm', color: '#888888', flex: 2 },
            {
              type: 'text',
              text: params.serviceType,
              size: 'sm',
              color: '#1A1A2E',
              flex: 5,
              wrap: true,
            },
          ],
          margin: 'md',
        } as FlexComponent,
        { type: 'separator', color: '#E8E8E8', margin: 'lg' },
        {
          type: 'text',
          text: '当日はGoogle Meetからご参加ください。',
          size: 'xs',
          color: '#888888',
          wrap: true,
          margin: 'lg',
        },
      ],
      paddingAll: 'xl',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: 'Google Meetに参加',
            uri: params.meetUrl,
          },
          style: 'primary',
          color: '#2471A3',
          height: 'sm',
        },
      ],
      paddingAll: 'lg',
    },
    styles: { footer: { separator: true } },
  };
}

// ============================================================================
// 3. 予約リマインダー
// altText: `リマインダー: ${params.minutesUntil}分後に相談が始まります`
// ============================================================================

export function buildReservationReminderMessage(params: {
  date: string;
  startTime: string;
  endTime: string;
  consultantName: string;
  meetUrl: string;
  minutesUntil: number;
}): FlexContainer {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '🔔 リマインダー',
          size: 'md',
          weight: 'bold',
          color: '#FFFFFF',
          align: 'center',
        },
      ],
      paddingAll: 'lg',
      backgroundColor: '#E67E22',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'まもなく相談が始まります',
          size: 'md',
          weight: 'bold',
          color: '#1A1A2E',
          align: 'center',
        },
        {
          type: 'text',
          text: `あと${params.minutesUntil}分`,
          size: 'xl',
          weight: 'bold',
          color: '#E67E22',
          align: 'center',
          margin: 'md',
        },
        { type: 'separator', color: '#E8E8E8', margin: 'lg' },
        // 日時
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '日時', size: 'sm', color: '#888888', flex: 2 },
            {
              type: 'text',
              text: `${params.date} ${params.startTime}〜${params.endTime}`,
              size: 'sm',
              color: '#1A1A2E',
              weight: 'bold',
              flex: 5,
              wrap: true,
            },
          ],
          margin: 'lg',
        } as FlexComponent,
        // 担当者
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '担当', size: 'sm', color: '#888888', flex: 2 },
            {
              type: 'text',
              text: params.consultantName,
              size: 'sm',
              color: '#1A1A2E',
              flex: 5,
            },
          ],
          margin: 'md',
        } as FlexComponent,
      ],
      paddingAll: 'xl',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: 'Google Meetに参加',
            uri: params.meetUrl,
          },
          style: 'primary',
          color: '#E67E22',
          height: 'sm',
        },
      ],
      paddingAll: 'lg',
    },
    styles: { footer: { separator: true } },
  };
}

// ============================================================================
// 4. 予約キャンセル通知
// altText: `予約キャンセル: ${params.date} ${params.startTime}〜${params.endTime}`
// ============================================================================

export function buildReservationCancelMessage(params: {
  date: string;
  startTime: string;
  endTime: string;
}): FlexContainer {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '予約キャンセル',
          size: 'md',
          weight: 'bold',
          color: '#FFFFFF',
          align: 'center',
        },
      ],
      paddingAll: 'lg',
      backgroundColor: '#7F8C8D',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '以下のご予約がキャンセルされました',
          size: 'sm',
          color: '#555555',
          align: 'center',
          wrap: true,
        },
        { type: 'separator', color: '#E8E8E8', margin: 'lg' },
        // 日時
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '日時', size: 'sm', color: '#888888', flex: 2 },
            {
              type: 'text',
              text: `${params.date} ${params.startTime}〜${params.endTime}`,
              size: 'sm',
              color: '#999999',
              decoration: 'line-through',
              flex: 5,
              wrap: true,
            },
          ],
          margin: 'lg',
        } as FlexComponent,
        { type: 'separator', color: '#E8E8E8', margin: 'lg' },
        {
          type: 'text',
          text: '新しい日程をご希望の場合は、下のボタンからご予約ください。',
          size: 'xs',
          color: '#888888',
          wrap: true,
          margin: 'lg',
        },
      ],
      paddingAll: 'xl',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'message',
            label: '新しい予約を取る',
            text: 'reservation:new',
          },
          style: 'primary',
          color: '#7F8C8D',
          height: 'sm',
        },
      ],
      paddingAll: 'lg',
    },
    styles: { footer: { separator: true } },
  };
}
