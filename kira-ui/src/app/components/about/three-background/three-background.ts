import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import {
  AdditiveBlending,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

interface SignalPulse {
  curve: CatmullRomCurve3;
  mesh: Mesh;
  offset: number;
  speed: number;
}

@Component({
  selector: 'app-three-background',
  imports: [],
  templateUrl: './three-background.html',
  styleUrl: './three-background.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreeBackground implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(52, 1, 0.1, 100);
  private readonly dataField = new Group();
  private readonly timer = new Timer();
  private readonly pointerTarget = new Vector2();
  private readonly pointerCurrent = new Vector2();
  private readonly pointerWorld = new Vector3(5.2, 0, 0);
  private readonly projectedPointer = new Vector3();
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly pointMaterials: ShaderMaterial[] = [];
  private readonly connectionMaterials: ShaderMaterial[] = [];
  private readonly signalPulses: SignalPulse[] = [];
  private readonly depthLayers: Group[] = [];

  private renderer?: WebGLRenderer;
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private animationFrame?: number;
  private ripple?: Mesh<RingGeometry, MeshBasicMaterial>;
  private compactScene?: boolean;
  private heroVisible = true;
  private pointerInside = false;
  private pointerStrength = 0;
  private rippleAge = 10;
  private destroyed = false;

  ngAfterViewInit(): void {
    const host = this.hostRef().nativeElement;

    try {
      this.renderer = new WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      host.classList.add('webgl-fallback');
      return;
    }

    this.configureRenderer(host);
    this.scene.add(this.dataField);
    this.camera.position.set(0, 0, 9.2);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.heroVisible = entry?.isIntersecting ?? false;
      this.syncAnimationState();
    }, {threshold: 0.02});
    this.visibilityObserver.observe(host);

    window.addEventListener('pointermove', this.onPointerMove, {passive: true});
    window.addEventListener('pointerdown', this.onPointerDown, {passive: true});
    document.addEventListener('visibilitychange', this.syncAnimationState);
    this.motionQuery.addEventListener('change', this.syncAnimationState);

    this.resize();
    this.syncAnimationState();

    this.destroyRef.onDestroy(() => this.dispose());
  }

  private configureRenderer(host: HTMLDivElement): void {
    if (!this.renderer) {
      return;
    }

    this.renderer.setClearColor(new Color('#07101f'), 0);
    this.renderer.setPixelRatio(this.pixelRatio(host.clientWidth));
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    Object.assign(this.renderer.domElement.style, {
      display: 'block',
      height: '100%',
      width: '100%',
    });
    host.appendChild(this.renderer.domElement);
  }

  private buildDataField(width: number): void {
    const compact = width < 720;
    const random = this.seededRandom(2002);
    const pointsPerLayer = compact ? 180 : 540;
    const palette = [0x397fbf, 0x58a8ea, 0x8bc8ff];

    for (let layerIndex = 0; layerIndex < 3; layerIndex++) {
      const layer = new Group();
      layer.position.z = (layerIndex - 1) * 1.2;
      const positions: number[] = [];
      const sizes: number[] = [];

      for (let index = 0; index < pointsPerLayer; index++) {
        const position = this.createEdgePosition(random, compact, layerIndex);
        positions.push(position.x, position.y, position.z);
        sizes.push(0.55 + random() * 1.25);
      }

      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));

      const material = this.createPointMaterial(palette[layerIndex], layerIndex);
      const points = new Points(geometry, material);
      points.frustumCulled = false;
      layer.add(points);
      this.pointMaterials.push(material);
      this.depthLayers.push(layer);
      this.dataField.add(layer);
    }

    this.buildConnectionNetwork(random, compact);
    this.buildDataStreams(random, compact);
    this.buildPolyhedra(random, compact);
    this.buildRipple();
  }

  private createEdgePosition(random: () => number, compact: boolean, layer: number): Vector3 {
    const rangeX = compact ? 4.8 : 7.4;
    const rangeY = compact ? 7.9 : 6.3;
    const branch = random();
    let x: number;
    let y: number;

    if (branch < 0.42) {
      const side = random() < 0.18 ? -1 : 1;
      x = side * (rangeX * (0.58 + random() * 0.48));
      y = (random() - 0.5) * rangeY;
    } else if (branch < 0.72) {
      x = (random() - 0.5) * rangeX * 2.1;
      y = -(rangeY * (0.35 + random() * 0.38));
    } else if (branch < 0.9) {
      x = (random() - 0.5) * rangeX * 2.05;
      y = rangeY * (0.34 + random() * 0.36);
    } else {
      x = (random() - 0.5) * rangeX * 1.6;
      y = (random() - 0.5) * rangeY * 0.72;
    }

    const wave = Math.sin(x * 0.72 + layer * 1.6) * (0.16 + layer * 0.05);
    return new Vector3(x, y + wave, (random() - 0.5) * (1.1 + layer * 0.45));
  }

  private createPointMaterial(color: number, layer: number): ShaderMaterial {
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uColor: {value: new Color(color)},
        uTime: {value: 0},
        uPointer: {value: this.pointerWorld.clone()},
        uPointerStrength: {value: 0},
        uRippleOrigin: {value: new Vector3(20, 20, 0)},
        uRippleAge: {value: 10},
        uLayer: {value: layer},
        uPixelRatio: {value: Math.min(window.devicePixelRatio, 1.75)},
      },
      vertexShader: `
        attribute float aSize;
        uniform float uTime;
        uniform float uLayer;
        uniform float uPointerStrength;
        uniform float uRippleAge;
        uniform vec3 uPointer;
        uniform vec3 uRippleOrigin;
        uniform float uPixelRatio;
        varying float vGlow;

        void main() {
          vec3 displaced = position;
          displaced.y += sin(position.x * 0.62 + uTime * 0.18 + uLayer) * (0.025 + uLayer * 0.012);

          vec2 pointerDelta = displaced.xy - uPointer.xy;
          float pointerDistance = length(pointerDelta);
          float magneticField = smoothstep(2.0, 0.0, pointerDistance) * uPointerStrength;
          displaced.xy += normalize(pointerDelta + vec2(0.0001)) * magneticField * 0.34;

          float rippleDistance = length(displaced.xy - uRippleOrigin.xy);
          float rippleRadius = uRippleAge * 2.15;
          float rippleBand = exp(-pow((rippleDistance - rippleRadius) * 5.0, 2.0)) * max(0.0, 1.0 - uRippleAge / 1.8);
          displaced.xy += normalize(displaced.xy - uRippleOrigin.xy + vec2(0.0001)) * rippleBand * 0.22;

          vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = aSize * (5.8 - uLayer * 0.8) * uPixelRatio * (9.0 / -viewPosition.z);
          vGlow = 0.38 + magneticField * 1.7 + rippleBand * 1.4 + aSize * 0.16;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vGlow;

        void main() {
          float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
          float core = smoothstep(0.5, 0.04, distanceToCenter);
          float halo = smoothstep(0.5, 0.0, distanceToCenter) * 0.35;
          float alpha = (core + halo) * min(vGlow, 1.45);
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
  }

  private buildConnectionNetwork(random: () => number, compact: boolean): void {
    const nodeCount = compact ? 62 : 150;
    const connectionLimit = compact ? 105 : 330;
    const nodes: Vector3[] = [];
    const positions: number[] = [];

    for (let index = 0; index < nodeCount; index++) {
      nodes.push(this.createEdgePosition(random, compact, 1));
    }

    let connectionCount = 0;
    for (let left = 0; left < nodes.length && connectionCount < connectionLimit; left++) {
      for (let right = left + 1; right < nodes.length && connectionCount < connectionLimit; right++) {
        if (nodes[left].distanceTo(nodes[right]) > (compact ? 1.55 : 1.35)) {
          continue;
        }
        positions.push(...nodes[left].toArray(), ...nodes[right].toArray());
        connectionCount++;
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uPointer: {value: this.pointerWorld.clone()},
        uPointerStrength: {value: 0},
        uColor: {value: new Color(0x397bac)},
      },
      vertexShader: `
        uniform vec3 uPointer;
        uniform float uPointerStrength;
        varying float vNearPointer;

        void main() {
          vec3 displaced = position;
          vec2 delta = displaced.xy - uPointer.xy;
          float distanceToPointer = length(delta);
          float field = smoothstep(2.25, 0.0, distanceToPointer) * uPointerStrength;
          displaced.xy += normalize(delta + vec2(0.0001)) * field * 0.3;
          vNearPointer = field;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vNearPointer;

        void main() {
          gl_FragColor = vec4(mix(uColor, vec3(0.55, 0.82, 1.0), vNearPointer), 0.17 + vNearPointer * 0.56);
        }
      `,
    });
    this.connectionMaterials.push(material);
    this.dataField.add(new LineSegments(geometry, material));
  }

  private buildDataStreams(random: () => number, compact: boolean): void {
    const streamCount = compact ? 9 : 18;
    const signalGeometry = new SphereGeometry(compact ? 0.035 : 0.042, 8, 8);
    const blueMaterial = new MeshBasicMaterial({
      color: 0x79c8ff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const amberMaterial = new MeshBasicMaterial({
      color: 0xf89820,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    for (let index = 0; index < streamCount; index++) {
      const isTop = index % 3 === 0;
      const isBottom = index % 3 === 1;
      const spread = compact ? 4.7 : 7.4;
      const vertical = compact ? 4.5 : 3.7;
      let controlPoints: Vector3[];

      if (isTop) {
        controlPoints = [
          new Vector3(-spread, vertical + random() * 0.8, -0.3),
          new Vector3(-1.8, vertical - 0.5 + random() * 0.55, 0),
          new Vector3(2.2, vertical + 0.1 + random() * 0.7, 0.2),
          new Vector3(spread, 2.2 + random() * 1.2, 0),
        ];
      } else if (isBottom) {
        controlPoints = [
          new Vector3(-spread, -vertical + random() * 0.55, 0),
          new Vector3(-2.2, -vertical - random() * 0.5, 0.2),
          new Vector3(2.5, -vertical + 0.35 + random() * 0.55, -0.15),
          new Vector3(spread, -2.1 + random() * 1.1, 0.15),
        ];
      } else {
        const centerX = compact ? 2.35 : 5.05;
        const centerY = compact ? -0.15 : 0.1;
        const phase = index * 0.18;
        const turns = compact ? 2.65 : 3.15;
        const maxRadius = compact ? 3.75 : 5.15;
        controlPoints = Array.from({length: compact ? 24 : 32}, (_, pointIndex) => {
          const progress = pointIndex / (compact ? 23 : 31);
          const radius = 0.12 + progress * maxRadius;
          const angle = phase + progress * Math.PI * turns;
          return new Vector3(
            centerX + Math.cos(angle) * radius * 0.72,
            centerY + Math.sin(angle) * radius,
            Math.sin(angle * 0.5) * 0.35 + (random() - 0.5) * 0.16,
          );
        });
      }

      const jitter = (index - streamCount / 2) * (compact ? 0.055 : 0.065);
      controlPoints.forEach((point) => {
        point.y += isTop || isBottom ? jitter : 0;
        point.x += !isTop && !isBottom ? jitter : 0;
        point.z += (random() - 0.5) * 1.2;
      });

      const curve = new CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5);
      const geometry = new BufferGeometry().setFromPoints(curve.getPoints(compact ? 70 : 110));
      const line = new Line(geometry, new LineBasicMaterial({
        color: index % 7 === 0 ? 0xb66b20 : 0x347cad,
        transparent: true,
        opacity: index % 7 === 0 ? 0.32 : 0.17 + random() * 0.16,
        depthWrite: false,
        blending: AdditiveBlending,
      }));
      this.dataField.add(line);

      if (index % 2 === 0) {
        const mesh = new Mesh(signalGeometry, index % 6 === 0 ? amberMaterial : blueMaterial);
        this.signalPulses.push({curve, mesh, offset: random(), speed: 0.025 + random() * 0.025});
        this.dataField.add(mesh);
      }
    }
  }

  private buildPolyhedra(random: () => number, compact: boolean): void {
    const geometry = new IcosahedronGeometry(compact ? 0.31 : 0.4, 1);
    const material = new MeshBasicMaterial({
      color: 0x79b8ff,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const positions = compact
      ? [[-2.1, 3.2], [2.1, -3.1], [2.4, 2.8]]
      : [[-6.3, 3.1], [5.4, 3], [6.1, -2.8], [-4.7, -3.4]];

    positions.forEach(([x, y], index) => {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, (random() - 0.5) * 2.2);
      mesh.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      mesh.scale.setScalar(0.72 + index * 0.12);
      mesh.userData['drift'] = 0.35 + random() * 0.4;
      this.dataField.add(mesh);
    });
  }

  private buildRipple(): void {
    const geometry = new RingGeometry(0.97, 1, 96);
    const material = new MeshBasicMaterial({
      color: 0x78c8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.ripple = new Mesh(geometry, material);
    this.ripple.visible = false;
    this.dataField.add(this.ripple);
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.motionQuery.matches || !this.renderer) {
      return;
    }

    const rect = this.hostRef().nativeElement.getBoundingClientRect();
    this.pointerInside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;

    if (!this.pointerInside) {
      this.pointerTarget.set(0, 0);
      return;
    }

    this.pointerTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.motionQuery.matches || !this.pointerInside || !this.renderer) {
      return;
    }

    const rect = this.hostRef().nativeElement.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom) {
      return;
    }

    this.updatePointerWorld(true);
    this.rippleAge = 0;
    if (this.ripple) {
      this.ripple.position.copy(this.pointerWorld);
      this.ripple.position.z = 0.22;
      this.ripple.scale.setScalar(0.08);
      this.ripple.visible = true;
    }

    this.pointMaterials.forEach((material) => {
      material.uniforms['uRippleOrigin'].value.copy(this.pointerWorld);
      material.uniforms['uRippleAge'].value = 0;
    });
  };

  private updatePointerWorld(useTarget = false): void {
    const pointer = useTarget ? this.pointerTarget : this.pointerCurrent;
    this.projectedPointer.set(pointer.x, pointer.y, 0).unproject(this.camera);
    const direction = this.projectedPointer.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / direction.z;
    this.pointerWorld.copy(this.camera.position).add(direction.multiplyScalar(distance));
  }

  private readonly syncAnimationState = (): void => {
    if (!this.renderer || this.destroyed) {
      return;
    }

    if (this.motionQuery.matches || !this.heroVisible || document.hidden) {
      this.stopAnimation();
      this.setStaticState();
      this.renderFrame();
      return;
    }

    if (this.animationFrame === undefined) {
      this.timer.reset();
      this.animationFrame = requestAnimationFrame(this.animate);
    }
  };

  private readonly animate = (timestamp: number): void => {
    if (this.destroyed || this.motionQuery.matches || !this.heroVisible || document.hidden) {
      this.animationFrame = undefined;
      return;
    }

    this.timer.update(timestamp);
    const elapsed = this.timer.getElapsed();
    const delta = Math.min(this.timer.getDelta(), 0.05);
    this.pointerCurrent.lerp(this.pointerTarget, 0.045);
    this.pointerStrength += ((this.pointerInside ? 1 : 0) - this.pointerStrength) * 0.055;
    this.updatePointerWorld();

    this.depthLayers.forEach((layer, index) => {
      const depth = index + 1;
      layer.position.x = this.pointerCurrent.x * depth * 0.13;
      layer.position.y = this.pointerCurrent.y * depth * 0.09 + Math.sin(elapsed * 0.09 + index) * 0.035;
      layer.rotation.z = Math.sin(elapsed * 0.055 + index) * 0.006;
    });

    this.dataField.rotation.y = elapsed * 0.004 + this.pointerCurrent.x * 0.025;
    this.dataField.rotation.x = Math.sin(elapsed * 0.06) * 0.006 + this.pointerCurrent.y * 0.018;

    this.pointMaterials.forEach((material) => {
      material.uniforms['uTime'].value = elapsed;
      material.uniforms['uPointer'].value.copy(this.pointerWorld);
      material.uniforms['uPointerStrength'].value = this.pointerStrength;
      material.uniforms['uRippleAge'].value = this.rippleAge;
    });
    this.connectionMaterials.forEach((material) => {
      material.uniforms['uPointer'].value.copy(this.pointerWorld);
      material.uniforms['uPointerStrength'].value = this.pointerStrength;
    });

    this.signalPulses.forEach((signal) => {
      signal.offset = (signal.offset + signal.speed * delta) % 1;
      signal.curve.getPointAt(signal.offset, signal.mesh.position);
      const pulse = 0.75 + Math.sin(elapsed * 4.2 + signal.offset * 14) * 0.28;
      signal.mesh.scale.setScalar(pulse);
    });

    this.dataField.children.forEach((child) => {
      if (child instanceof Mesh && child.userData['drift']) {
        const drift = child.userData['drift'] as number;
        child.rotation.x += delta * 0.06 * drift;
        child.rotation.y += delta * 0.09 * drift;
      }
    });

    if (this.rippleAge < 2) {
      this.rippleAge += delta;
      if (this.ripple) {
        const progress = Math.min(this.rippleAge / 1.35, 1);
        this.ripple.scale.setScalar(0.1 + progress * 2.15);
        this.ripple.material.opacity = (1 - progress) * 0.52;
        this.ripple.visible = progress < 1;
      }
    }

    this.renderFrame();
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private setStaticState(): void {
    this.pointerStrength = 0;
    this.rippleAge = 10;
    this.ripple?.scale.setScalar(0);
    if (this.ripple) {
      this.ripple.visible = false;
    }
    this.pointMaterials.forEach((material) => {
      material.uniforms['uTime'].value = 1.5;
      material.uniforms['uPointerStrength'].value = 0;
      material.uniforms['uRippleAge'].value = 10;
    });
    this.connectionMaterials.forEach((material) => {
      material.uniforms['uPointerStrength'].value = 0;
    });
  }

  private resize(): void {
    const host = this.hostRef().nativeElement;
    if (!this.renderer || host.clientWidth === 0 || host.clientHeight === 0) {
      return;
    }

    const compact = host.clientWidth < 720;
    if (this.compactScene !== compact) {
      this.clearDataField();
      this.buildDataField(host.clientWidth);
      this.compactScene = compact;
    }

    this.camera.aspect = host.clientWidth / host.clientHeight;
    this.camera.updateProjectionMatrix();
    const pixelRatio = this.pixelRatio(host.clientWidth);
    this.renderer.setPixelRatio(pixelRatio);
    this.pointMaterials.forEach((material) => material.uniforms['uPixelRatio'].value = pixelRatio);
    this.renderer.setSize(host.clientWidth, host.clientHeight, false);
    this.renderFrame();
  }

  private pixelRatio(width: number): number {
    return Math.min(window.devicePixelRatio, width < 720 ? 1.35 : 1.75);
  }

  private renderFrame(): void {
    this.renderer?.render(this.scene, this.camera);
  }

  private stopAnimation(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
  }

  private dispose(): void {
    this.destroyed = true;
    this.stopAnimation();
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    document.removeEventListener('visibilitychange', this.syncAnimationState);
    this.motionQuery.removeEventListener('change', this.syncAnimationState);
    this.timer.dispose();
    this.clearDataField();

    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = undefined;
  }

  private clearDataField(): void {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<ShaderMaterial | LineBasicMaterial | MeshBasicMaterial>();

    this.dataField.traverse((object) => {
      if (object instanceof Points || object instanceof LineSegments || object instanceof Line || object instanceof Mesh) {
        geometries.add(object.geometry);
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => materials.add(material));
        } else {
          materials.add(object.material);
        }
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());

    this.dataField.clear();
    this.pointMaterials.length = 0;
    this.connectionMaterials.length = 0;
    this.signalPulses.length = 0;
    this.depthLayers.length = 0;
    this.ripple = undefined;
  }

  private seededRandom(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }
}
