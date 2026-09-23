"""Avon, New York: surveyed recreation geometry in the site's exact local frame.

Hooks (see tinytown/site.py):
    landmarks(site, paths)  authored features from the "landmarks" sidecar named
                            in sites/<site>/site.json (sites/avon-extended/landmarks.json)

The sidecar stores geographic [lon, lat] coordinates so the same features fall
in the right place for any site sharing the survey (including avon-extended). No
approximate locations, generated stream paths, or guessed baseball diamonds.
"""
import json

from .. import site as _site


def authored_features(site, path):
    """Project a landmarks sidecar into `site`'s local frame.

    Pitch bases, playground equipment, fence/gate openings and baseball fences,
    dugouts and bleachers all follow the geographic origin; angles and lengths
    stay as authored.
    """
    project = _site.geo_point(site['center'])

    def openings(items):
        return [dict(item, point=project(item['coordinates'])) for item in items]

    result = []
    for raw in json.loads(path.read_text())['features']:
        f = dict(raw)
        f['pts'] = [project(p) for p in f.pop('coordinates')]
        if f.get('bases'):
            f['bases'] = [project(p) for p in f['bases']]
        if f.get('equipment'):
            f['equipment'] = [dict(e, position=project(e['coordinates'])) for e in f['equipment']]
        if f.get('openings'):
            f['openings'] = openings(f['openings'])
        if f.get('baseball'):
            # Keys the survey leaves out stay out (the renderer treats absent and
            # empty alike, and the authored overrides were generated that way).
            baseball = dict(f['baseball'])
            if baseball.get('surfaces'):
                baseball['surfaces'] = [dict(surface, pts=[project(p) for p in surface['coordinates']])
                                        for surface in baseball['surfaces']]
            if baseball.get('pitcher'):
                baseball['pitcher'] = project(baseball['pitcher'])
            if baseball.get('fences'):
                fences = []
                for raw_fence in baseball['fences']:
                    fence = dict(raw_fence)
                    fence['pts'] = [project(p) for p in fence.pop('coordinates')]
                    if fence.get('openings'):
                        fence['openings'] = openings(fence['openings'])
                    fences.append(fence)
                baseball['fences'] = fences
            if baseball.get('dugouts'):
                baseball['dugouts'] = [dict(dugout, position=project(dugout['coordinates']))
                                       for dugout in baseball['dugouts']]
            if baseball.get('bleachers'):
                baseball['bleachers'] = [dict(seat, position=project(seat['coordinates']))
                                         for seat in baseball['bleachers']]
            f['baseball'] = baseball
        result.append(f)
    return result


def landmarks(site, paths):
    path = _site.authored_path(paths, 'landmarks')
    if not path or not path.exists():
        return []
    return authored_features(site, path)
