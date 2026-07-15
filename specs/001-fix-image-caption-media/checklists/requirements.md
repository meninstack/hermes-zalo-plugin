# Specification Quality Checklist: Preserve Image + Caption in Zalo Inbound Messages

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-14
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validated in one pass; no [NEEDS CLARIFICATION] markers were introduced because reasonable defaults existed for all ambiguous points raised in the source issue (scope: single photo per message, downstream agent boundary, definition of "observable signal"). These defaults are recorded in the spec's Assumptions section for review during `/speckit-clarify` or `/speckit-plan` if they need to be challenged.
- `message_type=PHOTO` in FR-001 reflects the domain vocabulary already used in the reported bug (message classification), not an implementation/tech-stack detail.
- Re-validated on 2026-07-14 (Specify rerun for issue #2). All 16 checklist items re-checked against `spec.md` and still pass; spec conforms to the current `.specify/templates/spec-template.md` section structure, and the pipeline entry points it references (`server.js`, `zaloClient.js`, `hermes-plugin/adapter.py`) still exist in the repo. No spec content changes were required — the specification already fully covers the current issue requirement (PHOTO classification, readable media in `media_urls`, caption preservation, observable download/cache failure signal, and no-regression for image-without-caption).
- **TechLead clarify (2026-07-15)**: Traced FR-001..FR-008 against the real pipeline code before Plan. Findings (evidence: `zaloClient.js:811-822`, `server.js:135-164`, `hermes-plugin/adapter.py:581-638`, `node_modules/zca-js/dist/models/Message.d.ts` `TAttachmentContent`):
  - `zaloClient.js#_normaliseMessage` (kind `"image"`) already emits a **single** inbound event carrying both `media.url` and `text` (from `c.description`) for every photo message, whether or not it has a caption. zca-js's own `TAttachmentContent` type puts `description` and the photo `params` on the same message object, so Zalo never splits image+caption into two raw messages at this layer — no change needed in `zaloClient.js`.
  - `server.js` forwards that event over SSE verbatim (`client.on("message", (msg) => pushEvent("message", msg))`); it is a pass-through with no risk of dropping media or caption.
  - The one real gap is in `hermes-plugin/adapter.py::_on_inbound_message` / `_download_media`: on download/cache failure the event silently degrades to `message_type=TEXT` with only the caption (matches the reported "agent only saw the caption" symptom if downloads are in fact failing), and the existing `logger.warning` calls (adapter.py:620, 624, 637) don't include `message_id`/`thread_id`, so FR-005/FR-006 ("identify WHICH message failed") aren't fully met yet.
  - **Boundary for Plan to preserve**: keep the fix inside `adapter.py`'s `_on_inbound_message`/`_download_media` (add message/thread identifiers to the failure logs; verify the download itself succeeds). Do not change the `zaloClient.js`/`server.js` event shape and do not add a bridge-side media-download proxy endpoint unless a direct Python-side download is first confirmed to actually fail in practice (e.g. missing `User-Agent`/`Referer` on the plain `aiohttp` GET to Zalo's CDN, unlike the Node bridge's authenticated zca-js session) — try the minimal header fix before any new abstraction.
  - No material technical/architecture ambiguity blocks Plan. Spec is ready for `/speckit-plan`.
