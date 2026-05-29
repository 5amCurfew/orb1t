/**
 * Utility functions for the game
 */

export const CLIMATE_TYPES = {
  ARCTIC: 0,
  TROPICAL: 1,
  STONE: 2
};

export function getClimateFromTemperature(temp) {
  if (temp < -0.3) return CLIMATE_TYPES.ARCTIC;
  if (temp > 0.3) return CLIMATE_TYPES.TROPICAL;
  return CLIMATE_TYPES.STONE;
}

export function getClimateName(climateType) {
  switch(climateType) {
    case CLIMATE_TYPES.ARCTIC: return 'Arctic';
    case CLIMATE_TYPES.TROPICAL: return 'Tropical';
    case CLIMATE_TYPES.STONE: return 'Stone';
    default: return 'Unknown';
  }
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start, end, t) {
  return start + (end - start) * t;
}
