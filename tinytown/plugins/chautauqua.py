"""Chautauqua Institution: lakefront, gardens, perimeter and grounds scope.

Hooks (see tinytown/site.py):
    landmarks(site, paths)                   authored features from the "landmarks"
                                             sidecar (sites/chautauqua/landmarks.json)
    outline(site, request, overrides, paths) the reviewed non-rectangular outline
                                             from the "outline" sidecar
    scope_filter(elements, request)          mapped buildings whose centroid lies
                                             inside the Institution grounds boundary
                                             (OSM relation 19317589)
"""
import json

from .. import site as _site

GROUNDS_BOUNDARY = 19317589


def authored_features(site, path):
    """Project the geographic sidecar into any requested local frame.

    Garden entry/geometry dimensions stay in the anchor's local metre frame.
    Polygon holes use the same geographic coordinate convention as outlines.
    """
    if not path.exists():
        return []
    point = _site.geo_point(site['center'])
    features = []
    for source in json.loads(path.read_text())['features']:
        feature = {k: v for k, v in source.items() if k != 'coordinates'}
        feature['pts'] = [point(p) for p in source['coordinates']]
        if 'holes' in source:
            feature['holes'] = [[point(p) for p in ring] for ring in source['holes']]
        if source.get('garden', {}).get('coordinates'):
            garden = {k: v for k, v in source['garden'].items() if k != 'coordinates'}
            garden['position'] = point(source['garden']['coordinates'])
            feature['garden'] = garden
        features.append(feature)
    return features


def landmarks(site, paths):
    path = _site.authored_path(paths, 'landmarks')
    return authored_features(site, path) if path else []


def outline(site, request, overrides, paths):
    """The reviewed geographic outline; it survives source rebuilds."""
    path = _site.authored_path(paths, 'outline')
    if path and path.exists():
        return json.loads(path.read_text())
    return None


def grounds_ring(elements):
    """The closed [lon, lat] ring of the Institution grounds boundary.

    Accepts an Overpass extract with member geometry or a map-API extract with
    way node references. Raises when the relation is absent or does not close.
    """
    by_id = {(e['type'], e['id']): e for e in elements}
    relation = by_id.get(('relation', GROUNDS_BOUNDARY))
    if relation is None:
        raise ValueError(f'the grounds boundary (relation {GROUNDS_BOUNDARY}) is not in the cached source; '
                         f'fetch it into source/grounds-osm.json first')
    if any(m['role'] == 'inner' for m in relation['members']):
        raise ValueError('The grounds boundary now has holes; review its scope.')
    ways = []
    for member in relation['members']:
        if member['type'] != 'way' or member['role'] != 'outer':
            continue
        if 'geometry' in member:
            ways.append([[p['lon'], p['lat']] for p in member['geometry']])
        else:
            way = by_id['way', member['ref']]
            ways.append([[by_id['node', n]['lon'], by_id['node', n]['lat']] for n in way['nodes']])
    ring = ways.pop(0)
    while ways:
        for index, way in enumerate(ways):
            if way[0] == ring[-1]:
                ring.extend(way[1:]); ways.pop(index); break
            if way[-1] == ring[-1]:
                ring.extend(way[-2::-1]); ways.pop(index); break
        else:
            raise ValueError('Incomplete or disconnected grounds boundary.')
    if ring[0] != ring[-1]:
        raise ValueError('The grounds boundary must close.')
    return ring


def scope_filter(elements, request):
    """Mapped buildings whose centroid lies inside the grounds boundary."""
    ring = grounds_ring(elements)
    chosen = []
    for element in elements:
        if 'building' not in element.get('tags', {}):
            continue
        outer = _site.building_ring(element)
        if not outer:
            continue
        lon = sum(p['lon'] for p in outer) / len(outer)
        lat = sum(p['lat'] for p in outer) / len(outer)
        if _site.contains(ring, lon, lat):
            chosen.append(element)
    return chosen
