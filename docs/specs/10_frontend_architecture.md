# 10. フロントエンドアーキテクチャ仕様

| 項目 | 内容 |
|------|------|
| ドキュメントID | SPEC-010 |
| 対象システム | LineMag |
| 作成日 | 2026-03-24 |
| ステータス | Draft |

---

## 10.1 現行システム概要

### 技術スタック

| レイヤー | 技術 | バージョン |
|----------|------|-----------|
| フレームワーク | Next.js (App Router) | 14.2.x |
| UI ライブラリ | React | 18.3.x |
| スタイリング | Tailwind CSS | 3.4.x |
| 言語 | TypeScript | 5.5.x |
| パッケージマネージャ | npm | - |
| ホスティング | Vercel | - |

### パスエイリアス

```
@/* -> src/*
```

`tsconfig.json` にて `"paths": { "@/*": ["./src/*"] }` で設定済み。

### 既存ディレクトリ構成

```
src/
  app/
    api/
      cron/line-broadcast/route.ts
      line/
        broadcast/route.ts
        debug/route.ts
        followers/route.ts
        history/route.ts
        logs/route.ts
        push/route.ts
        schedule/route.ts
        scrape-detail/route.ts
        scrape-list/route.ts
        scrape/route.ts
        test-broadcast/route.ts
        webhook/route.ts
    dashboard/
      layout.tsx          # Client Component（ナビゲーション付き）
      page.tsx            # マニュアル配信
      history/page.tsx
      logs/page.tsx
      schedule/page.tsx
    preview/page.tsx
    layout.tsx            # Root Layout (Server Component)
    globals.css
    page.tsx
  components/
    line/
      ArticleCard.tsx       # 記事カード（Client Component）
      FlexPreview.tsx       # LINE Flex Message プレビュー（Client Component）
      TemplateSelector.tsx  # テンプレート選択（Client Component）
  lib/
    line/                   # LINE API関連ユーティリティ
  types/
    line.ts                 # LINE関連型定義
```

### 既存コンポーネントの特徴

- 全コンポーネントが `'use client'` ディレクティブを使用
- 外部 UI ライブラリへの依存なし（全て Tailwind CSS によるカスタムスタイリング）
- インラインSVGアイコンを多用
- LINE のグリーン系カラー (`green-500`, `green-100`) をアクセントカラーとして統一

---

## 10.2 ディレクトリ構成設計

### 設計方針

App Router の Route Groups `(group)` を活用し、管理者向け画面、LIFF 顧客向けアプリ、および既存の LINE 配信機能を明確に分離する。各 Route Group は独自の `layout.tsx` を持ち、ナビゲーション・認証コンテキストを個別に管理する。

### 拡張後ディレクトリ構成

