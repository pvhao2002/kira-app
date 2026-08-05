import type * as THREE from 'three';
import type { RoomId } from '../types';

export const doorLayout: Record<RoomId, { x: number; accent: string }> = {
  projects: { x: -4.35, accent: '#72d6de' },
  experience: { x: -1.45, accent: '#dcae70' },
  about: { x: 1.45, accent: '#dfbe89' },
  contact: { x: 4.35, accent: '#a8cfbd' },
};

export type DoorObject = { pivot: THREE.Group; hit: THREE.Mesh; glow: THREE.PointLight };

export function createHouse(THREE: typeof import('three')) {
  const house = new THREE.Group();
  const doors = new Map<RoomId, DoorObject>();
  const plaster = new THREE.MeshStandardMaterial({ color: '#8f7d68', roughness: .92 });
  const wood = new THREE.MeshStandardMaterial({ color: '#4d3022', roughness: .78 });
  const oak = new THREE.MeshStandardMaterial({ color: '#6d482b', roughness: .76 });
  const stone = new THREE.MeshStandardMaterial({ color: '#4c4b48', roughness: .94 });
  const darkWood = new THREE.MeshStandardMaterial({ color: '#251b18', roughness: .86 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(13.8, .32, 5.7), oak);
  floor.position.set(0, -.16, 0); floor.receiveShadow = true; house.add(floor);
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(14.5, .62, 6.2), stone);
  foundation.position.set(0, -.48, 0); foundation.receiveShadow = true; house.add(foundation);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(13.2, 3.85, .32), plaster);
  wall.position.set(0, 1.9, -1.85); wall.receiveShadow = true; house.add(wall);
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(13.8, .32, .42), darkWood);
  topBeam.position.set(0, 3.72, -1.66); house.add(topBeam);
  const backRoof = new THREE.Mesh(new THREE.BoxGeometry(13.9, .22, 1.9), new THREE.MeshStandardMaterial({ color: '#1c2730', roughness: .9 }));
  backRoof.position.set(0, 4.15, -1.65); backRoof.rotation.x = -.28; house.add(backRoof);
  const steps = new THREE.Mesh(new THREE.BoxGeometry(13.6, .26, 1.1), stone);
  steps.position.set(0, -.54, 2.62); house.add(steps);

  Object.entries(doorLayout).forEach(([id, config]) => {
    const roomId = id as RoomId;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.05, 3.05, .26), darkWood);
    frame.position.set(config.x, 1.48, -1.57); house.add(frame);
    const pivot = new THREE.Group(); pivot.position.set(config.x - .85, .08, -1.4);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.75, .15), wood);
    door.position.set(.85, 1.37, 0); door.castShadow = true; pivot.add(door);
    const inset = new THREE.Mesh(new THREE.BoxGeometry(1.34, 2.38, .025), new THREE.MeshStandardMaterial({ color: '#5c3925', roughness: .66 }));
    inset.position.set(.85, 1.38, .09); pivot.add(inset);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), new THREE.MeshStandardMaterial({ color: '#d8b883', metalness: .6, roughness: .3 }));
    handle.position.set(1.45, 1.33, .16); pivot.add(handle);
    const glow = new THREE.PointLight(config.accent, .14, 3.2); glow.position.set(config.x, 1.65, .2); house.add(glow);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3, .45), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    hit.position.set(config.x, 1.48, -1.18); hit.userData.roomId = roomId; house.add(hit);
    doors.set(roomId, { pivot, hit, glow }); house.add(pivot);
  });
  for (let x = -6; x <= 6; x += 2) {
    const lamp = new THREE.PointLight('#ffd69a', .55, 3.6); lamp.position.set(x, 2.55, .8); house.add(lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffcf8f' })); bulb.position.copy(lamp.position); house.add(bulb);
  }
  return { house, doors, hits: Array.from(doors.values()).map((door) => door.hit) };
}
