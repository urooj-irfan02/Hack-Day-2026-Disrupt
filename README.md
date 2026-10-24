# Hisaab (حساب)

> **Your WhatsApp chaos, reconciled.**

Hisaab is an intelligent order reconciliation and payment verification engine designed for Pakistani home businesses, bakeries, and social commerce sellers operating over WhatsApp.

Upload an exported WhatsApp chat (`.txt`) alongside payment receipts / screenshots. Hisaab parses multi-line Roman Urdu conversations, reads payment slips with Gemma vision OCR, deterministically matches catalog pricing, flags discrepancies (short payments, duplicate transaction IDs, missing delivery addresses, unreadable slips), and exports clean, verified CSV sheets for fulfillment.

The seller stays in total control: **the model assists, deterministic code calculates, and the seller approves everything.**

---

## ⚡ The 8 Hard Rules

1. **Gemma Only**: Every AI API call goes through ONE file (`server/gemma.ts`). The model is a single constant: `process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it"`. Zero `gemini-*` models are used anywhere in the codebase.
2. **Deterministic Arithmetic**: All arithmetic, price lookups, matching, and flagging are executed in pure, deterministic code (`server/reconcile.ts`). The AI model never calculates totals.
3. **Zod Schema Validation**: Every model output is strictly validated against a Zod schema. On validation failure, the engine automatically retries once with validation error feedback before marking items for human review.
4. **Seller Approval Guard**: Nothing is exported until the user explicitly checks and approves rows in the UI. Export buttons remain locked when 0 rows are approved.
5. **Deterministic Replay Mode**: Every model response is cached on disk in `cache/` keyed by `sha256(model + prompt + input)`. Setting `REPLAY=1` serves 100% offline from disk with zero network requests.
6. **Synthetic Data Only**: Strictly zero real customer information. The repository contains a synthetic 3-day Pakistani bakery dataset testing 6 planted real-world edge cases.
7. **Advisory Verification**: The app never claims a payment is authentic or verified in a bank account. It checks that receipts are consistent with orders. Sellers confirm final funds in their banking apps.
8. **Draft Reply by Clipboard Only**: Drafted Roman Urdu customer replies are copied to the clipboard. The application never sends messages automatically.

---

## 🏗 Pipeline Architecture

```
[ chat.txt ] + [ screenshots/ ] + [ catalog.csv ]
                    │
                    ▼
          1. parser.ts (Code)
      Android / iOS WhatsApp regex parser
                    │
                    ▼
       2. extractOrders (Gemma Text)
   Chunks of 40 with 5 sliding overlap + Zod
                    │
                    ▼
       3. readPayment (Gemma Vision)
    Receipt OCR, confidence score & txnId
                    │
                    ▼
          4. reconcile.ts (Code)
 Deterministic pricing, aliases & flag logic
        ┌───────────┴───────────┐
        ▼                       ▼
5. draftReply (Gemma)    6. export.ts (Code)
Roman Urdu replies       orders.csv & pick-list.csv
```

### 1. WhatsApp Chat Parser (`server/parser.ts`)
- Parses both **Android 24h/12h** (`21/10/2026, 14:05 - Name: text`) and **iOS** (`[21/10/26, 2:05:11 PM] Name: text`).
- Handles multi-line message continuation and strips invisible Unicode directional markers (LRM/RLM).
- Extracts attachment tags (e.g. `PAY-20261021-WA0001.jpg (file attached)`) to link screenshots to specific customers.

### 2. Order Extraction (`server/gemma.ts`)
- Evaluates customer intent, order edits (e.g. *"2 nahi 3 kardo"*), cancellations (*"order cancel karden"*), and item add-ons across message chunks.
- Validates output with `ExtractedOrdersChunkSchema` via Zod.
- Merges orders across sliding window chunks deterministically.

### 3. Payment Slip OCR (`server/gemma.ts`)
- Processes bank transfer receipts (Easypaisa, JazzCash, SadaPay, Nayapay, bank transfers) using Gemma vision.
- Extracts `amount`, `currency`, `txnId`, `senderName`, `timestamp`, `status`, and `confidence`.
- Sets unreadable or blurry fields to `null` without guessing. Flags low-confidence extractions (< 0.6).

