# Local change queue

The change queue lets you request source changes, watch independent workers,
and review a live preview before applying their work to your checkout. Start
the local dashboard after logging into the Codex CLI:

```sh
codex login
./town changes serve --workers 2
# open the dashboard URL printed by the command
```

The dashboard starts at port 8735, tries the next free port if it is occupied,
and remembers the selected port for subsequent commands. Use `--port PORT`
to select a particular port; an explicit port occupied by another application
reports an error.

In Codex, invoke the installed `$queue-change` skill with your request. It
queues the work and returns links to the dashboard,
the individual change and its live preview when a target is specified. The
skill's source is [skills/queue-change/SKILL.md](../skills/queue-change/SKILL.md).

Submit a request in the dashboard or from another terminal:

```sh
./town changes add "Give the trees softer, rounder crowns" --title "Softer trees"
./town changes list
./town changes show CHANGE_ID
./town changes iterate CHANGE_ID "Keep the existing trunk proportions"
./town changes bake CHANGE_ID --site avon-extended
./town changes approve CHANGE_ID
./town changes discard CHANGE_ID
```

Changes receive permanent numbers in submission order: #1, #2, #3, and so on.
Numbers remain the same through feedback, retries, approval, discard, and
server restarts. Use a number anywhere a change ID is accepted, for example
`./town changes show 2` or `./town changes iterate 2 "Adjust the tree spacing"`.
The dashboard also supports links such as `/changes#2`; existing ID links work.

The server runs queued jobs; CLI commands automatically start a local server
if needed. Each worker uses `gpt-6-astra` in an independent
Codex session, with instructions to make reasonable choices and finish without
asking questions. Requests can run concurrently. The dashboard receives live
updates through short requests once a second and exposes the worker output, changed files,
preview, approval, feedback, cancellation and retry controls.

Workers use Codex's **Approve for me** mode. They normally run in the workspace
sandbox; requests to run local servers, Chromium, or other required checks
outside that sandbox go through automatic permission review. The queue's old
`approval_policy="never"` prevented those requests and caused `listen EPERM`
and macOS Chromium sandbox failures. The installed private browser runtime is
shared, while every worker keeps its own browser profiles and state.

Drop screenshots anywhere on the dashboard. They attach to the open change,
or to the new request if no change is open. Dropping onto the feedback form
keeps them with that feedback. You can also paste images or use **Attach screenshots**.
Thumbnails can be removed before submitting; saved images
remain visible in the task details. You can also append screenshots directly
to an existing task. PNG, JPEG, and WebP are supported (up to 8 images per
change, 10 MB each, 20 MB total).

Screenshots accompany the worker's initial prompt as Codex image inputs and
remain available on subsequent passes. Images appended after a worker starts
are used on the next pass; adding them does not interrupt or restart a job.
Images are local queue files, excluded from source diffs and approval.

## Isolation and approval

Every request gets its own Git repository under `runs/changes/`. Its starting
point is the current checkout, including uncommitted source edits and untracked
files that Git does not ignore. Ignored private files, previous runs and baked
streams and surfaces are excluded. Workers edit these snapshots; their work
does not enter the main checkout until you approve it.

A successful job becomes `pending_approval`. A blocked check or worker failure
also goes to review when it leaves editable changes, with the unresolved issue
shown as a warning. You can approve those edits, request another pass, or discard
them; a warning does not claim the checks passed. Jobs that stop without any
editable changes remain Failed and can be retried. Existing failed jobs with
saved edits move back to review when the server starts.

Feedback queues another iteration
in the same workspace, preserving the previous edits and feedback history.
`./town changes cancel CHANGE_ID` cancels a queued or running job;
`./town changes retry CHANGE_ID` queues a failed, cancelled, or discarded job again.

The dashboard provides **Approve & apply** and **Discard** on a completed
change. Discard also works on queued or running jobs: it stops the worker,
moves the job to History, and does not modify the checkout. Its workspace,
diff and logs are retained; **Restore** queues another pass from those files.
Discard cannot undo an already approved change.

Each worker pass has a one-hour timeout by default; set
`./town changes serve --timeout SECONDS` to change it. A timeout or server
interruption preserves its workspace. Saved edits remain reviewable; use
feedback to continue from those files, or retry if no edits were saved.

