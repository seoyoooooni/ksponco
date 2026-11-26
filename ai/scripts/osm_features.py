import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from tm import to5186

RAW = os.path.join(os.path.dirname(HERE), 'raw', 'osm_olympicpark.json')
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'web', 'public', 'data')
REACH = 115

VENUES = {
    'lawn88': (37.51907307551449, 127.12480727425854),
    'lake': (37.52120576755575, 127.12543145557632),
}

WIDTH = {
    'footway': 2.4,
    'path': 1.8,
    'pedestrian': 3.0,
    'cycleway': 2.5,
    'service': 4.0,
    'steps': 2.0,
}


def local(origin):
    oE, oN = to5186(*origin)

    def f(lat, lon):
        E, N = to5186(lat, lon)
        return [round(E - oE, 2), round(-(N - oN), 2)]

    return f


def near(pts):
    return any(math.hypot(x, z) <= REACH for x, z in pts)


def build(vid, origin, elements):
    loc = local(origin)
    paths, areas, water, points = [], [], [], []
    for e in elements:
        tags = e.get('tags', {})
        if e['type'] == 'node':
            kind = tags.get('amenity')
            if kind in ('bench', 'toilets'):
                x, z = loc(e['lat'], e['lon'])
                if math.hypot(x, z) <= REACH:
                    points.append({'kind': kind, 'x': x, 'z': z})
            continue
        pts = [loc(p['lat'], p['lon']) for p in e.get('geometry', [])]
        if len(pts) < 2 or not near(pts):
            continue
        closed = pts[0] == pts[-1]
        hw = tags.get('highway')
        if tags.get('natural') == 'water' and tags.get('water') in ('lake', 'pond') and closed:
            water.append({'name': tags.get('name', ''), 'poly': pts[:-1]})
        elif hw and tags.get('area') == 'yes' and closed:
            areas.append({'kind': hw, 'poly': pts[:-1]})
        elif hw in WIDTH:
            paths.append({'kind': hw, 'width': WIDTH[hw], 'surface': tags.get('surface', ''), 'pts': pts})
    return {
        'source': 'OpenStreetMap contributors (ODbL), Overpass API',
        'reach': REACH,
        'paths': paths,
        'areas': areas,
        'water': water,
        'points': points,
    }


def main():
    data = json.load(open(RAW, encoding='utf-8'))
    for vid, origin in VENUES.items():
        out = build(vid, origin, data['elements'])
        path = os.path.join(OUT, vid, 'osm.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        print(vid, 'paths', len(out['paths']), 'areas', len(out['areas']), 'water', len(out['water']), 'points', len(out['points']), os.path.getsize(path))


main()
