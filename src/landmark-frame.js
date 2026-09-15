// Shift all mapped landmark geometry into the centered render slab. Geographic
// source coordinates remain unchanged so a rebuild can use another site origin.
export function shiftLandmark(feature, dx, dz) {
  const point = ([x, z]) => [x - dx, z - dz];
  const openings = items => items.map(o => ({...o, point: point(o.point)}));
  const result = {...feature, pts: feature.pts.map(point)};
  if (feature.openings) result.openings = openings(feature.openings);
  if (feature.bases) result.bases = feature.bases.map(point);
  if (feature.garden?.position) result.garden = {...feature.garden, position:point(feature.garden.position)};
  if (feature.holes) result.holes = feature.holes.map(ring=>ring.map(point));
  if (feature.equipment) result.equipment = feature.equipment.map(e =>
    ({...e, ...(e.position ? {position: point(e.position)} : {})}));
  if (feature.baseball) result.baseball = {...feature.baseball,
    fences: (feature.baseball.fences || []).map(f => ({...f, pts: f.pts.map(point),
      ...(f.openings ? {openings: openings(f.openings)} : {})})),
    dugouts: (feature.baseball.dugouts || []).map(d => ({...d, position: point(d.position)})),
    bleachers: (feature.baseball.bleachers || []).map(d => ({...d, position: point(d.position)}))};
  return result;
}
