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

    this.rockMaterial = new THREE.MeshLambertMaterial({
      color: 0x505050,
      flatShading: true
    });

    this.treeTrunkMaterial = new THREE.MeshLambertMaterial({
      color: 0x4a3325,
      flatShading: true
    });

    this.treeCanopyMaterial = new THREE.MeshLambertMaterial({
      color: 0x1c4f2b,
      flatShading: true
    });

    this.shrubMaterial = new THREE.MeshLambertMaterial({
      color: 0x2f6b3a,
      flatShading: true
    });
  }

  setLightDirection(direction) {
    this.terrainMaterial.uniforms.lightDirection.value.copy(direction);

    for (const chunk of this.chunks.values()) {
      chunk.mesh.material.uniforms.lightDirection.value.copy(direction);
    }
  }

  /**
   * Generate terrain height at given world coordinates
   */
  getBaseTerrainHeight(x, z) {
    const elevation = this.noiseGen.getElevation(x, z);
    const moisture = this.noiseGen.getMoisture(x, z);
    const detail = this.noiseGen.getNoise(x + 500, z + 500, 0.02, 3);
    
    let height = elevation * 11 + detail * 2.5;
    
    // Reduce height near water sources for smooth transitions
    if (moisture > 0.3) {
      height *= 0.7;
    }
    
    // Blend mountains in gradually so the landscape keeps variation without frequent cliffs.
    const mountains = this.noiseGen.getNoise(x, z, 0.005, 6);
    const mountainBlend = THREE.MathUtils.smoothstep(mountains, 0.45, 0.72);
    if (mountainBlend > 0) {
      height += mountainBlend * (mountains - 0.45) * 12;
    }

    return height;
  }

  getTerrainHeight(x, z) {
    let height = this.getBaseTerrainHeight(x, z);

    const lakeBlend = this.getLakeBlend(x, z);
    if (lakeBlend > 0) {
      const lakeFloor = this.waterLevel - 0.28;
      const shorelineEase = THREE.MathUtils.smoothstep(lakeBlend, 0.18, 0.9);
      height = THREE.MathUtils.lerp(height, lakeFloor, shorelineEase * 0.52);
    }
    
    return height;
  }

  getWalkableHeight(x, z) {
    const sampleOffsets = [
      [0, 0, 0.4],
      [0.45, 0, 0.15],
      [-0.45, 0, 0.15],
      [0, 0.45, 0.15],
      [0, -0.45, 0.15]
    ];

    let totalHeight = 0;
    let totalWeight = 0;

    for (const [offsetX, offsetZ, weight] of sampleOffsets) {
      const sampleX = x + offsetX;
      const sampleZ = z + offsetZ;

      totalHeight += this.getTerrainHeight(sampleX, sampleZ) * weight;
      totalWeight += weight;
    }

    if (totalWeight <= 0) {
      return this.getTerrainHeight(x, z);
    }

    return totalHeight / totalWeight;
  }

  getLakeBlend(x, z) {
    if (this.getClimate(x, z) !== CLIMATE_TYPES.ARCTIC) {
      return 0;
    }

    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const chunkOriginX = chunkX * this.chunkSize;
    const chunkOriginZ = chunkZ * this.chunkSize;
    const centerOffsetX = (this.noiseGen.getNoise(chunkX * 4.7 + 18.2, chunkZ * 6.1 - 11.4, 0.6, 1) * 0.5 + 0.5);
    const centerOffsetZ = (this.noiseGen.getNoise(chunkX * 5.3 - 7.9, chunkZ * 4.9 + 22.6, 0.6, 1) * 0.5 + 0.5);
    const lakeCenterX = chunkOriginX + this.chunkSize * (0.42 + centerOffsetX * 0.16);
    const lakeCenterZ = chunkOriginZ + this.chunkSize * (0.42 + centerOffsetZ * 0.16);
    const dx = x - lakeCenterX;
    const dz = z - lakeCenterZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const radiusNoise = this.noiseGen.getNoise(chunkX * 8.3 + 3.1, chunkZ * 7.7 - 5.2, 0.5, 1) * 0.5 + 0.5;
    const baseRadius = 0.14 + radiusNoise * 0.08;
    const shorelineNoise = this.noiseGen.getNoise(x + chunkX * 13.0, z - chunkZ * 9.0, 0.12, 2) * 0.5 + 0.5;
    const shorelineRadius = baseRadius * THREE.MathUtils.lerp(0.88, 1.08, shorelineNoise);
    const guaranteedLakeMask = 1.0 - THREE.MathUtils.smoothstep(shorelineRadius * 0.35, shorelineRadius, distance);
    const baseHeight = this.getBaseTerrainHeight(x, z);

    const moisture = this.noiseGen.getMoisture(x, z);
    const basin = this.noiseGen.getNoise(x - 220, z + 340, 0.018, 3) * 0.5 + 0.5;
    const shelf = this.noiseGen.getNoise(x + 140, z - 170, 0.04, 2) * 0.5 + 0.5;
    const lowHeightMask = 1.0 - THREE.MathUtils.smoothstep(this.waterLevel + 0.02, this.waterLevel + 0.42, baseHeight);

    const moistureMask = THREE.MathUtils.smoothstep(moisture, 0.18, 0.66);
    const basinMask = THREE.MathUtils.smoothstep(basin, 0.34, 0.72);
    const shelfMask = 1.0 - THREE.MathUtils.smoothstep(shelf, 0.68, 0.94);
    const naturalLakeMask = moistureMask * basinMask * shelfMask * lowHeightMask;

    return Math.max(guaranteedLakeMask * lowHeightMask, naturalLakeMask * 0.12);
  }

  isBlockingWater(x, z) {
    const height = this.getTerrainHeight(x, z);
    const slope = this.getTerrainSlope(x, z, 2.5);
    const lakeBlend = this.getLakeBlend(x, z);

    return lakeBlend > 0.58 && slope < 0.18 && height < this.waterLevel + 0.08;
  }

  /**
   * Check if location should be water
   */
  isWater(x, z) {
    const height = this.getTerrainHeight(x, z);
    const slope = this.getTerrainSlope(x, z, 2.5);
    const lakeBlend = this.getLakeBlend(x, z);
    
    // Arctic lakes form in flatter basins with higher moisture.
    return lakeBlend > 0.28 && slope < 0.34 && height < this.waterLevel + 0.24;
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

  getTerrainSlope(x, z, sampleDistance = 1.5) {
    const centerHeight = this.getTerrainHeight(x, z);
    const offsetHeightX = this.getTerrainHeight(x + sampleDistance, z);
    const offsetHeightZ = this.getTerrainHeight(x, z + sampleDistance);

    return Math.max(
      Math.abs(offsetHeightX - centerHeight),
      Math.abs(offsetHeightZ - centerHeight)
    ) / sampleDistance;
  }

  generateRocks(chunkX, chunkZ, climate) {
    if (climate !== CLIMATE_TYPES.STONE) {
      return [];
    }

    const rocks = [];
    const candidateCount = 28;

    for (let index = 0; index < candidateCount; index++) {
      const seedOffset = index * 19.37;
      const scatter = this.noiseGen.getNoise(chunkX * 41.7 + seedOffset, chunkZ * 38.1 - seedOffset, 0.4, 2);
      if (scatter < 0.02) {
        continue;
      }

      const offsetX = (this.noiseGen.getNoise(chunkX * 17.3 + seedOffset, chunkZ * 13.1 + seedOffset, 0.8, 1) * 0.5 + 0.5) * this.chunkSize;
      const offsetZ = (this.noiseGen.getNoise(chunkX * 11.9 - seedOffset, chunkZ * 23.7 + seedOffset, 0.8, 1) * 0.5 + 0.5) * this.chunkSize;
      const worldX = chunkX * this.chunkSize + offsetX;
      const worldZ = chunkZ * this.chunkSize + offsetZ;
      const height = this.getTerrainHeight(worldX, worldZ);
      const slope = this.getTerrainSlope(worldX, worldZ);

      if (this.isWater(worldX, worldZ) || slope > 0.7 || height < this.waterLevel + 0.5) {
        continue;
      }

      const radius = 0.26 + Math.max(0, scatter - 0.08) * 0.72;
      const detail = scatter > 0.55 ? 1 : 0;
      const rockGeometry = new THREE.DodecahedronGeometry(radius, detail);
      const rockMesh = new THREE.Mesh(rockGeometry, this.rockMaterial);
      rockMesh.position.set(worldX, height + radius * 0.7, worldZ);
      rockMesh.rotation.set(
        scatter * Math.PI * 0.35,
        scatter * Math.PI * 1.7,
        scatter * Math.PI * 0.2
      );
      rockMesh.scale.set(
        0.9 + scatter * 0.45,
        0.65 + scatter * 0.55,
        0.85 + scatter * 0.5
      );
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      this.scene.add(rockMesh);
      rocks.push(rockMesh);
    }

    return rocks;
  }

  createTree(worldX, groundHeight, worldZ, size, rotationSeed) {
    const tree = new THREE.Group();

    const trunkHeight = 1.6 * size;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * size, 0.18 * size, trunkHeight, 5),
      this.treeTrunkMaterial
    );
    trunk.position.y = trunkHeight * 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const canopyBase = new THREE.Mesh(
      new THREE.ConeGeometry(0.8 * size, 1.5 * size, 6),
      this.treeCanopyMaterial
    );
    canopyBase.position.y = trunkHeight + 0.5 * size;
    canopyBase.castShadow = true;
    canopyBase.receiveShadow = true;
    tree.add(canopyBase);

    const canopyTop = new THREE.Mesh(
      new THREE.ConeGeometry(0.58 * size, 1.08 * size, 6),
      this.treeCanopyMaterial
    );
    canopyTop.position.y = trunkHeight + 1.15 * size;
    canopyTop.castShadow = true;
    canopyTop.receiveShadow = true;
    tree.add(canopyTop);

    tree.position.set(worldX, groundHeight, worldZ);
    tree.rotation.y = rotationSeed * Math.PI * 2;
    tree.scale.setScalar(0.9 + rotationSeed * 0.25);
    this.scene.add(tree);

    return tree;
  }

  createShrub(worldX, groundHeight, worldZ, size, rotationSeed) {
    const shrub = new THREE.Group();

    for (let clusterIndex = 0; clusterIndex < 3; clusterIndex++) {
      const leaf = new THREE.Mesh(
        new THREE.DodecahedronGeometry((0.28 + clusterIndex * 0.08) * size, 0),
        this.shrubMaterial
      );
      const angle = rotationSeed * Math.PI * 2 + clusterIndex * (Math.PI * 2 / 3);
      const radius = 0.16 * size;
      leaf.position.set(
        Math.cos(angle) * radius,
        0.18 * size + clusterIndex * 0.05 * size,
        Math.sin(angle) * radius
      );
      leaf.scale.set(1.0, 0.72, 1.0);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      shrub.add(leaf);
    }

    shrub.position.set(worldX, groundHeight + 0.03, worldZ);
    shrub.rotation.y = rotationSeed * Math.PI * 2;
    this.scene.add(shrub);

    return shrub;
  }

  generateTrees(chunkX, chunkZ, climate) {
    if (climate !== CLIMATE_TYPES.TROPICAL) {
      return [];
    }

    const groveStrength = this.noiseGen.getNoise(chunkX * 9.7, chunkZ * 9.7, 0.18, 2) * 0.5 + 0.5;
    if (groveStrength < 0.0) {
      return [];
    }

    const trees = [];
    const groveCount = 7 + Math.floor(groveStrength * 5.6);

    for (let groveIndex = 0; groveIndex < groveCount; groveIndex++) {
      const groveSeed = groveIndex * 31.17;
      const centerOffsetX = (this.noiseGen.getNoise(chunkX * 13.1 + groveSeed, chunkZ * 7.3 - groveSeed, 0.5, 1) * 0.5 + 0.5) * this.chunkSize;
      const centerOffsetZ = (this.noiseGen.getNoise(chunkX * 5.9 - groveSeed, chunkZ * 11.7 + groveSeed, 0.5, 1) * 0.5 + 0.5) * this.chunkSize;
      const groveCenterX = chunkX * this.chunkSize + centerOffsetX;
      const groveCenterZ = chunkZ * this.chunkSize + centerOffsetZ;
      const treeCount = 6 + Math.floor(groveStrength * 7);

      for (let treeIndex = 0; treeIndex < treeCount; treeIndex++) {
        const treeSeed = groveSeed + treeIndex * 17.13;
        const angle = (this.noiseGen.getNoise(groveCenterX + treeSeed, groveCenterZ - treeSeed, 0.24, 1) * 0.5 + 0.5) * Math.PI * 2;
        const distance = 1.1 + (this.noiseGen.getNoise(groveCenterX - treeSeed, groveCenterZ + treeSeed, 0.28, 1) * 0.5 + 0.5) * 5.8;
        const worldX = groveCenterX + Math.cos(angle) * distance;
        const worldZ = groveCenterZ + Math.sin(angle) * distance;
        const height = this.getTerrainHeight(worldX, worldZ);
        const slope = this.getTerrainSlope(worldX, worldZ, 2.0);
        const moisture = this.noiseGen.getMoisture(worldX, worldZ);

        if (this.isWater(worldX, worldZ) || slope > 0.52 || height < this.waterLevel + 0.7 || moisture < 0.02) {
          continue;
        }

        const size = 0.9 + (this.noiseGen.getNoise(worldX + treeSeed, worldZ - treeSeed, 0.32, 1) * 0.5 + 0.5) * 0.75;
        const tree = this.createTree(worldX, height, worldZ, size, moisture + treeSeed * 0.01);
        trees.push(tree);
      }
    }

    return trees;
  }

  generateUndergrowth(chunkX, chunkZ, climate) {
    if (climate !== CLIMATE_TYPES.TROPICAL) {
      return [];
    }

    const undergrowth = [];
    const patchCount = 16;

    for (let patchIndex = 0; patchIndex < patchCount; patchIndex++) {
      const patchSeed = patchIndex * 23.41;
      const offsetX = (this.noiseGen.getNoise(chunkX * 15.2 + patchSeed, chunkZ * 8.4 - patchSeed, 0.65, 1) * 0.5 + 0.5) * this.chunkSize;
      const offsetZ = (this.noiseGen.getNoise(chunkX * 9.1 - patchSeed, chunkZ * 14.8 + patchSeed, 0.65, 1) * 0.5 + 0.5) * this.chunkSize;
      const centerX = chunkX * this.chunkSize + offsetX;
      const centerZ = chunkZ * this.chunkSize + offsetZ;
      const patchDensity = this.noiseGen.getMoisture(centerX, centerZ);

      if (patchDensity < 0.12) {
        continue;
      }

      const shrubCount = 2 + Math.floor(patchDensity * 4);
      for (let shrubIndex = 0; shrubIndex < shrubCount; shrubIndex++) {
        const shrubSeed = patchSeed + shrubIndex * 13.7;
        const angle = (this.noiseGen.getNoise(centerX + shrubSeed, centerZ - shrubSeed, 0.45, 1) * 0.5 + 0.5) * Math.PI * 2;
        const distance = 0.3 + (this.noiseGen.getNoise(centerX - shrubSeed, centerZ + shrubSeed, 0.52, 1) * 0.5 + 0.5) * 2.2;
        const worldX = centerX + Math.cos(angle) * distance;
        const worldZ = centerZ + Math.sin(angle) * distance;
        const groundHeight = this.getTerrainHeight(worldX, worldZ);
        const slope = this.getTerrainSlope(worldX, worldZ, 1.8);

        if (this.isWater(worldX, worldZ) || slope > 0.5 || groundHeight < this.waterLevel + 0.65) {
          continue;
        }

        const size = 0.55 + (this.noiseGen.getNoise(worldX + shrubSeed, worldZ - shrubSeed, 0.8, 1) * 0.5 + 0.5) * 0.6;
        undergrowth.push(this.createShrub(worldX, groundHeight, worldZ, size, shrubSeed * 0.031));
      }
    }

    return undergrowth;
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
    
    const rocks = this.generateRocks(chunkX, chunkZ, climate);
    const trees = this.generateTrees(chunkX, chunkZ, climate);
    const undergrowth = this.generateUndergrowth(chunkX, chunkZ, climate);
    const water = this.generateWater(chunkX, chunkZ, climate);

    this.chunks.set(key, { mesh, climate, rocks, trees, undergrowth, water });
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
  generateWater(chunkX, chunkZ, climate) {
    if (climate !== CLIMATE_TYPES.ARCTIC) {
      return null;
    }

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
    if (waterCount > 0) {
      const waterGeometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 32, 32);
      
      // Deform water surface slightly to match terrain
      const waterVertices = waterGeometry.attributes.position.array;
      for (let i = 0; i < 33; i++) {
        for (let j = 0; j < 33; j++) {
          const idx = (i * 33 + j) * 3;
          const worldX = chunkX * this.chunkSize + (j / 32) * this.chunkSize;
          const worldZ = chunkZ * this.chunkSize + (i / 32) * this.chunkSize;
          const height = this.getTerrainHeight(worldX, worldZ);
          
            if (this.getLakeBlend(worldX, worldZ) > 0.18) {
              waterVertices[idx + 2] = 0.08;
          } else {
              waterVertices[idx + 2] = -2.2;
          }
        }
      }
      waterGeometry.attributes.position.needsUpdate = true;
      waterGeometry.computeVertexNormals();
      
      const waterMesh = new THREE.Mesh(waterGeometry, this.waterMaterial);
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.set(
        chunkX * this.chunkSize + this.chunkSize / 2,
        this.waterLevel,
        chunkZ * this.chunkSize + this.chunkSize / 2
      );
      waterMesh.receiveShadow = true;
      this.scene.add(waterMesh);

      return waterMesh;
    }

    return null;
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