```
src/
  app/
    (admin)/                          # --- 管理者向け画面 ---
      layout.tsx                      # 管理画面共通レイアウト（サイドバー + ヘッダー）
      dashboard/
        layout.tsx                    # 既存ダッシュボードレイアウト（移設）
        page.tsx                      # マニュアル配信（既存）
        history/page.tsx              # 配信履歴（既存）
        logs/page.tsx                 # ログ（既存）
        schedule/page.tsx             # スケジュール（既存）
      crm/
        layout.tsx                    # CRM セクションレイアウト
        page.tsx                      # 顧客一覧（DataTable + フィルター）
        [customerId]/
          page.tsx                    # 顧客詳細（タブ: 基本情報/配信履歴/予約/クーポン）
      coupons/
        layout.tsx
        page.tsx                      # クーポン一覧
        new/page.tsx                  # クーポン新規作成フォーム
        [couponId]/
          page.tsx                    # クーポン詳細・編集
      reservations/
        layout.tsx
        page.tsx                      # 予約カレンダー（月/週/日ビュー）
        slots/page.tsx                # スロット管理
        [reservationId]/page.tsx      # 予約詳細
      analytics/
        layout.tsx
        page.tsx                      # 分析ダッシュボード（KPI + チャート）
        messages/page.tsx             # メッセージ分析
        customers/page.tsx            # 顧客分析
        coupons/page.tsx              # クーポン分析
        reservations/page.tsx         # 予約分析

    (liff)/                           # --- LIFF 顧客向けアプリ ---
      layout.tsx                      # LIFF 共通レイアウト（LiffProvider）
      page.tsx                        # LIFF トップ / マイページ
      reservations/
        page.tsx                      # 予約一覧・新規予約
        [reservationId]/page.tsx      # 予約詳細
        confirm/page.tsx              # 予約確認
      coupons/
        page.tsx                      # クーポン一覧（マイクーポン）
        [couponId]/page.tsx           # クーポン詳細・使用
      profile/
        page.tsx                      # プロフィール編集

    preview/page.tsx                  # Flex Message プレビュー（既存）

    api/
      cron/line-broadcast/route.ts    # 既存
      line/...                        # 既存 API Routes
      admin/                          # --- 管理 API ---
        crm/
          customers/route.ts
          customers/[customerId]/route.ts
        coupons/route.ts
        coupons/[couponId]/route.ts
        reservations/route.ts
        reservations/[reservationId]/route.ts
        reservations/slots/route.ts
        analytics/route.ts
      liff/                           # --- LIFF API ---
        auth/route.ts
        reservations/route.ts
        coupons/route.ts
        profile/route.ts

    layout.tsx                        # Root Layout
    globals.css
    page.tsx                          # ランディング / リダイレクト

  components/
    ui/                               # --- shadcn/ui ベースの汎用コンポーネント ---
      button.tsx
      input.tsx
      label.tsx
      select.tsx
      dialog.tsx
      dropdown-menu.tsx
      table.tsx
      tabs.tsx
      badge.tsx
      calendar.tsx
      card.tsx
      sheet.tsx
      skeleton.tsx
      toast.tsx
      toaster.tsx
      tooltip.tsx
      popover.tsx
      command.tsx
      separator.tsx
      scroll-area.tsx
      avatar.tsx
      chart.tsx                       # Recharts ラッパー

    shared/                           # --- ドメイン横断の共通コンポーネント ---
      DataTable/
        DataTable.tsx                 # 汎用テーブル（ソート、ページネーション、行選択）
        DataTablePagination.tsx
        DataTableColumnHeader.tsx
        DataTableToolbar.tsx          # フィルター・検索バー
        DataTableFacetedFilter.tsx    # ファセットフィルター
      FormBuilder/
        FormField.tsx                 # React Hook Form 統合フィールド
        FormSection.tsx               # フォームセクション
        FormActions.tsx               # 送信・キャンセルボタン群
      PageHeader.tsx                  # ページヘッダー（タイトル + アクション）
      EmptyState.tsx                  # 空状態表示
      LoadingState.tsx                # ローディング状態
      ConfirmDialog.tsx               # 確認ダイアログ
      StatusBadge.tsx                 # ステータスバッジ
      DateRangePicker.tsx             # 日付範囲選択

    line/                             # --- LINE 配信コンポーネント（既存） ---
      ArticleCard.tsx
      FlexPreview.tsx
      TemplateSelector.tsx

    admin/                            # --- 管理画面固有コンポーネント ---
      crm/
        CustomerTable.tsx
        CustomerDetailModal.tsx
        CustomerFilterBar.tsx
        CustomerTagEditor.tsx
      coupons/
        CouponForm.tsx
        CouponCard.tsx
        CouponStatusBadge.tsx
      reservations/
        ReservationCalendar.tsx
        SlotEditor.tsx
        ReservationDetailCard.tsx
        TimeSlotPicker.tsx
      analytics/
        KpiCard.tsx
        ChartContainer.tsx
        MessageAnalyticsChart.tsx
        CustomerGrowthChart.tsx
        CouponUsageChart.tsx
        ReservationTrendChart.tsx

    liff/                             # --- LIFF 顧客向けコンポーネント ---
      LiffProvider.tsx                # LIFF SDK 初期化 Context
      BottomNav.tsx                   # モバイルボトムナビゲーション
      ReservationCard.tsx
      CouponCard.tsx
      ProfileForm.tsx
      ReservationSlotSelector.tsx

  hooks/                              # --- カスタムフック ---
    useDataTable.ts                   # DataTable 状態管理
    useLiff.ts                        # LIFF SDK フック
    useDebounce.ts                    # デバウンス
    useMediaQuery.ts                  # レスポンシブ判定
    usePagination.ts                  # ページネーション
    useToast.ts                       # トースト通知

  lib/
    line/...                          # 既存
    utils.ts                          # shadcn/ui 用ユーティリティ（cn 関数）
    validations/                      # Zod スキーマ
      customer.ts
      coupon.ts
      reservation.ts
    api-client.ts                     # API クライアント（fetch ラッパー）
    date.ts                           # 日付ユーティリティ
    constants.ts                      # 定数定義

  types/
    line.ts                           # 既存
    customer.ts                       # CRM 型定義
    coupon.ts                         # クーポン型定義
    reservation.ts                    # 予約型定義
    analytics.ts                      # 分析型定義
    liff.ts                           # LIFF 関連型定義
    common.ts                         # 共通型（PaginatedResponse, ApiError 等）
```

### Route Group の責務分離

