# LINE Flex Message 新規テンプレートデザイン仕様書

## 1. 概要

本仕様書は、既存5種類のマガジン配信テンプレートに加え、業務運用向けの新規5テンプレートの設計を定義する。

### 1.1 既存テンプレート一覧

| ID | 名称 | カテゴリ | アクセントカラー |
|----|------|----------|-----------------|
| `daily-column` | デイリーコラム | マガジン | `#1B4965` |
| `news-card` | ニュースカード | ニュース | `#2D6A4F` |
| `visual-magazine` | ビジュアルマガジン | ビジュアル | `#6B2FA0` |
| `minimal-text` | ミニマルテキスト | シンプル | `#374151` |
| `premium-card` | プレミアムカード | プレミアム | `#92400E` |

### 1.2 新規テンプレート一覧

| ID | 名称 | カテゴリ | アクセントカラー |
|----|------|----------|-----------------|
| `coupon-delivery` | クーポン配信 | クーポン | `#E63946` |
| `reservation-confirm` | 予約確認 | 予約 | `#2196F3` |
| `reservation-reminder` | 予約リマインダー | 予約 | `#FF9800` |
| `crm-notification` | CRM通知 | CRM | `#9C27B0` |
| `google-meet-invite` | Google Meet招待 | ミーティング | `#00897B` |

---

## 2. 命名規則とID体系

### 2.1 テンプレートID

```
{機能カテゴリ}-{用途}
```

- 英小文字ケバブケース（`kebab-case`）
- 既存: `daily-column`, `news-card`, `visual-magazine`, `minimal-text`, `premium-card`
- 新規: `coupon-delivery`, `reservation-confirm`, `reservation-reminder`, `crm-notification`, `google-meet-invite`

### 2.2 TemplateId 型定義の拡張

```typescript
export type TemplateId =
  // 既存マガジン系
  | 'daily-column'
  | 'news-card'
  | 'visual-magazine'
  | 'minimal-text'
  | 'premium-card'
  // 新規業務系
  | 'coupon-delivery'
  | 'reservation-confirm'
  | 'reservation-reminder'
  | 'crm-notification'
  | 'google-meet-invite';
```

### 2.3 カテゴリ分類

| グループ | カテゴリ | 対象テンプレート |
|---------|---------|-----------------|
| コンテンツ配信 | マガジン / ニュース / ビジュアル / シンプル / プレミアム | 既存5種 |
| 販促 | クーポン | `coupon-delivery` |
| 予約管理 | 予約 | `reservation-confirm`, `reservation-reminder` |
| 顧客管理 | CRM | `crm-notification` |
| コミュニケーション | ミーティング | `google-meet-invite` |

---

## 3. 各テンプレートのビジュアル仕様

### 3.1 共通デザインルール

| 項目 | 値 |
|------|-----|
| Bubble サイズ | `mega` |
| 本文テキスト色 | `#555555` |
| タイトルテキスト色 | `#1A1A2E` |
| サブテキスト色 | `#999999` |
| パディング（body） | `xl` |
| パディング（header/footer） | `lg` |
| ボタン高さ | `sm` |
| 角丸（バッジ） | `md` |
| 角丸（小バッジ） | `sm` |

---

## 4. テンプレート別 Flex Message JSON構造設計

---

### 4.1 クーポン配信（`coupon-delivery`）

#### コンセプト
赤を基調とした緊急感・お得感を演出するデザイン。クーポンコードを大きく表示し、有効期限を明確に提示する。

#### ビジュアル仕様

| 要素 | 仕様 |
|------|------|
| プライマリカラー | `#E63946`（赤） |
| セカンダリカラー | `#FFF1F2`（淡ピンク背景） |
| ヘッダー背景 | `#E63946` |
| クーポンコード文字 | `xl` / `bold` / `#E63946` |
| 割引率・割引額文字 | `3xl` / `bold` / `#E63946` |
| 有効期限文字 | `xs` / `#999999` |
| ボタンスタイル | `primary` / `#E63946` |

#### レイアウト構造

```
[header] 背景: #E63946
  ├── アイコン "🎫 COUPON" (白文字, bold, xs)
  └── キャンペーン名 (白文字, bold, sm)

[body] パディング: xl
  ├── 割引表示ボックス (背景: #FFF1F2, 角丸: xl, パディング: xl)
  │   ├── 割引額/割引率 ("20% OFF" 等) — 3xl, bold, #E63946, 中央揃え
  │   └── 対象説明テキスト — sm, #555555, 中央揃え
  ├── セパレーター (破線風: #E8E8E8)
  ├── クーポンコードボックス (背景: #F8F8F8, 角丸: md)
  │   ├── ラベル "クーポンコード" — xxs, #999999
  │   └── コード表示 "SPRING2026" — xl, bold, #E63946, 中央揃え
  ├── 有効期限テキスト — xs, #999999, 中央揃え
  └── 注意事項テキスト — xxs, #BBBBBB, wrap

[footer] セパレーター付き
  └── ボタン "クーポンを使う" — primary, #E63946
```

#### JSON構造

