# Bake fonts

Metric-compatible substitutes for the families canvas sign textures in `src/`
request. The bake (`../node-dom.mjs`) registers them with Skia under the
requested names, and `../stream-export.html` does the same for browser tests,
so baked textures do not depend on the fonts installed on the baking machine.
`node-dom.mjs` takes the family from the file name prefix and the weight and
style from the font itself.

| Registered as | File | Weights covered |
| --- | --- | --- |
| Georgia | `gelasio-latin-400-{normal,italic}.woff2` | 1-599 |
| Georgia | `gelasio-latin-700-{normal,italic}.woff2` | 600-1000 |
| Arial | `arimo-latin-400-{normal,italic}.woff2` | 1-599 |
| Arial | `arimo-latin-700-{normal,italic}.woff2` | 600-1000 |
| Nunito | `nunito-latin-700-normal.woff2` | 1-749 |
| Nunito | `nunito-latin-800-normal.woff2` | 750-1000 |

Sources: the npm packages `@fontsource/gelasio@5.3.0` (Gelasio v14),
`@fontsource/arimo@5.3.0` (Arimo v36) and `@fontsource/nunito@5.3.0`
(Nunito v32), `files/<name>.woff2`, fetched from cdn.jsdelivr.net. Latin
subset only. All three are licensed under the SIL Open Font License 1.1; see
`LICENSE-*.txt`.

Adding a family, weight or style to a texture in `src/` means adding the file
here (and a `FAMILIES` entry in `../node-dom.mjs` for a new family) and a row
to `FACES` in `../stream-export.html`.
