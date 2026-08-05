import * as THREE from 'three';
import { createAvatar } from './avatar';
import { damp } from './animation';
import { createHouse, doorLayout } from './house';
import type { RoomId } from '../types';

type SceneOptions = {
  canvas: HTMLCanvasElement;
  onNearbyRoom: (room: RoomId | null) => void;
  onOpenRoom: (room: RoomId) => void;
};

export type HouseScene = {
  moveTo(room: RoomId): void;
  nudge(x: number, z: number): void;
  openNearby(): void;
  setActiveRoom(room: RoomId | null): void;
  dispose(): void;
};

const roomIds = Object.keys(doorLayout) as RoomId[];

export function createHouseScene({ canvas, onNearbyRoom, onOpenRoom }: SceneOptions): HouseScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.15 : 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#0b1520', 14, 29);
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 50);
  camera.position.set(0, 5.7, 13.5);
  const target = new THREE.Vector3(0, 1.45, -0.45);
  scene.add(new THREE.HemisphereLight('#9bb5c8', '#2a1d17', 1.5));
  const sun = new THREE.DirectionalLight('#f3bd7e', 2.2); sun.position.set(-7, 9, 6); sun.castShadow = true; scene.add(sun);
  const { house, doors, hits } = createHouse(THREE); scene.add(house);
  const avatar = createAvatar(THREE); scene.add(avatar);
  const garden = new THREE.Group();
  const leaf = new THREE.MeshStandardMaterial({ color: '#344832', roughness: .95 });
  for (let index = 0; index < 24; index += 1) {
    const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(.18 + (index % 3) * .08, 0), leaf);
    shrub.position.set(-7 + (index % 12) * 1.25, .08, index < 12 ? 1.9 : -2.25); garden.add(shrub);
  }
  scene.add(garden);
  const timer = new THREE.Timer();
  timer.connect(document);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = new Set<string>();
  let frame = 0; let nearby: RoomId | null = null; let movingTarget: THREE.Vector3 | null = null; let activeRoom: RoomId | null = null;
  const homeCamera = new THREE.Vector3(0, 5.7, 13.5);

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  const setNearby = (next: RoomId | null) => { if (nearby !== next) { nearby = next; onNearbyRoom(next); } };
  const getClosestDoor = () => roomIds.reduce<RoomId | null>((closest, room) => {
    const position = doorLayout[room].x;
    const distance = Math.hypot(avatar.position.x - position, avatar.position.z - .5);
    if (distance > 1.18) return closest;
    if (!closest) return room;
    return Math.abs(avatar.position.x - doorLayout[closest].x) > distance ? room : closest;
  }, null);
  const openDoor = (room: RoomId) => { activeRoom = room; onOpenRoom(room); };
  const nudge = (x: number, z: number) => {
    avatar.position.x = THREE.MathUtils.clamp(avatar.position.x + x, -5.95, 5.95);
    avatar.position.z = THREE.MathUtils.clamp(avatar.position.z + z, -.1, 2.25);
    if (x || z) avatar.rotation.y = Math.atan2(x, z);
  };
  const moveTo = (room: RoomId) => { movingTarget = new THREE.Vector3(doorLayout[room].x, 0, .45); };
  const onKeyDown = (event: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA', 'BUTTON'].includes((event.target as HTMLElement)?.tagName)) return;
    if (event.key === 'Enter') { event.preventDefault(); if (nearby) openDoor(nearby); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) { keys.add(event.key.toLowerCase()); event.preventDefault(); }
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  const onPointerDown = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(hits)[0];
    if (hit) moveTo(hit.object.userData.roomId as RoomId);
  };
  window.addEventListener('resize', resize); window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); canvas.addEventListener('pointerdown', onPointerDown);
  resize();
  const animate = () => {
    frame = requestAnimationFrame(animate); timer.update(); const delta = Math.min(timer.getDelta(), .05);
    const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const z = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    if (x || z) { movingTarget = null; nudge(x * delta * 2.7, z * delta * 2.7); }
    if (movingTarget) {
      const direction = movingTarget.clone().sub(avatar.position); direction.y = 0;
      if (direction.length() < .08) movingTarget = null;
      else { direction.normalize(); nudge(direction.x * delta * 2.4, direction.z * delta * 2.4); }
    }
    avatar.position.y = Math.sin(timer.getElapsed() * 2.6) * .015;
    setNearby(getClosestDoor());
    roomIds.forEach((room) => {
      const door = doors.get(room)!; const isOpen = activeRoom === room;
      door.pivot.rotation.y = damp(door.pivot.rotation.y, isOpen ? -1.25 : 0, delta, 4.5);
      door.glow.intensity = damp(door.glow.intensity, isOpen ? 1.25 : nearby === room ? .45 : .14, delta, 4.5);
    });
    const roomCamera = activeRoom ? new THREE.Vector3(doorLayout[activeRoom].x * .65, 3.1, 8.5) : homeCamera;
    const look = activeRoom ? new THREE.Vector3(doorLayout[activeRoom].x, 1.4, -.9) : new THREE.Vector3(0, 1.45, -.45);
    camera.position.x = damp(camera.position.x, roomCamera.x, delta, 2.6); camera.position.y = damp(camera.position.y, roomCamera.y, delta, 2.6); camera.position.z = damp(camera.position.z, roomCamera.z, delta, 2.6);
    target.lerp(look, 1 - Math.exp(-2.6 * delta)); camera.lookAt(target); renderer.render(scene, camera);
  };
  animate();
  return { moveTo, nudge, openNearby: () => { if (nearby) openDoor(nearby); }, setActiveRoom: (room) => { activeRoom = room; }, dispose: () => {
    cancelAnimationFrame(frame); timer.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); canvas.removeEventListener('pointerdown', onPointerDown); renderer.dispose(); scene.traverse((object) => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose?.(); if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose()); else mesh.material?.dispose?.(); });
  } };
}
