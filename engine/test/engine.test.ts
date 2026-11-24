import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Layout, type VenueData, Terrain, applyEventShadows, buildEventScene, buildFixedScene, decodeBits, decodeSunGrid,
  encodeBits, findShadeSpots, isSunlit, mergeScenes, placeAudience, rectPoly, shadeRatio, spotSun, sunGridFixed, sunPosition,
  sunsetTime, viewFrom,
} from "../src/index.js";

/** 평평한 100m × 100m 장소 (높이 0) */
function flatVenue(extra: Partial<VenueData> = {}): VenueData {
  const nx = 101, nz = 101;
  return {
    venue: { id: "lawn88", name: "test", origin5186: [0, 0], originNote: "test", stage: "temporary", fixedStage: null, seating: "lawn", defaultLayout: "layout_default.json" },
    terrain: { x0: -50, z0: -50, nx, nz, cell: 1, h: new Array(nx * nz).fill(0) },
    trees: [],
    buildings: [],
    ...extra,
  };
}

test("해 위치: 하지 남중 고도 ≈ 90 − 위도 + 23.44", () => {
  const s = sunPosition("2026-06-21", "12:33", { refraction: false });
  assert.ok(Math.abs(s.altitude - (90 - 37.5207 + 23.44)) < 0.1, `alt ${s.altitude}`);
  assert.ok(Math.abs(s.azimuth - 180) < 1, `az ${s.azimuth}`);
  // 남쪽 해 → 방향 벡터 z 양수(+z 남)
  assert.ok(s.dir[2] > 0 && Math.abs(s.dir[0]) < 0.05);
});

test("해 위치: 서울 하지 일몰 19:5x, 동지 일몰 17:1x", () => {
  assert.ok(/^19:5\d$/.test(sunsetTime("2026-06-21")));
  assert.ok(/^17:1\d$/.test(sunsetTime("2026-12-21")));
});

test("비트 묶음 base64 왕복", () => {
  const bits = Array.from({ length: 2385 }, (_, i) => (i * 7919) % 3 === 0 ? 1 : 0);
  assert.deepEqual(Array.from(decodeBits(encodeBits(bits), bits.length)), bits);
});

test("건물 그림자 길이 = 높이 / tan(고도)", () => {
  // 남쪽 건물(정사각 10m, 높이 10m). 정오에 해는 남쪽 → 그림자는 건물 북쪽(−z)으로
  const data = flatVenue({ buildings: [{ name: "box", base: 0, height: 10, footprint: rectPoly(0, 0, 10, 10, 0), source: "gis" }] });
  const scene = buildFixedScene(data), t = scene.terrain!;
  const sun = sunPosition("2026-12-21", "12:30");
  const L = (10 - 0.3) / Math.tan((sun.altitude * Math.PI) / 180); // 판정 높이 0.3m
  assert.equal(isSunlit(scene, t, 0, -5 - L * 0.9, sun), false);
  assert.equal(isSunlit(scene, t, 0, -5 - L * 1.1, sun), true);
  assert.equal(isSunlit(scene, t, 0, 8, sun), true); // 남쪽은 햇볕
});

test("나무 그늘과 해 진 뒤", () => {
  const data = flatVenue({ trees: [{ x: 0, z: 0, h: 9, base: 3, r: 4, source: "scan" }] });
  const scene = buildFixedScene(data), t = scene.terrain!;
  const noon = sunPosition("2026-08-15", "12:30");
  assert.equal(isSunlit(scene, t, 0, -2, noon), false); // 나무 바로 북쪽
  assert.equal(isSunlit(scene, t, 0, 20, noon), true);
  const sp = spotSun(scene, t, 0, 20, "2026-08-15", "18:00", "21:00");
  assert.equal(sp.state.at(-1), "night");
  assert.ok(sp.shadeFrom !== null);
});

test("사전계산 격자 + 행사 그늘막 합치기", () => {
  const data = flatVenue();
  const sg = sunGridFixed(data, "2026-08-15", { t0: "12:00", step: 30, nt: 4 });
  const bits = decodeSunGrid(sg);
  assert.ok(bits[0].every((b) => b === 1)); // 아무것도 없으면 전부 햇볕
  const ev = buildEventScene(data, null, [{ x: 0, z: 0, w: 6, d: 6, h: 3 }]);
  const merged = applyEventShadows(sg, bits, ev, new Terrain(data.terrain));
  const shaded = merged[0].reduce((a, b) => a + (b ? 0 : 1), 0);
  assert.ok(shaded >= 4 && shaded <= 16, `shaded cells ${shaded}`); // 6m×6m 그림자 ≈ 2m 칸 9개 안팎
  const spots = findShadeSpots(sg, merged, "12:00", "14:00", 10, 10);
  assert.ok(spots.length > 0 && spots[0].dist < 15);
  assert.ok(shadeRatio(sg, merged, "12:00", "14:00").some((r) => r === 1));
});

test("시야: 앞 나무와 앞 관객이 가림", () => {
  const layout: Layout = {
    id: "t", venue: "lawn88", source: "default",
    stage: { x: 0, z: -30, w: 20, d: 10, deckH: 1.5, roofH: 12, azimuth: 180 },
    performer: { x: 0, z: -28, h: 1.7 },
    screens: [{ x: 15, z: -28, w: 6, h: 4, bottom: 5, azimuth: 180 }],
    zones: [{ type: "standing", poly: [[-10, -20], [10, -20], [10, -10], [-10, -10]], density: 2 }],
    mat: { w: 1.8, d: 1.2, people: 2 },
  };
  const open = flatVenue();
  const t = new Terrain(open.terrain);
  const noCrowd = { ...layout, zones: [] };
  const sceneOpen = mergeScenes(buildFixedScene(open), buildEventScene(open, noCrowd));
  const clear = viewFrom(open, noCrowd, sceneOpen, t, [], 0, 10);
  assert.equal(clear.stage.pct, 100);
  assert.ok(clear.screens[0].pct === 100 && clear.bestScreen === 0);

  // 사이에 나무
  const treed = flatVenue({ trees: [{ x: 0, z: 0, h: 8, base: 0.5, r: 3, source: "scan" }] });
  const sceneTree = mergeScenes(buildFixedScene(treed), buildEventScene(treed, noCrowd));
  assert.ok(viewFrom(treed, noCrowd, sceneTree, t, [], 0, 10).stage.pct < 50);

  // 스탠딩 관객 뒤에 앉으면 거의 안 보이고, 서면 더 보임
  const crowd = placeAudience(layout, t);
  const sceneCrowd = mergeScenes(buildFixedScene(open), buildEventScene(open, layout));
  const sit = viewFrom(open, layout, sceneCrowd, t, crowd, 0, -5, 0.8).stage.pct;
  const stand = viewFrom(open, layout, sceneCrowd, t, crowd, 0, -5, 1.6).stage.pct;
  assert.ok(sit < stand, `sit ${sit} stand ${stand}`);
});
