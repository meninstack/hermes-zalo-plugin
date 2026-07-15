# Implementation Plan: Preserve Image + Caption in Zalo Inbound Messages

**Branch**: `001-fix-image-caption-media` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-fix-image-caption-media/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

The reported bug ("agent only sees the caption, not the photo") is **not** an event-shape problem: `zaloClient.js#_normaliseMessage` already emits one inbound event with both `media.url` and `text` (caption) for every photo message, and `server.js` forwards it unchanged over SSE. The actual gap, confirmed by TechLead clarify against the real code (`specs/001-fix-image-caption-media/checklists/requirements.md`), is in `hermes-plugin/adapter.py`: when `_download_media` fails, the event silently degrades to `message_type=TEXT` with only the caption — matching the reported symptom — and the existing `logger.warning` calls (adapter.py:620, 624, 637) omit `message_id`/`thread_id`, so a failed download can't be told apart from "no photo was sent" (FR-005/FR-006).

Technical approach: keep the fix confined to `hermes-plugin/adapter.py::_on_inbound_message` / `_download_media`. First verify whether the plain `aiohttp.ClientSession()` GET to Zalo's CDN (no `User-Agent`/`Referer`, unlike the Node bridge's authenticated zca-js session) is the actual failure cause; if so, add the minimal headers needed to make the download succeed. Regardless, add `message_id`/`thread_id` (and failure reason) to the three existing failure log lines so User Story 2 (FR-005/FR-006) is met even in cases where a download genuinely cannot succeed. No change to `zaloClient.js`, `server.js`, or the SSE/event schema, and no new bridge-side media-download proxy — per the TechLead boundary, a new abstraction is only justified if the direct header fix is confirmed insufficient in practice.

## Technical Context

**Language/Version**: Node.js >=18 (`server.js`, `zaloClient.js`, ESM) + Python (async, `hermes-plugin/adapter.py`) — both already in use, no new language/runtime introduced.

**Primary Dependencies**: `zca-js` (unofficial Zalo client, Node side, unchanged), `aiohttp` (Python side, already used for `_download_media`/session GET/POST) — no new dependency added.

**Storage**: Local filesystem media cache via existing `cache_image_from_bytes` / `cache_audio_from_bytes` / `cache_document_from_bytes` helpers (unchanged).

**Testing**: Manual/regression pass per spec's Independent Tests (image+caption, forced download failure, image-without-caption) — see `quickstart.md`. No existing automated test harness for `hermes-plugin/adapter.py` in this repo; adding one is out of scope (ponytail: fix confined to the two touched methods, not a test-infra project).

**Target Platform**: Existing Hermes Zalo bridge deployment (bridge process + hermes-plugin), Linux/macOS/Windows per `package.json` engines — no new platform.

**Project Type**: Existing single bridge+plugin project (Node bridge `server.js`/`zaloClient.js` + Python `hermes-plugin`) — not a new project, no new service boundary.

**Performance Goals**: N/A — no new performance requirement; download timeout (120s) and cache path are unchanged.

**Constraints**: Must not change the inbound event shape/SSE contract between `zaloClient.js`/`server.js` and `hermes-plugin` (per TechLead boundary). Must not introduce a new abstraction (e.g. bridge-side media proxy) unless the minimal header fix is confirmed insufficient.

**Scale/Scope**: Two methods in one file (`adapter.py::_on_inbound_message`, `adapter.py::_download_media`); no other files change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no ratified project-specific principles) — there are no concrete gates to evaluate against. Treated as PASS (no constitution constraints exist to violate); default engineering discipline (minimal diff, no unneeded abstractions, verify before adding code) applied per the ponytail/TechLead boundary instead.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-image-caption-media/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command) — manual validation guide
├── checklists/
│   └── requirements.md  # Spec quality + TechLead clarify evidence (already present)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `data-model.md` or `contracts/` are produced: this feature introduces no new entities (the spec's Key Entities — Inbound Message Event, Media Attachment, Delivery Failure Signal — already exist as `MessageEvent`, the `media` dict, and `logger.warning` calls in the current code) and no new external interface/API contract (the SSE event shape and plugin boundary are explicitly frozen per the TechLead clarify boundary). Generating them would be speculative documentation for a targeted bugfix.

### Source Code (repository root)

```text
hermes-zalo-plugin/
├── server.js                    # SSE forward, pass-through — unchanged
├── zaloClient.js                # media+caption normalisation — unchanged
└── hermes-plugin/
    └── adapter.py                # _on_inbound_message, _download_media — ONLY files touched
```

**Structure Decision**: Single existing project, no new directories. The fix is scoped to `hermes-plugin/adapter.py` only, per the TechLead-clarified boundary (`specs/001-fix-image-caption-media/checklists/requirements.md`). `server.js` and `zaloClient.js` are read-only reference points confirming the event already carries both media and caption before it reaches the plugin.

## Complexity Tracking

*No Constitution Check violations — table not applicable.*
