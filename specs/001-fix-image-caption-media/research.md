# Phase 0 Research: Preserve Image + Caption in Zalo Inbound Messages

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

There were no `NEEDS CLARIFICATION` markers left in `spec.md`, and TechLead clarify (`checklists/requirements.md`, evidence at `zaloClient.js:811-822`, `server.js:135-164`, `adapter.py:581-638`) already traced the bug to a single root-cause area. The one remaining open technical question carried into Plan is recorded below.

## Where does the image get dropped?

- **Decision**: The bug is in `hermes-plugin/adapter.py`, not in `zaloClient.js`/`server.js`. `_normaliseMessage` (kind `"image"`) already emits one event with both `media.url` and `text` for every photo message; `server.js` forwards it verbatim over SSE. `adapter.py::_on_inbound_message` calls `_download_media`, and on any failure (non-200 response, request exception, or cache-write exception) it falls back to `message_type=TEXT` while keeping only the caption text — this is the observed "agent only saw the caption" behavior.
- **Rationale**: Traced by reading the real code paths end-to-end (not inferred from UI behavior alone), per the TechLead clarify boundary note. `zca-js`'s own `TAttachmentContent` type carries `description` and photo `params` on the same raw message, confirming Zalo itself never splits image+caption into two messages at the source.
- **Alternatives considered**: Fixing at `zaloClient.js`/`server.js` (rejected — those layers already preserve both fields; changing them would be solving a problem that doesn't exist there and would risk the event-shape contract). Adding a bridge-side media-download proxy so Python never does the CDN GET itself (deferred — only justified if the direct-download header fix below is confirmed insufficient).

## Why would the download itself fail?

- **Decision**: The leading hypothesis is that the plain `aiohttp.ClientSession()` used in `adapter.py` (created with no default headers — confirmed at `adapter.py:322`) issues an unauthenticated GET to Zalo's CDN, unlike the Node bridge's `zca-js` session which is already logged in and carries the right `User-Agent`/`Referer`/cookies. If that's the actual failure mode, the minimal fix is to add the missing headers (or reuse cookies/auth already available to the Node side) to the Python-side GET in `_download_media`, not to build a new proxy.
- **Rationale**: Matches the TechLead boundary note (`checklists/requirements.md`, line 41): try the minimal header fix before any new abstraction. Keeps the diff inside `_download_media` with no new dependency.
- **Alternatives considered**: New bridge-side download proxy endpoint (rejected for now — adds a new HTTP surface and dependency between Node and Python for a problem that may be solvable with a one-line header change; revisit only if headers alone don't fix real download failures observed during Task/Implement).

## How should failures become observable (FR-005/FR-006)?

- **Decision**: Extend the three existing `logger.warning` call sites in `_download_media` (adapter.py:620, 624, 637) to include `message_id`/`thread_id` and the failure reason, so a failed-download event is distinguishable in logs from a legitimately photo-less text message.
- **Rationale**: An observable signal already exists (the `logger.warning` calls) — spec's Assumptions explicitly say a new alerting channel is not required, just that the existing log mechanism identify which message failed and why. Minimal change: add identifiers to existing calls, no new logging framework/abstraction.
- **Alternatives considered**: New structured "delivery failure" log channel/table (rejected — over-engineered for what the spec asks: an existing-log-entry-level observable signal is sufficient per Assumptions).

**Output**: All open questions carried from `spec.md`/TechLead clarify are resolved above; no `NEEDS CLARIFICATION` remains for Task/Implement.