```json
{
  "type": "bubble",
  "size": "mega",
  "header": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "🎫 COUPON",
        "size": "xs",
        "color": "#FFFFFF",
        "weight": "bold"
      },
      {
        "type": "text",
        "text": "${campaignName}",
        "size": "sm",
        "color": "#FFFFFF",
        "weight": "bold",
        "wrap": true
      }
    ],
    "backgroundColor": "#E63946",
    "paddingAll": "lg"
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "xl",
    "contents": [
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "${discountDisplay}",
            "size": "3xl",
            "weight": "bold",
            "color": "#E63946",
            "align": "center"
          },
          {
            "type": "text",
            "text": "${targetDescription}",
            "size": "sm",
            "color": "#555555",
            "align": "center",
            "margin": "sm",
            "wrap": true
          }
        ],
        "backgroundColor": "#FFF1F2",
        "cornerRadius": "xl",
        "paddingAll": "xl"
      },
      {
        "type": "separator",
        "color": "#E8E8E8",
        "margin": "xl"
      },
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "クーポンコード",
            "size": "xxs",
            "color": "#999999",
            "align": "center"
          },
          {
            "type": "text",
            "text": "${couponCode}",
            "size": "xl",
            "weight": "bold",
            "color": "#E63946",
            "align": "center",
            "margin": "sm"
          }
        ],
        "backgroundColor": "#F8F8F8",
        "cornerRadius": "md",
        "paddingAll": "lg",
        "margin": "xl"
      },
      {
        "type": "text",
        "text": "有効期限: ${expiresAt}",
        "size": "xs",
        "color": "#999999",
        "align": "center",
        "margin": "lg"
      },
      {
        "type": "text",
        "text": "${notes}",
        "size": "xxs",
        "color": "#BBBBBB",
        "wrap": true,
        "margin": "md"
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "lg",
    "contents": [
      {
        "type": "button",
        "action": {
          "type": "uri",
          "label": "クーポンを使う",
          "uri": "${couponUrl}"
        },
        "style": "primary",
        "color": "#E63946",
        "height": "sm"
      }
    ]
  },
  "styles": {
    "footer": { "separator": true }
  }
}
```

#### 動的パラメータ

| 変数名 | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `campaignName` | `string` | キャンペーン名 | `"春の大感謝セール"` |
| `discountDisplay` | `string` | 割引表示 | `"20% OFF"`, `"¥1,000 OFF"` |
| `targetDescription` | `string` | 対象商品説明 | `"全商品対象"` |
| `couponCode` | `string` | クーポンコード | `"SPRING2026"` |
| `expiresAt` | `string` | 有効期限 | `"2026/04/30 23:59まで"` |
| `notes` | `string` | 注意事項 | `"※他クーポンとの併用不可"` |
| `couponUrl` | `string` | クーポン利用先URL | `"https://example.com/use?code=SPRING2026"` |

---

### 4.2 予約確認（`reservation-confirm`）

#### コンセプト
青を基調とした信頼感のあるデザイン。予約内容を構造化リストで表示し、確認・変更・キャンセル操作を提供する。

#### ビジュアル仕様

| 要素 | 仕様 |
|------|------|
| プライマリカラー | `#2196F3`（ブルー） |
| ヘッダー背景 | `#2196F3` |
| 確認済みバッジ | 背景 `#E3F2FD` / 文字 `#2196F3` |
| ラベル文字 | `xs` / `#999999` |
| 値文字 | `sm` / `bold` / `#1A1A2E` |
| ボタン（確認）| `primary` / `#2196F3` |
| ボタン（変更・キャンセル）| `link` / `#2196F3` |

#### レイアウト構造

```
[header] 背景: #2196F3
  ├── "✅ 予約確認" (白文字, bold, sm)
  └── "ご予約ありがとうございます" (白文字, xs)

[body] パディング: xl
  ├── 予約番号ボックス (背景: #E3F2FD, 角丸: md)
  │   ├── ラベル "予約番号" — xxs, #2196F3
  │   └── 番号 "RSV-20260324-001" — md, bold, #2196F3, 中央揃え
  ├── セパレーター
  ├── 予約詳細リスト (horizontal レイアウト × N行)
  │   ├── [日時]   ラベル(flex:2) + 値(flex:5)
  │   ├── [メニュー] ラベル(flex:2) + 値(flex:5)
  │   ├── [担当]   ラベル(flex:2) + 値(flex:5)
  │   └── [場所]   ラベル(flex:2) + 値(flex:5)
  └── 注意事項テキスト — xxs, #BBBBBB

[footer] セパレーター付き
  ├── ボタン "予約内容を確認" — primary, #2196F3
  └── ボタン横並び
      ├── "変更する" — link, #2196F3
      └── "キャンセル" — link, #E63946
```

#### JSON構造