Approval performs a three-way merge against the task's starting snapshot and the
current checkout. Independent text edits merge automatically. JSON objects and
lists with stable IDs merge by entry, so changes to different buildings can be
approved in either order. Approvals are serialized and applied together; a
conflict never leaves half a task applied.

Overlapping edits automatically queue an Astra repair pass against the latest
checkout. The original workspace is retained, and the worker receives the
baseline, checkout and task versions of each conflict. It must preserve both
sets of changes and run relevant checks. The result returns to **Pending approval**
for review before applying. Failed repairs retain their inputs and can be retried.
If the checkout changes again, the next approval repeats the merge.
Approval applies source files locally; it does not commit, push or deploy them.

Queue records and workspaces are local, persistent, gitignored files. They are
separate from the per-building authoring pipeline and its derived status.

## Worker reports

Each worker receives a reporting command and its own report file. The prompt
instructs it to publish status as its activity changes and attach a relevant
preview early. Inside a worker, for example:

```sh
./town changes report --status "Checking roof geometry" --progress 40
./town changes report --site avon-extended --target '75 South Avenue' --radius 60
./town changes report --asset tinytown/web/preview-assets.js --export tree
./town changes report --outcome complete --status "Tests passed" --progress 100
```

`--title` updates the task title; `--summary` publishes findings;
`--clear-preview` removes the preview. Status is a short description, and
progress is the worker's estimate. Use `--outcome blocked --status 'Reason'`
when the worker cannot finish.

The queue also injects a standalone copy of the reporter into each workspace,
so it works for tasks created before this command existed:

```sh
"$PIPELINE_PYTHON" "$TOWN_CHANGE_REPORTER" --status "Running tests" --progress 80
```

Reports are written atomically to `runs/change-worker/report.json` inside that
task's workspace, excluded from the code diff. The queue reads them while the
process runs and after it exits. Reports are scoped to the current iteration;
late reports from stopped/discarded passes cannot update another pass.
Status and preview changes reach the dashboard automatically. Short update requests
leave browser connections free for map assets, even with several tabs open.
The preview URL remains `/previews/<task-id>/`; the worker selects what that
URL renders, rather than starting another server or inventing a URL.

Reports cannot approve or apply files. A clean completion requires a successful
Codex exit and completed-turn event. A blocker or process failure preserves
saved edits for review with a warning. Invalid reports display an error and
leave the last valid status and preview intact.

## Task world bakes

Choose a town and click **Bake world** on a task, or run
`./town changes bake CHANGE_ID --site SITE`. Bake progress and its log appear
in the task and update automatically. Bakes run one at a time, separately from
agent work, from a frozen copy of the task's source. Workers can continue editing.
The bake builds the scene, surfaces and streaming assets, stamps the viewer,
and checks the output. It never writes baked files into the main checkout or
into the worker's editable workspace.

**Whole map** opens `/previews/<task-id>/map/` and shows the last successful
bake through the normal streaming viewer. Opening it does not build a live
whole-map scene. Before the first bake, the page offers **Bake world**. A new
successful bake replaces the displayed world; a failed bake keeps the previous
one available. The page marks the bake stale when source changes afterward.
Each successful bake also has its own versioned URL, keeping its source and
assets together. Bakes remain available across queue restarts.

Workers receive the map link in `TOWN_CHANGE_MAP_URL`; API records include
`map_url`, `bake` (the current attempt) and `baked` (the last successful result).
This stays separate from the close-up live preview.

## Live close-up previews

Preview a bounded area directly from source:

```sh
./town preview --site avon-extended --target BUILDING_ID --radius 60
./town preview --asset src/my-preview.js --export preview
```

The preview uses live source geometry instead of baked streams or surfaces.
Its radius (10–200 metres) bounds the scene so local changes can be reviewed
without rebuilding the whole town. Each preview has an independent stable URL. Queue
requests accept `--site`, `--target` and `--radius` to choose the review area.
The viewer still needs network access for its Three.js dependency. Asset modules
must export a factory such as `preview({THREE})` returning an `Object3D` or
`{group}`; `--export` selects the factory name. The preview uses a simplified
light rig. See [rendering.md](rendering.md) for the asset interface.

After approval, follow the usual [rebuild and deployment workflow](deploy.md)
for any affected production assets. Run `./town changes --help` and
`./town preview --help` for the full command options.
