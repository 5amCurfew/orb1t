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
    this.spaceBackdrop = null;
    
    this.lastTime = 0;
    
    this.init();
    this.animate();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x070912, 75, 240);

    // Create camera (perspective for 3D clarity)
    this.camera = new THREE.PerspectiveCamera(
      60,
      16 / 9, // Horizontal rectangle aspect ratio
      0.1,
      1000
    );

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); // No AA for crisp 1-bit look
    
    // Make viewport horizontal rectangle at 90% of window
    const viewportWidth = window.innerWidth * 0.9;
    const viewportHeight = viewportWidth * (9 / 16); // 16:9 aspect ratio
    this.renderer.setSize(viewportWidth, viewportHeight);
    this.renderer.setClearColor(0x000000, 0);
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

    // Add distant celestial backdrop
    this.createSpaceBackdrop();

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
    const ambientLight = new THREE.AmbientLight(0x9ba8c7, 0.22);
    this.scene.add(ambientLight);

    // Directional light (sun) for shadows
    this.sunLight = new THREE.DirectionalLight(0xe8f0ff, 1.08);
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

  createSpaceBackdrop() {
    const backdrop = new THREE.Group();

    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starColorChoices = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xaecbff),
      new THREE.Color(0xffe2a8)
    ];

    for (let index = 0; index < starCount; index++) {
      const radius = 260 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45 + Math.PI * 0.12;
      const offset = index * 3;

      starPositions[offset] = Math.cos(theta) * Math.sin(phi) * radius;
      starPositions[offset + 1] = Math.cos(phi) * radius + 55;
      starPositions[offset + 2] = Math.sin(theta) * Math.sin(phi) * radius;

      const starColor = starColorChoices[index % starColorChoices.length];
      starColors[offset] = starColor.r;
      starColors[offset + 1] = starColor.g;
      starColors[offset + 2] = starColor.b;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    backdrop.add(stars);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(24, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x2d4266, fog: false })
    );
    planet.position.set(-180, 120, -280);
    backdrop.add(planet);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(30, 42, 24),
      new THREE.MeshBasicMaterial({
        color: 0xa7b7d8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        fog: false
      })
    );
    ring.position.copy(planet.position);
    ring.rotation.x = Math.PI * 0.45;
    ring.rotation.y = Math.PI * 0.2;
    backdrop.add(ring);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(10, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xd9dbe6, fog: false })
    );
    moon.position.set(165, 88, -220);
    backdrop.add(moon);

    this.spaceBackdrop = backdrop;
    this.scene.add(backdrop);
  }

  updateSpaceBackdrop() {
    if (!this.spaceBackdrop || !this.character) {
      return;
    }

    this.spaceBackdrop.position.set(
      this.character.position.x * 0.12,
      0,
      this.character.position.z * 0.12
    );
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
      this.updateSpaceBackdrop();
      
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
