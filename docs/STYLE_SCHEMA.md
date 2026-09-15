# Building style schema (data/<site>/overrides.json → "buildings")

Each entry is keyed by OSM way id (as a string, e.g. "1090362845") and holds a
style object. All fields optional; unspecified fields keep the generator's guess.

| field | values | meaning |
|---|---|---|
| kind | house, commercial, church, garage, pavilion, civic | overall template (commercial = storefront + flat/parapet by default; pavilion = open roof on posts) |
| floors | 1..4 | storey count |
| floorH | metres, e.g. 3.0 (house), 3.5–4.2 (commercial), 5–6.5 (church) | storey height |
| wall | named swatch or "#rrggbb" | main facade colour |
| upperWall | swatch/hex | different colour for upper floors (e.g. brick base, white clapboard above) |
| trim | swatch/hex | window frames, cornice, porch posts |
| roof | flat, gable, hip | flat = parapet + tar roof; gable = tiled pitched roof along the long axis; hip = four-sided |
| pitch | 0.3–0.75 | roof height as a fraction of span (0.35 shallow, 0.6 steep) |
| maxRoofH | metres | cap on roof height for big footprints |
| roofColor | slate, grey, tar, black, terracotta, brown, green, red, tan, copper, white, or hex | |
| storefront | true/false | big ground-floor shop windows + awning on the street side |
| awning | swatch/hex | awning colour |
| sign | text | business/building name shown on a sign board over the entrance (keep ≤ 24 chars) |
| signless | true | suppress any sign |
| demolished | true | OSM still has the footprint but the lot is empty now: the building is left out of site.json |
| door | swatch/hex | door colour |
| bays | 1..6 | vehicle bay doors across the front (fire station, garage) |
| bayColor | swatch/hex | |
| tower | { width, height, spire (bool), color, clock (bool), glass (bool), offset (m along front) } | square tower on the front (steeple, clock tower) |
| steeple | false | remove the default church steeple |
| cupola | { width, color } | small cupola at the ridge (gable roofs only) |
| porch | true/false | porch over the front door (houses) |
| porchWidth | metres | |

Named wall swatches: white, cream, butter, sage, slate, rose, grey, tan, brick,
darkbrick, redbrick, sand, stone, green, blue, yellow, brown, black, navy, red,
teal, olive, paleblue, darkgreen, limestone, khaki, glass.

Example:
```json
"1090362845": {"kind":"commercial","floors":2,"floorH":3.4,"wall":"khaki","trim":"brown",
  "roof":"gable","pitch":0.35,"roofColor":"brown","storefront":true,"awning":"black",
  "sign":"The Avondale Pub"}
```