```json
{
  "type": "bubble",
  "size": "mega",
  "header": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "✅ 予約確認",
        "size": "sm",
        "color": "#FFFFFF",
        "weight": "bold"
      },
      {
        "type": "text",
        "text": "ご予約ありがとうございます",
        "size": "xs",
        "color": "#BBDEFB"
      }
    ],
    "backgroundColor": "#2196F3",
    "paddingAll": "lg"
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "xl",
    "contents": [
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "予約番号",
            "size": "xxs",
            "color": "#2196F3",
            "align": "center"
          },
          {
            "type": "text",
            "text": "${reservationId}",
            "size": "md",
            "weight": "bold",
            "color": "#2196F3",
            "align": "center",
            "margin": "xs"
          }
        ],
        "backgroundColor": "#E3F2FD",
        "cornerRadius": "md",
        "paddingAll": "md"
      },
      {
        "type": "separator",
        "color": "#E8E8E8",
        "margin": "xl"
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "xl",
        "contents": [
          { "type": "text", "text": "日時", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${dateTime}", "size": "sm", "weight": "bold", "color": "#1A1A2E", "flex": 5, "wrap": true }
        ]
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
          { "type": "text", "text": "メニュー", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${menuName}", "size": "sm", "weight": "bold", "color": "#1A1A2E", "flex": 5, "wrap": true }
        ]
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
          { "type": "text", "text": "担当", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${staffName}", "size": "sm", "weight": "bold", "color": "#1A1A2E", "flex": 5 }
        ]
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
          { "type": "text", "text": "場所", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${location}", "size": "sm", "weight": "bold", "color": "#1A1A2E", "flex": 5, "wrap": true }
        ]
      },
      {
        "type": "text",
        "text": "${notes}",
        "size": "xxs",
        "color": "#BBBBBB",
        "wrap": true,
        "margin": "xl"
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "lg",
    "contents": [
      {
        "type": "button",
        "action": {
          "type": "uri",
          "label": "予約内容を確認",
          "uri": "${confirmUrl}"
        },
        "style": "primary",
        "color": "#2196F3",
        "height": "sm"
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "uri",
              "label": "変更する",
              "uri": "${modifyUrl}"
            },
            "style": "link",
            "color": "#2196F3",
            "height": "sm",
            "flex": 1
          },
          {
            "type": "button",
            "action": {
              "type": "uri",
              "label": "キャンセル",
              "uri": "${cancelUrl}"
            },
            "style": "link",
            "color": "#E63946",
            "height": "sm",
            "flex": 1
          }
        ]
      }
    ]
  },
  "styles": {
    "footer": { "separator": true }
  }
}
```

#### 動的パラメータ

| 変数名 | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `reservationId` | `string` | 予約番号 | `"RSV-20260324-001"` |
| `dateTime` | `string` | 予約日時 | `"2026/04/01 14:00〜15:00"` |
| `menuName` | `string` | メニュー名 | `"カット + カラー"` |
| `staffName` | `string` | 担当者名 | `"田中 太郎"` |
| `location` | `string` | 場所 | `"渋谷本店 3F"` |
| `notes` | `string` | 備考 | `"※キャンセルは前日18時まで"` |
| `confirmUrl` | `string` | 確認ページURL | — |
| `modifyUrl` | `string` | 変更ページURL | — |
| `cancelUrl` | `string` | キャンセルページURL | — |

---

### 4.3 予約リマインダー（`reservation-reminder`）

#### コンセプト
オレンジを基調とした注意喚起デザイン。予約日時までのカウントダウン表示で来店意識を高め、日時選択アクションで変更にも対応する。

#### ビジュアル仕様

| 要素 | 仕様 |
|------|------|
| プライマリカラー | `#FF9800`（オレンジ） |
| 警告アクセント | `#FFF3E0`（淡オレンジ背景） |
| ヘッダー背景 | `#FF9800` |
| カウントダウン文字 | `xxl` / `bold` / `#FF9800` |
| ボタン（確認）| `primary` / `#FF9800` |
| ボタン（日時変更）| Postback + datetimepicker |

#### レイアウト構造

```
[header] 背景: #FF9800
  ├── "🔔 リマインダー" (白文字, bold, sm)
  └── "ご予約の確認をお願いします" (白文字, xs)

[body] パディング: xl
  ├── カウントダウンボックス (背景: #FFF3E0, 角丸: xl)
  │   ├── "あと" — sm, #FF9800
  │   ├── "${daysUntil}日" — xxl, bold, #FF9800, 中央揃え
  │   └── "${dateTime}" — sm, bold, #1A1A2E, 中央揃え
  ├── セパレーター
  ├── 予約詳細リスト
  │   ├── [メニュー] ラベル + 値
  │   ├── [担当]   ラベル + 値
  │   └── [場所]   ラベル + 値
  └── 持ち物・注意テキスト — xxs, #BBBBBB

[footer] セパレーター付き
  ├── ボタン "予約を確認しました" — primary, #FF9800
  └── ボタン "日時を変更する" — link(datetimepicker)
```

#### JSON構造

