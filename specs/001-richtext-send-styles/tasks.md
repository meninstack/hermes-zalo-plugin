---

description: "Task list template for feature implementation"
---

# Tasks: Rich-Text Styles on POST /send

**Input**: Design documents from `specs/001-richtext-send-styles/` (plan.md, spec.md, research.md, data-model.md, contracts/send.md, quickstart.md)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/send.md — tất cả đã có, đã đọc.

**Tests**: Repo hiện không có test suite; QA Clarify (issue #4) yêu cầu rõ unit test cho validation + backward-compat. Dùng `node:test`/`node:assert` built-in (research.md Decision #3) — không thêm dev dependency.

**Organization**: Task được nhóm theo 3 user story trong `spec.md` (US1 P1, US2 P1, US3 P2). Không có Setup/Foundational phase riêng — đây là thay đổi tối thiểu 2 file đã tồn tại (`server.js`, `zaloClient.js`), không cần khởi tạo project/dependency mới.

## Path Conventions

Single project, layout phẳng ở repo root (không `src/`/`tests/`): `server.js`, `zaloClient.js`, `zaloClient.test.js` (file test mới, cùng cấp).

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Hạ tầng tối thiểu bắt buộc trước khi bất kỳ user story nào có thể implement — import `TextStyle` làm nguồn thật cho validate, và mở rộng signature `sendText` để nhận `styles`.

**⚠️ CRITICAL**: Không user story nào được implement trước khi phase này xong.

- [ ] T001 Import `TextStyle` từ `zca-js` trong `zaloClient.js` (mở rộng dòng `import { Zalo, ThreadType, LoginQRCallbackEventType, Reactions } from "zca-js";` tại `zaloClient.js:8` để thêm `TextStyle`) — nguồn thật duy nhất cho tập token hợp lệ, không tạo bảng dịch riêng (research.md Decision #1)
- [ ] T002 Mở rộng signature `sendText(threadId, threadType, text, mentions, quote)` trong `zaloClient.js:890` thành `sendText(threadId, threadType, text, mentions, quote, styles)` — build `content.styles` từ `styles` đã validate (map `{ start, len, st: type }`, cộng `indentSize` chỉ khi `type === TextStyle.Indent` và có mặt), **không** thêm field `content.styles` khi `styles` rỗng/undefined (data-model.md § Backward Compatibility)

**Checkpoint**: `zaloClient.js#sendText` sẵn sàng nhận `styles` optional; route `/send` có thể gọi với tham số mới ở các phase sau.

---

## Phase 2: User Story 2 - Existing plain-text callers keep working unchanged (Priority: P1)

**Goal**: Request không có `styles` (hoặc `styles: []`) phải hành xử y hệt hiện tại — response shape, delivered message không đổi.

**Independent Test**: Gửi request `{ threadId, threadType, text, mentions?, quote? }` không có `styles` → response/hành vi giống hệt trước khi có feature.

### Tests for User Story 2

- [ ] T003 [P] [US2] Viết test trong `zaloClient.test.js` (mới, `node:test`): `sendText(...)` khi `styles` là `undefined` hoặc `[]` → `content` gửi cho `api.sendMessage` KHÔNG có field `styles` (mock `this.api.sendMessage` để assert `content` argument) — cover FR-004, FR-005, SC-001

### Implementation for User Story 2

- [ ] T004 [US2] Trong `server.js:309` route `POST /send`, destructure thêm `styles` từ `req.body` bên cạnh `threadId, threadType, text, mentions, quote` (giữ nguyên validate `threadId`/`text` hiện có) — chưa gọi validate styles ở task này, chỉ đảm bảo field được đọc mà không phá vỡ path hiện tại khi `styles` vắng mặt
- [ ] T005 [US2] Cập nhật lời gọi `client.sendText(threadId, threadType, text, mentions, quote)` tại `server.js` thành `client.sendText(threadId, threadType, text, mentions, quote, styles)`, xác nhận khi `styles` là `undefined` code path không đổi so với trước (phụ thuộc T002, T004)

**Checkpoint**: Request không `styles` hoạt động y hệt trước — có thể chạy `node --test zaloClient.test.js` và pass T003 độc lập với US1/US3.

---

## Phase 3: User Story 1 - Send a message with formatted text ranges (Priority: P1)

**Goal**: Request có `styles` hợp lệ → message gửi đi với đúng style trên từng range, áp dụng độc lập kể cả khi overlap.

**Independent Test**: Gửi request với `text` + `styles` hợp lệ (nhiều range, gồm 1 range `indentSize`) → HTTP 200, style build đúng 1-1 sang `Style[]` của zca-js.

### Tests for User Story 1

- [ ] T006 [P] [US1] Viết test trong `zaloClient.test.js`: `sendText(...)` với `styles` hợp lệ (nhiều entry, gồm `"b"`, `"c_db342e"`, và `"ind_$"` kèm `indentSize`) → `content.styles` build đúng mảng `{ start, len, st, indentSize? }` 1-1 theo thứ tự, `indentSize` chỉ xuất hiện trên entry `ind_$` — cover FR-009, data-model.md § Entity Style
- [ ] T007 [P] [US1] Viết test trong `zaloClient.test.js`: hai range overlap (cùng che ký tự đầu) trong `styles` hợp lệ → cả hai được build vào `content.styles` độc lập, không có resolver/reject overlap — cover spec.md Edge Cases

### Implementation for User Story 1

- [ ] T008 [US1] Trong `zaloClient.js#sendText` (từ T002), implement build `Style[]` khi `styles` là mảng non-empty đã validate: map từng entry `{ start: s.start, len: s.len, st: s.type }`, thêm `indentSize: s.indentSize` chỉ khi `s.type === TextStyle.Indent && s.indentSize !== undefined`, gán vào `content.styles` (phụ thuộc T001, T002)
- [ ] T009 [US1] Xác nhận `server.js` route `/send` (từ T005) forward `styles` đã pass validate (Phase 4) tới `client.sendText` đúng thứ tự tham số, không biến đổi thêm — chạy `node --test zaloClient.test.js` (T006, T007) để xác nhận pass (phụ thuộc T008)

**Checkpoint**: Styles hợp lệ được gửi đúng tới zca-js; kết hợp T004/T005 (US2), route `/send` giờ xử lý cả hai trường hợp có/không có `styles` qua cùng một code path.

---

## Phase 4: User Story 3 - Invalid style ranges are rejected clearly, before anything is sent (Priority: P2)

**Goal**: `styles` sai (type ngoài enum, offset âm/sai kiểu, `start+len` vượt `text.length`, hoặc không phải array) → reject 400 toàn bộ request, nêu rõ index + điều kiện, không gửi message nào.

**Independent Test**: Gửi request với `styles` chứa entry sai (từng loại lỗi riêng) → HTTP 400 với message nêu đúng index + điều kiện, không có message nào được gửi tới zca-js.

### Tests for User Story 3

- [ ] T010 [P] [US3] Viết test trong `zaloClient.test.js` cho hàm validate `styles` (import từ `server.js` hoặc test trực tiếp hàm thuần nếu export được — xem T011): mỗi điều kiện riêng lẻ theo data-model.md § Validation Rules — `styles` không phải Array; `start` không phải integer hoặc `< 0`; `len` không phải integer hoặc `< 1`; `type` ngoài `Object.values(TextStyle)`; `start + len > text.length` — mỗi case trả lỗi nêu rõ `index` + điều kiện đúng theo message format trong `contracts/send.md`
- [ ] T011 [P] [US3] Viết test trong `zaloClient.test.js`: mảng `styles` có 1 entry hợp lệ + 1 entry sai → toàn bộ request reject (all-or-nothing), không có entry nào được build vào `Style[]` — cover FR-006, FR-007, spec.md Edge Cases ("both malformed and valid → entire request rejected")

### Implementation for User Story 3

- [ ] T012 [US3] Implement hàm validate `styles` trong `server.js` tại route `POST /send` (ngay sau validate `threadId`/`text` hiện có ở `server.js:309-313`): nếu `styles` có mặt và không phải `Array` → `res.status(400).json({ error: "styles must be an array" })`, return sớm, không gọi `sendText` (data-model.md rule 1)
- [ ] T013 [US3] Trong cùng hàm validate (T012), khi `styles` là Array non-empty: loop qua từng entry theo thứ tự rule ở data-model.md § Validation Rules (`start`, `len`, `type` thuộc `Object.values(TextStyle)`, `start+len <= text.length`); entry đầu tiên fail → `res.status(400).json({ error: "invalid styles entry at index {i}: {condition message}" })` đúng 4 message format trong `contracts/send.md`, return sớm, không gọi `sendText` (phụ thuộc T001 cho `TextStyle` import trong `server.js` — thêm import riêng nếu `server.js` chưa import `TextStyle`)
- [ ] T014 [US3] Xác nhận khi `styles` rỗng/vắng mặt, validate ở T012/T013 bị bỏ qua hoàn toàn (không chạy loop, không lỗi) — không phá vỡ US2; chạy `node --test zaloClient.test.js` (T010, T011) để xác nhận pass (phụ thuộc T012, T013)

**Checkpoint**: Toàn bộ 3 user story hoạt động độc lập và cùng nhau qua route `/send` thật; `node --test zaloClient.test.js` pass toàn bộ.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Regression theo FR-010 và verify thủ công theo quickstart.md — không có code mới ngoài các phase trên.

- [ ] T015 [P] Viết test trong `zaloClient.test.js`: `sendText(...)` với cả `mentions`/`quote` VÀ `styles` hợp lệ cùng lúc → `content` có đủ `mentions`, `quote`, `styles`, không cái nào bị mất — cover FR-010
- [ ] T016 Chạy `node --test zaloClient.test.js` toàn bộ, xác nhận tất cả test (T003, T006, T007, T010, T011, T015) pass
- [ ] T017 Thực hiện Bước 2–5 trong `specs/001-richtext-send-styles/quickstart.md` (smoke test HTTP thật qua server đang chạy + verify thủ công trên Zalo client) và ghi lại evidence (screenshot/log) cho SC-003 — chuẩn bị cho QA verify

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: Không phụ thuộc gì — BLOCKS tất cả user story (T001, T002 phải xong trước T004+)
- **User Story 2 (Phase 2, P1)**: Phụ thuộc Phase 1 (T002) — không phụ thuộc US1/US3
- **User Story 1 (Phase 3, P1)**: Phụ thuộc Phase 1 (T001, T002); tái sử dụng route đã sửa ở US2 (T004, T005) nhưng không phụ thuộc logic US3
- **User Story 3 (Phase 4, P2)**: Phụ thuộc Phase 1 (T001 cho `TextStyle` import) và route đã có field `styles` (T004); độc lập về mặt implementation với T008/T009 (US1) nhưng cả hai cùng sửa `server.js`/`zaloClient.js` nên nên làm tuần tự để tránh conflict merge
- **Polish (Phase 5)**: Phụ thuộc toàn bộ Phase 2–4 hoàn tất

### Trong mỗi User Story

- Test viết trước (T003/T006-T007/T010-T011), implementation sau — test PHẢI fail trước khi implement (repo chưa có `zaloClient.test.js`, file được tạo mới ở T003)
- US2 (backward-compat) nên hoàn tất trước US1/US3 vì cả hai đều build trên cùng route/signature mà US2 thiết lập (T004, T005)

### Parallel Opportunities

- T001, T002 (Phase 1) là 2 vùng khác nhau trong cùng file `zaloClient.js` — làm tuần tự (T001 rồi T002) vì T002 dùng `TextStyle` từ T001
- T006, T007 (US1 tests) có thể chạy song song — khác test case trong cùng file mới, không phụ thuộc lẫn nhau
- T010, T011 (US3 tests) có thể chạy song song — khác test case
- T015 (Polish test) độc lập, chạy song song được với T010/T011 nếu cùng thời điểm viết test

---

## Parallel Example: User Story 1

```bash
# Sau khi Phase 1 (T001, T002) xong, hai test case này viết song song trong zaloClient.test.js:
Task: "T006 - test build Style[] cho styles hợp lệ nhiều loại token"
Task: "T007 - test overlap ranges áp dụng độc lập"
```

---

## Implementation Strategy

### MVP First (User Story 2 trước, vì P1 + rủi ro regression cao nhất)

1. Hoàn tất Phase 1: Foundational (T001, T002)
2. Hoàn tất Phase 2: User Story 2 (backward-compat) — **STOP và VALIDATE**: chạy T003, xác nhận request không `styles` không đổi hành vi
3. Hoàn tất Phase 3: User Story 1 (styles hợp lệ được áp dụng)
4. Hoàn tất Phase 4: User Story 3 (reject styles sai)
5. Hoàn tất Phase 5: Polish (regression FR-010 + quickstart verify thủ công)

### Incremental Delivery

1. Foundational xong → route `/send` sẵn sàng nhận `styles` nhưng chưa validate/build
2. US2 xong → backward-compat đảm bảo (an toàn nhất để merge trước)
3. US1 xong → giá trị cốt lõi của feature hoạt động
4. US3 xong → an toàn hoá input, hoàn thiện toàn bộ acceptance criteria của issue #4
5. Polish → regression + evidence thủ công cho QA verify

---

## Notes

- Không tạo file/module mới ngoài `zaloClient.test.js` — không dependency mới, không abstraction dư (theo Ponytail/full và plan.md § Structure Decision)
- Test dùng `node:test`/`node:assert` built-in, chạy bằng `node --test zaloClient.test.js` (research.md Decision #3, quickstart.md Bước 1)
- Validate `styles` đặt trong `server.js` (input boundary), build `Style[]` đặt trong `zaloClient.js#sendText` — không trùng lặp logic ở hai nơi (research.md Decision #4)
- Mọi entry lỗi trong `styles` → reject toàn bộ request 400, không 500, không gửi message nào (FR-006–FR-008)
- Bước verify thủ công (T017) là bắt buộc làm evidence cho QA verify — không thay thế bằng unit test (SC-003, theo Assumption của spec.md)