| Route Group | 用途 | レイアウト特徴 | 認証 |
|-------------|------|---------------|------|
| `(admin)` | 管理者向け全画面 | サイドバー + ヘッダー + ブレッドクラム | 管理者認証（将来対応） |
| `(liff)` | LINE ユーザー向けアプリ | モバイルファースト + BottomNav | LIFF 認証 |

### 既存ページの移行方針

既存の `/dashboard/*` ページ群は `(admin)/dashboard/` 配下に移設する。URL パスは Route Group により影響を受けないため、`/dashboard`, `/dashboard/history` 等の既存 URL は維持される。

---

## 10.3 共通コンポーネント設計

### 10.3.1 DataTable

CRM 顧客一覧、クーポン一覧、予約一覧など、管理画面に頻出するテーブル表示を統一的に処理する。

**依存ライブラリ:** `@tanstack/react-table` v8

```typescript
// components/shared/DataTable/DataTable.tsx
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;                    // テキスト検索対象カラム
  filterableColumns?: FilterableColumn[];  // ファセットフィルター定義
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
  };
  onPaginationChange?: (pagination: PaginationState) => void;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
}
```

**機能一覧:**

| 機能 | 実装方針 |
|------|---------|
| ソート | `@tanstack/react-table` の `SortingState` |
| ページネーション | サーバーサイドページネーション対応 |
| フィルター | ファセットフィルター + テキスト検索 |
| 行選択 | チェックボックスによる複数選択 |
| ローディング | `Skeleton` コンポーネントによるプレースホルダー |
| 空状態 | `EmptyState` コンポーネント表示 |
| レスポンシブ | モバイルではカード表示にフォールバック |

### 10.3.2 Form

フォーム管理には `react-hook-form` + `zod` を採用する。

**依存ライブラリ:** `react-hook-form` v7, `@hookform/resolvers`, `zod`

```typescript
// 使用例: クーポン作成フォーム
const couponSchema = z.object({
  title: z.string().min(1, '必須項目です').max(100),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  validFrom: z.date(),
  validUntil: z.date(),
  maxUsage: z.number().int().positive().optional(),
  targetSegment: z.string().optional(),
});

type CouponFormValues = z.infer<typeof couponSchema>;
```

**FormField コンポーネント設計:**

```typescript
// components/shared/FormBuilder/FormField.tsx
interface FormFieldProps {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactElement;  // Input, Select, DatePicker 等を受け取る
}
```

### 10.3.3 Modal / Dialog

shadcn/ui の `Dialog` コンポーネントをベースとし、以下のパターンで使い分ける。

| パターン | コンポーネント | 用途 |
|---------|---------------|------|
| 確認ダイアログ | `ConfirmDialog` | 削除確認、ステータス変更確認 |
| 詳細モーダル | `Dialog` | 顧客詳細、予約詳細 |
| サイドシート | `Sheet` | フィルター設定、クイック編集 |
| コマンドパレット | `Command` | グローバル検索（将来対応） |

```typescript
// components/shared/ConfirmDialog.tsx
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;         // デフォルト: '確認'
  cancelLabel?: string;          // デフォルト: 'キャンセル'
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}
```

### 10.3.4 Calendar

予約管理のカレンダー表示は段階的に構築する。

**依存ライブラリ:** `date-fns` (日付操作), `date-fns/locale/ja` (日本語ロケール)

| ビュー | 用途 | 実装方針 |
|--------|------|---------|
| 月ビュー | 予約概要の俯瞰 | カスタム実装 (CSS Grid) |
| 週ビュー | 詳細スケジュール確認 | カスタム実装 (時間軸 Grid) |
| 日ビュー | スロット単位の管理 | カスタム実装 (タイムスロットリスト) |

```typescript
// components/admin/reservations/ReservationCalendar.tsx
interface ReservationCalendarProps {
  view: 'month' | 'week' | 'day';
  currentDate: Date;
  reservations: Reservation[];
  slots: TimeSlot[];
  onDateChange: (date: Date) => void;
  onViewChange: (view: 'month' | 'week' | 'day') => void;
  onSlotClick: (slot: TimeSlot) => void;
  onReservationClick: (reservation: Reservation) => void;
}
```

外部カレンダーライブラリ (FullCalendar 等) は導入せず、Tailwind CSS + CSS Grid でカスタム実装する。理由は以下の通り。

- バンドルサイズの抑制（FullCalendar は ~200KB gzipped）
- LINE の顧客向け LIFF アプリでも同じカレンダーロジックを再利用
- デザインの完全なコントロール

### 10.3.5 Chart

分析ダッシュボードのチャートコンポーネント。

**依存ライブラリ:** `recharts` v2