```json
{
  "type": "bubble",
  "size": "mega",
  "header": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "🔔 リマインダー",
        "size": "sm",
        "color": "#FFFFFF",
        "weight": "bold"
      },
      {
        "type": "text",
        "text": "ご予約の確認をお願いします",
        "size": "xs",
        "color": "#FFE0B2"
      }
    ],
    "backgroundColor": "#FF9800",
    "paddingAll": "lg"
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "xl",
    "contents": [
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "ご予約まであと",
            "size": "sm",
            "color": "#FF9800",
            "align": "center"
          },
          {
            "type": "text",
            "text": "${daysUntil}日",
            "size": "xxl",
            "weight": "bold",
            "color": "#FF9800",
            "align": "center",
            "margin": "sm"
          },
          {
            "type": "text",
            "text": "${dateTime}",
            "size": "sm",
            "weight": "bold",
            "color": "#1A1A2E",
            "align": "center",
            "margin": "md"
          }
        ],
        "backgroundColor": "#FFF3E0",
        "cornerRadius": "xl",
        "paddingAll": "xl"
      },
      {
        "type": "separator",
        "color": "#E8E8E8",
        "margin": "xl"
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "xl",
        "contents": [
          { "type": "text", "text": "メニュー", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${menuName}", "size": "sm", "weight": "bold", "color": "#1A1A2E", "flex": 5, "wrap": true }
        ]
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
          { "type": "text", "text": "担当", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${staffName}", "size": "sm", "weight": "bold", "color": "#1A1A2E", "flex": 5 }
        ]
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
          { "type": "text", "text": "場所", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${location}", "size": "sm", "weight": "bold", "color": "#1A1A2E", "flex": 5, "wrap": true }
        ]
      },
      {
        "type": "text",
        "text": "${reminderNote}",
        "size": "xxs",
        "color": "#BBBBBB",
        "wrap": true,
        "margin": "xl"
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "lg",
    "contents": [
      {
        "type": "button",
        "action": {
          "type": "postback",
          "label": "予約を確認しました",
          "data": "action=confirm_reservation&id=${reservationId}",
          "displayText": "予約を確認しました"
        },
        "style": "primary",
        "color": "#FF9800",
        "height": "sm"
      },
      {
        "type": "button",
        "action": {
          "type": "datetimepicker",
          "label": "日時を変更する",
          "data": "action=reschedule&id=${reservationId}",
          "mode": "datetime",
          "initial": "${initialDateTime}",
          "min": "${minDateTime}",
          "max": "${maxDateTime}"
        },
        "style": "link",
        "color": "#FF9800",
        "height": "sm",
        "margin": "sm"
      }
    ]
  },
  "styles": {
    "footer": { "separator": true }
  }
}
```

#### 動的パラメータ

| 変数名 | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `daysUntil` | `number` | 予約までの日数 | `3` |
| `dateTime` | `string` | 予約日時（表示用） | `"2026/04/01（水）14:00"` |
| `menuName` | `string` | メニュー名 | `"カット + カラー"` |
| `staffName` | `string` | 担当者名 | `"田中 太郎"` |
| `location` | `string` | 場所 | `"渋谷本店 3F"` |
| `reminderNote` | `string` | リマインダー備考 | `"※当日は5分前にお越しください"` |
| `reservationId` | `string` | 予約ID（Postback用） | `"RSV-20260324-001"` |
| `initialDateTime` | `string` | 日時選択の初期値 | `"2026-04-01T14:00"` |
| `minDateTime` | `string` | 選択可能最小日時 | `"2026-03-25T09:00"` |
| `maxDateTime` | `string` | 選択可能最大日時 | `"2026-05-31T20:00"` |

---

### 4.4 CRM通知（`crm-notification`）

#### コンセプト
紫を基調としたパーソナルで特別感のあるデザイン。誕生日祝い、ランクアップ通知、ポイント通知など、CRMイベントに応じてサブタイプを切り替える。

#### サブタイプ一覧

| サブタイプ | 用途 | アイコン | アクセントカラー |
|-----------|------|---------|-----------------|
| `birthday` | 誕生日 | `🎂` | `#9C27B0` |
| `rank-up` | ランクアップ | `🏆` | `#FFD700` (ゴールド) |
| `point-expiry` | ポイント期限 | `⚠️` | `#FF5722` |
| `anniversary` | 来店記念 | `🎉` | `#9C27B0` |
| `thank-you` | サンクス | `💐` | `#4CAF50` |

#### ビジュアル仕様

| 要素 | 仕様 |
|------|------|
| プライマリカラー | `#9C27B0`（パープル、サブタイプで変動） |
| ヘッダー背景 | サブタイプ別アクセントカラー |
| 顧客名表示 | `lg` / `bold` / `#1A1A2E` |
| メッセージ本文 | `sm` / `#555555` / `wrap` |
| 特典ボックス背景 | `#F3E5F5`（淡パープル） |
| ボタン | `primary` / サブタイプ別カラー |

#### レイアウト構造

```
[header] 背景: サブタイプ別
  ├── アイコン + タイトル ("🎂 Happy Birthday!" 等)
  └── サブタイトル (白文字, xs)

[body] パディング: xl
  ├── 顧客名 "${customerName} 様" — lg, bold, #1A1A2E
  ├── メッセージ本文 — sm, #555555, wrap
  ├── セパレーター
  ├── 特典ボックス (背景: #F3E5F5, 角丸: md)
  │   ├── ラベル "特典" — xxs, サブタイプ色
  │   ├── 特典内容 — md, bold, サブタイプ色, 中央揃え
  │   └── 有効期限 — xxs, #999999
  └── ※条件テキスト — xxs, #BBBBBB

[footer] セパレーター付き
  └── ボタン "特典を受け取る" — primary, サブタイプ色
```

#### JSON構造（誕生日サブタイプの例）

