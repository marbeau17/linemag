export interface CouponMaster {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: 'fixed' | 'percentage' | 'free_shipping';
  discountValue: number;
  minPurchaseAmount: number;
  maxIssues: number | null;
  maxUsesPerCustomer: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  targetSegmentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CouponIssue {
  id: string;
  couponMasterId: string;
  customerId: string;
  issueCode: string;
  status: 'issued' | 'used' | 'expired' | 'revoked';
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  couponName?: string;
  discountType?: string;
  discountValue?: number;
}

export const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  fixed: '固定額割引',
  percentage: 'パーセント割引',
  free_shipping: '送料無料',
};

export const COUPON_STATUS_LABELS: Record<string, string> = {
  issued: '発行済み',
  used: '利用済み',
  expired: '期限切れ',
  revoked: '取消済み',
};

export const COUPON_STATUS_COLORS: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-700',
  used: 'bg-green-100 text-green-700',
  expired: 'bg-slate-100 text-slate-500',
  revoked: 'bg-red-100 text-red-700',
};
