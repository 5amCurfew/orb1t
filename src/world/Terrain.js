import * as THREE from 'three';
import NoiseGenerator from '../lib/noise.js';
import { OneBitShader, WaterShader } from '../lib/shaders.js';
import { getClimateFromTemperature, CLIMATE_TYPES } from '../lib/utils.js';

/**
 * Terrain generator for moon-like landscape
 */
class Terrain {
  constructor(scene, worldSize = 1000) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.noiseGen = new NoiseGenerator();
    this.chunkSize = 50;
    this.chunks = new Map();
    this.waterLevel = 0.5; // Raise water level for better integration
    this.time = 0;
    
    // Terrain material with 1-bit shader
    this.createMaterials();
  }

  createMaterials() {
    // Main terrain material
    this.terrainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        threshold: { value: 0.5 },
        lightDirection: { value: new THREE.Vector3(1, 1, 1).normalize() },
        climateType: { value: CLIMATE_TYPES.STONE },
        time: { value: 0 }
      },
      vertexShader: OneBitShader.vertexShader,
      fragmentShader: OneBitShader.fragmentShader,
      side: THREE.DoubleSide
    });

    // Water material
    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: WaterShader.vertexShader,
      fragmentShader: WaterShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });
  }

  /**
   * Generate terrain height at given world coordinates
   */
  getTerrainHeight(x, z) {
    const elevation = this.noiseGen.getElevation(x, z);
    const moisture = this.noiseGen.getMoisture(x, z);
    
    // More dramatic terrain
    let height = elevation * 18; // Increased from 8
    
    // Reduce height near water sources for smooth transitions
    if (moisture > 0.3) {
      height *= 0.5;
    }
    
    // Add dramatic mountainous regions
    const mountains = this.noiseGen.getNoise(x, z, 0.005, 6);
    if (mountains > 0.4) {
      height += (mountains - 0.4) * 25; // More dramatic mountains
    }
    
    return height;
  }

  /**
   * Check if location should be water
   */
  isWater(x, z) {
    const moisture = this.noiseGen.getMoisture(x, z);
    const height = this.getTerrainHeight(x, z);
    
    // Water in low-lying moisture-rich areas with smooth blending
    return moisture > 0.5 && height < this.waterLevel + 0.5;
  }

  /**
   * Check if location is inside a cave
   */
  isCave(x, y, z) {
    // Caves disabled for now
    return false;
  }

  /**
   * Get climate type at location
   */
  getClimate(x, z) {
    const temp = this.noiseGen.getTemperature(x, z);
    return getClimateFromTemperature(temp);
  }

  /**
   * Generate a terrain chunk
   */
  generateChunk(chunkX, chunkZ) {
    const key = `${chunkX}_${chunkZ}`;
    if (this.chunks.has(key)) return;

    const resolution = 32;
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize, 
      this.chunkSize, 
      resolution - 1, 
      resolution - 1
    );

    const vertices = geometry.attributes.position.array;

    // Generate heights - ensure continuity at chunk boundaries
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const idx = (i * resolution + j) * 3;
        // Use (resolution - 1) to ensure edges align properly between chunks
        const worldX = chunkX * this.chunkSize + (j / (resolution - 1)) * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize + (i / (resolution - 1)) * this.chunkSize;
        
        const height = this.getTerrainHeight(worldX, worldZ);
        vertices[idx + 2] = height; // Y is up in our coordinate system after rotation
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    // Get dominant climate for this chunk
    const centerX = chunkX * this.chunkSize + this.chunkSize / 2;
    const centerZ = chunkZ * this.chunkSize + this.chunkSize / 2;
    const climate = this.getClimate(centerX, centerZ);

    // Create material instance for this chunk
    const material = this.terrainMaterial.clone();
    material.uniforms.climateType.value = climate;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      chunkX * this.chunkSize + this.chunkSize / 2,
      0,
      chunkZ * this.chunkSize + this.chunkSize / 2
    );
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    this.scene.add(mesh);
    
    // Grid removed - using enhanced shader-based terrain visualization
    // this.addContourLines(chunkX, chunkZ, geometry);
    
    this.chunks.set(key, { mesh, climate });

    // Water removed for now
  }
  
  /**
   * Add square grid lines to terrain
   */
  addContourLines(chunkX, chunkZ, geometry) {
    const resolution = 64; // Higher resolution for tighter grid following
    
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0x000000, 
      opacity: 0.3,
      transparent: true
    });
    
    const lines = [];
    
    // Horizontal lines (along X axis) - draw every 2nd line to maintain spacing
    for (let i = 0; i < resolution; i += 2) {
      const points = [];
      for (let j = 0; j < resolution; j++) {
        const worldX = chunkX * this.chunkSize + (j / (resolution - 1)) * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize + (i / (resolution - 1)) * this.chunkSize;
        const height = this.getTerrainHeight(worldX, worldZ);
        
        points.push(new THREE.Vector3(worldX, height + 0.03, worldZ));
      }
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      this.scene.add(line);
      lines.push(line);
    }
    
    // Vertical lines (along Z axis) - draw every 2nd line to maintain spacing
    for (let j = 0; j < resolution; j += 2) {
      const points = [];
      for (let i = 0; i < resolution; i++) {
        const worldX = chunkX * this.chunkSize + (j / (resolution - 1)) * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize + (i / (resolution - 1)) * this.chunkSize;
        const height = this.getTerrainHeight(worldX, worldZ);
        
        points.push(new THREE.Vector3(worldX, height + 0.03, worldZ));
      }
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      this.scene.add(line);
      lines.push(line);
    }
    
    // Store for cleanup
    const key = `${chunkX}_${chunkZ}`;
    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.gridLines = lines;
    }
  }

  /**
   * Generate water features for a chunk
   */
  generateWater(chunkX, chunkZ) {
    const resolution = 16; // More resolution for better water detection
    let waterCount = 0;

    // Check if this chunk needs water
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const worldX = chunkX * this.chunkSize + (j / resolution) * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize + (i / resolution) * this.chunkSize;
        
        if (this.isWater(worldX, worldZ)) {
          waterCount++;
        }
      }
    }

    // Only add water if significant portion of chunk is water
    if (waterCount > resolution * resolution * 0.3) {
      const waterGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 32, 32);
      
      // Deform water surface slightly to match terrain
      const waterVertices = waterGeometry.attributes.position.array;
      for (let i = 0; i < 33; i++) {
        for (let j = 0; j < 33; j++) {
          const idx = (i * 33 + j) * 3;
          const worldX = chunkX * this.chunkSize + (j / 32) * this.chunkSize;
          const worldZ = chunkZ * this.chunkSize + (i / 32) * this.chunkSize;
          const height = this.getTerrainHeight(worldX, worldZ);
          
          // Slight elevation to blend with terrain
          if (height < this.waterLevel) {
            waterVertices[idx + 2] = this.waterLevel - height * 0.1;
          }
        }
      }
      waterGeometry.attributes.position.needsUpdate = true;
      
      const waterMesh = new THREE.Mesh(waterGeometry, this.waterMaterial);
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.set(
        chunkX * this.chunkSize + this.chunkSize / 2,
        this.waterLevel,
        chunkZ * this.chunkSize + this.chunkSize / 2
      );
      this.scene.add(waterMesh);
      
      const key = `${chunkX}_${chunkZ}`;
      const chunk = this.chunks.get(key);
      if (chunk) {
        chunk.water = waterMesh;
      }
    }
  }

  /**
   * Update terrain around player position
   */
  update(playerX, playerZ, deltaTime) {
    this.time += deltaTime;
    this.waterMaterial.uniforms.time.value = this.time;

    const chunkX = Math.floor(playerX / this.chunkSize);
    const chunkZ = Math.floor(playerZ / this.chunkSize);
    const viewDistance = 3;

    // Generate chunks around player
    for (let x = chunkX - viewDistance; x <= chunkX + viewDistance; x++) {
      for (let z = chunkZ - viewDistance; z <= chunkZ + viewDistance; z++) {
        // Keep within world bounds
        if (Math.abs(x * this.chunkSize) < this.worldSize / 2 && 
            Math.abs(z * this.chunkSize) < this.worldSize / 2) {
          this.generateChunk(x, z);
        }
      }
    }
  }

  /**
   * Get climate at specific position
   */
  getClimateAt(x, z) {
    return this.getClimate(x, z);
  }
}

export default Terrain;
