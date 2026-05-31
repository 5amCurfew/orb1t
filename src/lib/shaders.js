/**
 * 1-Bit shader material for retro arcade aesthetic
 */
export const OneBitShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vElevation;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vElevation = position.y;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = mvPosition.xyz;
      
      // World position for edge detection
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  
  fragmentShader: `
    uniform float threshold;
    uniform vec3 lightDirection;
    uniform int climateType; // 0: arctic, 1: tropical, 2: stone
    uniform float time;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vElevation;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    
    // Simple hash function for procedural noise
    float hash(vec2 p) {
      float h = dot(p, vec2(127.1, 311.7));
      return fract(sin(h) * 43758.5453123);
    }
    
    // 2D noise function
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float arcticLakeBlend(vec2 worldPos) {
      vec2 chunkCoord = floor(worldPos / 50.0);
      vec2 chunkOrigin = chunkCoord * 50.0;
      float centerOffsetX = noise(chunkCoord * vec2(4.7, 6.1) + vec2(18.2, -11.4));
      float centerOffsetZ = noise(chunkCoord * vec2(5.3, 4.9) + vec2(-7.9, 22.6));
      vec2 lakeCenter = chunkOrigin + 50.0 * (vec2(0.42) + vec2(centerOffsetX, centerOffsetZ) * 0.16);
      float radiusNoise = noise(chunkCoord * vec2(8.3, 7.7) + vec2(3.1, -5.2));
      float baseRadius = 0.14 + radiusNoise * 0.08;
      float shorelineNoise = noise(worldPos * 0.12 + chunkCoord * vec2(13.0, -9.0));
      float shorelineRadius = baseRadius * mix(0.88, 1.08, shorelineNoise);
      float distanceToCenter = distance(worldPos, lakeCenter);
      float guaranteedLakeMask = 1.0 - smoothstep(shorelineRadius * 0.35, shorelineRadius, distanceToCenter);

      float moisture = noise(worldPos * 0.003 + vec2(81.0, 17.0));
      float basin = noise((worldPos + vec2(-220.0, 340.0)) * 0.018);
      float shelf = noise((worldPos + vec2(140.0, -170.0)) * 0.04);
      float moistureMask = smoothstep(0.18, 0.66, moisture);
      float basinMask = smoothstep(0.34, 0.72, basin);
      float shelfMask = 1.0 - smoothstep(0.68, 0.94, shelf);
      float lowElevationMask = 1.0 - smoothstep(0.52, 0.92, vElevation);
      float naturalLakeMask = moistureMask * basinMask * shelfMask * lowElevationMask;

      return max(guaranteedLakeMask * lowElevationMask, naturalLakeMask * 0.12);
    }
    
    void main() {
      // Calculate lighting
      vec3 lightDir = normalize(lightDirection);
      float light = dot(vNormal, lightDir);
      
      // Calculate surface steepness (based on normal)
      float steepness = 1.0 - abs(vNormal.y);
      float flatness = abs(vNormal.y);
      
      // Smoother lighting
      light = light * 0.5 + 0.5; // Remap from [-1,1] to [0,1]
      
      // === ENHANCED LIGHTING & SHADOWS ===
      
      // 1. Improved Ambient Occlusion (darker in valleys, lighter on peaks)
      float ao = smoothstep(-5.0, 20.0, vElevation) * 0.25 + 0.75; // Stronger height-based AO
      
      // 2. Slope-based shadow enhancement (cliffs get darker)
      float slopeShadow = 1.0 - (steepness * 0.3); // Cliffs are darker
      ao *= slopeShadow;
      
      // 3. Ambient light term (prevents pure black shadows)
      float ambient = 0.24;
      
      // 4. Bias flatter ground brighter and cliff faces darker so terrain reads consistently.
      float terrainShape = mix(0.72, 1.08, smoothstep(0.18, 0.95, flatness));
      float finalLight = light * ao * terrainShape + ambient;
      finalLight = clamp(finalLight, 0.0, 1.0);
      
      // Base shading with enhanced lighting (maintaining gradient)
      float bit = smoothstep(0.3, 0.7, finalLight);
      
      // Calculate distance from camera for LOD - extended range
      float distance = length(vViewPosition);
      float distanceFade = smoothstep(150.0, 40.0, distance); // Much larger radius for texturing
      
      // === EDGE DETECTION / CLIFF OUTLINES ===
      // Draw black outlines on steep terrain (cliffs)
      if (steepness > 0.6) {
        // Create edge lines using world position
        vec2 edgePos = vWorldPosition.xz * 3.0;
        vec2 edgeGrid = fract(edgePos);
        
        // Draw lines at edges of cliffs
        float edgeLine = min(
          smoothstep(0.05, 0.0, edgeGrid.x),
          smoothstep(0.05, 0.0, edgeGrid.y)
        );
        edgeLine += min(
          smoothstep(0.95, 1.0, edgeGrid.x),
          smoothstep(0.95, 1.0, edgeGrid.y)
        );
        
        // Strong edge on very steep surfaces
        float edgeStrength = smoothstep(0.6, 0.85, steepness) * distanceFade;
        bit = mix(bit, 0.0, edgeLine * edgeStrength * 0.8);
      }

      // Height contours give flat areas a readable sense of rise and fall.
      float contourSpacing = 1.6;
      float contourCoord = fract((vElevation + noise(vWorldPosition.xz * 0.25) * 0.18) / contourSpacing);
      float contourLine = 1.0 - smoothstep(0.0, 0.06, min(contourCoord, 1.0 - contourCoord));
      float contourStrength = smoothstep(0.15, 0.85, flatness) * distanceFade * 0.22;
      bit = mix(bit, bit * (1.0 - contourLine * contourStrength), 1.0);
      
      // === STIPPLING WITH SLOPE VARIATION ===
      // Add stippling that varies with slope and lighting
      if (steepness > 0.4 && distanceFade > 0.1) {
        // Create regular dot grid
        vec2 dotPos = vec2(vWorldPosition.x, vWorldPosition.z) * 8.0;
        vec2 dotGrid = fract(dotPos) - 0.5;
        float dotDist = length(dotGrid);
        
        // Dot threshold varies with lighting and steepness
        float lightFactor = light * (1.0 - steepness * 0.5);
        float dotThreshold = mix(0.18, 0.38, lightFactor);
        
        // Show dot if within threshold radius
        float dotMask = 1.0 - smoothstep(dotThreshold - 0.03, dotThreshold, dotDist);
        
        // Apply distance fade
        dotMask *= distanceFade;
        
        // Blend stippling with base shading
        bit = mix(bit, bit * (0.4 + dotMask * 0.3), steepness * 0.8);
      }

      // Add a stable cliff-face darkening pass so drop-offs are readable from either camera side.
      float cliffFace = smoothstep(0.35, 0.85, steepness);
      bit = mix(bit, bit * 0.58, cliffFace * 0.7);

      // === 2. PROCEDURAL GROUND TEXTURE ===
      // Add subtle rock/crack patterns on flatter surfaces
      if (steepness < 0.5) {
        // Multi-scale noise for ground detail
        float groundNoise = noise(vWorldPosition.xz * 4.0) * 0.5;
        groundNoise += noise(vWorldPosition.xz * 12.0) * 0.25;
        groundNoise += noise(vWorldPosition.xz * 30.0) * 0.125;
        
        // Create crack patterns
        float cracks = smoothstep(0.45, 0.5, groundNoise);
        cracks += smoothstep(0.75, 0.8, groundNoise);
        
        // Rock spots
        float rocks = smoothstep(0.65, 0.7, noise(vWorldPosition.xz * 8.0));
        
        // Combine and apply subtly
        float groundDetail = (cracks * 0.15 + rocks * 0.1) * (1.0 - steepness * 2.0);
        groundDetail *= distanceFade; // Fade at distance
        bit = mix(bit, bit * (1.0 - groundDetail), 0.7);
      }
      
      // === 3. DIRECTIONAL HATCHING ===
      // Scan lines that follow terrain slope direction
      if (steepness < 0.6 && distanceFade > 0.2) {
        // Calculate slope direction from normal
        vec2 slopeDir = normalize(vec2(vNormal.x, vNormal.z));
        
        // Create hatching lines perpendicular to slope
        vec2 hatchPos = vWorldPosition.xz;
        float hatchLine = dot(hatchPos, vec2(-slopeDir.y, slopeDir.x));
        
        // Create line pattern
        float hatchPattern = fract(hatchLine * 2.0); // 2 lines per unit
        float hatch = smoothstep(0.45, 0.5, hatchPattern) - smoothstep(0.5, 0.55, hatchPattern);
        
        // Apply hatching subtly, stronger on mid-tones
        float hatchStrength = (1.0 - abs(bit - 0.5) * 2.0) * 0.12; // Strongest at mid-gray
        hatchStrength *= (1.0 - steepness); // Less on steep surfaces
        hatchStrength *= distanceFade;
        
        bit = mix(bit, bit * (1.0 - hatch * hatchStrength), 0.8);
      }
      
      // Map terrain into a narrower grey palette so the base reads as grey and shadows stay darker grey.
      vec3 darkGrey = vec3(0.28, 0.28, 0.3);
      vec3 lightGrey = vec3(0.66, 0.66, 0.68);
      vec3 color = mix(darkGrey, lightGrey, bit);
      if (climateType == 0) {
        // Arctic - slightly blue tint
        color *= vec3(0.94, 0.97, 1.0);

        float lakeBlend = arcticLakeBlend(vWorldPosition.xz);
        float shoreBand = smoothstep(0.16, 0.34, lakeBlend) * (1.0 - smoothstep(0.34, 0.58, lakeBlend));
        color = mix(color, vec3(0.86, 0.92, 1.0), shoreBand * 0.75);
      } else if (climateType == 1) {
        // Tropical - slightly green tint
        color *= vec3(0.93, 0.98, 0.93);
      }
      // Stone keeps neutral greys.
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

export const WaterShader = {
  vertexShader: `
    varying vec2 vUv;
    uniform float time;
    
    void main() {
      vUv = uv;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    void main() {
      vec2 flowUv = vUv * 18.0;
      float ripple = noise(flowUv + vec2(time * 0.45, -time * 0.2));
      float shimmer = noise(flowUv * 1.9 + vec2(-time * 0.7, time * 0.38));
      float sparkles = step(0.84, ripple * 0.62 + shimmer * 0.38);
      float bandSignal = sin((vUv.x + vUv.y) * 58.0 + time * 2.2) * 0.5 + 0.5;
      float bands = (smoothstep(0.82, 0.86, bandSignal) - smoothstep(0.86, 0.9, bandSignal)) * 0.28;
      float foam = clamp(sparkles + bands, 0.0, 1.0);

      vec3 baseColor = vec3(0.12, 0.2, 0.28);
      vec3 color = mix(baseColor, vec3(0.97, 0.99, 1.0), foam);

      gl_FragColor = vec4(color, 0.98);
    }
  `
};
