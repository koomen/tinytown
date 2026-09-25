---
name: queue-change
description: Add, watch, review, or iterate on TinyTown queued changes, and track their remaining steps to local main. Use for queue operations, not for editing the queue implementation itself.
---

# Queue and watch TinyTown changes

Run from the checkout containing `town` and `tinytown/changes.py`.
If `TOWN_CHANGE_ID` is set, you are already the worker: implement the assigned
request and use the injected reporter; do not enqueue the same work again.
Otherwise use the queue's isolated GPT-6 Astra workers instead of implementing
the requested change in the operator's checkout.

## Add or iterate

```sh
./town changes add 'Complete request and relevant context' --title 'Short title'
./town changes iterate 4 'Specific feedback for the next pass'
```

Include the user's requirements, relevant conversation context, acceptance
criteria, and known follow-up requirements. Split independent requests into
separate changes. Workers make reasonable decisions without asking questions.
Use the existing number for feedback; never create a duplicate just because
the user refers to “#4.” Commands accept numbers or full IDs.

For a known property, add `--site SITE --target 'ADDRESS OR ID' --radius 60`.
For a preview factory, add `--asset src/example.js --export preview`.
Infer optional preview details when possible. Workers can attach or update
previews and status themselves. The command starts the queue server if needed.

To choose the coding agent, add `--agent claude` (Claude Code, default model
`claude-opus-5-5`) or `--agent codex`, and optionally `--model MODEL`.

## Buildings

```sh
./town changes buildings SITE --group needs-attention      # derived status; no queue records
./town changes add-building SITE ID [ID…] [--reauthor] [--option author_model=opus]
./town changes iterate 7 'The porch roof slopes away from the door' --building ID
./town changes approve 7 [--building ID] [--force]
./town changes escalate SITE ID --note 'Keep the tower' [--agent claude]
```

A building job runs the bounded `town author` pipeline in the main checkout;
approval runs `town accept` and commits overrides.json, site.json and the
building's records. `--force` publishes a refused (forced) draft; use it only
when the user asks. `escalate` hands one building to a coding agent that
iterates on its draft with compare renders; approving it also accepts the draft.

## Watch

```sh
./town changes list
./town changes watch 4 --timeout 60
./town changes show 4
./town changes steps 4
```

After submitting work, watch it unless the user only wants it queued. Continue
watching after exit 124 (watch timeout); the worker is still running. Give short
updates while waiting. Watching stops when the worker reaches review, fails,
or is cancelled/discarded; it never approves or cancels work. Omit the number
to watch the whole queue; `--json` emits one JSON object per update.

Report the change number, dashboard link, preview when available, test warnings,
and remaining final steps. `pending_approval` means ready for review, not merged.
Saved edits remain reviewable when a test or worker fails. Inspect the warning
and final summary instead of claiming all checks passed.

For a whole-map review, use `./town changes bake 4 --site SITE` and open the
record's `map_url`. It serves the last successful isolated bake; it does not
rebuild production assets in the main checkout.

## Approve and finish

On a user request to approve that change:

```sh
./town changes approve 4
./town changes steps 4
```

Approval applies and commits only the task's delta to local `main`, preserving
unrelated working-tree and staged edits. The queue checkout must be on `main`.
Overlapping approved changes may queue an Astra repair pass; watch it, then
return the repaired result for review. Do not claim approval succeeded when
its result is `queued` or `pending_approval`.

The `integration.commit` field records the local commit. It does not mean
all rebuilds or other follow-ups are finished. Workers report those into the
persistent final-step checklist; approved changes with unfinished steps remain
visible on the dashboard. Missing reports leave an explicit review step.

Inspect the checklist and the repository's rebuild rules. Complete remaining
work within the user's authorized scope, including required generated assets
and their local commits, and mark steps done only after actually doing them:

```sh
./town changes steps 4 --add 'Concrete remaining step, with command and scope'
./town changes steps 4 --done STEP_ID
./town changes steps 4 --reopen STEP_ID
```

Checking a step only records completion; it does not execute commands. The
`plan` step confirms that the final-step list was reviewed. No remote push or
deployment is part of local approval. Do not stage unrelated files or use
`git add -A` to finish a change.

A requested discard uses `./town changes discard 4`, preserving the workspace
and history without applying it. `./town changes retry 4` restores a failed,
cancelled, or discarded change. Discard cannot undo an approved commit.

See [the queue documentation](../../../docs/changes.md) for server configuration,
worker reports, screenshots, and conflict handling.
