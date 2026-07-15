---
description: "Task list for Preserve Image + Caption in Zalo Inbound Messages"
---

# Tasks: Preserve Image + Caption in Zalo Inbound Messages

**Input**: Design documents from `/specs/001-fix-image-caption-media/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, quickstart.md

**Tests**: No automated test tasks are generated. The spec and plan (Technical Context) explicitly scope verification to a **manual/regression pass** via `quickstart.md`; there is no automated test harness for `hermes-plugin/adapter.py` and adding one is out of scope (ponytail: fix confined to two methods).

**Organization**: Tasks are grouped by user story (P1->P3 from spec.md) so each story is independently implementable and verifiable.

**Scope guardrails (from TechLead clarify / plan.md)**:

- Only `hermes-plugin/adapter.py::_on_inbound_message` and `_download_media` may change.
- Do NOT change `zaloClient.js`, `server.js`, or the SSE/inbound event shape.
- Do NOT add a media-download proxy unless the minimal header fix is confirmed insufficient in practice - that requires escalation to TechLead, not autonomous work.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story the task belongs to (US1, US2, US3)
- Exact file paths are included in each task

## Path Conventions

- Single existing bridge+plugin project. All code changes are confined to `hermes-plugin/adapter.py` at the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare a runnable environment to reproduce and observe the bug.

- [ ] T001 Start the bridge (`npm run start`, logged in via `npm run login`) connected to `hermes-plugin` and confirm plugin log output (stdout/log sink) is visible, per `specs/001-fix-image-caption-media/quickstart.md` Prerequisites.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the real failure mode before choosing the fix - this determines whether the minimal header fix (US1) is sufficient or must be escalated.

**CRITICAL**: No user story implementation may begin until T002 is complete.

- [ ] T002 Reproduce the bug and confirm root cause in `hermes-plugin/adapter.py::_download_media` (lines 615-625): send a real image+caption message and record whether the `aiohttp` GET returns non-200 (adapter.py:619-620), raises an exception (adapter.py:623-624), or succeeds; note the exact status/exception so the US1 fix (headers) can be validated against reality.

**Checkpoint**: Root cause confirmed - if the failure is NOT header/auth related, STOP and escalate to TechLead before implementing US1 (per scope guardrails: no proxy without confirmed need).

---

## Phase 3: User Story 1 - Image with caption reaches the agent as an image (Priority: P1) MVP

**Goal**: An inbound photo+caption message reaches the downstream agent as `message_type=PHOTO` with the image in `media_urls` AND the caption preserved in `text` (FR-001..FR-004, FR-008).

**Independent Test**: `quickstart.md` Scenario 1 - send a photo with a non-empty caption; confirm the event is `PHOTO`, `media_urls` holds a readable cached image, and `text` equals the caption exactly.

### Implementation for User Story 1

- [ ] T003 [US1] In `hermes-plugin/adapter.py::_download_media` (GET at adapter.py:616-618), add the minimal request headers needed for Zalo CDN to serve the image (e.g. `User-Agent`/`Referer` matching the authenticated Node/zca-js session), only as required by the failure mode confirmed in T002; keep the existing 120s timeout and cache path unchanged.
- [ ] T004 [US1] In `hermes-plugin/adapter.py::_on_inbound_message` (adapter.py:581-591), verify a successful download sets `message_type = mtype` (PHOTO) AND keeps `text` (caption) populated, so a non-empty caption never suppresses the photo (FR-003/FR-004); adjust only if the caption path drops the media.
- [ ] T005 [US1] Validate User Story 1 via `quickstart.md` Scenario 1 (image+caption -> `PHOTO` + cached `media_urls` + exact caption text, including emoji/non-Latin per FR-008).

**Checkpoint**: US1 is the MVP - image+caption is delivered as a readable photo with caption intact.

---

## Phase 4: User Story 2 - Image download/cache failure is observable, not silent (Priority: P2)

**Goal**: When a photo fails to download or cache, an operator-visible log identifies which message failed and why, distinct from a legitimately photo-less message (FR-005, FR-006).

**Independent Test**: `quickstart.md` Scenario 2 - force a download/cache failure; confirm the log names the failed `message_id`/`thread_id` + reason, distinguishable from Scenario 3's no-media case.

### Implementation for User Story 2

- [ ] T006 [US2] Thread `message_id`/`thread_id` into the failure path: update the `_download_media` signature and its call site in `hermes-plugin/adapter.py::_on_inbound_message` (adapter.py:587) to pass the message/thread identifiers already available in `_on_inbound_message` (adapter.py:534, 597).
- [ ] T007 [US2] Enrich the three existing `logger.warning` calls in `hermes-plugin/adapter.py::_download_media` (adapter.py:620, 624, 637) to include `message_id`, `thread_id`, and the failure reason (HTTP status / request exception / cache-write exception) so a failed download is distinguishable in logs (FR-005/FR-006). Reuse the existing logger - no new logging framework or channel.
- [ ] T008 [US2] Validate User Story 2 via `quickstart.md` Scenario 2 (forced failure produces an operator-visible warning identifying the message and reason, distinct from a no-media message).

**Checkpoint**: US1 + US2 both work - successful photos are delivered, failed ones are loudly observable.

---

## Phase 5: User Story 3 - Image without caption keeps working (Priority: P3)

**Goal**: Photo-only (no caption) inbound messages still reach the agent as readable media with no regression (FR-007).

**Independent Test**: `quickstart.md` Scenario 3 - send a photo with no caption; confirm `PHOTO` + photo in `media_urls` and no unexpected text.

### Implementation for User Story 3

- [ ] T009 [US3] Validate User Story 3 (regression) via `quickstart.md` Scenario 3: photo without caption still arrives as `message_type=PHOTO` with the image in `media_urls` and empty/no text, identical to pre-fix behavior. No code change expected - file a defect against T003/T004 if regressed.

**Checkpoint**: All three stories verified; no regression on the photo-only path.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm scope boundaries held and hand off cleanly.

- [ ] T010 [P] Confirm the diff touches only `hermes-plugin/adapter.py` and that `zaloClient.js`, `server.js`, and the SSE/inbound event shape are unchanged (scope guardrail) via `git diff --name-only`.
- [ ] T011 Run the full `specs/001-fix-image-caption-media/quickstart.md` pass (Scenarios 1-3) and confirm SC-001..SC-004 are met, then add a Dev handoff note to the PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories (T002 decides the US1 fix / escalation).
- **User Stories (Phase 3-5)**: All depend on Foundational (T002).
- **Polish (Phase 6)**: Depends on all implemented stories.

### User Story Dependencies

- **US1 (P1)**: After T002. Delivers the MVP fix (download + caption preservation).
- **US2 (P2)**: After T002. T006/T007 edit the same `_download_media` method as US1's T003 -> run **after** US1 code tasks to avoid same-file conflict (not parallel with US1).
- **US3 (P3)**: After US1/US2 code tasks - it is a regression check over their changes.

### Within Each User Story

- US1: T003 -> T004 -> T005 (validate).
- US2: T006 -> T007 -> T008 (validate).
- US3: T009 (validate only).

### Parallel Opportunities

- Limited by design: US1 and US2 both edit `hermes-plugin/adapter.py::_download_media`, so their code tasks are sequential (no [P] across them).
- T010 (name-only diff check) is [P] - independent of validation runs.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (T002 root-cause confirmation).
2. Complete Phase 3 (US1): header fix + caption-preservation verify.
3. **STOP and VALIDATE** via quickstart Scenario 1 - image+caption now reaches the agent as a photo.

### Incremental Delivery

1. Setup + Foundational -> root cause known.
2. US1 -> validate Scenario 1 -> MVP (the reported bug is fixed).
3. US2 -> validate Scenario 2 -> failures are now observable.
4. US3 -> validate Scenario 3 -> confirm no regression.
5. Polish -> confirm scope boundary + full quickstart pass + handoff.

---

## Notes

- Tests: none automated by design - validation is the manual `quickstart.md` runbook (Implement/QA follow it).
- Escalation gate: if T002 shows the failure is not fixable with headers, do NOT add a proxy - escalate to TechLead (per plan.md Constraints).
- [Story] labels map each task to its spec.md user story for traceability.
- Keep the diff inside `hermes-plugin/adapter.py`; commit after each logical group.
