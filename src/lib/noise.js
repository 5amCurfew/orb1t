import { createNoise2D } from 'simplex-noise';

/**
 * Noise generator utility for procedural terrain
 */
class NoiseGenerator {
  constructor(seed = Date.now()) {
    this.noise2D = createNoise2D(() => this.seededRandom(seed));
    this.seed = seed;
  }

  seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Generate noise value at given coordinates
   * @param {number} x 
   * @param {number} y 
   * @param {number} scale - Frequency of noise
   * @param {number} octaves - Number of noise layers
   * @returns {number} Noise value between -1 and 1
   */
  getNoise(x, y, scale = 1, octaves = 4) {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  }

  /**
   * Generate different noise for different features
   */
  getElevation(x, z) {
    return this.getNoise(x, z, 0.01, 6);
  }

  getMoisture(x, z) {
    return this.getNoise(x + 1000, z + 1000, 0.02, 3);
  }

  getTemperature(x, z) {
    return this.getNoise(x + 2000, z + 2000, 0.005, 2);
  }

  getCaves(x, z) {
    return this.getNoise(x + 3000, z + 3000, 0.05, 2);
  }
}

export default NoiseGenerator;