| チャート種別 | 用途 |
|-------------|------|
| `LineChart` | 顧客増加推移、配信数推移 |
| `BarChart` | クーポン使用数、予約件数 |
| `PieChart` | セグメント分布 |
| `AreaChart` | メッセージ到達率推移 |

```typescript
// components/admin/analytics/KpiCard.tsx
interface KpiCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;       // 前期比変化率
    period: string;      // '前月比', '前週比'
  };
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'flat';
}
```

```typescript
// components/admin/analytics/ChartContainer.tsx
interface ChartContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;       // Recharts コンポーネント
  isLoading?: boolean;
  dateRange?: { from: Date; to: Date };
  onDateRangeChange?: (range: { from: Date; to: Date }) => void;
}
```

---

## 10.4 状態管理戦略

### 10.4.1 Server Components vs Client Components の使い分け

**原則: Server Components をデフォルトとし、インタラクションが必要な部分のみ Client Component にする。**

| カテゴリ | Server Component | Client Component |
|---------|-----------------|------------------|
| ページレイアウト | レイアウト、ページシェル | - |
| データ表示 | 初期データ取得・表示 | フィルター・ソート操作 |
| フォーム | - | 全フォーム入力 |
| ナビゲーション | 静的リンク | アクティブ状態判定 |
| カレンダー | - | 全カレンダー操作 |
| チャート | - | 全チャート描画 |
| モーダル | - | 全モーダル制御 |
| LIFF | - | LIFF SDK 依存の全コンポーネント |

### 10.4.2 データフェッチ戦略

```
                    +--------------------------+
                    |   Server Component       |
                    |   (データ取得 + 初期表示)  |
                    +-----------+--------------+
                                |
                     props として渡す
                                |
                    +-----------v--------------+
                    |   Client Component       |
                    |   (インタラクション)       |
                    |   - フィルター変更         |
                    |   - ページネーション       |
                    |   - ソート操作            |
                    +-----------+--------------+
                                |
                     Server Action or
                     Route Handler 呼び出し
                                |
                    +-----------v--------------+
                    |   API Route / Server     |
                    |   Action (データ更新)      |
                    +--------------------------+
```

**パターン別実装方針:**

| パターン | 手法 | 使用箇所 |
|---------|------|---------|
| 初期データ取得 | Server Component での直接 fetch / DB アクセス | ページ初期表示 |
| リスト操作 (フィルター/ページ) | URL Search Params + Server Component 再レンダリング | CRM一覧、クーポン一覧 |
| ミューテーション | Server Actions | フォーム送信、ステータス更新 |
| リアルタイム更新 | `router.refresh()` + `revalidatePath()` | 予約ステータス変更後 |
| LIFF からのデータ取得 | Client Component での fetch (API Route 経由) | LIFF 全画面 |

### 10.4.3 URL ベースの状態管理

フィルター、ページネーション、ソート状態は URL Search Params で管理し、ブックマーク可能・共有可能にする。

```typescript
// 例: /crm?search=田中&segment=premium&page=2&sort=createdAt&order=desc

// hooks/useDataTable.ts
function useDataTable<TData>() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return { searchParams, updateParams };
}
```

### 10.4.4 クライアントサイド状態管理

グローバル状態管理ライブラリ (Redux, Zustand 等) は **導入しない**。理由は以下の通り。

- Server Components + URL Search Params で大部分の状態管理が可能
- LIFF アプリはページ単位で独立しており、グローバル状態の共有が不要
- React Context は認証情報・テーマなど限定的に使用

**React Context の使用箇所:**

| Context | 用途 | スコープ |
|---------|------|---------|
| `LiffContext` | LIFF SDK の初期化状態・ユーザー情報 | `(liff)` Route Group |
| `ToastContext` | トースト通知の管理 | Root Layout |
| `AdminContext` | 管理者セッション情報（将来対応） | `(admin)` Route Group |

---

## 10.5 LIFF 統合アーキテクチャ

### 10.5.1 概要

LINE Front-end Framework (LIFF) を利用し、LINE アプリ内ブラウザで動作する顧客向けアプリを構築する。予約・クーポン・マイページ機能を提供する。

### 10.5.2 セットアップ

**パッケージ:**

```bash
npm install @line/liff
```

**環境変数:**

```env
NEXT_PUBLIC_LIFF_ID=xxxx-xxxx
```

### 10.5.3 LiffProvider 設計

