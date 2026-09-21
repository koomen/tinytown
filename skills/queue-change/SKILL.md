---
name: queue-change
description: Queue a TinyTown source or visual change for an independent GPT-6 Astra worker, attach a live preview, and iterate on an existing queued change.
---

# Queue a TinyTown change

Run from the TinyTown checkout containing `town` and `tinytown/changes.py`.
Use the local queue's independent Codex workers; do not implement the queued
request in the operator's checkout or launch a second worker for the same task.

For a new change, run:

```sh
./town changes add 'The complete requested change' --title 'Short change title'
```

Pass the user's actual requirements and useful context (relevant source files,
visual details and acceptance criteria), including instructions from the current
conversation that the fresh worker would otherwise lack. Preserve the user's
intent. If they request multiple independent changes, enqueue each separately.
The command starts the local dashboard and workers if needed. Every worker uses
`gpt-6-astra`, an isolated snapshot of the current source, and noninteractive
execution. It makes reasonable choices instead of asking the user questions.

Attach a preview when the request concerns a known property or landmark:

```sh
./town changes add 'Requested change' --site avon-extended --target '75 South Avenue' --radius 60
```

`--target` accepts a building id, address or landmark name; `--center=x,z` uses
local scene metres. Infer the town/target from the request or repository data
when possible. Do not ask for optional preview details. For an asset with a
preview factory, pass `--asset src/example.js --export preview`. A factory
receives `{THREE}` and returns an Object3D or `{group}`. Use source previews;
there is no need to bake the whole town while iterating.

The worker can also choose or update its preview and publish live progress.
The queue injects reporting instructions into each worker; it does not need
the operator to relay status or discover a preview URL afterward.

For feedback about an existing change, preserve its workspace and history:

```sh
./town changes iterate CHANGE_ID 'Specific feedback for the next pass'
./town changes show CHANGE_ID
```

Changes have permanent numbers. When the user refers to "change 2" or "#2",
use `./town changes show 2` to inspect it and `./town changes iterate 2 'Feedback'`
to adjust that same workspace. All change commands accept either the number
or the full ID. Include the number in your response; never create a new request
merely because the user identified an existing one by number.

The command prints the record and dashboard URL. Return the change link and
preview link when present, and let the background worker finish. A completed
worker awaits review. Saved edits also remain reviewable when a check is blocked
or a worker stops; describe the warning accurately. The dashboard's Approve action (or `town changes approve`)
applies only that workspace's changes; do not approve automatically merely
because execution succeeded. Apply on an explicit user request to approve that
change. Approval refuses conflicts with intervening checkout edits.

A user-requested discard uses `town changes discard ID`: stop the worker and
archive without applying files. History and workspace are retained. A failed,
cancelled, or discarded change can be continued with `town changes retry ID`.
Report a queue startup or worker failure accurately; preserve the saved
workspace. See the repository's `docs/changes.md` for server configuration.
