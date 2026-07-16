# Spec — Issue #4: Formatted-message rich text qua `POST /send`

- Issue: `meninstack/hermes-zalo-plugin#4`
- Branch: `feat/issue-4`
- Repo path: `/opt/data/workspace/hoa-agent-workspace/hermes-zalo-plugin/.worktrees/issue-4`
- Current step: Specify (Gate: bypass)
- Nguồn sự thật: issue body (PM Refined Requirement đã approve + Techlead Clarify đã chốt). File này chỉ materialize lại contract đó thành artifact repo cho downstream (Plan/Task/Implement), không thêm quyết định mới.

## Mục tiêu

Cho `POST /send` hỗ trợ rich text dựa trực tiếp trên `zca-js@2.1.2` `MessageContent.styles` / `TextStyle`, giữ backward-compatible 100% cho caller cũ chỉ gửi `text`.

## Contract đã chốt (Techlead)

`POST /send` body hiện tại (`server.js:309-322`, `zaloClient.js:890-895`):

```
{ threadId, threadType?: "user"|"group", text, mentions?, quote? }
```

Thêm optional field mới, không đổi field cũ:

```
{ threadId, threadType?, text, mentions?, quote?, styles?: Style[] }

Style = { start: number, len: number, type: TextStyleToken, indentSize?: number }
```

- `type` phải là một trong các giá trị chuỗi thật của `TextStyle` enum (`node_modules/zca-js/dist/apis/sendMessage.d.ts:19-31`):
  `"b"` (Bold), `"i"` (Italic), `"u"` (Underline), `"s"` (StrikeThrough),
  `"c_db342e"` (Red), `"c_f27806"` (Orange), `"c_f7b503"` (Yellow), `"c_15a85f"` (Green),
  `"f_13"` (Small), `"f_18"` (Big), `"lst_1"` (UnorderedList), `"lst_2"` (OrderedList), `"ind_$"` (Indent).
- Không custom màu/cỡ ngoài enum trên. Không nhận Markdown/HTML.
- Map 1 phần tử input → 1 phần tử `Style` của zca-js: `{ start, len, st: type, ...(type === "ind_$" ? { indentSize } : {}) }`.

## Validate (reject toàn bộ request bằng `400` nếu bất kỳ điều kiện sau vi phạm)

- `styles` khi có mặt phải là array (không phải object/string/…).
- Mỗi phần tử: `start` là integer `>= 0`; `len` là integer `>= 1`; `type` ∈ danh sách 12 token hợp lệ ở trên.
- `start + len <= String(text).length`.
- `styles` không có mặt, hoặc `[]` → hành vi y như hiện tại (không đổi output/side-effect).
- Lỗi validate trả `400` với message rõ ràng field/index nào sai (không trả `500`).

## Acceptance Criteria (từ issue body, PM Refined + Techlead)

1. `POST /send` nhận thêm optional `styles` theo schema trên.
2. Không truyền `styles` (hoặc `styles: []`) → plain-text hiện tại không đổi hành vi/response.
3. Có `styles` hợp lệ → verify thủ công tin nhắn hiển thị đúng style trên Zalo client.
4. `styles` invalid (start/len/type/offset sai) → response lỗi rõ ràng, status `400`, không gửi message xuống Zalo.

## Điểm chạm code hiện tại (evidence, chưa sửa — dành cho Plan/Implement)

- `server.js:309-322` — route `/send`, hiện chỉ destructure `{ threadId, threadType, text, mentions, quote }`, luôn `res.status(500)` khi `client.sendText` throw (cần phân nhánh 400 cho lỗi validate `styles`, theo đúng cách issue #1 v2 đã làm ở `server.js` — xem phần "Prior art" dưới).
- `zaloClient.js:890-895` — `sendText(threadId, threadType, text, mentions, quote)` dựng `content = { msg, mentions?, quote? }` rồi gọi `this.api.sendMessage(content, ...)`. Cần thêm tham số `styles` và build `content.styles` theo `Style[]` của zca-js sau khi validate.
- `README.md:205`, `README.vi.md` (dòng tương ứng) — mô tả `/send` hiện tại chỉ có `{ threadId, threadType, text, mentions?, quote? }`, cần cập nhật thêm `styles?` khi implement.

## Prior art liên quan — KHÔNG tái dùng thiết kế

Nhánh `feat/issue-1-formatted-message-v2` (issue #1, cùng chủ đề "formatted message") đã có một implementation trước đó với **thiết kế khác và không còn là contract hiện hành**:

- Dùng `format: { version: 1, segments: [{ text, styles: ["bold", "italic", ...] }] }` (segment-based, style token dạng tên tiếng Anh tự đặt: `bold`, `italic`, …) — khác hoàn toàn với contract offset-based `styles: [{start,len,type,indentSize?}]` mà Techlead đã chốt cho issue #4.
- Chỉ map được 10/12 `TextStyle` (thiếu `UnorderedList`, `OrderedList`, không hỗ trợ `Indent`/`indentSize`).
- Nhánh này chưa merge vào `main` và không phải nguồn sự thật cho issue #4.

→ Plan/Implement cho issue #4 phải theo contract offset-based ở trên, không copy code/schema từ `feat/issue-1-formatted-message-v2`. Có thể tham khảo cách nhánh đó phân nhánh lỗi 400 vs 500 ở `server.js` làm gợi ý pattern, nhưng schema thì khác.

## Ngoài scope

- Custom màu/cỡ ngoài 12 giá trị enum của `TextStyle`.
- Markdown/HTML parsing phía server.
- Sửa `hermes-plugin/adapter.py` hoặc bất kỳ call-site Hermes nào (không nằm trong issue body hiện tại; chỉ contract HTTP `/send` của bridge).

## Bàn giao cho downstream

- **Plan/Task (Tech Lead):** dựa trên contract + validate rules ở trên để breakdown implementation trong `server.js` + `zaloClient.js`, cập nhật `README.md`/`README.vi.md`.
- **Implement (Dev):** không cần refine thêm requirement; mọi câu hỏi field/type đã được Techlead trả lời trong issue body, replicate ở trên.
- **QA verify:** dùng 4 Acceptance Criteria ở trên làm test case, bao gồm test thủ công hiển thị style trên Zalo client thật.
