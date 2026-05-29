import * as THREE from 'three';

/**
 * Player character controller with movement, jumping, and shooting
 */
class Character {
  constructor(scene, terrain, camera) {
    this.scene = scene;
    this.terrain = terrain;
    this.camera = camera;
    
    // Physics properties
    this.position = new THREE.Vector3(0, 10, 0);
    this.velocity = new THREE.Vector3();
    this.gravity = -15.0; // Slightly stronger gravity for snappier feel
    this.jumpForce = 12.0; // Higher jump force for more responsive jumping
    this.moveSpeed = 10.0;
    this.isGrounded = false;
    this.characterHeight = 1.0; // Total character height (scaled) - increased for better clearance
    this.maxClimbSlope = 2.5; // Maximum height difference per unit distance - more lenient
    this.maxStepHeight = 1.2; // Allow climbing larger steps
    
    // Shooting properties
    this.lastShotTime = 0;
    this.shootCooldown = 0.2; // Faster shooting (was 0.5)
    this.projectiles = [];
    
    // Input state
    this.keys = {};
    this.mouseButtons = {};
    
    // Create character mesh
    this.createMesh();
    this.createWeapon();
    
    // Setup input handlers
    this.setupInput();
  }

  createMesh() {
    // Simple character model - blocky 1-bit style
    const group = new THREE.Group();
    const scale = 0.4; // Make character smaller
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(0.8 * scale, 1.6 * scale, 0.6 * scale);
    const material = new THREE.MeshBasicMaterial({ color: 0x0066ff }); // Blue for visibility
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.8 * scale;
    group.add(body);
    
    // Head
    const headGeometry = new THREE.BoxGeometry(0.6 * scale, 0.6 * scale, 0.6 * scale);
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = 2.0 * scale;
    group.add(head);
    
    // Add a simple visor (indicator of forward direction)
    const visorGeometry = new THREE.BoxGeometry(0.5 * scale, 0.2 * scale, 0.65 * scale);
    const visorMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 2.0 * scale, 0.3 * scale); // Move forward to show direction
    group.add(visor);
    
