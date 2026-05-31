import * as THREE from 'three';
import Terrain from './world/Terrain.js';
import Character from './character/Character.js';
import IsometricCamera from './world/IsometricCamera.js';
import Minimap from './world/Minimap.js';
import { getClimateName } from './lib/utils.js';

/**
 * Main game class
 */
class Game {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.terrain = null;
    this.character = null;
    this.cameraController = null;
    this.minimap = null;
    this.markers = []; // Store placed markers
    this.sunLight = null;
    
    this.lastTime = 0;
    
    this.init();
    this.animate();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

    // Create camera (perspective for 3D clarity)
    this.camera = new THREE.PerspectiveCamera(
      60,
      16 / 9, // Horizontal rectangle aspect ratio
      0.1,
      1000
    );

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false }); // No AA for crisp 1-bit look
    
    // Make viewport horizontal rectangle at 90% of window
    const viewportWidth = window.innerWidth * 0.9;
    const viewportHeight = viewportWidth * (9 / 16); // 16:9 aspect ratio
    this.renderer.setSize(viewportWidth, viewportHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // Hard shadows for 1-bit style
    
    // Add border to canvas
    this.renderer.domElement.style.border = '3px solid #ffffff';
    
    const container = document.getElementById('canvas-container');
    
    // Create wrapper for canvas and UI
    const viewportWrapper = document.createElement('div');
    viewportWrapper.id = 'game-viewport';
    viewportWrapper.appendChild(this.renderer.domElement);
    
    // Move HUD and controls into wrapper
    const hud = document.getElementById('hud');
    const controls = document.getElementById('controls');
    viewportWrapper.appendChild(hud);
    viewportWrapper.appendChild(controls);
    
    container.appendChild(viewportWrapper);
    
    // Center the wrapper
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    
    // Store viewport dimensions for UI positioning
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    // Create terrain
    this.terrain = new Terrain(this.scene, 1000);

    // Add lighting
    this.setupLighting();

    // Create character (pass camera for screen-relative movement)
    this.character = new Character(this.scene, this.terrain, this.camera);

    // Setup camera controller
    this.cameraController = new IsometricCamera(this.camera, this.character);

    // Create minimap
    this.minimap = new Minimap(this.terrain, this.character, this.renderer.domElement);

    // Setup marker placement input
    this.setupMarkerInput();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());

    console.log('Game initialized!');
    console.log('Controls: Arrow Keys - Move, W - Jump, R - Shoot, Q - Place Marker, E - Rotate Camera');
  }

  setupLighting() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambientLight);

    // Directional light (sun) for shadows
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.position.set(90, 55, 45);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    if (this.terrain) {
      this.terrain.setLightDirection(this.getSunLightDirection());
    }
  }

  getSunLightDirection() {
    return this.sunLight.position.clone().sub(this.sunLight.target.position).normalize();
  }

  setupMarkerInput() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyQ') {
        this.placeMarker();
      }
    });
  }

  placeMarker() {
    const pos = this.character.getPosition();
    const groundHeight = this.terrain.getTerrainHeight(pos.x, pos.z);
    
    // Create marker mesh
    const markerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
    
    markerMesh.position.set(pos.x, groundHeight + 1, pos.z);
    this.scene.add(markerMesh);
    
    // Store marker with random time offset for pulse variation
    this.markers.push({
      position: new THREE.Vector3(pos.x, groundHeight, pos.z),
      mesh: markerMesh,
      time: Math.random() * 1.5 // Random offset for pulsing animation
    });
    
    console.log(`Marker placed at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
  }

  updateHUD() {
    const pos = this.character.getPosition();
    const climate = this.terrain.getClimateAt(pos.x, pos.z);
    
    document.getElementById('position').textContent = 
      `Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
    document.getElementById('climate').textContent = 
      `Climate: ${getClimateName(climate)}`;
  }

  animate(currentTime = 0) {
    requestAnimationFrame((time) => this.animate(time));

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp delta time to avoid large jumps
    const dt = Math.min(deltaTime, 0.1);

    // Update game objects
    if (this.character && this.terrain && this.cameraController) {
      const cameraRotation = this.cameraController.getRotationIndex();
      this.character.update(dt, cameraRotation);
      this.terrain.update(
        this.character.position.x,
        this.character.position.z,
        dt
      );
      this.cameraController.update(dt);
      
      // Update minimap
      if (this.minimap) {
        this.minimap.update(dt, this.markers);
      }
      
      // Update HUD
      this.updateHUD();
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const viewportWidth = window.innerWidth * 0.9;
    const viewportHeight = viewportWidth * (9 / 16);
    this.camera.aspect = 16 / 9;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(viewportWidth, viewportHeight);
    
    // Update viewport dimensions
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    
    // Update minimap position
    if (this.minimap) {
      this.minimap.updatePosition();
    }
  }
}

// Start the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
