import json, math, random, sys, pathlib
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
random.seed(88)
x0, z0, nx, nz = -70, -45, 141, 111

def shore(x):
    return -12 - (x / 70) ** 2 * 14

def rise(z):
    if z < 12: return 0.0
    if z < 48: return (1 + math.floor((z - 12) / 4)) * 0.5
    if z < 62: return 5.0 * (62 - z) / 14
    return 0.0

def side(x):
    a = abs(x)
    return 1.0 if a < 52 else max(0.0, (66 - a) / 14)

h, src = [], []
for j in range(nz):
    for i in range(nx):
        x, z = x0 + i, z0 + j
        s = shore(x)
        if z < s:
            hv, sv = -1.2, 1
        elif z < s + 3:
            hv, sv = 0.3, 1
        elif z < 10 and abs(x) < 30:
            hv, sv = 0.4, 1
        else:
            hv, sv = 0.6 + rise(z) * side(x), 0
        if i < 2 or j < 2 or i > nx - 3 or j > nz - 3:
            sv = 1
        h.append(round(hv, 2)); src.append(sv)
(out / 'terrain.json').write_text(json.dumps({"x0": x0, "z0": z0, "nx": nx, "nz": nz, "cell": 1, "h": h, "src": src}, separators=(',', ':')))

water = [[x, round(shore(x) + 0.5, 2)] for x in range(-200, 201, 5)] + [[200, -320], [-200, -320]]
stage = {"x": 0, "z": -6, "w": 22, "d": 8, "deckH": 1.2, "roofH": 10, "azimuth": 180}
venue = {
    "id": "lake", "name": "88호수 수변무대", "origin5186": [209700.0, 547300.0],
    "originNote": "목업: 호수를 등진 고정 무대와 계단식 잔디 객석을 가정한 시연용 좌표(원점은 무대 앞)",
    "stage": "fixed", "fixedStage": stage, "seating": "terrace", "defaultLayout": "layout_default.json",
    "water": water,
}
(out / 'venue.json').write_text(json.dumps(venue, ensure_ascii=False, indent=2))

layout = {
    "id": "default", "venue": "lake", "source": "default", "sourceNote": "목업: 고정 무대 앞 스탠딩, 계단식 잔디 객석에 돗자리",
    "performer": {"x": 0, "z": -3.5, "h": 1.7},
    "screens": [
        {"x": -16, "z": -3, "w": 6, "h": 3.6, "bottom": 3.4, "azimuth": 180},
        {"x": 16, "z": -3, "w": 6, "h": 3.6, "bottom": 3.4, "azimuth": 180},
    ],
    "zones": [
        {"type": "standing", "poly": [[-22, 1], [22, 1], [22, 10], [-22, 10]], "density": 2.0},
        {"type": "picnic", "poly": [[-27, 13], [27, 13], [43, 47], [-43, 47]], "density": 0.8},
        {"type": "aisle", "poly": [[-1, 13], [1, 13], [1, 47], [-1, 47]]},
    ],
    "mat": {"w": 1.8, "d": 1.2, "people": 2},
}
(out / 'layout_default.json').write_text(json.dumps(layout, ensure_ascii=False, indent=2))

trees = []
def add(x, z, src='scan'):
    if z < shore(x) + 2: return
    hh = round(random.uniform(9, 14), 1)
    trees.append({"x": round(x, 1), "z": round(z, 1), "h": hh, "base": round(hh * random.uniform(0.24, 0.32), 1), "r": round(random.uniform(3.4, 5.0), 1), "source": src})
for sgn in (-1, 1):
    for k, x in enumerate(range(34, 64, 7)):
        add(sgn * (x + random.uniform(-1.5, 1.5)), shore(sgn * x) + 4 + random.uniform(0, 2), 'satellite' if k % 3 == 0 else 'scan')
    for k, z in enumerate(range(4, 56, 8)):
        add(sgn * (57 + random.uniform(-2, 2)), z + random.uniform(-1.5, 1.5), 'satellite' if k % 4 == 1 else 'scan')
    for z in (20, 33):
        add(sgn * (48 + random.uniform(-1, 1)), z + random.uniform(-1, 1))
for k, x in enumerate(range(-44, 45, 9)):
    add(x + random.uniform(-2, 2), 55 + random.uniform(-1.5, 2), 'satellite' if k % 3 == 2 else 'scan')
(out / 'trees.json').write_text(json.dumps(trees, separators=(',', ':')))

buildings = [{"name": "수변무대 관리동 (목업)", "base": 0.6, "height": 5.0, "footprint": [[40, -14], [52, -14], [52, -6], [40, -6]], "source": "model"}]
(out / 'buildings.json').write_text(json.dumps(buildings, ensure_ascii=False, indent=2))
print(len(trees), 'trees')