```json
{
  "type": "bubble",
  "size": "mega",
  "header": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "🎂 Happy Birthday!",
        "size": "lg",
        "color": "#FFFFFF",
        "weight": "bold"
      },
      {
        "type": "text",
        "text": "お誕生日おめでとうございます",
        "size": "xs",
        "color": "#E1BEE7",
        "margin": "sm"
      }
    ],
    "backgroundColor": "#9C27B0",
    "paddingAll": "xl"
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "xl",
    "contents": [
      {
        "type": "text",
        "text": "${customerName} 様",
        "size": "lg",
        "weight": "bold",
        "color": "#1A1A2E"
      },
      {
        "type": "text",
        "text": "${messageBody}",
        "size": "sm",
        "color": "#555555",
        "wrap": true,
        "margin": "lg"
      },
      {
        "type": "separator",
        "color": "#E8E8E8",
        "margin": "xl"
      },
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "🎁 バースデー特典",
            "size": "xxs",
            "color": "#9C27B0",
            "align": "center"
          },
          {
            "type": "text",
            "text": "${benefitDisplay}",
            "size": "md",
            "weight": "bold",
            "color": "#9C27B0",
            "align": "center",
            "margin": "sm"
          },
          {
            "type": "text",
            "text": "有効期限: ${benefitExpiry}",
            "size": "xxs",
            "color": "#999999",
            "align": "center",
            "margin": "sm"
          }
        ],
        "backgroundColor": "#F3E5F5",
        "cornerRadius": "md",
        "paddingAll": "lg",
        "margin": "xl"
      },
      {
        "type": "text",
        "text": "${conditions}",
        "size": "xxs",
        "color": "#BBBBBB",
        "wrap": true,
        "margin": "md"
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "lg",
    "contents": [
      {
        "type": "button",
        "action": {
          "type": "uri",
          "label": "特典を受け取る",
          "uri": "${benefitUrl}"
        },
        "style": "primary",
        "color": "#9C27B0",
        "height": "sm"
      }
    ]
  },
  "styles": {
    "footer": { "separator": true }
  }
}
```

#### ランクアップサブタイプのヘッダー差分

```json
{
  "type": "box",
  "layout": "vertical",
  "contents": [
    {
      "type": "text",
      "text": "🏆 ランクアップおめでとうございます!",
      "size": "sm",
      "color": "#FFFFFF",
      "weight": "bold",
      "wrap": true
    },
    {
      "type": "box",
      "layout": "horizontal",
      "margin": "lg",
      "contents": [
        {
          "type": "text",
          "text": "${previousRank}",
          "size": "sm",
          "color": "#FFE082",
          "align": "center",
          "flex": 2
        },
        {
          "type": "text",
          "text": "→",
          "size": "md",
          "color": "#FFFFFF",
          "align": "center",
          "flex": 1
        },
        {
          "type": "text",
          "text": "${newRank}",
          "size": "lg",
          "color": "#FFFFFF",
          "weight": "bold",
          "align": "center",
          "flex": 2
        }
      ]
    }
  ],
  "backgroundColor": "#5D4037",
  "paddingAll": "xl"
}
```

#### 動的パラメータ

| 変数名 | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `crmSubtype` | `CrmSubtype` | 通知サブタイプ | `"birthday"` |
| `customerName` | `string` | 顧客名 | `"山田 花子"` |
| `messageBody` | `string` | 本文メッセージ | `"いつもご利用ありがとう..."` |
| `benefitDisplay` | `string` | 特典表示 | `"20% OFF クーポン"` |
| `benefitExpiry` | `string` | 特典有効期限 | `"2026/04/30"` |
| `conditions` | `string` | 条件・注意事項 | `"※1回限り有効"` |
| `benefitUrl` | `string` | 特典ページURL | — |
| `previousRank` | `string` | 旧ランク（ランクアップ用） | `"シルバー"` |
| `newRank` | `string` | 新ランク（ランクアップ用） | `"ゴールド"` |

---

### 4.5 Google Meet招待（`google-meet-invite`）

#### コンセプト
ティール（青緑）を基調としたクリーンなデザイン。Google Meetのブランドカラーに近い配色で、ミーティング情報を簡潔に提示し、ワンタップで参加できるようにする。

#### ビジュアル仕様

| 要素 | 仕様 |
|------|------|
| プライマリカラー | `#00897B`（ティール） |
| セカンダリカラー | `#E0F2F1`（淡ティール背景） |
| ヘッダー背景 | `#00897B` |
| ミーティングタイトル | `md` / `bold` / `#1A1A2E` |
| 日時・情報ラベル | `xs` / `#999999` |
| 日時・情報値 | `sm` / `bold` / `#1A1A2E` |
| 参加ボタン | `primary` / `#00897B` |
| カレンダー追加ボタン | `link` / `#00897B` |

#### レイアウト構造

