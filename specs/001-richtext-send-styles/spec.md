# Feature Specification: Rich-Text Styles on POST /send

**Feature Branch**: `feat/issue-4`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Add a specification for GitHub issue #4 rich-text support on POST /send. The feature must use optional styles ranges {start,len,type,indentSize?}, map 1-1 to zca-js TextStyle tokens, preserve backward compatibility when styles is absent, reject invalid styles with 400, and avoid markdown/html parsing. Use the existing issue body and repo context as source of truth. Reuse the approved contract from .hermes/specs/issue-4/spec.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send a message with formatted text ranges (Priority: P1)

An integrator (the Hermes bridge or any other caller of the message-sending endpoint) wants to send a Zalo message where specific portions of the text are bold, italic, colored, or otherwise emphasized — for example, bolding a heading or coloring a warning phrase — without hand-building Zalo's internal message format.

**Why this priority**: This is the entire purpose of the feature. Without it, the request degrades to the existing plain-text-only capability and delivers no new value.

**Independent Test**: Send a request with `text` and a `styles` array describing one or more valid style ranges; confirm the call succeeds and the message renders in the Zalo client with the requested ranges styled (bold/italic/underline/strikethrough/color/size/list/indent as applicable).

**Acceptance Scenarios**:

1. **Given** a valid `text` and a `styles` array with a single valid range (e.g., bold the first 5 characters), **When** the caller submits the request, **Then** the message is sent and the specified range renders with the requested style in the recipient's Zalo client.
2. **Given** a valid `text` and a `styles` array with multiple non-overlapping ranges of different style types (including an indent range with `indentSize`), **When** the caller submits the request, **Then** the message is sent and every range renders with its own requested style.

---

### User Story 2 - Existing plain-text callers keep working unchanged (Priority: P1)

An existing integrator that only ever sends `{ threadId, threadType, text, mentions?, quote? }` (no `styles`) must see no change in behavior, response shape, or outcome after this feature ships.

**Why this priority**: Breaking existing callers would be a regression on a capability already in production use; backward compatibility is a hard requirement, not a nice-to-have.

**Independent Test**: Send a request identical to today's supported shape (no `styles` field, or `styles` omitted) and confirm the response and delivered message are indistinguishable from before the feature existed.

**Acceptance Scenarios**:

1. **Given** a request without a `styles` field, **When** the caller submits the request, **Then** the message is sent as plain text exactly as it was before this feature, with no behavior or response difference.
2. **Given** a request with `styles: []` (present but empty), **When** the caller submits the request, **Then** the message is sent as plain text with no styling applied, identical to omitting `styles` entirely.

---

### User Story 3 - Invalid style ranges are rejected clearly, before anything is sent (Priority: P2)

An integrator that constructs a malformed or out-of-bounds `styles` array (bad type token, negative/overlapping-with-text-bounds offsets, wrong data types) needs to find out immediately and clearly what is wrong, without the message being delivered in a broken or partially-styled state.

**Why this priority**: Prevents silent data corruption or confusing partial deliveries, and gives integrators a fast, actionable feedback loop during their own development. Ranks below the two P1 stories because it's a safety net around the core capability rather than the capability itself.

**Independent Test**: Send requests with various malformed `styles` entries (bad token, out-of-range offsets, wrong types) and confirm each is rejected with a client error identifying the problem, and confirm no message was delivered to Zalo as a result.

**Acceptance Scenarios**:

1. **Given** a `styles` entry whose `type` is not one of the supported style tokens, **When** the caller submits the request, **Then** the request is rejected with a 400-level error identifying the offending entry, and no message is sent.
2. **Given** a `styles` entry where `start + len` exceeds the length of `text` (or `start`/`len` are negative, non-integer, or missing), **When** the caller submits the request, **Then** the request is rejected with a 400-level error identifying the offending entry, and no message is sent.
3. **Given** a `styles` value that is not an array (e.g., an object or string), **When** the caller submits the request, **Then** the request is rejected with a 400-level error, and no message is sent.

---

### Edge Cases