```typescript
// components/liff/LiffProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Liff } from '@line/liff';

interface LiffContextValue {
  liff: Liff | null;
  isLoggedIn: boolean;
  isReady: boolean;
  error: Error | null;
  userId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
}

const LiffContext = createContext<LiffContextValue>({
  liff: null,
  isLoggedIn: false,
  isReady: false,
  error: null,
  userId: null,
  displayName: null,
  pictureUrl: null,
});

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [ctx, setCtx] = useState<LiffContextValue>({ /* 初期値 */ });

  useEffect(() => {
    (async () => {
      try {
        const liff = (await import('@line/liff')).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        setCtx({
          liff,
          isLoggedIn: true,
          isReady: true,
          error: null,
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? null,
        });
      } catch (error) {
        setCtx(prev => ({ ...prev, error: error as Error, isReady: true }));
      }
    })();
  }, []);

  return <LiffContext.Provider value={ctx}>{children}</LiffContext.Provider>;
}

export const useLiff = () => useContext(LiffContext);
```

### 10.5.4 LIFF レイアウト統合

```typescript
// app/(liff)/layout.tsx
import { LiffProvider } from '@/components/liff/LiffProvider';
import { BottomNav } from '@/components/liff/BottomNav';

export const metadata = {
  title: 'LineMag',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider>
      <div className="min-h-screen bg-white pb-16">
        <main>{children}</main>
        <BottomNav />
      </div>
    </LiffProvider>
  );
}
```

### 10.5.5 LIFF 固有の考慮事項

| 項目 | 対応方針 |
|------|---------|
| LIFF SDK 読み込み | `dynamic import` で遅延読み込み、SSR 時にはスキップ |
| 認証フロー | `liff.login()` → プロフィール取得 → API にトークン送信 |
| API 認証 | LIFF アクセストークンを Authorization ヘッダーで送信 |
| 非 LIFF 環境 | `liff.isInClient()` で判定し、外部ブラウザ時はフォールバック表示 |
| LINE 共有 | `liff.shareTargetPicker()` で予約確認・クーポンを友だちに共有 |
| メッセージ送信 | `liff.sendMessages()` で予約リマインダーをトーク画面に送信 |
| ウィンドウクローズ | `liff.closeWindow()` で操作完了後に LIFF ブラウザを閉じる |

### 10.5.6 LIFF ページ構成

```
/(liff)
  page.tsx                  → マイページ（予約状況サマリー + クーポン枚数 + プロフィール）
  /reservations
    page.tsx                → 予約一覧 + 新規予約ボタン
    /[reservationId]
      page.tsx              → 予約詳細（キャンセルボタン付き）
    /confirm
      page.tsx              → 予約確認画面（日時・メニュー確認 → 確定）
  /coupons
    page.tsx                → マイクーポン一覧（利用可能/使用済み/期限切れ）
    /[couponId]
      page.tsx              → クーポン詳細（QRコード表示 or 店頭提示用画面）
  /profile
    page.tsx                → プロフィール編集（表示名、電話番号等）
```

---

## 10.6 UI ライブラリ選定

### 10.6.1 shadcn/ui 採用理由

| 評価軸 | shadcn/ui | Headless UI | MUI | Chakra UI |
|--------|-----------|-------------|-----|-----------|
| バンドルサイズ | 使用分のみ (コピー方式) | 軽量 | 重い (~300KB) | 中程度 |
| Tailwind CSS 親和性 | 完全対応 | 高い | 低い | 中程度 |
| カスタマイズ性 | ソースコード直接編集 | 高い | テーマ制限あり | テーマベース |
| コンポーネント数 | 50+ | 少ない (~10) | 非常に多い | 多い |
| App Router 対応 | 完全対応 | 対応 | 部分対応 | 部分対応 |
| 依存ライブラリ | Radix UI (headless) | なし | Emotion | Emotion |
| アクセシビリティ | Radix UI ベースで高い | 高い | 高い | 高い |

**shadcn/ui を選定した主要理由:**

1. **コピー & ペースト方式**: `node_modules` に依存せず、`components/ui/` にソースコードを直接配置する。バージョンアップの影響を受けず、プロジェクト固有のカスタマイズが容易。
2. **既存 Tailwind CSS 資産との互換性**: 既存コンポーネント (FlexPreview, ArticleCard 等) と同じ Tailwind CSS ベースのスタイリングであり、デザインの統一が容易。
3. **Server Components 対応**: Radix UI Primitives をベースとしており、必要な部分のみ Client Component 化する設計と合致。
4. **段階的導入**: 必要なコンポーネントのみを個別に追加でき、一括導入が不要。

### 10.6.2 導入手順

```bash
# 1. shadcn/ui CLI のセットアップ
npx shadcn@latest init

# 設定選択:
#   Style: Default
#   Base color: Slate (既存の bg-slate-50 と統一)
#   CSS variables: Yes
```

