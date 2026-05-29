import * as THREE from 'three';
import { lerp } from '../lib/utils.js';

/**
 * Isometric camera controller with 4-direction rotation
 */
class IsometricCamera {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;
    
    // Isometric angle (more vertical view)
    this.angle = Math.PI / 4; // 45 degrees
    this.distance = 30; // Increased distance
    this.height = 28; // Higher camera
    
    // Rotation state (0-3 for 4 directions)
    this.currentRotation = 0;
    this.targetRotation = 0;
    this.rotationSpeed = 5.0;
    
    // Smooth following
    this.currentPosition = new THREE.Vector3();
    this.followSpeed = 0.1;
    
    // Setup camera
    this.setupCamera();
    this.setupInput();
  }

  setupCamera() {
    // Set isometric perspective
    this.camera.position.set(0, this.height, this.distance);
    this.camera.lookAt(0, 0, 0);
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        this.rotateRight();
      }
    });
  }

  rotateLeft() {
    this.targetRotation = (this.targetRotation + 1) % 4;
  }

  rotateRight() {
    this.targetRotation = (this.targetRotation - 1 + 4) % 4;
  }

  reset() {
    this.targetRotation = 0;
  }

  /**
   * Update camera position to follow target
   */
  update(deltaTime) {
    // Smooth rotation interpolation
    let rotationDiff = this.targetRotation - this.currentRotation;
    
    // Take shortest path
    if (rotationDiff > 2) rotationDiff -= 4;
    if (rotationDiff < -2) rotationDiff += 4;
    
    this.currentRotation += rotationDiff * this.rotationSpeed * deltaTime;
    
    // Keep in 0-4 range
    if (this.currentRotation >= 4) this.currentRotation -= 4;
    if (this.currentRotation < 0) this.currentRotation += 4;
    
    // Calculate camera position based on rotation
    const rotationAngle = this.currentRotation * Math.PI / 2;
    
    // Get target position
    const targetPos = this.target.getPosition();
    
    // Smooth follow
    this.currentPosition.lerp(targetPos, this.followSpeed);
    
    // Calculate camera offset with rotation
    const offsetX = Math.sin(rotationAngle + Math.PI / 4) * this.distance;
    const offsetZ = Math.cos(rotationAngle + Math.PI / 4) * this.distance;
    
    // Set camera position
    this.camera.position.set(
      this.currentPosition.x + offsetX,
      this.currentPosition.y + this.height,
      this.currentPosition.z + offsetZ
    );
    
    // Look at target
    this.camera.lookAt(
      this.currentPosition.x,
      this.currentPosition.y + 2,
      this.currentPosition.z
    );
  }

  /**
   * Get current rotation index for character movement
   */
  getRotationIndex() {
    // Return the target rotation (discrete 0-3) for consistent controls
    return this.targetRotation % 4;
  }
}

export default IsometricCamera;