```
[header] 背景: #00897B
  ├── "📹 Google Meet" (白文字, bold, xs)
  └── "ミーティングへの招待" (白文字, xs)

[body] パディング: xl
  ├── ミーティングタイトル — md, bold, #1A1A2E, wrap
  ├── セパレーター
  ├── 日時ボックス (背景: #E0F2F1, 角丸: md)
  │   ├── 日付 — sm, bold, #1A1A2E, 中央揃え
  │   └── 時間帯 — xs, #00897B, 中央揃え
  ├── ミーティング詳細リスト
  │   ├── [主催者]  ラベル + 値
  │   ├── [参加者数] ラベル + 値
  │   └── [議題]   ラベル + 値 (任意)
  └── Meet URL表示ボックス (背景: #F5F5F5, 角丸: sm)
      └── URL短縮表示 — xxs, #00897B

[footer] セパレーター付き
  ├── ボタン "ミーティングに参加" — primary, #00897B
  └── ボタン "カレンダーに追加" — link, #00897B
```

#### JSON構造

```json
{
  "type": "bubble",
  "size": "mega",
  "header": {
    "type": "box",
    "layout": "horizontal",
    "contents": [
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "📹 Google Meet",
            "size": "xs",
            "color": "#FFFFFF",
            "weight": "bold"
          },
          {
            "type": "text",
            "text": "ミーティングへの招待",
            "size": "xs",
            "color": "#B2DFDB"
          }
        ]
      },
      { "type": "filler" }
    ],
    "backgroundColor": "#00897B",
    "paddingAll": "lg"
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "xl",
    "contents": [
      {
        "type": "text",
        "text": "${meetingTitle}",
        "size": "md",
        "weight": "bold",
        "color": "#1A1A2E",
        "wrap": true
      },
      {
        "type": "separator",
        "color": "#E8E8E8",
        "margin": "lg"
      },
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "${meetingDate}",
            "size": "sm",
            "weight": "bold",
            "color": "#1A1A2E",
            "align": "center"
          },
          {
            "type": "text",
            "text": "${meetingTime}",
            "size": "xs",
            "color": "#00897B",
            "align": "center",
            "margin": "xs"
          }
        ],
        "backgroundColor": "#E0F2F1",
        "cornerRadius": "md",
        "paddingAll": "lg",
        "margin": "lg"
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "xl",
        "contents": [
          { "type": "text", "text": "主催者", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${organizerName}", "size": "sm", "weight": "bold", "color": "#1A1A2E", "flex": 5 }
        ]
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
          { "type": "text", "text": "参加者", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${attendeesDisplay}", "size": "sm", "color": "#1A1A2E", "flex": 5, "wrap": true }
        ]
      },
      {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
          { "type": "text", "text": "議題", "size": "xs", "color": "#999999", "flex": 2 },
          { "type": "text", "text": "${agenda}", "size": "sm", "color": "#555555", "flex": 5, "wrap": true }
        ]
      },
      {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "${meetUrl}",
            "size": "xxs",
            "color": "#00897B",
            "align": "center",
            "action": {
              "type": "uri",
              "label": "Meet URL",
              "uri": "${meetUrl}"
            }
          }
        ],
        "backgroundColor": "#F5F5F5",
        "cornerRadius": "sm",
        "paddingAll": "sm",
        "margin": "xl"
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "paddingAll": "lg",
    "contents": [
      {
        "type": "button",
        "action": {
          "type": "uri",
          "label": "ミーティングに参加",
          "uri": "${meetUrl}"
        },
        "style": "primary",
        "color": "#00897B",
        "height": "sm"
      },
      {
        "type": "button",
        "action": {
          "type": "uri",
          "label": "カレンダーに追加",
          "uri": "${calendarUrl}"
        },
        "style": "link",
        "color": "#00897B",
        "height": "sm",
        "margin": "sm"
      }
    ]
  },
  "styles": {
    "footer": { "separator": true }
  }
}
```

#### 動的パラメータ

| 変数名 | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `meetingTitle` | `string` | ミーティング名 | `"週次定例ミーティング"` |
| `meetingDate` | `string` | 日付（表示用） | `"2026年4月1日（水）"` |
| `meetingTime` | `string` | 時間帯（表示用） | `"14:00 〜 15:00（60分）"` |
| `organizerName` | `string` | 主催者名 | `"安田 修"` |
| `attendeesDisplay` | `string` | 参加者表示 | `"5名（田中、鈴木 他）"` |
| `agenda` | `string` | 議題 | `"Q2 KPIレビュー"` |
| `meetUrl` | `string` | Google Meet URL | `"https://meet.google.com/abc-defg-hij"` |
| `calendarUrl` | `string` | カレンダー追加URL | Google Calendar URLスキーム |

---

## 5. アクションボタン設計

### 5.1 アクション種別の使い分け

| アクション種別 | 用途 | 使用テンプレート |
|---------------|------|-----------------|
| **URI** | 外部URL遷移（Webページ、LIFF） | 全テンプレート |
| **Postback** | サーバー側処理トリガー（確認済み通知等） | `reservation-reminder`, `crm-notification` |
| **Datetimepicker** | 日時選択UI（予約変更） | `reservation-reminder` |
| **Message** | テキストメッセージ送信 | 将来拡張用 |

### 5.2 Postback data 設計規則

```
action={アクション名}&id={リソースID}&type={サブタイプ}
```

#### 定義済みアクション