```bash
# 2. 必要コンポーネントを段階的に追加
npx shadcn@latest add button input label select
npx shadcn@latest add dialog sheet dropdown-menu
npx shadcn@latest add table tabs badge card
npx shadcn@latest add calendar popover
npx shadcn@latest add skeleton toast tooltip
npx shadcn@latest add command scroll-area avatar separator
```

### 10.6.3 追加パッケージ

```bash
# フォーム管理
npm install react-hook-form @hookform/resolvers zod

# テーブル
npm install @tanstack/react-table

# チャート
npm install recharts

# 日付操作
npm install date-fns

# LIFF SDK
npm install @line/liff

# アイコン (shadcn/ui デフォルト)
npm install lucide-react
```

### 10.6.4 Tailwind CSS 拡張設定

```typescript
// tailwind.config.ts（拡張後）
import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: ['class'],  // shadcn/ui 要件
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', ...fontFamily.sans],
      },
      colors: {
        // shadcn/ui CSS Variables ベースのカラー定義
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // ... 以下 shadcn/ui 標準カラートークン
      },
      // LINE ブランドカラー
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
```

### 10.6.5 既存コンポーネントとの共存方針

| 既存コンポーネント | 対応 |
|-------------------|------|
| `FlexPreview.tsx` | 変更不要。独立した LINE プレビュー用途のため、shadcn/ui と無関係に維持。 |
| `ArticleCard.tsx` | 変更不要。既存のカスタムスタイリングを維持。 |
| `TemplateSelector.tsx` | 変更不要。既存のカスタムスタイリングを維持。 |
| `DashboardLayout.tsx` | 段階的に shadcn/ui の `Sheet` (モバイルサイドバー) や `Button` に置き換え可能。初期は変更不要。 |

既存コンポーネントは動作に問題がないため、新規画面から shadcn/ui を適用し、既存画面は必要に応じて段階的にマイグレーションする。

---

## 10.7 パフォーマンス最適化

### 10.7.1 コード分割

| 手法 | 対象 | 効果 |
|------|------|------|
| Route-based splitting | App Router が自動で各ページを分割 | ページ単位の遅延読み込み |
| `next/dynamic` | LIFF SDK, Recharts, Calendar | 初期バンドルサイズ削減 |
| `React.lazy` | モーダル内の大きなコンポーネント | インタラクション時に読み込み |

```typescript
// 重量級コンポーネントの動的インポート例
import dynamic from 'next/dynamic';

const ReservationCalendar = dynamic(
  () => import('@/components/admin/reservations/ReservationCalendar'),
  {
    loading: () => <CalendarSkeleton />,
    ssr: false,  // カレンダーは CSR のみ
  }
);

const AnalyticsChart = dynamic(
  () => import('@/components/admin/analytics/ChartContainer'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,  // Recharts は CSR のみ
  }
);
```

### 10.7.2 画像最適化

| 手法 | 実装 |
|------|------|
| `next/image` | 管理画面の静的画像、顧客アバター |
| `sizes` 属性 | レスポンシブ画像の適切なサイズ指定 |
| `priority` | ファーストビューの画像に指定 |
| `placeholder="blur"` | ブラー効果でのプレースホルダー |
| WebP / AVIF | Next.js Image Optimization による自動変換 |

```typescript
// 例: 顧客アバター
import Image from 'next/image';

<Image
  src={customer.pictureUrl || '/images/default-avatar.png'}
  alt={customer.displayName}
  width={40}
  height={40}
  className="rounded-full"
/>
```

**注意:** 既存の `FlexPreview.tsx` 内の `<img>` タグは LINE Flex Message のプレビュー表示用であり、外部 URL を直接参照するため `next/image` への置き換えは行わない（`remotePatterns` 設定が不確定なため）。

### 10.7.3 レンダリング戦略 (ISR / SSG / SSR)

| ページ | 戦略 | 理由 |
|--------|------|------|
| 管理画面 (CRM, クーポン, 予約) | SSR (動的) | リアルタイムデータが必要 |
| 分析ダッシュボード | ISR (`revalidate: 300`) | 5分間隔のキャッシュで十分 |
| LIFF ページ | CSR (Client Component) | LIFF SDK がクライアントサイド必須 |
| ランディングページ | SSG (静的) | 変更頻度が低い |

```typescript
// 分析ダッシュボードの ISR 設定例
// app/(admin)/analytics/page.tsx
export const revalidate = 300; // 5分

async function AnalyticsPage() {
  const kpis = await fetchKpis();
  return <AnalyticsDashboard initialData={kpis} />;
}
```

### 10.7.4 その他の最適化