### 4. Deterministic Reconciliation (`server/reconcile.ts`)
- Matches items against `catalog.csv` by name and pipe-separated Roman Urdu aliases (e.g. `chocolate cake | choc cake | choco cake`).
- Computes `total` and `paid` strictly with arithmetic code.
- Detects and attaches flags:
  - `SHORT_PAYMENT`: paid < total (displays both figures).
  - `OVERPAYMENT`: paid > total.
  - `DUPLICATE_TXN`: same transaction ID reused across multiple orders.
  - `MISSING_ADDRESS`: active order lacking a delivery address.
  - `UNPAID`: active order with no linked payment receipt.
  - `UNMATCHED_PAYMENT`: payment slip unable to be linked to an order.
  - `UNKNOWN_ITEM`: item requested not present in price catalog.
  - `LOW_CONFIDENCE`: OCR confidence < 0.6 or blurry slip.

### 5. Polite Roman Urdu Reply Drafter (`draftReply`)
- For any flagged order, Gemma drafts a courteous, culturally natural WhatsApp reply in the customer's language register.
- Allows tone selection (Auto, Short Balance Reminder, Request Address, Clarify Slip).
- Copy-to-clipboard functionality with zero automated sending.

### 6. Operations CSV Exports (`server/export.ts`)
- **`orders.csv`**: Contains approved customer deliveries (`name`, `phone`, `address`, `items`, `total`, `paid`, `status`).
- **`pick-list.csv`**: Kitchen baking/packaging summary aggregating total quantities needed across all approved active orders (`item`, `total_qty`).
- **Export Bundle (`.zip`)**: Compressed archive containing both verified operational sheets.
- Cancelled orders are strictly excluded from totals, pick-lists, and fulfillment exports.

---

## 🖥 User Interface

1. **Step 1: Upload Inputs**
   - Drag & drop or browse for `chat.txt`, payment images, and `catalog.csv`.
   - **1-Click Sample Dataset**: Preloads a realistic 3-day Pakistani bakery dataset with 7 orders, 5 receipts, and 6 planted edge cases.
2. **Step 2: Review & Reconcile**
   - High-level metric summary: Active Orders, Order Total, Total Paid, Short Amount, Flagged Rows, Approved Rows.
   - Comprehensive reconciliation table with red flag chips and instant inspection.
   - **Inspect & Edit Side Panel**: View highlighted raw WhatsApp messages and linked payment screenshots side-by-side with extracted fields. Every field is editable by the seller.
   - **Draft Reply Modal**: Generate or customize Roman Urdu replies with 1-click clipboard copy.
3. **Step 3: Approve & Export CSVs**
   - Direct download buttons for `orders.csv`, `pick-list.csv`, or the full `.zip` bundle.
   - Interactive preview toggling between formatted table view and raw CSV text.
   - Copy CSV directly to clipboard.
   - Hard Rule 4 lock banner preventing accidental unapproved exports.

---

## 🔄 Replay Mode & Offline Verification

Hisaab features built-in deterministic caching:
- Every prompt and input is hashed with SHA-256: `sha256(model + prompt + input)`.
- Model responses are recorded in `cache/*.json`.
- When `REPLAY=1` is configured in the environment:
  - Hisaab disconnects all outbound model network calls.
  - Responses are retrieved strictly from local cache.
  - The UI displays an amber **REPLAY ACTIVE** badge.

To test with offline replay:
```bash
REPLAY=1 npm run dev
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A valid Gemini API key (for live Gemma inference, or run in `REPLAY=1` mode)

### Installation
```bash
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your variables:
```ini
GEMINI_API_KEY="your-api-key"
GEMMA_MODEL="gemma-4-26b-a4b-it"
REPLAY="0"
PORT="3000"
```

### Running the Application
```bash
# Start full-stack development server (Express + Vite)
npm run dev

# Run unit and integration tests (28 tests covering parser, Gemma extraction, vision OCR, reconciliation, flags)
npm test

# Build for production
npm run build
npm start
```

---

## 🧪 Planted Synthetic Test Cases (`samples/`)

The included synthetic bakery dataset (`samples/chat.txt`, `samples/screenshots/`, `samples/catalog.csv`) tests 6 specific real-world scenarios:
1. **Order edited later**: Customer initially asks for 2 cakes, then amends: *"2 nahi, 3 kardo"* (correctly extracted as 3).
2. **Order cancelled**: Customer later texts *"bhai order cancel karden"* (status marked `cancelled`, excluded from pick-list).
3. **Short payment**: Customer owes Rs 3,000 for brownies and cookies, but payment slip is for Rs 2,500 (flagged `SHORT_PAYMENT`).
4. **Duplicate transaction ID**: One payment slip transaction ID is reused across two distinct orders (flagged `DUPLICATE_TXN`).
5. **Missing address**: Active order placed without delivery address (flagged `MISSING_ADDRESS`).
6. **Blurry receipt**: Screenshot with degraded legibility (tested OCR sets unreadable fields to `null` and raises `LOW_CONFIDENCE`).

---

## 📄 License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for complete terms and copyright notices.
