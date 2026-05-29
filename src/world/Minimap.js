/**
 * Circular minimap showing terrain contours
 */
class Minimap {
  constructor(terrain, character, canvasElement) {
    this.terrain = terrain;
    this.character = character;
    this.canvasElement = canvasElement; // Reference to game canvas
    this.radius = 100; // World units to display
    this.size = 150; // Canvas size in pixels
    this.resolution = 80; // Sample resolution
    this.time = 0; // Track time for animations
    
    this.createCanvas();
  }

  createCanvas() {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.style.position = 'absolute';
    this.canvas.style.border = '3px solid #fff';
    this.canvas.style.borderRadius = '50%';
    this.canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.canvas.style.imageRendering = 'pixelated';
    
    this.ctx = this.canvas.getContext('2d');
    
    // Position relative to game canvas
    this.updatePosition();
  }

  updatePosition() {
    // Position minimap inside the game viewport wrapper (bottom-right corner)
    const wrapper = document.getElementById('game-viewport');
    if (wrapper) {
      wrapper.appendChild(this.canvas);
      // Position will be relative to wrapper
      this.canvas.style.bottom = '20px';
      this.canvas.style.right = '20px';
    } else {
      // Fallback to body positioning
      document.body.appendChild(this.canvas);
      const canvasRect = this.canvasElement.getBoundingClientRect();
      this.canvas.style.bottom = `${window.innerHeight - canvasRect.bottom + 20}px`;
      this.canvas.style.right = `${window.innerWidth - canvasRect.right + 20}px`;
    }
  }

  update(deltaTime = 0.016, markers = []) {
    // Update animation time
    this.time += deltaTime;
    
    const ctx = this.ctx;
    const size = this.size;
    const radius = this.radius;
    const resolution = this.resolution;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Create circular clipping mask
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    
    // Fill background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);
    
    const playerPos = this.character.getPosition();
    
    // Sample terrain heights in grid around player
    const heightMap = [];
    const step = (radius * 2) / resolution;
    
    for (let i = 0; i < resolution; i++) {
      heightMap[i] = [];
      for (let j = 0; j < resolution; j++) {
        const worldX = playerPos.x - radius + j * step;
        const worldZ = playerPos.z - radius + i * step;
        
        // Check if point is within circular radius
        const dx = worldX - playerPos.x;
        const dz = worldZ - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist <= radius) {
          heightMap[i][j] = this.terrain.getTerrainHeight(worldX, worldZ);
        } else {
          heightMap[i][j] = null;
        }
      }
    }
    
    // Draw terrain as grayscale height
    const pixelSize = size / resolution;
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        if (heightMap[i][j] !== null) {
          // Map height to grayscale (0-30 range typical)
          const height = heightMap[i][j];
          const brightness = Math.floor(((height + 5) / 35) * 255);
          const clampedBrightness = Math.max(0, Math.min(255, brightness));
          
          ctx.fillStyle = `rgb(${clampedBrightness}, ${clampedBrightness}, ${clampedBrightness})`;
          ctx.fillRect(j * pixelSize, i * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    
    // Draw contour lines (every 5 units of elevation)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    
    const contourInterval = 5;
    const minHeight = -5;
    const maxHeight = 30;
    
    for (let h = minHeight; h <= maxHeight; h += contourInterval) {
      ctx.beginPath();
      
      for (let i = 0; i < resolution - 1; i++) {
        for (let j = 0; j < resolution - 1; j++) {
          if (heightMap[i][j] === null) continue;
          
          const h00 = heightMap[i][j];
          const h10 = heightMap[i][j + 1];
          const h01 = heightMap[i + 1][j];
          const h11 = heightMap[i + 1] ? heightMap[i + 1][j + 1] : null;
          
          // Check if contour crosses this cell
          if (h10 !== null && ((h00 <= h && h10 > h) || (h00 > h && h10 <= h))) {
            // Vertical edge
            const t = (h - h00) / (h10 - h00);
            const x = (j + t) * pixelSize;
            const y = i * pixelSize;
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 1);
          }
          
          if (h01 !== null && ((h00 <= h && h01 > h) || (h00 > h && h01 <= h))) {
            // Horizontal edge
            const t = (h - h00) / (h01 - h00);
            const x = j * pixelSize;
            const y = (i + t) * pixelSize;
            ctx.moveTo(x, y);
            ctx.lineTo(x + 1, y);
          }
        }
      }
      
      ctx.stroke();
    }
    
    // Draw outer circle border
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw compass directions (N, S, E, W)
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    const compassRadius = size / 2 + 14;
    
    // North (top)
    ctx.strokeText('N', size / 2, size / 2 - compassRadius);
    ctx.fillText('N', size / 2, size / 2 - compassRadius);
    
    // South (bottom)
    ctx.strokeText('S', size / 2, size / 2 + compassRadius);
    ctx.fillText('S', size / 2, size / 2 + compassRadius);
    
    // East (right)
    ctx.strokeText('E', size / 2 + compassRadius, size / 2);
    ctx.fillText('E', size / 2 + compassRadius, size / 2);
    
    // West (left)
    ctx.strokeText('W', size / 2 - compassRadius, size / 2);
    ctx.fillText('W', size / 2 - compassRadius, size / 2);
    
    // Calculate pulse animation (3 second cycle)
    const pulsePhase = (this.time % 3.0) / 3.0; // 0 to 1 over 3 seconds
    
    // Draw radar ring expanding outward
    const maxRingRadius = size / 2 - 2; // Don't exceed circle boundary
    const ringRadius = pulsePhase * maxRingRadius; // Expand from 0 to edge
    const ringAlpha = 1.0 - pulsePhase; // Fade as it expands
    const ringWidth = 2;
    
    ctx.strokeStyle = `rgba(0, 102, 255, ${ringAlpha * 0.8})`;
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw solid player position (center dot)
    ctx.fillStyle = '#0066ff';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw markers as red pulsing points
    for (const marker of markers) {
      const markerPos = marker.position;
      
      // Calculate marker position relative to player
      const dx = markerPos.x - playerPos.x;
      const dz = markerPos.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      // Only draw if within radius
      if (dist <= radius) {
        // Convert world position to minimap screen position
        const screenX = size / 2 + (dx / radius) * (size / 2);
        const screenY = size / 2 + (dz / radius) * (size / 2);
        
        // Pulsing animation for markers (offset from main pulse)
        const markerPulsePhase = ((this.time + marker.time) % 1.5) / 1.5; // Faster 1.5s cycle
        const markerPulseValue = Math.sin(markerPulsePhase * Math.PI * 2) * 0.5 + 0.5;
        const markerRadius = 3 + markerPulseValue * 2; // Pulse between 3 and 5 pixels
        const markerAlpha = 0.6 + markerPulseValue * 0.4; // Pulse opacity
        
        // Draw pulsing marker
        ctx.fillStyle = `rgba(255, 0, 0, ${markerAlpha})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, markerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw marker outline
        ctx.strokeStyle = `rgba(255, 255, 255, ${markerAlpha * 0.8})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screenX, screenY, markerRadius + 1, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    // Draw player direction indicator
    const angle = this.character.mesh.rotation.y;
    const dirLength = 8;
    const dirX = Math.sin(angle) * dirLength;
    const dirY = -Math.cos(angle) * dirLength;
    
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.lineTo(size / 2 + dirX, size / 2 + dirY);
    ctx.stroke();
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

export default Minimap;