| 項目 | 手法 |
|------|------|
| フォント | `next/font` で Noto Sans JP をセルフホスト化 (現在は Google Fonts CDN) |
| プリフェッチ | `<Link prefetch>` でナビゲーション先を事前読み込み (App Router デフォルト) |
| バンドル分析 | `@next/bundle-analyzer` で定期的にバンドルサイズを監視 |
| キャッシュ | `fetch` の `cache` / `next.revalidate` オプションで API レスポンスをキャッシュ |
| Streaming SSR | `loading.tsx` + `Suspense` で段階的にコンテンツを表示 |

```typescript
// 各セクションに loading.tsx を配置
// app/(admin)/crm/loading.tsx
import { DataTableSkeleton } from '@/components/shared/DataTable/DataTableSkeleton';

export default function Loading() {
  return <DataTableSkeleton columnCount={6} rowCount={10} />;
}
```

---

## 10.8 テスト戦略

### 10.8.1 テストピラミッド

```
         /  E2E テスト  \          ← Playwright (重要フロー)
        /  結合テスト     \        ← Testing Library (ページ単位)
       /  コンポーネントテスト\    ← Testing Library (コンポーネント単位)
      /  ユニットテスト      \    ← Vitest (関数・フック)
```

### 10.8.2 ツールチェーン

| 種別 | ツール | 用途 |
|------|--------|------|
| テストランナー | Vitest | ユニットテスト・コンポーネントテスト |
| DOM テスト | @testing-library/react | コンポーネントレンダリング・操作 |
| E2E テスト | Playwright | ブラウザ自動操作テスト |
| モック | MSW (Mock Service Worker) | API モック |
| カバレッジ | v8 (Vitest 内蔵) | コードカバレッジ計測 |

```bash
# テスト関連パッケージ
npm install -D vitest @vitejs/plugin-react
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D jsdom
npm install -D playwright @playwright/test
npm install -D msw
```

### 10.8.3 コンポーネントテスト方針

**テスト対象の優先度:**

| 優先度 | 対象 | 理由 |
|--------|------|------|
| 高 | 共通コンポーネント (`DataTable`, `FormField`, `ConfirmDialog`) | 多くの画面で使用されるため |
| 高 | バリデーション (Zod スキーマ) | データ整合性に直結 |
| 中 | ドメインコンポーネント (`CouponForm`, `ReservationCalendar`) | ビジネスロジックを含む |
| 中 | カスタムフック (`useLiff`, `useDataTable`) | 状態管理ロジック |
| 低 | 表示のみのコンポーネント (`KpiCard`, `StatusBadge`) | ロジックが少ない |

**テスト例:**

```typescript
// __tests__/components/shared/ConfirmDialog.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('確認ボタンクリックで onConfirm が呼ばれる', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="削除確認"
        description="このクーポンを削除しますか？"
        onConfirm={onConfirm}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
```

```typescript
// __tests__/lib/validations/coupon.test.ts
import { couponSchema } from '@/lib/validations/coupon';

describe('couponSchema', () => {
  it('有効なデータでパースが成功する', () => {
    const result = couponSchema.safeParse({
      title: '初回限定10%OFF',
      discountType: 'percentage',
      discountValue: 10,
      validFrom: new Date('2026-04-01'),
      validUntil: new Date('2026-04-30'),
    });
    expect(result.success).toBe(true);
  });

  it('タイトル未入力でバリデーションエラーになる', () => {
    const result = couponSchema.safeParse({
      title: '',
      discountType: 'percentage',
      discountValue: 10,
      validFrom: new Date(),
      validUntil: new Date(),
    });
    expect(result.success).toBe(false);
  });
});
```

### 10.8.4 E2E テスト方針

**対象フロー:**

| フロー | テスト内容 |
|--------|-----------|
| CRM 顧客管理 | 一覧表示 → フィルター → 詳細モーダル → 情報更新 |
| クーポン作成 | フォーム入力 → バリデーション → 送信 → 一覧に表示 |
| 予約管理 | カレンダー表示 → スロット選択 → 予約作成 → ステータス変更 |
| LIFF 予約 | LIFF 起動 → 日時選択 → 確認 → 予約完了 |

```typescript
// e2e/coupon-create.spec.ts
import { test, expect } from '@playwright/test';

test('クーポンを新規作成できる', async ({ page }) => {
  await page.goto('/coupons/new');

  await page.getByLabel('クーポン名').fill('春のキャンペーン 20%OFF');
  await page.getByLabel('割引タイプ').selectOption('percentage');
  await page.getByLabel('割引値').fill('20');
  // 日付選択...

  await page.getByRole('button', { name: '作成' }).click();

  // リダイレクト後、一覧にクーポンが表示される
  await expect(page).toHaveURL('/coupons');
  await expect(page.getByText('春のキャンペーン 20%OFF')).toBeVisible();
});
```

