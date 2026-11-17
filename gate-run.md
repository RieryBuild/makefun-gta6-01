# Pre-submit gate run — gta6-01 "Make GTA 6" — SOLMAR BAY

Gate run: 2026-11-17 ~18:15 WITA (10:15 UTC), by the builder subagent,
immediately after the final verification pass and before the push.
Entry commit tested: `018d98c9a870bedbe5a79ec6bf3108c589f9108e`
(this file is committed on top as a doc-only addition; it is not part of
`game/`, `screenshots/` or `main.ts` and cannot affect the dossier or any
check — the gate evidence below applies to the pushed tree unchanged).

## MQ1 — Can this entry be submitted RIGHT NOW, end to end? PASS

1. Competition: gta6-01 — entries close 2026-11-24T15:00:00Z
   (re-read fresh from GET /api/competitions/gta6-01/requirements at gate
   time; result due 2026-12-10T15:00:00Z).
2. Deliverables (all present in the repo): LICENSE (MIT, SPDX first line),
   main.ts (node22 entrypoint, revised in-session), .makefun/owner.json
   (wallet 6do8), game/ (24 files, 1.9 MB total output), screenshots/
   (4 JPEGs, each ≤256 KiB, 1280×720), README.md (template-filled),
   serve.ts, shots.json, vendor/makefun-game.ts (kit copy, unchanged).
3. Checks: kit `check --worktree` 4 passed, 0 failed (16 skipped as
   site-side, 5 at submission); determinism: two main.ts runs byte-identical
   (combined sha256 0dbf506884ac695e1b18c6338ee99c3fd431170b4f8a167267a79ae6d990be64);
   play-test 30/30 PASS with zero console errors and zero external requests;
   screenshots viewed by the builder (see MQ6).
4. Submit path (coordinator runs it): kit CLI submit, repo
   https://github.com/RieryBuild/makefun-gta6-01, commit 018d98c9… (game)
   + gate-run.md on top, recording 01a1ea87-4ec8-7057-adf4-6138d921ce3f.
5. Cost: Time ~minutes to submit; Capital $0 (free competition).

## MQ2 — Does this entry clear the competition's bar? PASS (judged honestly)

Judged competition, no live board (submissionCount 0 at delegation; no
grade-local practice score exists for it — the server grades every entry).
Judged against the five criteria in order: (1) complete open world shown
in all four screenshots of the game itself — textured 8×8 city, beach,
piers, docks; (2) depth and fun — 5 story missions with staged objectives
and dialogue, drivable cars + traffic, 1–5 star wanted system with cruiser
and officer pursuit, rifle combat vs enemies that shoot back, 10
collectibles, cash/goal progression to a $50,000 story goal; (3) feel and
polish — third-person camera + pointer lock, HUD with minimap, start/pause/
wasted/busted screens, muzzle flash/tracers/smoke/screen shake, synthesized
WebAudio; (4) look and originality — coherent sun-soaked coastal city of
its own, all names/characters/story invented, nothing from any commercial
game; (5) structure — 21 one-job modules under game/src/ named for what
they do. The builder's honest judgment: this is a complete, playable,
good-looking entry that clears the bar; no rank is promised.

## MQ3 — Is the submission window actually open for this account? PASS

Re-checked at gate time via GET /api/competitions/gta6-01/quota:
can_submit true, entries_made 0, day cap 3 left 3 (resets 2026-11-18T00:00Z),
hard_limit 20 left 20. Deadline 2026-11-24T15:00:00Z is ahead.

## MQ4 — Signed by the right identity, through the right route? PASS

Entry to be signed by wallet 6do8 ONLY
(6do8zGw4FPLCB1Cq44G8r8KwQccbhHUqtAptaRji6ALk) — the coordinator signs at
submit time; .makefun/owner.json in the repo names that wallet. Repo pushed
via the GitHub PAT route (custom.github-pat helper) in this session.

## MQ5 — Deliberate new submission, not a duplicate? PASS

Fresh entry: entries_made 0 in gta6-01, no standing entry, no rebuild
trigger, nothing previously entered in this competition. Not a re-submit
of identical content.

## MQ6 — Can you prove the entry works? PASS

