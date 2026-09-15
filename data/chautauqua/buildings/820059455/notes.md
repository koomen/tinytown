# Christian Science House — open lower porch correction

Building 820059455, 10 Center Avenue, is the pale gray-green house immediately southwest of Bestor Plaza Fountain. Its red awnings, stacked veranda and projecting cross gable match the user's September 13 screenshot.

The saved July 2012 Street View photos `front_820059455_+u.png` and `front_820059455_+v.png` show an open lower porch beneath a covered upper veranda. They support retaining the upper porch roofs and the red awnings. The lower porch was already authored as open, but both upper porch floors lacked `floorThickness`: the default foundation extended from below grade up to the 3.15 m balcony elevation and concealed the lower floor.

Added `floorThickness: 0.22` to the upper porch on the house's `+v` and `+u` faces. These are the only two blueprint changes. Both upper decks remain at 3.15 m; their undersides are now at 2.93 m. Existing lower decks, posts, stairs, railings, roofs, windows, materials and awnings are preserved.

Validation completed September 13, 2026:

- `python3 -B pipeline/lint_blueprint.py data/chautauqua 820059455`: 0 errors, 0 warnings.
- Isolated browser geometry checks prove both lower porch bays were obstructed before the change and are now open; both ground decks and all support posts remain; both upper decks are 0.22 m thick.
- No browser exceptions. Inspected before/after screenshot-matching views and the corrected front oblique view: the cream enclosure disappears, exposing the existing lower posts, windows, entrance and railings, while the covered upper veranda remains intact.

Evidence and integration patch: `runs/model-edits-20260913/bestor-open-porch/`. The aggregate overrides and site files were not modified by this authoring task.
