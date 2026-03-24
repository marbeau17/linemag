import { describe, it, expect } from 'vitest';
import { buildFlexMessage, TEMPLATE_DEFINITIONS } from '@/lib/line/templates';
import {
  buildCouponDeliveryMessage,
  buildReservationConfirmMessage,
  buildReservationReminderMessage,
  buildReservationCancelMessage,
} from '@/lib/line/templates-business';
import type { BroadcastRequest, FlexContainer, FlexBox, FlexButton, FlexText } from '@/types/line';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBroadcastRequest(
  templateId: BroadcastRequest['templateId'],
): BroadcastRequest {
  return {
    articleUrl: 'https://example.com/article/1',
    articleTitle: 'Test Article Title',
    summaryTitle: 'Summary Title',
    summaryText: 'This is the summary text for testing.',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    templateId,
    articleCategory: 'EC戦略',
  };
}

/** Recursively collect all FlexText components from a FlexBox */
function collectTexts(box: FlexBox): FlexText[] {
  const texts: FlexText[] = [];
  for (const c of box.contents) {
    if (c.type === 'text') texts.push(c as FlexText);
    if (c.type === 'box') texts.push(...collectTexts(c as FlexBox));
  }
  return texts;
}

/** Find the first FlexButton inside a FlexBox */
function findButton(box: FlexBox): FlexButton | undefined {
  for (const c of box.contents) {
    if (c.type === 'button') return c as FlexButton;
    if (c.type === 'box') {
      const found = findButton(c as FlexBox);
      if (found) return found;
    }
  }
  return undefined;
}

// ============================================================================
// Magazine templates (templates.ts)
// ============================================================================

const TEMPLATE_IDS = [
  'daily-column',
  'news-card',
  'visual-magazine',
  'minimal-text',
  'premium-card',
] as const;

describe('Magazine Flex Message templates', () => {
  describe.each(TEMPLATE_IDS)('template: %s', (templateId) => {
    const req = makeBroadcastRequest(templateId);
    const result: FlexContainer = buildFlexMessage(req);

    it('returns a valid FlexContainer with type "bubble"', () => {
      expect(result).toBeDefined();
      expect(result.type).toBe('bubble');
    });

    it('body section exists and contains text components', () => {
      expect(result.body).toBeDefined();
      const texts = collectTexts(result.body!);
      expect(texts.length).toBeGreaterThan(0);

      // The summary title or summary text should appear somewhere in the body
      const allText = texts.map((t) => t.text).join(' ');
      expect(allText).toContain(req.summaryTitle);
    });

    // minimal-text has no footer with a button; it uses an inline text action
    if (templateId !== 'minimal-text') {
      it('footer has a button with URI action', () => {
        expect(result.footer).toBeDefined();
        const btn = findButton(result.footer!);
        expect(btn).toBeDefined();
        expect(btn!.action.type).toBe('uri');
        expect(btn!.action.uri).toBe(req.articleUrl);
      });
    } else {
      it('body contains a text element with URI action linking to article', () => {
        const texts = collectTexts(result.body!);
        const actionText = texts.find(
          (t) => (t as Record<string, unknown>).action !== undefined,
        );
        expect(actionText).toBeDefined();
        const action = (actionText as Record<string, unknown>).action as {
          type: string;
          uri: string;
        };
        expect(action.type).toBe('uri');
        expect(action.uri).toBe(req.articleUrl);
      });
    }
  });
});

// ============================================================================
// Business templates (templates-business.ts)
// ============================================================================

