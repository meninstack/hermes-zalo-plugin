# Quickstart: Validate Rich-Text Styles on POST /send

Hướng dẫn chạy thử/validate feature end-to-end sau khi Implement xong. Không chứa code implementation đầy đủ — chỉ lệnh chạy và kết quả kỳ vọng. Xem `contracts/send.md` cho request/response shape đầy đủ, `data-model.md` cho validation rules chi tiết.

## Prerequisites

- Node.js >= 18 (theo `engines` trong `package.json`).
- Server đã login Zalo thành công (`node login.mjs` hoặc qua `install.mjs`), `client.loggedIn === true` (route `/send` trả `503` nếu chưa login — hành vi hiện có, không đổi).
- Server đang chạy: `npm start` (tương đương `node server.js`), lắng nghe cổng cấu hình sẵn (`.env`/config hiện có của repo).
- Có `threadId` hợp lệ (user hoặc group) để gửi test tới — dùng chính tài khoản/test group của người verify thủ công.

## Bước 1 — Unit test tối thiểu (validation + backward-compat)

Chạy sau khi Implement thêm `zaloClient.test.js` (xem `research.md` Decision #3 — `node:test` built-in, không cần cài thêm gì):

```bash
node --test zaloClient.test.js
```

Kỳ vọng: tất cả case pass, tối thiểu cover:
- `styles` omitted / `[]` → không đổi hành vi build `content` (không có field `styles`).
- Mỗi điều kiện validate riêng lẻ (`start` âm/không phải integer, `len < 1`, `type` ngoài enum, `start+len > text.length`) → reject với message nêu rõ index + điều kiện.
- Một entry hợp lệ + một entry sai trong cùng mảng → toàn bộ request reject (all-or-nothing).
- Mapping `type -> st` đúng 1-1 cho ít nhất vài token đại diện (`"b"`, `"c_db342e"`, `"ind_$"` kèm `indentSize`).

## Bước 2 — Smoke test qua HTTP (backward-compat, không style)

```bash
curl -sS -X POST http://localhost:<PORT>/send \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"threadId":"<THREAD_ID>","threadType":"user","text":"hello plain text"}'
```

Kỳ vọng: `{"success":true,"result":{...}}`, tin nhắn "hello plain text" xuất hiện plain text trên Zalo client — **không khác gì hành vi trước khi có feature này** (SC-001).

## Bước 3 — Smoke test với styles hợp lệ (manual visual verify — SC-003)

```bash
curl -sS -X POST http://localhost:<PORT>/send \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{
    "threadId":"<THREAD_ID>",
    "threadType":"user",
    "text":"Bold Red Indented",
    "styles":[
      {"start":0,"len":4,"type":"b"},
      {"start":5,"len":3,"type":"c_db342e"},
      {"start":9,"len":9,"type":"ind_$","indentSize":2}
    ]
  }'
```

Kỳ vọng: HTTP 200 `{"success":true,...}`. **Verify thủ công bằng mắt** trên client Zalo thật (theo Assumption của spec — không có automated rendering test trong scope):
- "Bold" hiển thị đậm.
- "Red" hiển thị màu đỏ (`c_db342e`).
- "Indented" thụt lề theo `indentSize: 2`.

Ghi lại evidence (screenshot hoặc mô tả log) cho bước QA verify sau — đây là bằng chứng bắt buộc, không chỉ dựa vào unit test pass (theo QA Clarify outcome trong issue #4).

## Bước 4 — Smoke test reject khi styles sai (SC-002, SC-004)

```bash
curl -sS -X POST http://localhost:<PORT>/send \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"threadId":"<THREAD_ID>","threadType":"user","text":"short","styles":[{"start":0,"len":100,"type":"b"}]}'
```

Kỳ vọng: HTTP 400, body nêu rõ index `0` và điều kiện `start + len` vượt `text.length` (xem `contracts/send.md` cho message format), **không có message nào được gửi tới Zalo** — verify bằng cách kiểm tra thread không nhận tin nhắn mới nào tương ứng.

## Bước 5 — Regression: mentions/quote vẫn hoạt động cùng styles (FR-010)

Lặp lại Bước 3 nhưng thêm `mentions` (group thread) hoặc `quote` (reply một tin nhắn đã nhận) vào cùng body — xác nhận cả style lẫn mention/quote đều render đúng, không cái nào bị mất do cái kia.

## Done Criteria

- Bước 1 pass (unit test xanh).
- Bước 2, 4 pass qua HTTP thật (hoặc môi trường staging tương đương).
- Bước 3, 5 có evidence verify thủ công (screenshot/log) đính kèm khi báo cáo QA verify.
