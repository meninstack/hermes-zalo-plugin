# Quickstart: Validate Image + Caption Handling

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Manual validation guide covering the spec's three Independent Tests (User Stories 1–3). No new automated test suite is introduced (see `plan.md` Technical Context) — this is the runbook Implement/QA verify should follow.

## Prerequisites

- A running Hermes Zalo bridge (`npm run start`, logged in via `npm run login`) connected to `hermes-plugin`.
- Access to the bridge/plugin process logs (stdout or configured log sink) to observe `logger.warning`/`logger.info` output from `hermes-plugin/adapter.py`.
- A Zalo test conversation you can send messages from (DM or a test group).

## Scenario 1 — Photo with caption (User Story 1, FR-001..FR-004, FR-008)

1. Send a Zalo photo with a non-empty caption (e.g. "hoá đơn tháng này") to the connected account.
2. **Expect**: the downstream agent's inbound event has `message_type=PHOTO`, `media_urls` contains a locally cached, readable image path, and `text` equals the caption exactly (including emoji/non-Latin text if used).
3. **Expect**: the agent's reply demonstrates it used the photo's visual content, not just the caption text.

## Scenario 2 — Forced download/cache failure (User Story 2, FR-005, FR-006)

1. Simulate a download failure — e.g. temporarily point `media.url` handling at an invalid/expired URL, or block network access to the CDN host for the plugin process, then send a photo+caption message.
2. **Expect**: the plugin log shows a warning identifying the failed message (`message_id`/`thread_id`) and the failure reason (non-200 status, request exception, or cache-write exception).
3. **Expect**: this log line is clearly distinguishable from Scenario 3's normal "no media" case — i.e. it names a media/download failure, not merely the absence of media.

## Scenario 3 — Photo without caption (User Story 3, FR-007, regression check)

1. Send a Zalo photo with no caption.
2. **Expect**: the downstream agent still receives `message_type=PHOTO` with the photo in `media_urls`, and no unexpected text content — identical to pre-fix behavior.

## Pass/Fail

All three scenarios must pass with no regression in Scenario 3 for this feature to be considered done (maps to SC-001..SC-004 in `spec.md`).