| data | トリガー | サーバー処理 |
|------|---------|-------------|
| `action=confirm_reservation&id={reservationId}` | リマインダー確認ボタン | 予約確認フラグON |
| `action=reschedule&id={reservationId}` | 日時変更ボタン | datetimepicker結果で予約更新 |
| `action=claim_benefit&id={benefitId}&type={crmSubtype}` | 特典受取ボタン | 特典使用フラグON |
| `action=use_coupon&code={couponCode}` | クーポン利用（Postback版） | クーポン使用処理 |

### 5.3 FlexAction 型定義の拡張

```typescript
export interface FlexAction {
  type: 'uri' | 'message' | 'postback' | 'datetimepicker';
  label?: string;
  uri?: string;
  text?: string;
  data?: string;         // postback用
  displayText?: string;  // postback用（チャットに表示するテキスト）
  mode?: 'date' | 'time' | 'datetime';  // datetimepicker用
  initial?: string;      // datetimepicker用
  min?: string;          // datetimepicker用
  max?: string;          // datetimepicker用
}
```

---

## 6. Carouselメッセージ活用方針

### 6.1 Carousel対応テンプレート

| テンプレート | Carousel利用シーン | 最大Bubble数 |
|-------------|-------------------|-------------|
| `coupon-delivery` | 複数クーポンの一括配信 | 10 |
| `crm-notification` | ランクアップ + 特典クーポンの組み合わせ | 3 |
| `reservation-confirm` | 複数予約の一括確認（連続予約時） | 5 |
| `google-meet-invite` | 同日複数ミーティングの案内 | 5 |

### 6.2 Carousel JSON構造

```json
{
  "type": "carousel",
  "contents": [
    { "type": "bubble", "...": "1枚目" },
    { "type": "bubble", "...": "2枚目" }
  ]
}
```

### 6.3 Carousel運用ルール

1. **最大枚数**: LINE APIの制限により最大12枚。運用推奨は5枚以下
2. **サイズ統一**: Carousel内の全Bubbleは同じ `size` を使用すること（`mega`）
3. **高さ統一**: 視認性のため、各Bubbleの高さはできるだけ揃える
4. **最終Bubble**: 「もっと見る」系のCTAカードを最後に配置する運用を推奨

### 6.4 Carousel活用パターン

#### パターンA: クーポン複数配信

```
[Bubble 1: 20%OFFクーポン] → [Bubble 2: 送料無料クーポン] → [Bubble 3: もっと見る]
```

#### パターンB: CRM ランクアップ + 特典

```
[Bubble 1: ランクアップ通知] → [Bubble 2: ランクアップ特典クーポン]
```

#### パターンC: 今日のミーティング一覧

```
[Bubble 1: 10:00 定例] → [Bubble 2: 14:00 1on1] → [Bubble 3: 16:00 レビュー]
```

---

## 7. TEMPLATE_DEFINITIONS 拡張

```typescript
// 新規テンプレート定義（templates.ts に追加）
export const NEW_TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'coupon-delivery',
    name: 'クーポン配信',
    description: '割引クーポンやキャンペーンコードを配信。割引額を大きく表示し、クーポンコードと有効期限を明示。',
    category: 'クーポン',
    previewColor: '#E63946',
    recommendedFor: 'セール・キャンペーン告知',
  },
  {
    id: 'reservation-confirm',
    name: '予約確認',
    description: '予約内容の確認通知。予約番号、日時、メニュー、担当者を構造化表示。変更・キャンセルボタン付き。',
    category: '予約',
    previewColor: '#2196F3',
    recommendedFor: '予約完了時の自動通知',
  },
  {
    id: 'reservation-reminder',
    name: '予約リマインダー',
    description: '予約日前日〜当日のリマインダー。カウントダウン表示と日時変更用datetimepicker付き。',
    category: '予約',
    previewColor: '#FF9800',
    recommendedFor: '予約日前のリマインド',
  },
  {
    id: 'crm-notification',
    name: 'CRM通知',
    description: '誕生日祝い、ランクアップ、ポイント期限などCRMイベント通知。サブタイプで表示を切り替え。',
    category: 'CRM',
    previewColor: '#9C27B0',
    recommendedFor: '顧客ロイヤルティ施策',
  },
  {
    id: 'google-meet-invite',
    name: 'Google Meet招待',
    description: 'Google Meetミーティング招待。日時・参加者・議題を表示し、ワンタップで参加可能。',
    category: 'ミーティング',
    previewColor: '#00897B',
    recommendedFor: 'オンライン会議招待',
  },
];
```

---

## 8. 新規リクエスト型定義

既存の `BroadcastRequest` はマガジン配信に特化しているため、新規テンプレート用のリクエスト型を定義する。

