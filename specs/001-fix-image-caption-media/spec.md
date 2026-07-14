# Feature Specification: Preserve Image + Caption in Zalo Inbound Messages

**Feature Branch**: `001-fix-image-caption-media`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Fix Zalo image message with caption not being read correctly by downstream agent. When a Zalo message arrives as a single image with a caption (description text attached to the photo), the end-to-end pipeline (server.js SSE forward -> zaloClient.js normalisation -> hermes-plugin/adapter.py MessageEvent construction) must preserve BOTH the image and the caption so the downstream agent actually receives and can read the image, not just the caption text. Today the reported behavior is that the downstream agent responds as if it only saw text/caption and did not read the image. Expected: for an image+caption inbound message, Hermes receives an event with message_type=PHOTO, the image is downloaded/cached successfully and appears in media_urls so the downstream model can read it, and the caption is preserved in text without causing the image to be dropped. If image download/caching fails, there must be an observable signal (log or explicit fallback behavior) instead of the message silently becoming text-only with no indication of the failure. Must also verify the existing image-without-caption flow still works (no regression)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Image with caption reaches the agent as an image (Priority: P1)

A Zalo user sends a single photo along with a caption (e.g. an invoice photo with the note "hoá đơn tháng này"). The person operating the downstream agent expects the agent to actually look at the photo and reply based on what is in it, while also taking the caption text into account.

**Why this priority**: This is the exact bug reported — today the agent behaves as if it only received the caption and never looked at the picture, which defeats the purpose of sending an image at all.

**Independent Test**: Send one Zalo message consisting of a photo with a non-empty caption to the bridge, and confirm the downstream agent's inbound event contains both the image (as readable media) and the caption text, and that the agent's reply reflects visual content from the photo (not only the caption).

**Acceptance Scenarios**:

1. **Given** a Zalo conversation is connected, **When** a user sends a photo with a caption, **Then** the downstream agent receives a single inbound event marked as a photo message, with the caption preserved as the message text and the photo available as readable media.
2. **Given** the same event has both a caption and a photo, **When** the agent processes it, **Then** the agent's response demonstrates it used the photo's visual content (not just the caption text).

---

### User Story 2 - Image download/cache failure is observable, not silent (Priority: P2)

When the photo attached to an inbound message cannot be downloaded or cached (e.g. transient network error, expired link), an operator monitoring the system needs to know that a photo was dropped, instead of the message quietly turning into a plain-text-only message with no trace of the problem.

**Why this priority**: Without this, failures are indistinguishable from "the sender didn't attach a photo," making the bug in User Story 1 impossible to diagnose or monitor going forward.

**Independent Test**: Simulate a photo download/cache failure for an inbound image+caption message and confirm an operator-visible signal (log entry or equivalent observable indicator) is produced identifying that the photo failed to attach, distinct from a message that legitimately had no photo.

**Acceptance Scenarios**:

1. **Given** an inbound message has a photo that fails to download or cache, **When** the message is handed off to the downstream agent, **Then** the system produces an observable signal identifying the failure (which message, why it failed).
2. **Given** a photo download/cache failure occurred, **When** the resulting event reaches the agent, **Then** the event is not silently indistinguishable from a plain text-only message with no photo.

---

### User Story 3 - Image without caption keeps working (Priority: P3)

A Zalo user sends a photo with no caption at all, exactly as already supported today.

**Why this priority**: This is an existing, working flow that must not regress while the caption-handling bug is fixed.

**Independent Test**: Send a Zalo photo message with an empty/no caption and confirm the downstream agent still receives the photo as readable media, with no unexpected text content.

**Acceptance Scenarios**:

1. **Given** a Zalo user sends a photo with no caption, **When** the message reaches the downstream agent, **Then** the agent still receives the photo as readable media exactly as it does today.

---

### Edge Cases

- What happens when the caption itself is empty/whitespace-only but the photo downloads successfully? (Photo must still be attached; empty caption must not be treated as an error.)
- What happens when the same inbound message contains a photo plus caption AND the download partially succeeds (e.g. file saved but corrupted/zero-byte)? System must treat this the same as a download failure (observable signal, not silent text-only fallback).
- What happens when multiple images are sent in the same batch/album with one shared caption? (Out of scope for this feature — see Assumptions; behavior should not regress vs. today.)
- What happens when the caption contains only emoji or non-Latin text? (Must be preserved as-is; no special-casing.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST classify any inbound Zalo message containing a single photo as a photo message (`message_type=PHOTO`) regardless of whether a caption is present.
- **FR-002**: System MUST make the photo available to the downstream agent as readable media (i.e. present in the event's media so the agent can actually access the image content), whenever the photo was successfully retrieved.
- **FR-003**: System MUST preserve the caption text attached to a photo message in the same inbound event as the photo, without causing the photo to be dropped or ignored.
- **FR-004**: System MUST NOT allow the presence of a non-empty caption to cause the event to be treated as text-only (i.e. caption text must never suppress the photo).
- **FR-005**: System MUST produce an observable signal (e.g. a log entry) when a photo fails to download or cache, that identifies the affected message and the failure reason.
- **FR-006**: System MUST distinguish, in an observable way, between "message had no photo" and "message had a photo that failed to attach" — an operator reviewing system output must be able to tell these two situations apart.
- **FR-007**: System MUST continue to correctly deliver photo-only (no caption) inbound messages to the downstream agent as readable media, with no observable regression versus current behavior.
- **FR-008**: System MUST preserve caption text exactly as received (including empty captions, emoji, and non-Latin text) without alteration.

### Key Entities

- **Inbound Message Event**: The unit handed off to the downstream agent for one Zalo message; carries a message type (e.g. text, photo), the message text/caption, and zero or more attached media items.
- **Media Attachment**: A photo (or other media) associated with an inbound message; has a source location, a local cached/downloaded copy, and a success/failure retrieval state.
- **Delivery Failure Signal**: An observable record (e.g. log entry) produced when a media attachment fails to retrieve, identifying which message and why.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of inbound Zalo messages consisting of one photo with a caption result in the downstream agent receiving both the readable photo and the caption text in the same event.
- **SC-002**: In manual/regression testing, the downstream agent's response to an image+caption test message visibly reflects the photo's content (not only the caption) in all tested cases.
- **SC-003**: 100% of simulated photo download/cache failures produce a distinguishable, operator-visible signal within the same processing cycle as the failed message — zero silent failures.
- **SC-004**: Existing photo-without-caption messages continue to reach the downstream agent as readable media with no observed regression across the regression test pass.

## Assumptions

- Each inbound message in scope contains at most one photo; multi-image albums/batches sent as a single Zalo message are out of scope for this feature and are not expected to change behavior.
- "Downstream agent" refers to the Hermes agent/model that ultimately consumes the inbound message event; this spec does not cover behavior deeper inside that agent/model once it has received a well-formed event with photo + caption.
- "Observable signal" for a download/cache failure means an existing or new log entry (or equivalent operator-visible mechanism already used elsewhere in this system); it does not require a new alerting/notification channel.
- The messaging bridge already correctly separates the photo from the caption text at the point the Zalo message is received; this feature is about ensuring that separation survives all the way to the downstream agent without either part being lost.