    this.mesh = group;
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  createWeapon() {
    // Simple sniper rifle model
    const weaponGroup = new THREE.Group();
    const scale = 0.4; // Match character scale
    
    // Barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 2.0 * scale);
    const weaponMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const barrel = new THREE.Mesh(barrelGeometry, weaponMaterial);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(1.0 * scale, 0, 0);
    weaponGroup.add(barrel);
    
    // Stock
    const stockGeometry = new THREE.BoxGeometry(0.6 * scale, 0.1 * scale, 0.2 * scale);
    const stock = new THREE.Mesh(stockGeometry, weaponMaterial);
    stock.position.set(-0.3 * scale, -0.1 * scale, 0);
    weaponGroup.add(stock);
    
    // Scope
    const scopeGeometry = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.4 * scale);
    const scope = new THREE.Mesh(scopeGeometry, weaponMaterial);
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0.3 * scale, 0.15 * scale, 0);
    weaponGroup.add(scope);
    
    weaponGroup.position.set(0.3 * scale, 1.2 * scale, -0.3 * scale);
    weaponGroup.rotation.y = -Math.PI / 4;
    
    this.weapon = weaponGroup;
    this.mesh.add(this.weapon);
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code.toLowerCase()] = true;
      
      // Jump on W key
      if (e.code === 'KeyW' && this.isGrounded) {
        this.velocity.y = this.jumpForce;
        this.isGrounded = false;
      }
      
      // Shoot on R key
      if (e.code === 'KeyR') {
        this.shoot();
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code.toLowerCase()] = false;
    });
  }

  shoot() {
    const currentTime = performance.now() / 1000;
    if (currentTime - this.lastShotTime < this.shootCooldown) return;
    
    this.lastShotTime = currentTime;
    
    // Create bullet tracer - shoot in the direction character is facing
    const direction = new THREE.Vector3(0, 0, 1); // Forward direction
    direction.applyQuaternion(this.mesh.quaternion);
    
    const scale = 0.4;
    this.createBulletTracer(
      this.position.clone().add(new THREE.Vector3(0, 1.5 * scale, 0)),
      direction
    );
    
    // Weapon recoil animation
    this.weapon.position.z = -0.4 * scale;
    setTimeout(() => {
      this.weapon.position.z = -0.3 * scale;
    }, 100);
  }

  createBulletTracer(origin, direction) {
    // Create red projectile bullet
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bullet = new THREE.Mesh(geometry, material);
    
    bullet.position.copy(origin);
    this.scene.add(bullet);
    
    // Store projectile data
    this.projectiles.push({
      mesh: bullet,
      velocity: direction.clone().multiplyScalar(50),
      lifetime: 3.0, // seconds
      age: 0
    });
  }

  /**
   * Update character physics and position
   */
  update(deltaTime, cameraRotation) {
    // Apply gravity
    this.velocity.y += this.gravity * deltaTime;
    
    // Movement input - Arrow keys (screen-relative for isometric view)
    const moveDirection = new THREE.Vector3();
    
    // For isometric view, screen directions map to diagonal world directions
    if (this.keys['arrowup']) {
      // Up on screen = diagonal in world (-X, -Z)
      moveDirection.x -= 1;
      moveDirection.z -= 1;
    }
    if (this.keys['arrowdown']) {
      // Down on screen = diagonal in world (+X, +Z)
      moveDirection.x += 1;
      moveDirection.z += 1;
    }
    if (this.keys['arrowleft']) {
      // Left on screen = diagonal in world (-X, +Z)
      moveDirection.x -= 1;
      moveDirection.z += 1;
    }
    if (this.keys['arrowright']) {
      // Right on screen = diagonal in world (+X, -Z)
      moveDirection.x += 1;
      moveDirection.z -= 1;
    }
    
    // Apply camera rotation to movement
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      
      // Rotate movement based on camera angle (negate to maintain screen-relative controls)
      const angle = -cameraRotation * Math.PI / 2;
      const rotatedX = moveDirection.x * Math.cos(angle) - moveDirection.z * Math.sin(angle);
      const rotatedZ = moveDirection.x * Math.sin(angle) + moveDirection.z * Math.cos(angle);
      
      moveDirection.x = rotatedX;
      moveDirection.z = rotatedZ;
      
      this.velocity.x = moveDirection.x * this.moveSpeed;
      this.velocity.z = moveDirection.z * this.moveSpeed;
      
      // Rotate character to face movement direction (in world space)
      const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
      this.mesh.rotation.y = targetRotation;
    } else {
      this.velocity.x *= 0.8; // Friction
      this.velocity.z *= 0.8;
    }
    
    // Update projectiles
    this.updateProjectiles(deltaTime);
    
    // Update position with slope checking
    const nextPosition = this.position.clone().add(this.velocity.clone().multiplyScalar(deltaTime));
    
    // Check slope at next position
    const currentHeight = this.terrain.getTerrainHeight(this.position.x, this.position.z);
    const nextHeight = this.terrain.getTerrainHeight(nextPosition.x, nextPosition.z);
    const heightDiff = nextHeight - currentHeight;
    const horizontalDist = Math.sqrt(
      Math.pow(nextPosition.x - this.position.x, 2) + 
      Math.pow(nextPosition.z - this.position.z, 2)
    );
    
    // Calculate slope (avoid division by very small numbers)
    const slope = horizontalDist > 0.01 ? Math.abs(heightDiff) / horizontalDist : 0;
    
    // More lenient movement - allow if jumping, airborne, or reasonable slope/step
    const canMove = !this.isGrounded || 
                    slope <= this.maxClimbSlope || 
                    (this.isGrounded && Math.abs(heightDiff) <= this.maxStepHeight);
    
    if (canMove) {
      this.position.copy(nextPosition);
    } else {
      // Can't climb steep cliff - stop horizontal movement but allow sliding
      this.velocity.x *= 0.3;
      this.velocity.z *= 0.3;
    }
    
    // Ground collision (no water check)
    const groundHeight = this.terrain.getTerrainHeight(this.position.x, this.position.z);
    const targetHeight = groundHeight;
    
    // Keep character above ground by its height
    if (this.position.y <= targetHeight + this.characterHeight) {
      this.position.y = targetHeight + this.characterHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }
    
    // Keep within world bounds
    const maxBound = this.terrain.worldSize / 2 - 10;
    this.position.x = Math.max(-maxBound, Math.min(maxBound, this.position.x));
    this.position.z = Math.max(-maxBound, Math.min(maxBound, this.position.z));
    
    this.mesh.position.copy(this.position);
  }
  
  updateProjectiles(deltaTime) {
    // Update all active projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      
      // Update position
      projectile.mesh.position.add(
        projectile.velocity.clone().multiplyScalar(deltaTime)
      );
      
      // Apply gravity to projectile
      projectile.velocity.y += this.gravity * deltaTime * 0.5;
      
      // Age the projectile
      projectile.age += deltaTime;
      
      // Remove if too old or below ground
      const groundHeight = this.terrain.getTerrainHeight(
        projectile.mesh.position.x,
        projectile.mesh.position.z
      );
      
      if (projectile.age > projectile.lifetime || projectile.mesh.position.y < groundHeight) {
        this.scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        projectile.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  getPosition() {
    return this.position.clone();
  }
}

export default Character;