```typescript
// --- クーポン配信 ---
export interface CouponDeliveryRequest {
  templateId: 'coupon-delivery';
  campaignName: string;
  discountDisplay: string;       // "20% OFF", "¥1,000 OFF"
  targetDescription: string;     // "全商品対象"
  couponCode: string;
  expiresAt: string;
  notes?: string;
  couponUrl: string;
}

// --- 予約確認 ---
export interface ReservationConfirmRequest {
  templateId: 'reservation-confirm';
  reservationId: string;
  dateTime: string;
  menuName: string;
  staffName: string;
  location: string;
  notes?: string;
  confirmUrl: string;
  modifyUrl: string;
  cancelUrl: string;
}

// --- 予約リマインダー ---
export interface ReservationReminderRequest {
  templateId: 'reservation-reminder';
  reservationId: string;
  daysUntil: number;
  dateTime: string;
  menuName: string;
  staffName: string;
  location: string;
  reminderNote?: string;
  initialDateTime: string;    // ISO 8601
  minDateTime: string;
  maxDateTime: string;
}

// --- CRM通知 ---
export type CrmSubtype = 'birthday' | 'rank-up' | 'point-expiry' | 'anniversary' | 'thank-you';

export interface CrmNotificationRequest {
  templateId: 'crm-notification';
  crmSubtype: CrmSubtype;
  customerName: string;
  messageBody: string;
  benefitDisplay: string;
  benefitExpiry: string;
  conditions?: string;
  benefitUrl: string;
  // ランクアップ用
  previousRank?: string;
  newRank?: string;
}

// --- Google Meet招待 ---
export interface GoogleMeetInviteRequest {
  templateId: 'google-meet-invite';
  meetingTitle: string;
  meetingDate: string;
  meetingTime: string;
  organizerName: string;
  attendeesDisplay: string;
  agenda?: string;
  meetUrl: string;
  calendarUrl: string;
}

// --- ユニオン型 ---
export type TemplateRequest =
  | BroadcastRequest
  | CouponDeliveryRequest
  | ReservationConfirmRequest
  | ReservationReminderRequest
  | CrmNotificationRequest
  | GoogleMeetInviteRequest;
```

---

## 9. 実装方針

### 9.1 ファイル構成

```
src/lib/line/
  ├── templates.ts              # 既存5テンプレート（変更なし）
  ├── templates-business.ts     # 新規5テンプレート（新規作成）
  └── template-registry.ts      # 統合レジストリ（新規作成）

src/types/
  └── line.ts                   # 型定義拡張
```

### 9.2 buildFlexMessage 拡張

```typescript
// template-registry.ts
import { buildFlexMessage as buildMagazine } from './templates';
import { buildBusinessFlexMessage } from './templates-business';

export function buildFlexMessage(req: TemplateRequest): FlexContainer {
  const magazineIds = ['daily-column','news-card','visual-magazine','minimal-text','premium-card'];
  if (magazineIds.includes(req.templateId)) {
    return buildMagazine(req as BroadcastRequest);
  }
  return buildBusinessFlexMessage(req);
}
```

### 9.3 Postback Webhook ハンドラ

```typescript
// 新規追加が必要なWebhookハンドラ
// POST /api/line/webhook
// event.type === 'postback' の場合に処理を分岐

switch (action) {
  case 'confirm_reservation':
    // 予約確認フラグを更新
    break;
  case 'reschedule':
    // event.postback.params.datetime を取得して予約日時を更新
    break;
  case 'claim_benefit':
    // 特典使用フラグを更新
    break;
  case 'use_coupon':
    // クーポン使用処理
    break;
}
```

---

## 10. altText 設計

Flex Messageの `altText` はプッシュ通知やトーク一覧に表示される重要なテキスト。

| テンプレート | altText パターン |
|-------------|-----------------|
| `coupon-delivery` | `【クーポン】{campaignName} - {discountDisplay}` |
| `reservation-confirm` | `【予約確認】{dateTime} {menuName}` |
| `reservation-reminder` | `【リマインダー】{dateTime}のご予約` |
| `crm-notification` | `【{subtypeLabel}】{customerName}様へのお知らせ` |
| `google-meet-invite` | `【Meet招待】{meetingTitle} {meetingDate}` |

altText は最大400文字。超過時は末尾を切り捨てる。

---

## 付録A: カラーパレット一覧

| 用途 | カラーコード | 使用箇所 |
|------|-------------|---------|
| クーポン・プライマリ | `#E63946` | ヘッダー、ボタン、強調テキスト |
| クーポン・淡背景 | `#FFF1F2` | 割引表示ボックス背景 |
| 予約確認・プライマリ | `#2196F3` | ヘッダー、ボタン、予約番号 |
| 予約確認・淡背景 | `#E3F2FD` | 予約番号ボックス背景 |
| リマインダー・プライマリ | `#FF9800` | ヘッダー、ボタン、カウントダウン |
| リマインダー・淡背景 | `#FFF3E0` | カウントダウンボックス背景 |
| CRM・プライマリ | `#9C27B0` | ヘッダー、ボタン、特典表示 |
| CRM・淡背景 | `#F3E5F5` | 特典ボックス背景 |
| CRM・ゴールド | `#FFD700` | ランクアップ |
| Meet・プライマリ | `#00897B` | ヘッダー、ボタン、時間表示 |
| Meet・淡背景 | `#E0F2F1` | 日時ボックス背景 |
| 共通・タイトル | `#1A1A2E` | 全テンプレートのタイトル |
| 共通・本文 | `#555555` | 全テンプレートの本文 |
| 共通・サブ | `#999999` | ラベル、日付等 |
| 共通・注釈 | `#BBBBBB` | 注意事項、条件等 |
| 共通・セパレーター | `#E8E8E8` | 区切り線 |
| 共通・淡背景 | `#F8F8F8` | コード表示枠等 |
| 削除・警告 | `#E63946` | キャンセルボタン |