### 10.8.5 LIFF テストの考慮事項

LIFF SDK はブラウザ環境 + LINE クライアント内でのみ完全動作するため、以下の戦略でテストを実施する。

| テストレベル | 方針 |
|-------------|------|
| ユニット / コンポーネント | `@line/liff` をモックし、`useLiff` フックの戻り値を制御 |
| E2E (開発環境) | LIFF の `liff.init()` をモック化した開発モードで実行 |
| E2E (ステージング) | LIFF 実機テスト (LINE Developers のテストアカウント使用) |

```typescript
// テスト用 LIFF モック
vi.mock('@line/liff', () => ({
  default: {
    init: vi.fn().mockResolvedValue(undefined),
    isLoggedIn: vi.fn().mockReturnValue(true),
    getProfile: vi.fn().mockResolvedValue({
      userId: 'U_test_user_001',
      displayName: 'テストユーザー',
      pictureUrl: 'https://example.com/avatar.png',
    }),
    isInClient: vi.fn().mockReturnValue(true),
  },
}));
```

### 10.8.6 CI 統合

```yaml
# .github/workflows/test.yml (概要)
jobs:
  test:
    steps:
      - run: npm ci
      - run: npm run type-check      # TypeScript 型チェック
      - run: npm run lint             # ESLint
      - run: npx vitest run          # ユニット + コンポーネントテスト
      - run: npx playwright test     # E2E テスト
```

**カバレッジ目標:**

| 対象 | 目標 |
|------|------|
| 共通コンポーネント (`components/shared/`) | 80% 以上 |
| バリデーション (`lib/validations/`) | 90% 以上 |
| カスタムフック (`hooks/`) | 80% 以上 |
| ドメインコンポーネント | 60% 以上 |
| 全体 | 70% 以上 |

---

## 10.9 追加パッケージまとめ

### 本番依存 (dependencies)

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `@line/liff` | ^2.25 | LIFF SDK |
| `@tanstack/react-table` | ^8.20 | テーブル管理 |
| `react-hook-form` | ^7.54 | フォーム管理 |
| `@hookform/resolvers` | ^3.9 | Zod リゾルバ |
| `zod` | ^3.23 | バリデーション |
| `recharts` | ^2.15 | チャート描画 |
| `date-fns` | ^4.1 | 日付操作 |
| `lucide-react` | ^0.468 | アイコン |
| `tailwindcss-animate` | ^1.0 | アニメーション |
| `class-variance-authority` | ^0.7 | shadcn/ui 依存 |
| `clsx` | ^2.1 | クラス結合 |
| `tailwind-merge` | ^2.6 | Tailwind クラスマージ |
| `@radix-ui/react-dialog` | - | shadcn/ui Dialog |
| `@radix-ui/react-dropdown-menu` | - | shadcn/ui DropdownMenu |
| `@radix-ui/react-popover` | - | shadcn/ui Popover |
| `@radix-ui/react-tabs` | - | shadcn/ui Tabs |
| `@radix-ui/react-tooltip` | - | shadcn/ui Tooltip |
| `@radix-ui/react-scroll-area` | - | shadcn/ui ScrollArea |
| `@radix-ui/react-separator` | - | shadcn/ui Separator |
| `@radix-ui/react-avatar` | - | shadcn/ui Avatar |

### 開発依存 (devDependencies)

| パッケージ | 用途 |
|-----------|------|
| `vitest` | テストランナー |
| `@vitejs/plugin-react` | Vitest React サポート |
| `@testing-library/react` | コンポーネントテスト |
| `@testing-library/jest-dom` | DOM マッチャー |
| `@testing-library/user-event` | ユーザー操作シミュレーション |
| `jsdom` | テスト用 DOM 環境 |
| `@playwright/test` | E2E テスト |
| `msw` | API モック |
| `@next/bundle-analyzer` | バンドルサイズ分析 |

---

## 10.10 実装ロードマップ

| フェーズ | 内容 | 目安期間 |
|---------|------|---------|
| Phase 1 | shadcn/ui 導入 + 共通コンポーネント (DataTable, Form, Modal) 構築 | 1 週間 |
| Phase 2 | CRM 管理画面 + クーポン管理画面 | 2 週間 |
| Phase 3 | 予約管理画面 (カレンダー + スロット管理) | 2 週間 |
| Phase 4 | 分析ダッシュボード (KPI + チャート) | 1.5 週間 |
| Phase 5 | LIFF 顧客向けアプリ (予約 + クーポン + マイページ) | 2 週間 |
| Phase 6 | テスト整備 + パフォーマンス最適化 + 既存画面マイグレーション | 1.5 週間 |
