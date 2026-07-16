# Implementation Plan: Rich-Text Styles on POST /send

**Branch**: `feat/issue-4` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-richtext-send-styles/spec.md`, technical boundary chốt tại Techlead Clarify (issue #4 body, section "Techlead Clarify").

## Summary

`POST /send` nhận thêm field optional `styles?: [{ start, len, type, indentSize? }]`. `type` là giá trị chuỗi thật (literal) của `TextStyle` enum trong `zca-js@2.1.2` — không có bảng dịch riêng phía Hermes. Server validate toàn bộ mảng `styles` (all-or-nothing) trước khi gọi `client.sendText`; nếu hợp lệ, `zaloClient.js#sendText` build `Style[]` (`{ start, len, st: type, indentSize? }`) và gán vào `content.styles` trước khi gọi `api.sendMessage`. Không truyền `styles` (hoặc `[]`) → hành vi y hệt hiện tại. Không thêm dependency, không parser Markdown/HTML, không abstraction/enum trùng lặp — validate bằng cách import trực tiếp `TextStyle` từ `zca-js` và so khớp `Object.values(TextStyle)`.

## Technical Context

**Language/Version**: Node.js >= 18 (ESM, `"type": "module"` trong `package.json`), JavaScript (không TypeScript).

**Primary Dependencies**: `express` (route `/send` hiện có tại `server.js`), `zca-js@2.1.2` (`TextStyle` enum, `Style`, `MessageContent.styles`, `api.sendMessage`) — cả hai đã là dependency sẵn có, **không thêm dependency mới**.

**Storage**: N/A — request đi thẳng qua `zaloClient.sendText()` tới `client.api.sendMessage()`, không có persistence layer cho styles.

**Testing**: Không có test suite sẵn trong repo (không `*.test.js`, không test script trong `package.json`). Chọn Node built-in test runner (`node:test` + `node:assert`) — có sẵn từ Node 18+, **không thêm dev dependency mới** (xem `research.md` Decision #3).

**Target Platform**: Linux/macOS/Windows server process chạy `server.js` (cross-platform, theo mô tả package hiện tại).

**Project Type**: Single project — Express HTTP bridge (`server.js`) + client wrapper (`zaloClient.js`), không có frontend riêng.

**Performance Goals**: Không có yêu cầu hiệu năng mới ngoài hiện trạng; validate `styles` là vòng lặp O(n) theo số entry, không ảnh hưởng đáng kể tới latency `/send`.

**Constraints**: Không markdown/html parser; không custom màu/cỡ ngoài 13 token cố định; không overlap resolver; không đổi response shape/behavior khi `styles` vắng mặt hoặc rỗng (backward-compatible, FR-004/FR-005); validate phải all-or-nothing, lỗi validate trả 400 (không 500) — FR-006–FR-008.

**Scale/Scope**: Thay đổi tối thiểu 2 file nguồn (`server.js`, `zaloClient.js`) + test tối thiểu cho validation/backward-compat; không đổi các route khác (`/send-attachment`, v.v.).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` trong repo này vẫn là template placeholder chưa được ratify (`[PROJECT_NAME] Constitution`, chưa điền nguyên tắc cụ thể) — không có gate ràng buộc nào để đối chiếu. Không có vi phạm nào để track; áp dụng nguyên tắc mặc định của workflow này (Ponytail/full — không abstraction dư, không dependency mới, thay đổi tối thiểu), đã phản ánh trong Summary/Technical Context ở trên. **PASS** (không có gate nào từ constitution để fail).

Re-check sau Phase 1: không có entity/contract mới nào phát sinh vi phạm (xem `data-model.md`, `contracts/`) — **PASS**, không cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-richtext-send-styles/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── send.md          # Phase 1 output — contract cho POST /send (request/response/error shape)
├── checklists/
│   └── requirements.md  # Đã tạo ở bước Specify
└── tasks.md              # Phase 2 output (/speckit-tasks — CHƯA tạo ở bước Plan này)
```

### Source Code (repository root)

Repo hiện tại là **single project** (Node.js Express bridge, không frontend riêng): route HTTP nằm trong `server.js`, logic gọi zca-js nằm trong `zaloClient.js`. Không có thư mục `src/`/`tests/` sẵn có — giữ nguyên layout phẳng ở repo root.

```text
server.js          # route POST /send (dòng ~306-322): parse + validate `styles`, giữ nguyên
                    # `threadId`/`threadType`/`text`/`mentions`/`quote`
zaloClient.js       # sendText(threadId, threadType, text, mentions, quote, styles?) (dòng ~890-895):
                    # build content.styles = Style[] từ styles đã validate, forward vào api.sendMessage
zaloClient.test.js  # (mới, tối thiểu) — unit test validate() + build Style[] + backward-compat,
                    # dùng node:test + node:assert (không cần khởi động server thật)
```

**Structure Decision**: Giữ nguyên layout phẳng hiện có của repo (không tạo `src/`, không tách module mới). Validate logic đặt cùng chỗ với route `/send` trong `server.js` (nơi request body được nhận), vì đây là input-boundary validation — không cần một service/lib riêng cho một hàm validate ~10 dòng. Việc build `Style[]` cho zca-js đặt trong `zaloClient.js#sendText` vì đó là nơi duy nhất gọi `api.sendMessage` — tránh trùng lặp logic mapping ở hai nơi.

## Complexity Tracking

> Không có vi phạm Constitution Check nào cần justify — bảng này để trống theo đúng hướng dẫn template ("Fill ONLY if Constitution Check has violations").
