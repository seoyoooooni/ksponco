/**
 * @kspo/engine — 프론트(Worker)와 백엔드(사전계산)가 같이 import하는 계산 엔진
 */
export * from "./types.js";
export { sunPosition, sunDirection, sunsetTime, timeSeries, parseTime, formatTime, OLYMPIC_PARK, KST_OFFSET_HOURS, type SunOptions } from "./sun.js";
export { Terrain, type Scene, buildFixedScene, buildEventScene, mergeScenes, occluded } from "./scene.js";
export {
  type GridSpec, gridFromTerrain, cellCenter, cellIndex, isSunlit, sunGridFixed, decodeSunGrid, gridOf,
  applyEventShadows, timeIndex, shadeRatio, findShadeSpots, spotSun, SUN_RAY_MAX, DEFAULT_SAMPLE_HEIGHT, type SunGridOptions,
} from "./shadow.js";
export { viewFrom, placeAudience, EYE_SIT, EYE_STAND } from "./view.js";
export { encodeBits, decodeBits } from "./codec.js";
export { rectPoly, circlePoly, pointInPoly } from "./geometry.js";
export { type WetReason, type WetOptions, type PondOptions, WET_RAIN_MM, HEAVY_RAIN_MM, morningSun, pondAt, wetAt } from "./wet.js";