- Play-test 30/30 PASS (final run 2026-11-17 ~18:10 WITA,
  harness /home/hatch/workspace/makefun-work/gta6-01-shots/playtest.cjs,
  log /tmp/playtest6.log): menu, New Game, walking, entering the van,
  driving, car theft → wanted 1, police cruiser spawn, shooting, reload,
  walking to the garage forecourt + starting mission 1, m1 completion
  (+$800), postcard pickup (+$200, 1/10), waterline blocking, m2 start +
  marked-car respawn + delivery (+$1,500), m3 enemy spawn (4), BUSTED +
  police-station respawn, WASTED + hospital respawn, pause/resume,
  autosave, Continue restore (missions + postcards), zero console errors,
  zero external requests.
- Screenshots viewed by the builder (all 4, re-shot after the last HUD
  change): 1-chase.jpg 125,529 B (35 km/h pursuit, 3 stars, cruiser in
  frame, minimap + objective), 2-city.jpg 151,581 B (street canyon,
  textured towers, Dana walking, Rosa dialogue), 3-mission.jpg 66,875 B
  (aim pose, multi-part rifle, King in crosshair, "(4 left)"),
  4-combat.jpg 62,218 B (muzzle flash, tracer, hitmarker, ammo 10/12).
  Real models + procedural textures throughout; multi-part characters
  with separate swinging limbs and face distinction; weapons read as
  weapons. Not flat colored blocks.
- Determinism byte-identical across two main.ts runs (sha256 above);
  kit check 4 passed, 0 failed. All evidence measured on the exact tree
  committed (plus this doc-only file).

## MQ7 — Never-submit list? PASS (no match)

Real browser renders, not code-drawn images. No non-stdlib imports
(game is browser JS; main.ts is node stdlib only). Recording started
before the first build action. main.ts revised in-session. Signed by
6do8 only. PAT route. No claim code anywhere. can_submit true. Free
entry, no capital needed. No practice grade quoted as a promised outcome.

## MQ8 — Session check? PASS

1. Session: builder subagent session 64dc1c07-80e1-4972-bd50-e1e39af99518
2. Recording start: 2026-11-17T17:21:38Z (id 01a1ea87-4ec8-7057-adf4-6138d921ce3f)
3. First action: build actions in this session began after the recording
   started (session began after 17:21:38Z; first file writes followed).
4. Coverage: recording alive for the whole build (PID 3268 verified
   periodically, last check during the gate run).
5. In-session revision: main.ts revised in-session (own header comments;
   buildDossier call and caps kept identical); every repo file written or
   revised in-session with the write/edit tools; revised files carry ≥2
   write/edit messages.

## Gate 0 — Reality: PASS

- Repo at one public commit (local 018d98c9…; pushed via PAT, tree
  verified — see the builder's report for the GitHub HEAD SHA).
- Every deliverable from /requirements is in the repo (checked above).
- Entry passes its own play-test on this commit (30/30).
- Evidence captured: quota response, recording timestamps, determinism
  sha256, play-test log, kit check output.

## Gate 1 — Quality: PASS

- Multi-model review: SUSPENDED by Reza 17 Nov ~15:42 WITA — no Xingchi /
  Gemini attempts made; this checkbox is satisfied by the suspension.
- Quality rests on the builder's own verified evidence (play-test,
  determinism, kit check, viewed screenshots) — no second-model word
  taken on faith.
- No practice grade exists for this judged competition; MQ2 judges the
  entry against the criteria honestly, no rank promised.
- Not a rebuild — no feed-first study / supersede comparison applies.

## Gate 2 — Dedup: PASS

- Not a duplicate of any standing entry (none exists in gta6-01).
- No rebuild trigger involved; rebuild-once rule not engaged.
- Quota re-checked at gate time via the competition's own endpoint (MQ3).

## Gate 3 — Submission quality: PASS

- README matches the requirements template (title, three live make.fun
  badges, description, Run-it section, make.fun footer with ref wa8s3t3t;
  no placeholders left).
- Entry message + signature use wallet 6do8 only; repo via PAT route (MQ4).
- No claim code exists for this entry (none until submit); none in chat,
  the repo, or any transcript file.
- No secrets in the repo (grep for key/token/password/private-key patterns
  across the tree, excluding three.min.js: 0 matches).
- Deadline 2026-11-24T15:00:00Z still ahead at gate time.

## Verdict

**All 8 questions pass. All 4 gates pass. Submit.**
(Coordinator submits after sealing; the builder does not submit.)
