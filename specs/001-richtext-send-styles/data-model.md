# Phase 1 Data Model: Rich-Text Styles on POST /send

Nguồn: `spec.md` (Key Entities) + Techlead Clarify (issue #4) + `node_modules/zca-js/dist/apis/sendMessage.d.ts`. Không có storage/persistence — đây là hai shape dữ liệu trong một request/response HTTP đơn lẻ, đi thẳng qua `zaloClient.sendText()` tới `api.sendMessage()` của `zca-js`.

## Entity: StyleRange (input, từ caller)

Tương ứng "Style Range" trong `spec.md` § Key Entities. Một phần tử của mảng `styles` optional trong body `POST /send`.

| Field        | Type     | Required | Ràng buộc |
|--------------|----------|----------|-----------|
| `start`      | integer  | có       | `>= 0`; là index ký tự trong `text` nơi style bắt đầu |
| `len`        | integer  | có       | `>= 1`; số ký tự style bao phủ, tính từ `start` |
| `type`       | string   | có       | Phải thuộc `Object.values(TextStyle)` từ `zca-js` (xem bảng token bên dưới) — **giá trị chuỗi thật**, không phải tên key |
| `indentSize` | integer  | không    | Chỉ có ý nghĩa khi `type === TextStyle.Indent` (`"ind_$"`); nếu có mặt trên type khác, không bắt buộc reject theo Edge Cases của spec (giá trị bị bỏ qua khi build `Style`, xem Decision dưới) |

Ràng buộc liên-field (áp dụng cho **mỗi** entry độc lập, không phải liên-entry):
- `start + len <= text.length` (dùng độ dài `text` của cùng request).

Ràng buộc liên-entry: **không có** — overlap giữa các range được phép (spec Edge Cases: "each valid range is applied independently"), không cần resolver.

### Bảng token `type` (tham chiếu con người — nguồn thật là `TextStyle` enum runtime, không phải bảng này)

| `type` (literal) | Ý nghĩa | Ghi chú |
|---|---|---|
| `"b"` | Bold | |
| `"i"` | Italic | |
| `"u"` | Underline | |
| `"s"` | StrikeThrough | |
| `"c_db342e"` | Red | 1 trong 4 màu cố định |
| `"c_f27806"` | Orange | |
| `"c_f7b503"` | Yellow | |
| `"c_15a85f"` | Green | |
| `"f_13"` | Small | 1 trong 2 cỡ cố định |
| `"f_18"` | Big | |
| `"lst_1"` | UnorderedList | |
| `"lst_2"` | OrderedList | |
| `"ind_$"` | Indent | dùng kèm `indentSize?: number` |

### Validation Rules (FR-006, FR-007, FR-008 — all-or-nothing)

Thực hiện **trước khi** gọi `client.sendText()`, trên toàn bộ mảng `styles`:

1. Nếu `styles` có mặt trong body và không phải `Array` → reject toàn bộ request, 400.
2. Nếu `styles` là `Array` rỗng (`[]`) hoặc vắng mặt (`undefined`) → bỏ qua mọi validate còn lại, xử lý như request không có style (Decision Backward Compatibility bên dưới).
3. Với mỗi phần tử tại index `i` trong `styles` (khi mảng không rỗng):
   - `start` không phải integer hoặc `< 0` → fail, ghi rõ `index=i`, điều kiện `start`.
   - `len` không phải integer hoặc `< 1` → fail, ghi rõ `index=i`, điều kiện `len`.
   - `type` không thuộc `Object.values(TextStyle)` → fail, ghi rõ `index=i`, điều kiện `type`.
   - `start + len > text.length` → fail, ghi rõ `index=i`, điều kiện `start+len`.
4. Nếu **bất kỳ** phần tử nào fail ở bước 3 → reject **toàn bộ** request, HTTP 400, không gọi `client.sendText`, không gửi message nào (FR-007, FR-008). Response phải nêu rõ index vi phạm + điều kiện sai (SC-004) — xem `contracts/send.md` cho response shape cụ thể.
5. Nếu tất cả entry pass → tiếp tục sang bước build `Style[]` (Entity kế tiếp) rồi gọi `client.sendText()`.

## Entity: Style (output, gửi cho zca-js)

Tương ứng type `Style` thật của `zca-js` (`node_modules/zca-js/dist/apis/sendMessage.d.ts`). Được build 1-1 từ mỗi `StyleRange` đã pass validate — **không thêm field, không đổi tên field**:

```ts
type Style =
  | { start: number; len: number; st: Exclude<TextStyle, TextStyle.Indent> }
  | { start: number; len: number; st: TextStyle.Indent; indentSize?: number };
```

Mapping: `{ start: range.start, len: range.len, st: range.type }`, cộng `indentSize: range.indentSize` **chỉ khi** `range.type === TextStyle.Indent` và `range.indentSize` có mặt (giữ nguyên type signature thật của zca-js — field `indentSize` chỉ tồn tại trên nhánh `Indent` của union type).

Mảng `Style[]` kết quả được gán vào `content.styles` trong `zaloClient.js#sendText`, cùng object với `content.msg`/`content.mentions`/`content.quote` hiện có, trước khi gọi `this.api.sendMessage(content, ...)`.

## Entity: SendRequest (mở rộng)

Tương ứng "Send Request" trong `spec.md` § Key Entities — body hiện tại của `POST /send`, mở rộng thêm một field optional.

| Field        | Type            | Required | Thay đổi so với hiện tại |
|--------------|-----------------|----------|---------------------------|
| `threadId`   | string          | có       | không đổi |
| `threadType` | `"user"\|"group"` | không (default `"user"`) | không đổi |
| `text`       | string          | có       | không đổi |
| `mentions`   | array           | không    | không đổi |
| `quote`      | object          | không    | không đổi |
| `styles`     | `StyleRange[]`  | **không (mới)** | Field mới của issue #4; vắng mặt/`[]` → hành vi y hệt trước (FR-004/FR-005) |

## Quyết định Backward Compatibility (FR-004, FR-005)

Khi `styles` vắng mặt hoặc `[]`: `zaloClient.js#sendText` **không** thêm field `styles` vào `content` gửi cho `api.sendMessage` (giữ nguyên `content = { msg, mentions?, quote? }` như code hiện tại tại `zaloClient.js:890-893`) — tránh gửi `styles: []` cho zca-js một cách không cần thiết và đảm bảo response/behavior không thể phân biệt được với trước khi có feature này.

## State Transitions

Không có — đây là một request/response HTTP đơn lẻ, không có entity nào có vòng đời/state machine.
