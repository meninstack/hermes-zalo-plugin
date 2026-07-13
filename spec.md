# Spec — Issue #1: Formatted message v2

- Issue: `meninstack/hermes-zalo-plugin#1`
- Branch: `feat/issue-1-formatted-message-v2`
- Repo path: `/opt/data/workspace/hoa-agent-workspace/hermes-zalo-plugin/.worktrees/issue-1`

## Mục tiêu
Cho phép outbound `/send` hỗ trợ rich/formatted text của `zca-js` thay vì chỉ `text` plain hiện tại, nhưng vẫn giữ backward compatibility cho caller cũ.

## Evidence đã verify
1. `zca-js` `sendMessage` hỗ trợ `styles?: Style[]` trong `MessageContent` (`node_modules/zca-js/dist/apis/sendMessage.d.ts`).
2. `TextStyle` hiện có: `Bold`, `Italic`, `Underline`, `StrikeThrough`, `Red`, `Orange`, `Yellow`, `Green`, `Small`, `Big`, `UnorderedList`, `OrderedList`, `Indent`.
3. Bridge hiện chỉ dựng payload `{ msg, mentions?, quote? }` tại `zaloClient.js:890-895`.
4. HTTP route `/send` hiện chỉ nhận `{ threadId, threadType, text, mentions?, quote? }` tại `server.js:306-318`.
5. Hermes adapter hiện `POST /send` với body chỉ có `{ threadId, threadType, text }` tại `hermes-plugin/adapter.py:716-748`.
6. README/README.vi hiện document `/send` chỉ có `text, mentions?, quote?`.

## Scope implementation dự kiến
- Mở rộng contract `POST /send` để nhận thêm rich payload tối thiểu:
  - `text` vẫn là required source text
  - `styles?: [{ start, len, st, indentSize? }]`
  - `mentions?`, `quote?` giữ nguyên
  - chưa cần expose `urgency`, `ttl`, `attachments` trong scope issue này trừ khi implementation buộc phải chạm
- Bridge validate/pass-through `styles` xuống `api.sendMessage(...)`
- Hermes adapter bổ sung đường gửi payload formatted khi metadata/call-site có truyền rich text
- Backward compatibility: caller cũ chỉ gửi `text` phải hoạt động y như trước
- Cập nhật docs API cho `/send`
- Thêm kiểm chứng tối thiểu cho serialization/fallback behavior

## Rủi ro / câu hỏi kỹ thuật hiện tại
- Chưa thấy test framework sẵn trong repo; cần chọn kiểm chứng tối thiểu phù hợp (ví dụ node smoke script hoặc `node --test` nếu muốn thêm nhẹ).
- Cần inspect tiếp call path phía Hermes để xác định rich payload nên đi qua `metadata` hay helper mới để không phá interface hiện có.
- Cần quyết định mức validate server-side cho `styles` (shape-only vs full range validation).

## Kế hoạch verify
- Verify payload cũ `/send` với plain text vẫn map sang `client.sendText(...)` thành công.
- Verify payload mới có `styles` được truyền nguyên xuống `api.sendMessage`.
- Verify docs `/send` mô tả đúng schema mới.
- Chạy kiểm chứng repo phù hợp sau khi sửa.

## Checklist bootstrap / execution gates
- [x] Xác nhận worktree/branch cho issue #1: `feat/issue-1-formatted-message-v2`
- [x] Xác nhận issue #1 là source-of-truth bootstrap
- [x] Inspect boundary hiện tại ở `server.js`, `zaloClient.js`, `hermes-plugin/adapter.py`
- [x] Verify `zca-js` thực sự hỗ trợ `styles`
- [x] Tạo spec artifact tối thiểu trong repo (`spec.md`)
- [ ] Chờ approve bootstrap scope trước khi implement code
- [ ] Implement server/client/adapter support cho `styles`
- [ ] Cập nhật README / README.vi cho contract mới của `/send`
- [ ] Chạy kiểm chứng phù hợp và lưu evidence

## Gate hiện tại
- **Gate name:** Bootstrap approval
- **Status:** Chờ user approve để vào implementation
- **Approval câu hỏi:** Có approve bootstrap scope hiện tại để em chuyển sang implement formatted message v2 theo `spec.md` không?

## Ngoài scope hiện tại
- UI/DSL authoring cho markdown → Zalo styles.
- Expose toàn bộ `zca-js` fields như `urgency`, `ttl`, attachment-rich message trong cùng issue này.
- Refactor lớn adapter/public API ngoài phần cần để mở rich text.
