## 📌 Mục tiêu
Closes #1

Cho phép Hermes gửi tin nhắn có định dạng qua Zalo bridge, thay vì chỉ plain text như contract `/send` hiện tại.

## ✅ Scope dự kiến
- [ ] Xác nhận capability định dạng mà `zca-js` thực sự hỗ trợ cho `sendMessage`
- [ ] Thiết kế contract outbound mới giữa Hermes adapter ↔ Node bridge cho formatted message
- [ ] Giữ backward compatibility cho payload cũ chỉ có `text`
- [ ] Cập nhật `server.js` và `zaloClient.js` để nhận/truyền rich payload
- [ ] Cập nhật `hermes-plugin/adapter.py` để có đường gửi formatted message phù hợp
- [ ] Cập nhật README/API docs cho `/send`
- [ ] Thêm kiểm chứng tối thiểu cho serialization / fallback behavior

## 🔎 Evidence hiện tại
- Issue #1 đang open, assignee `vh-agent`
- Chưa có branch/PR nào liên quan issue #1 trên remote
- `server.js` hiện nhận `/send` body: `{ threadId, threadType, text, mentions?, quote? }`
- `zaloClient.js` hiện map outbound thành `{ msg, mentions, quote }` rồi gọi `api.sendMessage(...)`
- `hermes-plugin/adapter.py` hiện chỉ POST `/send` với `{ text }`

## ⚠️ Rủi ro / câu hỏi kỹ thuật
- Cần xác nhận shape rich-format chính xác mà `zca-js`/Zalo chấp nhận khi gửi
- Cần chọn API contract sao cho không phá adapter hiện tại
- Có thể cần fallback về plain text nếu platform/runtime không hỗ trợ rich-format đầy đủ

## 🧪 Verification plan
- [ ] Chạy kiểm tra tĩnh / smoke test cho đường serialize payload
- [ ] Verify payload cũ vẫn gửi được plain text
- [ ] Verify payload mới được map đúng qua bridge layers

## 📝 Ghi chú workflow v2
PR này được tạo ở trạng thái draft để làm source-of-truth cho issue mới trước khi implementation hoàn tất.
