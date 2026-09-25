# Local change queue

The change queue lets you request source changes, watch independent workers,
and review a live preview before applying their work to your checkout. It also
tracks every building of a town and runs the bounded authoring pipeline for
the ones you queue (see [Buildings](#buildings)). Start the local dashboard
after logging into the Codex CLI or Claude Code:

```sh
codex login                     # or: claude (logged in), with --agent claude
./town changes serve --workers 2
# open the dashboard URL printed by the command
```

The dashboard starts at port 8735, tries the next free port if it is occupied,
and remembers the selected port for subsequent commands. Use `--port PORT`
to select a particular port; an explicit port occupied by another application
reports an error.

In Codex, invoke the repo-local `$queue-change` skill with your request. It
queues the work and returns links to the dashboard,
the individual change and its live preview when a target is specified. The
skill's source is [.agents/skills/queue-change/SKILL.md](../.agents/skills/queue-change/SKILL.md).

Submit a request in the dashboard or from another terminal:

```sh
./town changes add "Give the trees softer, rounder crowns" --title "Softer trees"
./town changes list
./town changes show CHANGE_ID
./town changes watch CHANGE_ID --timeout 60
./town changes steps CHANGE_ID
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
if needed. Each worker runs an independent coding-agent session, with
instructions to make reasonable choices and finish without asking questions
(see [Agents](#agents)). Requests can run concurrently. The dashboard receives live
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

The dashboard provides **Approve & commit** and **Discard** on a completed
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

Overlapping edits automatically queue a repair pass (same agent) against the latest
checkout. The original workspace is retained, and the worker receives the
baseline, checkout and task versions of each conflict. It must preserve both
sets of changes and run relevant checks. The result returns to **Pending approval**
for review before applying. Failed repairs retain their inputs and can be retried.
If the checkout changes again, the next approval repeats the merge.
Approval applies and commits the task's source delta to local `main`. The queue
checkout must be on `main`; it never switches branches for you. A separate Git
index keeps unrelated staged and uncommitted edits out of the commit, including
independent edits in the same file. If the task cannot be separated from those
edits, approval returns a specific error before applying anything. Separate or
commit the overlapping edits, then approve again. Git identity must be configured.
The commit SHA is saved in `integration.commit`. Approval does not push or deploy.
Existing approved records are not retroactively committed.

Queue records and workspaces are local, persistent, gitignored files. Building
status is never stored in the queue; see [Buildings](#buildings).

## Agents

A code change runs one of two agents, chosen per request (the composer's agent
menu, `./town changes add … --agent claude --model claude-sonnet-5`, or the
API's `agent` and `model` fields). The server default is Codex with
`gpt-6-astra`; `./town changes serve --agent claude [--model MODEL]` makes
Claude Code with `claude-opus-5-5` the default. `--claude-binary` and `--binary`
select the executables. Records keep `agent` and `model`; records made before
this choice existed ran Codex.

| Agent | Command | Permissions | Screenshots |
| --- | --- | --- | --- |
| `codex` | `codex exec --json --approve-for-me`, reasoning effort high | Approve for me (below) | `--image` inputs |
| `claude` | `claude -p --output-format stream-json --effort high` | `--permission-mode auto`; anything that would still prompt is denied (`--permission-prompts none`) | the prompt names the copied files and `--add-dir` grants read access |

Both receive the same prompt, environment (`TOWN_CHANGE_*`, `PIPELINE_PYTHON`,
browser state) and reporter, and both read CLAUDE.md. A pass succeeds only when
the agent exits 0 and reports completion (Codex: a completed turn; Claude Code:
a `result` event with subtype `success`). The agent-specific commands and
parsers live in `tinytown/change_agents.py`.

## Buildings

The dashboard's **Buildings** view (`/changes?view=buildings`, or
`./town changes buildings SITE`) lists every structure of a town with a status
derived from `data/<site>/buildings/<id>/` and `overrides.json`, exactly as
`town status` and `town plan` derive it. Nothing is written to the queue until
you start work. Filter by group and search by id, name or address:

| Group | Meaning |
| --- | --- |
| Needs references | no photos, aerial or reference packet yet |
| Needs authoring | references, no valid draft |
| In progress | a draft awaiting render/review/repair, or a building in a queued or running job |
| Ready to accept | a draft whose review passed |
| Needs attention | a failed review after the repair rounds, or an accepted forced publication |
| Accepted | the accepted blueprint, with a passing review |
| Failed | the author call failed for good |

A building's details show the review, issues and scores, recognition cues,
paired photo/render comparisons (`renders/compare-<face>.png`), face sheets and
photos (served read-only from the building directory; images are gitignored,
so a fresh clone shows none until the pipeline captures them), and earlier
human feedback. **Open live preview** renders the current draft in place of the
accepted blueprint (preview `drafts: [id]`, like the viewer's `?bp=`).

### Building jobs

Select buildings and choose **Author** or **Re-author**, or run:

```sh
./town changes add-building chautauqua 619932538 619932540 [--reauthor] \
    [--option author_model=opus --option max_tokens=200000]
```

A building job (`kind: "building"`) runs the bounded `town author` state
machine (`author.Run`) for those buildings in the main checkout. It needs no
snapshot: a draft is already a proposal, and the Street View photos and renders
it needs are gitignored. `--option` passes any `town author` keyword argument
(names come from `author.Run`; selection, acceptance and binaries are not
accepted). The job log streams the author's progress; building jobs run in
their own worker slots (`serve --building-workers`, default 1, because every
render goes through the one private browser), and two jobs never share a
building. `town author` itself is unchanged: batch runs from the terminal do
not go through the queue.

When the run ends, the job is **Pending approval** if any building reached a
reviewed draft. The task modal shows each building's steps, review summary,
issues and renders. **Accept & commit** (or **Accept** on one building) runs
`town accept`, which writes `overrides.json` and rebuilds `data/<site>/site.json`,
then commits exactly that delta plus the building's tracked JSON/Markdown
records to local `main` with the separate-index commit described above. When
`accept` refuses (a forced publication after two failed repairs, or an
unapproved re-authoring), the reasons appear on the building and **Accept
anyway** publishes with `--force`. A failed commit restores `overrides.json`
and `site.json`. The final-step list reminds you to `./town bake SITE` and commit
the regenerated assets.

**Feedback** on a building job is a human review. It is appended to
`buildings/<id>/human-feedback.json` (entries with `text`, the `draft_hash` it
judged, `at`, `job`) and the building is authored again. While a repair round
remains, the feedback is also recorded as the review's follow-up request, so
the next repair pass addresses it. Per-building feedback forms in the modal
target one building.

### Hand to agent

For a building the bounded pipeline cannot fix, **Hand to agent** (or
`./town changes escalate SITE ID --note '…' [--agent claude]`) queues an
ordinary code change with a templated request: edit
`buildings/<id>/draft.json`, iterate with `town lint`, `town render --compare`
and `town review --record`, and report a preview with `--draft ID`. Its
snapshot also receives copies of the building's gitignored photos and renders,
which stay out of the diff. Approving the change merges the draft and review
records as usual, then runs `town accept` for that building and commits
`overrides.json` and `site.json` separately (`integration.accept_commit`). If
`accept` refuses, a final step records the exact command to finish it.

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

Before finishing, workers report any remaining integration work:

```sh
./town changes report --clear-final-steps \
  --final-step './town bake avon-extended, then ./town bake --viewer; commit regenerated assets to local main' \
  --final-step 'Run the affected browser review after rebuilding'
```

`--final-step` appends a step and can be repeated. `--clear-final-steps` replaces
the worker's previous list; alone it explicitly reports no extra steps. Reports
can add instructions but cannot mark steps done or approve a commit. Each new
iteration, including merge repair, requires an updated final-step report.

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

## Watching and final steps

`./town changes watch 4` streams status, preview links, warnings, and the final
checklist until that worker reaches review or stops. Omit the number to watch
the queue. `--json` emits JSON lines; `--timeout 60` exits 124 if work is still
running. Timeout and Ctrl-C stop the watcher, never the job.

Every task has a persistent **To local main** checklist. The queue records
approval and the source commit automatically. Workers report remaining checks,
production rebuilds, generated-file commits, and other follow-ups. If a worker
omits the report, an explicit step remains to review and record what is needed.
Blocked workers retain this checklist too. Older approvals stay in History
unless they have explicitly recorded unfinished work; missing historical
commit or report metadata does not create new obligations.

Approved changes with unfinished steps appear under **Final steps**, outside
collapsed History. A committed source change is not a claim that its production
assets or all checks are complete. A task preview bake does not rebuild assets
in the main checkout.

Add steps or check them off in the task modal, or use:

```sh
./town changes steps 4
./town changes steps 4 --add 'Rebuild affected assets and commit them to local main'
./town changes steps 4 --done STEP_ID
./town changes steps 4 --reopen STEP_ID
```

Checking a step records completed work; it does not execute its text. The `plan`
step confirms that the list was reviewed. Iteration resets completion because
new edits can invalidate previous checks. Local integration is separate from
any later remote push or deployment.

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
./town preview --site avon-extended --target BUILDING_ID --radius 60 [--draft BUILDING_ID]
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
