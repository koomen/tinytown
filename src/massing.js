// Authoring-only preview. Loaded on demand; full geometry remains in the draft.
export function massingBlueprint(source) {
  const bp = structuredClone(source);
  bp.wall = '#a6aaa4'; bp.trim = '#69716a'; bp.roofColor = '#69716a'; bp.details = [];
  for (const v of bp.volumes) {
    v.wall = bp.wall; v.trim = bp.trim;
    // Preserve whether the source has split walls. Introducing upperWall on a
    // raised roof carrier uses the default split (3.6 m), below its bottom,
    // and builds a negative-height RoundedBoxGeometry with huge curved sheets.
    if (v.upperWall) v.upperWall = bp.wall;
    v.roof = {...v.roof, color: bp.roofColor, gableColor: bp.wall};
    delete v.chimneys; delete v.beltCourses;
    v.cornice = {...v.cornice, dentils: false, color: bp.trim};
    for (const face of Object.values(v.faces || {})) {
      if (!face || typeof face !== 'object') continue;
      delete face.signs; delete face.awnings;
      for (const st of face.storeys || []) if (st.windows) {
        Object.assign(st.windows, {trim: bp.trim, glass: '#49534d', mullions: false, hood: false, shutters: false, planter: false});
        delete st.windows.divisions;
      }
      for (const door of face.doors || []) Object.assign(door, {color: '#49534d', lamp: false});
    }
  }
  return bp;
}
