# #730 image-attachment delivery — verification evidence

Make-or-break acceptance: the worker agent must actually see the pasted image's
pixels. Proof form (per ticket): the image carries a unique marker text, and the
agent must transcribe it. Marker = `ZQX730KIWI` (rendered 96px monospace PNG,
`marker.png` in each directory). No indirect evidence substitutes for it.

## Per-runtime conclusion table

| Runtime | Delivery route | Marker terminal proof | Evidence |
|---|---|---|---|
| pi | whole-line token resolved by daemon → machine download → inline `ImageContent` via `session.prompt(text, {images})` / `steer(text, images)`; session-local `model.input` flipped to include `image` only when the step carries images | PASS — agent output transcribed `ZQX730KIWI` through the real relay (`gpt-5.6-sol`) | `relay-pi-runtime/transcript.json` |
| claude-code | same resolve/download → inline image content block in the streamed user message (`MessageParam` block array, the mechanism Claude Code itself uses for pasted images) | PASS — agent output transcribed `ZQX730KIWI` through the real relay (`gpt-5.6-sol`, machine-local auth) | `relay-claude-code-runtime/transcript.json` |
| pi (wire shape, stub capture) | full chain against an anthropic-messages stub that records the request body | PASS — request contains 1 image block, `source.type=base64`, `media_type=image/png`, base64 byte-identical to the uploaded PNG; text carries the anchor line and no raw token | `stub-capture/stub-request.json`, `stub-capture/result.json` |

pi SDK probe conclusion (bundled types, `@earendil-works/pi-coding-agent@0.86.0` +
`pi-ai@0.86.0`): prompt/steer images are a native SDK surface
(`PromptOptions.images`, `steer(text, images?)`), and the anthropic provider
converts them to inline base64 image blocks. The real blocker was the
`CUSTOM_MODEL_DEFAULTS input:['text']` capability pin: pi's
`transform-messages.js` silently downgrades images to
`(image omitted: model does not support images)` placeholders when the model's
`input` lacks `'image'`. The daemon now flips the session-local model object's
`input` to include `'image'` only when the step actually delivers images, so a
gateway or model that rejects image input fails visibly (error event → step
`errorMessage`) instead of pretending to have seen the image. The
`MACHINE_WIRE_EXTENSIONS` endpoint carries the download (machine-token auth,
ownedStep + team ownership + ready-status gates).

Relay status note: the 2026-09-24 observation "400 No endpoints found that
support image input" no longer reproduces — on 2026-10-03 the company relay
accepted base64 image blocks on `/v1/messages` and `gpt-5.6-sol`,
`qwen3.8-max` and `MiniMax-M3` all read the pixels (`kimi-k3` returned an empty
text for the image request). Marker legibility matters: a 44px
`XMON730-MARKER-PICTURE` render came back garbled (`XMON730-MARKER-PI`), the
96px short marker comes back exact — consistent with the reference canon's
"delivered image may be downscaled" guidance.

## Failure-mode coverage (tests, red before implementation)

- `packages/shared/test/attachment-token.test.ts` — token grammar round-trip,
  traversal-key rejection, whole-line-only expansion, ext classification.
- `apps/server/test/machine-attachment.test.ts` — machine-token auth, cross-team
  404, wrong-machine 404, pending 409, ready 200 base64 round-trip, browser
  route untouched.
- `apps/daemon/test/step-attachments.test.ts` — inline vs materialize routing,
  409/404 resilience (token kept + visible note, step never crashes), fileName
  sanitization, mime/ext drift.
- `apps/daemon/test/runner-images.test.ts` — backend receives expanded text +
  images; transcript/journal keep the original token; chief steps untouched.
- `apps/daemon/test/machine-loop.test.ts` (steer cases) — steer with image token
  resolves and delivers `steer(text, images)`; no-live-session drops before any
  download; 409 during steer keeps the run alive.
- `apps/daemon/test/backend-image-delivery.test.ts` — claude-code block-array
  shape (string form unchanged without images); pi mapping + capability flip.

## Known limitations (recorded, not silent)

- Inline tokens (mid-line, not whole-line) are not expanded — whole-line form
  only, same discipline as the web chip renderer.
- Non-inline image formats (svg/bmp/ico/avif) are materialized outside the
  worktree with a Read hint instead of inline delivery (the ticket's
  转码/素材化/如实不交付 three-way choice — materialization chosen).
- steer image delivery for a session whose model was not flipped at open time
  flips the live model object when steer images arrive; a future pi release
  that clones model objects would degrade to pi's visible omission note.
- Materialized step-attachment files are retained under
  `<PACMAN_HOME>/step-attachments/<stepId>/` (10MiB cap each) — no GC yet.
