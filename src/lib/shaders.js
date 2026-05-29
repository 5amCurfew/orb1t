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
    
    void main() {
      // Calculate lighting
      vec3 lightDir = normalize(lightDirection);
      float light = dot(vNormal, lightDir);
      
      // Calculate surface steepness (based on normal)
      float steepness = 1.0 - abs(vNormal.y);
      
      // Smoother lighting
      light = light * 0.5 + 0.5; // Remap from [-1,1] to [0,1]
      
      // === ENHANCED LIGHTING & SHADOWS ===
      
      // 1. Improved Ambient Occlusion (darker in valleys, lighter on peaks)
      float ao = smoothstep(-5.0, 20.0, vElevation) * 0.25 + 0.75; // Stronger height-based AO
      
      // 2. Slope-based shadow enhancement (cliffs get darker)
      float slopeShadow = 1.0 - (steepness * 0.3); // Cliffs are darker
      ao *= slopeShadow;
      
      // 3. Fresnel/Rim lighting (edges catch more light)
      vec3 viewDir = normalize(-vViewPosition);
      float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
      float rimLight = fresnel * 0.25; // Enhanced rim lighting
      
      // 4. Ambient light term (prevents pure black shadows)
      float ambient = 0.2; // Slightly reduced for more contrast
      
      // 5. Combine lighting components
      float finalLight = light * ao + ambient + rimLight;
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
      
      // === 2. SHADOW CASTING (Approximate) ===
      // Simulate shadows from elevated terrain on flat surfaces
      vec3 shadowDir = normalize(vec3(lightDirection.x, 0.0, lightDirection.z));
      float shadowSampleDist = 2.0; // Distance to check for shadow casters
      vec2 shadowPos = vWorldPosition.xz + shadowDir.xz * shadowSampleDist;
      
      // Approximate terrain height at shadow position using noise pattern
      float shadowNoise = noise(shadowPos * 0.05) * 18.0; // Match terrain scale
      float shadowMountain = noise(shadowPos * 0.005);
      if (shadowMountain > 0.4) {
        shadowNoise += (shadowMountain - 0.4) * 25.0;
      }
      
      // If shadow position is higher, cast shadow
      float heightDiff = shadowNoise - vElevation;
      float shadowAmount = smoothstep(0.5, 3.0, heightDiff) * 0.25; // Shadow strength
      shadowAmount *= (1.0 - steepness); // Only on flat surfaces
      bit = mix(bit, bit * (1.0 - shadowAmount), smoothstep(0.0, 0.2, bit)); // Don't darken already dark areas
      
      // === 3. PROCEDURAL GROUND TEXTURE ===
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
      
      // === 4. DIRECTIONAL HATCHING ===
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
      
      // Climate-based tinting (subtle)
      vec3 color = vec3(bit);
      if (climateType == 0) {
        // Arctic - slightly blue tint
        color = vec3(bit * 0.9, bit * 0.95, bit);
      } else if (climateType == 1) {
        // Tropical - slightly green tint
        color = vec3(bit * 0.9, bit, bit * 0.9);
      }
      // Stone keeps pure black/white
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

export const WaterShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float time;
    
    void main() {
      vUv = uv;
      vPosition = position;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      // Create small wave tildes moving across the surface
      float wave1 = sin(vUv.x * 40.0 + time * 2.0) * 0.5 + 0.5;
      float wave2 = sin(vUv.y * 40.0 - time * 1.5) * 0.5 + 0.5;
      float wave3 = sin((vUv.x + vUv.y) * 30.0 + time * 3.0) * 0.5 + 0.5;
      
      // Combine waves
      float waves = (wave1 + wave2 + wave3) / 3.0;
      
      // Create tilde pattern (1-bit style)
      float pattern = step(0.7, waves);
      
      // Black water with white tildes
      vec3 color = vec3(pattern);
      
      gl_FragColor = vec4(color, 0.9);
    }
  `
};
