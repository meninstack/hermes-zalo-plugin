# Contract: `POST /send` (extended with `styles`)

**Nguồn**: `server.js` route hiện tại (`POST /send`, ~dòng 306-322) + `data-model.md` + Techlead Clarify (issue #4). Đây là bản mô tả contract HTTP, không phải code — Task/Implement hiện thực đúng theo shape này, không tự thêm/bớt field.

## Request

`POST /send`

Auth: giữ nguyên cơ chế `checkAuth(req, res)` hiện có (không đổi).

Body (JSON):

```jsonc
{
  "threadId": "string",            // required — không đổi
  "threadType": "user" | "group",  // optional, default "user" — không đổi
  "text": "string",                 // required — không đổi
  "mentions": [ { "pos": 0, "uid": "string", "len": 0 } ],  // optional — không đổi
  "quote": { /* SendMessageQuote — không đổi */ },
  "styles": [                        // optional, MỚI (issue #4) — mảng rỗng hoặc vắng mặt = không style
    {
      "start": 0,                    // integer, >= 0, required nếu có entry
      "len": 1,                      // integer, >= 1, required nếu có entry
      "type": "b",                   // string literal thật của TextStyle enum (zca-js) — xem data-model.md
      "indentSize": 2                 // integer, optional, chỉ có ý nghĩa khi type === "ind_$"
    }
  ]
}
```

Ràng buộc:
- Nếu `styles` vắng mặt hoặc `[]` → request xử lý y hệt hành vi hiện tại (không style).
- Nếu `styles` có entry → toàn bộ mảng phải pass validate (xem `data-model.md` § Validation Rules) trước khi bất kỳ message nào được gửi.

## Response — thành công (200)

Không đổi so với hiện tại:

```jsonc
{
  "success": true,
  "result": { /* SendMessageResponse từ zca-js, không đổi shape */ }
}
```

## Response — lỗi input hiện có (400, không đổi)

```jsonc
{ "error": "threadId and text required" }
```

## Response — lỗi validate `styles` (400, MỚI)

Khi `styles` present nhưng không phải Array:

```jsonc
{ "error": "styles must be an array" }
```

Khi `styles` là Array nhưng có (các) entry sai — phải nêu rõ **index** và **điều kiện vi phạm** (SC-004: integrator xác định được lỗi chỉ từ response, không cần xem log server):

```jsonc
{
  "error": "invalid styles entry at index 0: start must be an integer >= 0"
}
```

Các thông điệp lỗi tương ứng theo điều kiện vi phạm tại từng `index`:
- `"invalid styles entry at index {i}: start must be an integer >= 0"`
- `"invalid styles entry at index {i}: len must be an integer >= 1"`
- `"invalid styles entry at index {i}: type must be one of the supported TextStyle values"`
- `"invalid styles entry at index {i}: start + len must not exceed text length"`

Trong mọi trường hợp lỗi validate `styles`: HTTP status **400** (không phải 500), **không** gọi `client.sendText`, **không** message nào được gửi tới Zalo (FR-007, FR-008).

## Response — lỗi delivery hiện có (500, không đổi)

Giữ nguyên hành vi hiện tại của route: lỗi phát sinh từ `client.sendText()` (network/API lỗi phía zca-js) vẫn trả 500 với `{ error: String(e.message || e) }` — đây là lỗi delivery, khác với lỗi validate input (400).

## Backward Compatibility Contract

Một request không có field `styles` (hoặc `styles: []`) phải:
1. Được xử lý qua đúng cùng code path hiện tại (`client.sendText(threadId, threadType, text, mentions, quote)`), không có nhánh rẽ mới nào chèn vào giữa.
2. Trả về response identical về shape và nội dung so với hành vi trước khi có feature này (SC-001).

## Out of scope (không đổi trong contract này)

`/send-attachment` và các route khác không thay đổi. `urgency`, `ttl`, `attachments` trên `MessageContent` của zca-js không nằm trong scope contract này (Non-goals của spec).