describe('Business Flex Message templates', () => {
  // ── Coupon Delivery ─────────────────────────────────────────────────────

  describe('buildCouponDeliveryMessage', () => {
    const baseCouponParams = {
      couponName: 'Spring Sale Coupon',
      couponCode: 'SPRING2026',
      discountType: 'percent',
      discountValue: 20,
      validUntil: '2026-04-30',
      description: 'Limited time offer',
    };

    it('returns valid FlexContainer with coupon info', () => {
      const result = buildCouponDeliveryMessage(baseCouponParams);

      expect(result).toBeDefined();
      expect(result.type).toBe('bubble');
      expect(result.header).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.footer).toBeDefined();

      // Coupon name and code should appear in body
      const texts = collectTexts(result.body!);
      const allText = texts.map((t) => t.text).join(' ');
      expect(allText).toContain(baseCouponParams.couponName);
      expect(allText).toContain(baseCouponParams.couponCode);
      expect(allText).toContain(baseCouponParams.validUntil);
    });

    it('handles percentage discount', () => {
      const result = buildCouponDeliveryMessage({
        ...baseCouponParams,
        discountType: 'percent',
        discountValue: 15,
      });

      const texts = collectTexts(result.body!);
      const allText = texts.map((t) => t.text).join(' ');
      expect(allText).toContain('15% OFF');
    });

    it('handles fixed discount', () => {
      const result = buildCouponDeliveryMessage({
        ...baseCouponParams,
        discountType: 'fixed',
        discountValue: 1000,
      });

      const texts = collectTexts(result.body!);
      const allText = texts.map((t) => t.text).join(' ');
      expect(allText).toContain('1,000 OFF');
    });

    it('footer button uses message action with coupon code', () => {
      const result = buildCouponDeliveryMessage(baseCouponParams);
      const btn = findButton(result.footer!);
      expect(btn).toBeDefined();
      expect(btn!.action.type).toBe('message');
      expect(btn!.action.text).toBe(`coupon:${baseCouponParams.couponCode}`);
    });
  });

  // ── Reservation Confirm ─────────────────────────────────────────────────

  describe('buildReservationConfirmMessage', () => {
    const reservationParams = {
      date: '2026-04-01',
      startTime: '14:00',
      endTime: '15:00',
      consultantName: 'Tanaka Taro',
      serviceType: 'EC Strategy Consultation',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
    };

    it('returns FlexContainer with meet URL', () => {
      const result = buildReservationConfirmMessage(reservationParams);

      expect(result).toBeDefined();
      expect(result.type).toBe('bubble');
      expect(result.header).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.footer).toBeDefined();

      // Footer button should link to meet URL
      const btn = findButton(result.footer!);
      expect(btn).toBeDefined();
      expect(btn!.action.type).toBe('uri');
      expect(btn!.action.uri).toBe(reservationParams.meetUrl);
    });

    it('contains date/time/consultant info', () => {
      const result = buildReservationConfirmMessage(reservationParams);

      const texts = collectTexts(result.body!);
      const allText = texts.map((t) => t.text).join(' ');

      expect(allText).toContain(reservationParams.date);
      expect(allText).toContain(reservationParams.startTime);
      expect(allText).toContain(reservationParams.endTime);
      expect(allText).toContain(reservationParams.consultantName);
      expect(allText).toContain(reservationParams.serviceType);
    });
  });

  // ── Reservation Reminder ────────────────────────────────────────────────

  describe('buildReservationReminderMessage', () => {
    const reminderParams = {
      date: '2026-04-01',
      startTime: '14:00',
      endTime: '15:00',
      consultantName: 'Tanaka Taro',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      minutesUntil: 10,
    };

    it('contains countdown info', () => {
      const result = buildReservationReminderMessage(reminderParams);

      expect(result).toBeDefined();
      expect(result.type).toBe('bubble');
      expect(result.header).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.footer).toBeDefined();

      const texts = collectTexts(result.body!);
      const allText = texts.map((t) => t.text).join(' ');

      // Countdown text
      expect(allText).toContain(`${reminderParams.minutesUntil}分`);
      // Date/time info
      expect(allText).toContain(reminderParams.date);
      expect(allText).toContain(reminderParams.startTime);
      expect(allText).toContain(reminderParams.consultantName);
    });

    it('has meet URL button', () => {
      const result = buildReservationReminderMessage(reminderParams);

      const btn = findButton(result.footer!);
      expect(btn).toBeDefined();
      expect(btn!.action.type).toBe('uri');
      expect(btn!.action.uri).toBe(reminderParams.meetUrl);
      expect(btn!.action.label).toBe('Google Meetに参加');
    });
  });

  // ── Reservation Cancel ──────────────────────────────────────────────────

  describe('buildReservationCancelMessage', () => {
    const cancelParams = {
      date: '2026-04-01',
      startTime: '14:00',
      endTime: '15:00',
    };

    it('contains cancelled date info', () => {
      const result = buildReservationCancelMessage(cancelParams);

      expect(result).toBeDefined();
      expect(result.type).toBe('bubble');
      expect(result.header).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.footer).toBeDefined();

      // Header should mention cancel
      const headerTexts = collectTexts(result.header!);
      const headerText = headerTexts.map((t) => t.text).join(' ');
      expect(headerText).toContain('キャンセル');

      // Body should contain the cancelled date/time
      const bodyTexts = collectTexts(result.body!);
      const bodyText = bodyTexts.map((t) => t.text).join(' ');
      expect(bodyText).toContain(cancelParams.date);
      expect(bodyText).toContain(cancelParams.startTime);
      expect(bodyText).toContain(cancelParams.endTime);
    });

    it('footer has a button for rebooking', () => {
      const result = buildReservationCancelMessage(cancelParams);

      const btn = findButton(result.footer!);
      expect(btn).toBeDefined();
      expect(btn!.action.type).toBe('message');
      expect(btn!.action.text).toBe('reservation:new');
    });
  });
});