- What happens when two style ranges overlap (e.g., both cover character 0)? The specification does not require detecting or rejecting overlap; each valid range is applied independently, consistent with the underlying style-range model. (Not a validation failure.)
- What happens when `styles` is present but contains zero entries? Treated identically to `styles` being absent (User Story 2).
- What happens when a style range covers the full length of `text`? Must be accepted as valid as long as `start + len <= length(text)`.
- What happens when `indentSize` is supplied on a non-indent style type, or omitted on an indent style type? Only the indent style type uses `indentSize`; the specification does not require rejecting an unused `indentSize` on other types, but an indent-type range must still validate against the same offset/type rules as any other range.
- What happens when the request body includes both a malformed `styles` entry and an otherwise-valid one? The entire request is rejected — validation is all-or-nothing per request, not per-entry.
- What happens when `text` itself is missing or empty but `styles` is present? Existing required-field validation for `text` still applies; a `styles` array requires no additional handling beyond validating offsets against whatever `text` value was (or wasn't) supplied.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The message-sending endpoint MUST accept an optional `styles` field: an array of style ranges, each with `start` (integer, position in `text` where the style begins), `len` (integer, number of characters the style covers), `type` (a style token identifying the visual style), and an optional `indentSize` (used only for the indent style type).
- **FR-002**: Each style token in `type` MUST map one-to-one to a supported visual style: Bold, Italic, Underline, StrikeThrough, four named text colors, two named text sizes, unordered list, ordered list, and indent. No style types outside this fixed set are supported.
- **FR-003**: The system MUST NOT interpret `text` as Markdown or HTML — no inline syntax (`**bold**`, `<b>`, etc.) is parsed or converted into styling. Styling is expressed exclusively through the `styles` array acting on the raw, literal `text`.
- **FR-004**: When `styles` is omitted from the request, the system MUST behave exactly as it did before this feature existed — same validation, same response shape, same delivered message.
- **FR-005**: When `styles` is present but empty (`[]`), the system MUST treat the request identically to `styles` being omitted.
- **FR-006**: When `styles` is present and non-empty, the system MUST validate every entry before sending anything: `styles` itself must be an array; each entry's `start` must be an integer >= 0; each entry's `len` must be an integer >= 1; each entry's `type` must be one of the supported style tokens (FR-002); and `start + len` must not exceed the length of `text`.
- **FR-007**: If any `styles` entry fails validation, the system MUST reject the entire request with a client error response (HTTP 400) that identifies which entry and which condition failed, and MUST NOT deliver any message to the recipient.
- **FR-008**: The system MUST NOT return a server error (HTTP 500) for a `styles` validation failure — validation failures are caller input errors (400), distinct from unexpected delivery failures.
- **FR-009**: When `styles` passes validation, the system MUST apply every requested range's style to the delivered message such that a recipient viewing the message in their Zalo client sees each range rendered with its corresponding style.
- **FR-010**: All other existing request fields and behaviors (`threadId`, `threadType`, `mentions`, `quote`) MUST continue to function unchanged when combined with a `styles` field.

### Key Entities

- **Style Range**: A single instruction to apply one visual style to a contiguous slice of the outgoing message text. Attributes: start position, length, style type, and an optional indent size (meaningful only for the indent style type).
- **Send Request**: The outgoing message request, extended with an optional list of Style Ranges alongside its existing fields (destination, message text, mentions, quote).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing requests that omit `styles` produce identical responses and delivered messages to the pre-feature behavior (zero regressions).
- **SC-002**: 100% of requests containing at least one invalid style range are rejected with a 400-level error and result in zero messages delivered to the recipient.
- **SC-003**: 100% of requests containing only valid style ranges result in a delivered message where every requested range is visibly styled as requested, verified by manual inspection in the Zalo client.
- **SC-004**: An integrator can determine, from the error response alone, which style range and which validation condition caused a rejection, without needing to inspect server logs.

## Assumptions

- The set of supported style types is fixed to the twelve tokens already defined by the underlying messaging platform's style model (bold, italic, underline, strikethrough, four colors, two sizes, unordered list, ordered list, indent); no custom colors or sizes beyond this set are in scope.
- Overlapping style ranges are permitted and are the caller's responsibility to reason about visually; the system does not attempt to detect or reject overlaps.
- Manual verification against a real Zalo client is an acceptable acceptance method for visual-rendering criteria (SC-003), since automated rendering verification is out of scope for this feature.
- This feature covers only the HTTP send-message contract; it does not extend to any downstream caller-side integration (e.g., adapter code that constructs requests) beyond documenting the new optional field.
- Validation is all-or-nothing per request: a single invalid entry in `styles` fails the whole request rather than silently dropping just that entry.
