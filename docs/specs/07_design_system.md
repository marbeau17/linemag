# 07. デザインシステム & ブランディング仕様書

> LineMag — LINE公式アカウントからブログ記事を配信し、CRM・EC連携・予約機能を統合するプラットフォーム

---

## 目次

1. [ブランドアイデンティティ](#1-ブランドアイデンティティ)
2. [デザインシステム定義](#2-デザインシステム定義)
3. [コンポーネントライブラリ設計](#3-コンポーネントライブラリ設計)
4. [管理画面と顧客向け画面のデザイントーン](#4-管理画面と顧客向け画面のデザイントーン)
5. [LINE Flex Message デザインガイドライン](#5-line-flex-message-デザインガイドライン)
6. [アイコン・イラストレーション方針](#6-アイコンイラストレーション方針)
7. [ダークモード対応方針](#7-ダークモード対応方針)
8. [Tailwind CSS カスタムテーマ設定](#8-tailwind-css-カスタムテーマ設定)

---

## 1. ブランドアイデンティティ

### 1.1 ブランドコンセプト

LineMag は「プロフェッショナルな情報配信を、誰でも手軽に」を掲げるプラットフォームである。LINE という身近なチャネルを通じて、質の高いマガジンコンテンツを届けることを使命とする。

### 1.2 ブランドキーワード

| カテゴリ | キーワード |
|---------|-----------|
| 印象 | 信頼感・洗練・親しみやすさ |
| トーン | プロフェッショナルだが堅すぎない |
| 体験 | シンプル・直感的・効率的 |

### 1.3 ロゴ

- **シンボル**: 緑のグラデーション角丸正方形（`rounded-lg`）に白い紙飛行機アイコン
- **グラデーション**: `from-green-400 to-green-600`（送信・配信の躍動感を表現）
- **ロゴタイプ**: Noto Sans JP Bold、`text-slate-800`
- **最小使用サイズ**: 24px（シンボルのみ）/ 32px（シンボル + ロゴタイプ）

---

## 2. デザインシステム定義

### 2.1 カラーパレット

#### プライマリカラー（ブランドグリーン）

LINE のブランドカラーとの親和性を保ちつつ、LineMag 独自の深みを持たせる。

| トークン名 | 値 | 用途 |
|-----------|-----|------|
| `primary-50` | `#F0FDF4` | 背景ハイライト・選択状態の薄い背景 |
| `primary-100` | `#DCFCE7` | アクティブナビゲーションの背景（`bg-green-100`） |
| `primary-200` | `#BBF7D0` | ホバー状態のボーダー |
| `primary-300` | `#86EFAC` | 軽いアクセント |
| `primary-400` | `#4ADE80` | グラデーション始点（ロゴ） |
| `primary-500` | `#22C55E` | メインのインタラクティブ要素 |
| `primary-600` | `#16A34A` | プライマリボタン背景・グラデーション終点 |
| `primary-700` | `#15803D` | アクティブナビゲーションテキスト（`text-green-700`） |
| `primary-800` | `#166534` | ボタンホバー状態 |
| `primary-900` | `#14532D` | 強調テキスト |

#### ニュートラルカラー（Slate系）

既存実装（`bg-slate-50`, `text-slate-800`）との整合性を維持する。

| トークン名 | 値 | 用途 |
|-----------|-----|------|
| `neutral-50` | `#F8FAFC` | アプリ全体の背景（`bg-slate-50`） |
| `neutral-100` | `#F1F5F9` | カード背景・セクション区切り |
| `neutral-200` | `#E2E8F0` | ボーダー・ディバイダー（`border-slate-200`） |
| `neutral-300` | `#CBD5E1` | 無効状態のボーダー |
| `neutral-400` | `#94A3B8` | プレースホルダーテキスト |
| `neutral-500` | `#64748B` | 非アクティブナビ（`text-slate-500`） |
| `neutral-600` | `#475569` | セカンダリテキスト |
| `neutral-700` | `#334155` | ホバーテキスト（`text-slate-700`） |
| `neutral-800` | `#1E293B` | メインテキスト（`text-slate-800`） |
| `neutral-900` | `#0F172A` | 見出しテキスト |

#### テンプレートカラー

Flex Message 5テンプレートの固有色。テンプレート選択UIおよびプレビューで使用する。

| テンプレート | カラー | 用途 |
|------------|--------|------|
| デイリーコラム | `#1B4965` | ヘッダー背景・CTAボタン |
| ニュースカード | `#2D6A4F` | カテゴリバッジ・リンク色 |
| ビジュアルマガジン | `#6B2FA0` | アクセントバー・CTAボタン |
| ミニマルテキスト | `#374151` | トップバー・テキストリンク |
| プレミアムカード | `#1A1A2E` / `#D4A843` | ヘッダー背景 / ゴールドアクセント |

#### セマンティックカラー

| トークン名 | 値 | 用途 |
|-----------|-----|------|
| `success` | `#16A34A` (green-600) | 配信成功・完了状態 |
| `warning` | `#D97706` (amber-600) | 注意喚起・保留状態 |
| `error` | `#DC2626` (red-600) | エラー・失敗状態 |
| `info` | `#2563EB` (blue-600) | 情報通知・ヒント |

### 2.2 タイポグラフィ

#### フォントファミリー

```
プライマリ: "Noto Sans JP", sans-serif （既存設定を踏襲）
モノスペース: "JetBrains Mono", "Fira Code", monospace （ログ・コード表示用）
```

#### フォントスケール

Tailwind のデフォルトスケールを基本とし、以下の用途別ガイドラインを定める。

| レベル | Tailwind クラス | サイズ | 行間 | ウェイト | 用途 |
|-------|----------------|--------|------|---------|------|
| Display | `text-3xl` | 30px | 36px | `font-bold` | ランディングページのメイン見出し |
| H1 | `text-2xl` | 24px | 32px | `font-bold` | ページタイトル |
| H2 | `text-xl` | 20px | 28px | `font-semibold` | セクション見出し |
| H3 | `text-lg` | 18px | 28px | `font-semibold` | カード見出し・サブセクション |
| Body | `text-sm` | 14px | 20px | `font-normal` | 本文・説明文 |
| Caption | `text-xs` | 12px | 16px | `font-medium` | ナビゲーション・バッジ・ラベル |
| Micro | `text-[11px]` | 11px | 14px | `font-medium` | タイムスタンプ・補足情報 |

> **設計方針**: 管理画面は情報密度を重視し `text-sm` (14px) をベースとする。顧客向け画面は可読性を重視し `text-base` (16px) をベースとする。

### 2.3 スペーシング

Tailwind の 4px 基準スペーシングスケールをそのまま活用する。

| 用途 | トークン | 値 | 例 |
|------|---------|-----|-----|
| コンポーネント内パディング（小） | `p-2` / `px-3 py-1.5` | 8px / 12px-6px | ナビリンク |
| コンポーネント内パディング（中） | `p-4` | 16px | カード内部 |
| コンポーネント内パディング（大） | `p-6` | 24px | モーダル・セクション |
| 要素間マージン（小） | `gap-1` / `gap-2` | 4px / 8px | アイコンとラベル |
| 要素間マージン（中） | `gap-4` / `gap-6` | 16px / 24px | カード間 |
| セクション間マージン | `py-8` / `py-12` | 32px / 48px | ページセクション |
| ページ横パディング | `px-4 sm:px-6` | 16px / 24px | レイアウトコンテナ |
| 最大コンテンツ幅 | `max-w-5xl` | 1024px | メインコンテンツ領域 |

### 2.4 角丸（Border Radius）

| 用途 | トークン | 値 |
|------|---------|-----|
| 小さいバッジ・タグ | `rounded-sm` | 2px |
| ボタン・入力フィールド | `rounded-lg` | 8px |
| カード・コンテナ | `rounded-xl` | 12px |
| モーダル・ダイアログ | `rounded-2xl` | 16px |
| アバター・サムネイル（丸） | `rounded-full` | 50% |
| ロゴシンボル | `rounded-lg` | 8px |

### 2.5 シャドウ（Box Shadow）

| 用途 | トークン | 説明 |
|------|---------|------|
| ナビゲーション区切り | ボーダー（`border-b border-slate-200`） | シャドウではなくボーダーで区切る |
| カード（デフォルト） | `shadow-sm` | 微細な浮遊感 |
| カード（ホバー） | `shadow-md` | インタラクション時のフィードバック |
| ドロップダウン・ポップオーバー | `shadow-lg` | 浮遊レイヤーの明示 |
| モーダル | `shadow-xl` | 最前面レイヤー |
| フォーカスリング | `ring-2 ring-green-500/20` | アクセシビリティ対応のフォーカス表示 |

> **設計方針**: フラットデザインを基調とし、シャドウは控えめに使用する。レイヤーの階層が明確に伝わる最小限のシャドウに留める。

---

## 3. コンポーネントライブラリ設計

### 3.1 ボタン（Button）

#### バリアント

| バリアント | クラス | 用途 |
|-----------|--------|------|
| Primary | `bg-green-600 text-white hover:bg-green-700 active:bg-green-800` | 主要アクション（配信実行・保存） |
| Secondary | `bg-white border border-slate-200 text-slate-600 hover:bg-slate-50` | 副次アクション（戻る・キャンセル） |
| Danger | `bg-red-600 text-white hover:bg-red-700` | 削除・破壊的操作 |
| Ghost | `text-slate-500 hover:bg-slate-100 hover:text-slate-700` | ナビゲーション・低優先度アクション |
| Link | `text-green-600 hover:text-green-700 underline-offset-2 hover:underline` | テキストリンク風アクション |

#### サイズ

| サイズ | クラス |
|--------|--------|
| Small | `px-3 py-1.5 text-xs rounded-lg` |
| Medium | `px-4 py-2 text-sm rounded-lg` |
| Large | `px-6 py-3 text-base rounded-lg` |

#### 状態

```
デフォルト → ホバー → アクティブ → フォーカス → 無効
```

- **フォーカス**: `focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:ring-offset-2`
- **無効**: `disabled:opacity-50 disabled:cursor-not-allowed`
- **ローディング**: ボタン内にスピナーSVGを表示、テキストを「処理中...」に変更、`disabled` 状態にする

### 3.2 カード（Card）

```html
<div class="bg-white rounded-xl border border-slate-200 shadow-sm
            hover:shadow-md transition-shadow">
  <!-- Card Header (任意) -->
  <div class="px-4 py-3 border-b border-slate-100">
    <h3 class="text-sm font-semibold text-slate-800">タイトル</h3>
  </div>
  <!-- Card Body -->
  <div class="p-4">
    ...
  </div>
  <!-- Card Footer (任意) -->
  <div class="px-4 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
    ...
  </div>
</div>
```

#### バリアント

| バリアント | 説明 |
|-----------|------|
| Default | 白背景・薄いボーダー・微細シャドウ |
| Interactive | ホバーでシャドウ変化 + カーソルポインター |
| Selected | 緑ボーダー（`border-green-500 ring-2 ring-green-500/20`） |
| Muted | `bg-slate-50` 背景・ボーダーなし |

### 3.3 フォーム（Form）

#### テキスト入力

```html
<label class="block text-xs font-medium text-slate-700 mb-1">ラベル</label>
<input type="text"
  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
         bg-white text-slate-800 placeholder:text-slate-400
         focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500
         disabled:bg-slate-100 disabled:text-slate-400" />
<p class="mt-1 text-xs text-slate-500">ヘルプテキスト</p>
```

#### セレクト

```html
<select class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
               bg-white text-slate-800
               focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500">
  <option>選択してください</option>
</select>
```

#### エラー状態

- ボーダー: `border-red-500`
- フォーカスリング: `focus:ring-red-500/20`
- エラーメッセージ: `<p class="mt-1 text-xs text-red-600">エラー内容</p>`

### 3.4 テーブル（Table）

```html
<div class="overflow-x-auto rounded-xl border border-slate-200">
  <table class="w-full text-sm">
    <thead>
      <tr class="bg-slate-50 border-b border-slate-200">
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
          カラム名
        </th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-3 text-slate-700">データ</td>
      </tr>
    </tbody>
  </table>
</div>
```

- **ソート可能カラム**: ヘッダーにソートアイコン + `cursor-pointer hover:text-slate-800`
- **空状態**: テーブル中央に「データがありません」メッセージ + イラスト

### 3.5 モーダル（Modal）

```html
<!-- Overlay -->
<div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm
            flex items-center justify-center p-4">
  <!-- Dialog -->
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg
              animate-in fade-in zoom-in-95">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-800">タイトル</h2>
      <button class="text-slate-400 hover:text-slate-600">✕</button>
    </div>
    <!-- Body -->
    <div class="px-6 py-4">...</div>
    <!-- Footer -->
    <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
      <button class="[Secondary Button]">キャンセル</button>
      <button class="[Primary Button]">確認</button>
    </div>
  </div>
</div>
```

- **ESCキーで閉じる**: 全モーダルで必須
- **Overlay クリックで閉じる**: 確認ダイアログ以外で有効
- **フォーカストラップ**: モーダル内でTABキーがループする

### 3.6 通知（Notification / Toast）

#### トーストバリアント

| バリアント | アイコン | ボーダー色 | 背景色 |
|-----------|---------|-----------|--------|
| Success | チェックマーク | `border-l-4 border-green-500` | `bg-green-50` |
| Error | エクスクラメーション | `border-l-4 border-red-500` | `bg-red-50` |
| Warning | 三角アラート | `border-l-4 border-amber-500` | `bg-amber-50` |
| Info | インフォメーション | `border-l-4 border-blue-500` | `bg-blue-50` |

```html
<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
  <div class="bg-green-50 border border-green-200 border-l-4 border-l-green-500
              rounded-lg px-4 py-3 shadow-lg flex items-start gap-3
              animate-in slide-in-from-right">
    <span class="text-green-600 mt-0.5">[icon]</span>
    <div>
      <p class="text-sm font-medium text-green-800">配信が完了しました</p>
      <p class="text-xs text-green-600 mt-0.5">3件のメッセージを送信しました</p>
    </div>
    <button class="text-green-400 hover:text-green-600 ml-auto">[close]</button>
  </div>
</div>
```

- **自動非表示**: 成功通知は5秒、エラー通知は手動クローズ
- **スタック**: 最大3件まで表示、古いものから自動消去
- **位置**: 画面右下（`bottom-4 right-4`）

---

## 4. 管理画面と顧客向け画面のデザイントーン

### 4.1 比較表

| 項目 | 管理画面（Dashboard） | 顧客向け画面 |
|------|---------------------|-------------|
| **目的** | 効率的なオペレーション | ブランド体験・エンゲージメント |
| **背景色** | `bg-slate-50`（明るいグレー） | `bg-white`（クリーンな白） |
| **情報密度** | 高い（テーブル・リスト・ステータス表示） | 適度（余白を活かしたレイアウト） |
| **フォントサイズ** | `text-sm` (14px) ベース | `text-base` (16px) ベース |
| **最大幅** | `max-w-5xl` (1024px) | `max-w-3xl` (768px) ／記事ページ |
| **ナビゲーション** | 水平タブ型（ヘッダー固定） | シンプルなトップバー or ハンバーガー |
| **カラーの使い方** | グリーンをアクセントに抑制的 | テンプレートカラーを積極活用 |
| **アニメーション** | 最小限（`transition-colors` 程度） | リッチ（フェード・スライド・スケール） |
| **トーン** | 機能的・ビジネスライク | 親しみやすく・マガジン風 |

### 4.2 管理画面の詳細ガイドライン

- **ヘッダー**: 白背景・下ボーダー区切り（`bg-white border-b border-slate-200`）、高さ56px（`h-14`）
- **ステップUI**: 現在ステップをグリーンハイライト、完了ステップにチェックマーク
- **データテーブル**: ゼブラストライプなし、行ホバーで `bg-slate-50`
- **ステータスバッジ**: 丸みを帯びたピル型（`rounded-full px-2 py-0.5 text-xs font-medium`）
  - 成功: `bg-green-100 text-green-700`
  - 処理中: `bg-blue-100 text-blue-700`
  - エラー: `bg-red-100 text-red-700`
  - 保留: `bg-amber-100 text-amber-700`

### 4.3 顧客向け画面の詳細ガイドライン

- **ファーストビュー**: ヒーロー画像 or グラデーション背景を活用
- **記事表示**: ゆったりとした行間（`leading-relaxed`）、段落間に `mb-6`
- **CTA**: 大きめのボタン（`py-3 px-8`）、明確なコントラスト
- **レスポンシブ**: モバイルファースト、LINE内ブラウザでの表示を最優先
- **ブランド要素**: フッターにロゴ、テンプレートカラーを使ったアクセントライン

---

## 5. LINE Flex Message デザインガイドライン

### 5.1 既存5テンプレートの設計原則

全テンプレート共通のデザインルールを定義し、今後のテンプレート追加時にも一貫性を保つ。

#### 共通ルール

| 項目 | ルール |
|------|--------|
| サイズ | `bubble` の `size: 'mega'` を標準とする |
| 本文テキスト色 | `#555555`（グレー系で視認性確保） |
| 見出しテキスト色 | `#1A1A2E`（ほぼ黒のダークネイビー） |
| 日付表示 | `M/D（曜日）` 形式、色 `#999999`、サイズ `xxs` or `xs` |
| セパレーター色 | `#E8E8E8` 〜 `#EEEEEE` |
| パディング | body 部に `paddingAll: 'xl'`、footer に `paddingAll: 'lg'` |
| CTAボタン | `style: 'primary'`、高さ `'sm'`、テンプレート固有色で背景 |
| 画像アスペクト比 | ヒーロー画像 `20:13` or `16:9`、サムネイル `1:1` |
| 画像モード | `aspectMode: 'cover'` |
| フォールバック画像 | `https://placehold.co/800x520/1B4965/white?text=LineMag` |

#### テンプレート別設計意図

| ID | 名称 | 構造 | 設計意図 |
|----|------|------|---------|
| `daily-column` | デイリーコラム | header + hero + body + footer | マガジン表紙風。日付バッジで「毎日届く」感を演出 |
| `news-card` | ニュースカード | body（横並び） + footer | コンパクトに要点を伝える。サムネ+テキストの2カラム |
| `visual-magazine` | ビジュアルマガジン | hero + body + footer | フルワイド画像で視覚インパクト。3色グラデーションバー |
| `minimal-text` | ミニマルテキスト | body のみ | 軽量配信。画像なし、テキストリンクで通信量削減 |
| `premium-card` | プレミアムカード | header + hero + body + footer | ダークヘッダー + ゴールドアクセントで特別感 |

### 5.2 カラーの使い分けルール

```
テンプレートごとにキーカラーを1色定め、以下の箇所に適用する:
  - ヘッダー背景 or カテゴリバッジ背景
  - CTAボタン背景
  - アクセントライン/セパレーター（ある場合）

その他のテキスト・背景は共通カラーを使用し、テンプレート間の統一感を保つ。
```

### 5.3 テンプレート追加時のチェックリスト

新しいテンプレートを追加する際は、以下を満たすこと:

- [ ] `TEMPLATE_DEFINITIONS` に定義を追加（id, name, description, category, previewColor, recommendedFor）
- [ ] `buildFlexMessage` の switch 文にケースを追加
- [ ] 共通ルール（テキスト色、パディング、日付形式）を遵守
- [ ] CTAボタンは `style: 'primary'` で統一
- [ ] 画像URLの `http → https` フォールバック処理を `img()` ヘルパーで行う
- [ ] プレビュー画面（`/preview`）の5テンプレートグリッドに新テンプレートを追加
- [ ] テンプレートセレクターUIへの反映

### 5.4 Flex Message アクセシビリティ

- CTAボタンの `label` は動詞で始める（「記事を読む」「続きを読む」等）
- テキストの最小サイズは `xs`（12px相当）以上
- コントラスト比: テキストと背景のコントラスト比 4.5:1 以上を確保
- `wrap: true` を本文テキストに必ず設定し、途中切れを防ぐ

---

## 6. アイコン・イラストレーション方針

### 6.1 アイコンシステム

| 項目 | 仕様 |
|------|------|
| ライブラリ | Heroicons v2 (Outline スタイル) |
| サイズ | 16px (`w-4 h-4`), 20px (`w-5 h-5`), 24px (`w-6 h-6`) |
| ストローク幅 | 1.5px (デフォルト) 〜 2.5px (強調時、ロゴ等) |
| カラー | `currentColor` を使用し、親要素の `text-*` で制御 |
| インライン使用 | SVGを直接埋め込み（既存実装を踏襲） |

#### 用途別アイコンサイズ

| 用途 | サイズ | 例 |
|------|--------|-----|
| ナビゲーション・ボタン内 | 16px | 戻る矢印、スピナー |
| リストアイテムの先頭 | 20px | ステータスアイコン |
| 空状態イラスト内 | 24px - 48px | 大きなシンボル |

### 6.2 イラストレーション

| 項目 | 方針 |
|------|------|
| スタイル | ラインアート + スポットカラー（ブランドグリーン） |
| 用途 | 空状態、オンボーディング、エラーページ |
| トーン | フレンドリーだがプロフェッショナル |
| カラー | Slate (線) + Green (アクセント) の2色構成 |
| 禁止事項 | 写実的なイラスト、3D表現、過度な装飾 |

### 6.3 ファビコン・OGP画像

- **ファビコン**: ロゴシンボルの32x32, 16x16。SVG版も用意
- **OGP画像**: 1200x630px、白背景にロゴ + 「LineMag」ロゴタイプ + サブタイトル
- **Apple Touch Icon**: 180x180px、角丸なし（OSが自動適用）

---

## 7. ダークモード対応方針

### 7.1 対応戦略

**フェーズ1（現行）**: ライトモードのみ。ダークモード未対応。

**フェーズ2（計画）**: Tailwind の `dark:` バリアントを活用し、`prefers-color-scheme` メディアクエリ ベースで自動切替。

### 7.2 ダークモードカラーマッピング

| ライトモード | ダークモード | 用途 |
|-------------|-------------|------|
| `bg-slate-50` | `dark:bg-slate-950` | アプリ背景 |
| `bg-white` | `dark:bg-slate-900` | カード・ヘッダー背景 |
| `text-slate-800` | `dark:text-slate-100` | メインテキスト |
| `text-slate-500` | `dark:text-slate-400` | セカンダリテキスト |
| `border-slate-200` | `dark:border-slate-700` | ボーダー |
| `bg-green-600` | `dark:bg-green-500` | プライマリボタン |
| `bg-green-100` | `dark:bg-green-900/30` | アクティブナビ背景 |
| `text-green-700` | `dark:text-green-400` | アクティブナビテキスト |
| `shadow-sm` | `dark:shadow-none` or `dark:shadow-slate-900/50` | シャドウ |

### 7.3 ダークモード実装ルール

```typescript
// tailwind.config.ts での設定
const config: Config = {
  darkMode: 'media', // OS設定に連動。将来的に 'class' に変更して手動切替も可
  // ...
};
```

- **画像**: ダークモードでの視認性を考慮し、透過PNGの使用を避ける
- **シャドウ**: ダークモードではシャドウの視認性が低下するため、ボーダーで代替する場合がある
- **カラーコントラスト**: WCAG AA 基準（4.5:1）を両モードで満たすこと
- **テンプレートカラー**: Flex Message はLINEアプリ内で表示されるため、ダークモード対応はLINE側に委ねる（Webプレビューのみ対応）

### 7.4 切替コンポーネント

将来実装時の設計方針:

```html
<!-- ダークモード切替トグル（class戦略採用時） -->
<button class="p-2 rounded-lg text-slate-500 hover:bg-slate-100
               dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="テーマ切替">
  <!-- Sun icon (dark mode) / Moon icon (light mode) -->
</button>
```

---

## 8. Tailwind CSS カスタムテーマ設定

### 8.1 現行設定

```typescript
// tailwind.config.ts（現行）
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
```

### 8.2 推奨拡張設定

デザインシステムの全トークンを反映した推奨設定:

```typescript
// tailwind.config.ts（推奨拡張）
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'media',
  theme: {
    extend: {
      // ── フォント ──────────────────────────────────────
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },

      // ── ブランドカラー ────────────────────────────────
      colors: {
        brand: {
          50:  '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },
        // テンプレート固有色
        template: {
          'daily-column':      '#1B4965',
          'news-card':         '#2D6A4F',
          'visual-magazine':   '#6B2FA0',
          'minimal-text':      '#374151',
          'premium-dark':      '#1A1A2E',
          'premium-gold':      '#D4A843',
        },
      },

      // ── シャドウ ──────────────────────────────────────
      boxShadow: {
        'card':    '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'modal':   '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },

      // ── 角丸 ──────────────────────────────────────────
      borderRadius: {
        'card':  '0.75rem',  // 12px
        'modal': '1rem',     // 16px
      },

      // ── アニメーション ────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        'slide-in-up': {
          '0%':   { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        'zoom-in': {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
      },
      animation: {
        'fade-in':        'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-up':    'slide-in-up 0.2s ease-out',
        'zoom-in':        'zoom-in 0.2s ease-out',
      },

      // ── スペーシング拡張 ──────────────────────────────
      spacing: {
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px
        '128': '32rem',   // 512px
      },

      // ── フォントサイズ拡張 ────────────────────────────
      fontSize: {
        'micro': ['0.6875rem', { lineHeight: '0.875rem' }], // 11px/14px
      },
    },
  },
  plugins: [],
};
export default config;
```

### 8.3 CSS カスタムプロパティ（CSS Variables）

`globals.css` に定義するCSS変数。将来のテーマ切替やホワイトラベル対応の基盤とする。

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ブランドカラー */
    --color-brand: 22 163 74;          /* green-600 */
    --color-brand-light: 220 252 231;  /* green-100 */
    --color-brand-dark: 21 128 61;     /* green-700 */

    /* サーフェス */
    --color-surface: 248 250 252;      /* slate-50 */
    --color-surface-card: 255 255 255; /* white */
    --color-surface-hover: 241 245 249;/* slate-100 */

    /* テキスト */
    --color-text-primary: 30 41 59;    /* slate-800 */
    --color-text-secondary: 100 116 139;/* slate-500 */
    --color-text-muted: 148 163 184;   /* slate-400 */

    /* ボーダー */
    --color-border: 226 232 240;       /* slate-200 */
    --color-border-light: 241 245 249; /* slate-100 */

    /* レイアウト */
    --header-height: 3.5rem;           /* 56px */
    --content-max-width: 64rem;        /* 1024px = max-w-5xl */
    --sidebar-width: 16rem;            /* 256px（将来のサイドバー用） */
  }

  .dark {
    --color-surface: 2 6 23;           /* slate-950 */
    --color-surface-card: 15 23 42;    /* slate-900 */
    --color-surface-hover: 30 41 59;   /* slate-800 */
    --color-text-primary: 241 245 249; /* slate-100 */
    --color-text-secondary: 148 163 184;/* slate-400 */
    --color-text-muted: 100 116 139;   /* slate-500 */
    --color-border: 51 65 85;          /* slate-700 */
    --color-border-light: 30 41 59;    /* slate-800 */
  }
}
```

### 8.4 ユーティリティクラス拡張

```css
@layer components {
  /* ステータスバッジ */
  .badge-success { @apply bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-medium; }
  .badge-error   { @apply bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium; }
  .badge-warning { @apply bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-medium; }
  .badge-info    { @apply bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium; }

  /* カード */
  .card {
    @apply bg-white rounded-xl border border-slate-200 shadow-sm;
  }
  .card-interactive {
    @apply card hover:shadow-md transition-shadow cursor-pointer;
  }

  /* フォーム入力 */
  .input {
    @apply w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
           bg-white text-slate-800 placeholder:text-slate-400
           focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500
           disabled:bg-slate-100 disabled:text-slate-400;
  }
  .input-error {
    @apply input border-red-500 focus:ring-red-500/20 focus:border-red-500;
  }
}
```

---

## 付録A: デザイントークン一覧（クイックリファレンス）

```
┌──────────────────────────────────────────────────────────────┐
│  LineMag Design Tokens                                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Colors                                                      │
│  ├─ Brand:     green-400 → green-600 (gradient)              │
│  ├─ Neutral:   slate-50 → slate-900                          │
│  ├─ Success:   green-600                                     │
│  ├─ Warning:   amber-600                                     │
│  ├─ Error:     red-600                                       │
│  └─ Info:      blue-600                                      │
│                                                              │
│  Typography                                                  │
│  ├─ Font:      "Noto Sans JP", sans-serif                    │
│  ├─ Admin:     text-sm (14px) base                           │
│  └─ Public:    text-base (16px) base                         │
│                                                              │
│  Spacing                                                     │
│  ├─ Unit:      4px (Tailwind default)                        │
│  ├─ Page:      px-4 sm:px-6                                  │
│  └─ Max:       max-w-5xl (1024px)                            │
│                                                              │
│  Radius                                                      │
│  ├─ Button:    rounded-lg (8px)                              │
│  ├─ Card:      rounded-xl (12px)                             │
│  └─ Modal:     rounded-2xl (16px)                            │
│                                                              │
│  Shadow                                                      │
│  ├─ Card:      shadow-sm → shadow-md (hover)                 │
│  ├─ Dropdown:  shadow-lg                                     │
│  └─ Modal:     shadow-xl                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 付録B: 実装チェックリスト

- [ ] `tailwind.config.ts` にカスタムテーマを反映
- [ ] `globals.css` にCSS変数とユーティリティクラスを追加
- [ ] 共通コンポーネント（Button, Card, Input, Modal, Toast）をReactコンポーネント化
- [ ] Storybookまたはコンポーネントカタログの構築
- [ ] LINE Flex Message テンプレートのプレビュー画面との整合性確認
- [ ] WCAG AA アクセシビリティ基準の検証
- [ ] レスポンシブ対応（モバイル / タブレット / デスクトップ）の確認
- [ ] ダークモード対応（フェーズ2で実施）
