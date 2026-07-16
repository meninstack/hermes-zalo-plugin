# Phase 0 Research: Rich-Text Styles on POST /send

Không còn `NEEDS CLARIFICATION` nào trong Technical Context của `plan.md` — spec đã pass Speckit clarify (Techlead Clarify, issue #4) và checklist `requirements.md` (16/16 pass). Research dưới đây ghi lại các quyết định kỹ thuật đã chốt, để Task/Implement không phải tự suy diễn lại.

## Decision #1: Nguồn sự thật cho tập style token là `TextStyle` enum trong `zca-js`, import trực tiếp — không tạo bảng dịch riêng

- **Decision**: `type` trong request body `/send` phải là đúng giá trị chuỗi (literal) của `TextStyle` enum export bởi `zca-js@2.1.2`. Validate bằng cách `import { TextStyle } from "zca-js"` (cùng cách import hiện có ở `zaloClient.js:8`: `import { Zalo, ThreadType, LoginQRCallbackEventType, Reactions } from "zca-js"`) rồi so khớp `Object.values(TextStyle)` — không hard-code lại danh sách 13 token thành một mảng/enum riêng của Hermes.
- **Rationale**: Nếu `zca-js` thêm/đổi token ở version sau, validate tự động theo kịp mà không cần sửa code Hermes ở hai chỗ (spec đã ghi rõ 13 token cố định làm tài liệu tham khảo cho con người, nhưng validate runtime phải bám nguồn thật). Tránh lệch giữa "bảng dịch" nội bộ và enum thật — đúng nguyên tắc Ponytail "không abstraction dư".
- **Nguồn xác thực**: `node_modules/zca-js/dist/apis/sendMessage.d.ts` (đã đọc trực tiếp ở bước Techlead Clarify và lại ở bước Plan này):
  ```ts
  export declare enum TextStyle {
      Bold = "b", Italic = "i", Underline = "u", StrikeThrough = "s",
      Red = "c_db342e", Orange = "c_f27806", Yellow = "c_f7b503", Green = "c_15a85f",
      Small = "f_13", Big = "f_18",
      UnorderedList = "lst_1", OrderedList = "lst_2",
      Indent = "ind_$"
  }
  export type Style = { start: number; len: number; st: Exclude<TextStyle, TextStyle.Indent> }
    | { start: number; len: number; st: TextStyle.Indent; indentSize?: number };
  ```
- **Alternatives considered**:
  - Hard-code lại 13 chuỗi trong một enum riêng của Hermes → bị loại: tạo hai nguồn sự thật, rủi ro lệch khi `zca-js` cập nhật, và là abstraction dư thừa không cần thiết cho một object literal 13 giá trị đã tồn tại sẵn.
  - Cho phép caller truyền tên key (`"Bold"`, `"Italic"`...) rồi Hermes tự map sang `st` → bị loại ở bước Techlead Clarify: thêm một lớp đặt tên thứ hai, vi phạm yêu cầu "map 1-1, không bảng dịch riêng".

## Decision #2: Range-based (`start`/`len`) thay vì markdown-like syntax

- **Decision**: `styles` nhận theo range offset (`start`, `len`) trên chuỗi `text` thô, giống hệt cấu trúc `Style` của zca-js — không có cú pháp đánh dấu kiểu markdown (`**bold**`) để server tự parse.
- **Rationale**: Đây là câu hỏi PM đặt ra ở Refine Requirement, đã được Techlead chốt: range-based tránh phải viết parser Markdown/HTML (bị cấm rõ trong Non-goals/FR-003), và map thẳng 1-1 sang input mà `api.sendMessage` cần — không có bước convert trung gian, giảm bề mặt lỗi.
- **Alternatives considered**: Markdown-like syntax phía Hermes rồi server tự convert sang range → bị loại vì kéo theo một parser mới (vi phạm "không parser Markdown/HTML" và "không dependency mới"), và làm tăng bề mặt lỗi (ký tự escape, nested syntax) không cần thiết cho scope issue này.

## Decision #3: Test tối thiểu bằng `node:test` built-in, không thêm dev dependency

- **Decision**: Dùng module built-in của Node (`node:test`, `node:assert`) để viết unit test tối thiểu cho: (a) validate `styles` (mọi điều kiện FR-006/FR-007/FR-008), (b) backward-compat khi `styles` omitted/`[]` (FR-004/FR-005), (c) mapping `type -> st` khi build `Style[]`.
- **Rationale**: Repo hiện không có test suite (`*.test.js`) và không có framework test nào trong `package.json` (`dependencies`/không có `devDependencies` test). Thêm Jest/Vitest/Mocha sẽ là dependency mới không cần thiết — vi phạm ràng buộc "không dependency mới" của issue. Node >= 18 (đã là `engines` requirement hiện tại của package) có `node:test` built-in, đủ cho unit test đồng bộ/bất đồng bộ đơn giản này.
- **Alternatives considered**: Thêm Jest/Vitest → bị loại (dependency mới không cần thiết cho vài chục dòng test). Không viết test nào → bị loại vì QA Clarify (issue #4) đã yêu cầu rõ unit test cho validation + regression backward-compat là điều kiện bắt buộc trước khi qua QA verify.

## Decision #4: Vị trí đặt logic validate + mapping

- **Decision**: Hàm validate `styles` đặt trong `server.js` ngay tại route `POST /send` (input-boundary validation, cùng chỗ với validate `threadId`/`text` hiện có ở dòng 306-312). Hàm build `Style[]` cho zca-js đặt trong `zaloClient.js#sendText` (dòng ~890-895), vì đây là nơi duy nhất build `content` object trước khi gọi `api.sendMessage`.
- **Rationale**: Tránh tạo file/module mới chỉ để chứa 1-2 hàm nhỏ (vi phạm "không abstraction dư"). `sendText()` đã nhận `mentions`/`quote` theo đúng pattern optional-arg này — thêm tham số `styles` theo cùng convention, không đổi signature style hiện có.
- **Alternatives considered**: Tạo file `styles.js`/`richtext.js` riêng làm "helper module" → bị loại: quy mô logic (một vòng lặp validate + một map 1-1) không đủ lớn để tách module, và spec/Techlead Clarify đã nói rõ "chỉ cần sửa `server.js` và `zaloClient.js`".

## Kết luận

Không còn NEEDS CLARIFICATION. Tất cả quyết định trên đã bám trực tiếp: (1) spec.md + checklist đã pass, (2) Techlead Clarify outcome trong issue #4, (3) mã nguồn thật hiện tại (`server.js`, `zaloClient.js`), (4) `node_modules/zca-js/dist/apis/sendMessage.d.ts`. Sẵn sàng cho Phase 1.
