export function createAvatar(THREE: typeof import('three')) {
  const avatar = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#c98f69', roughness: 0.78 });
  const coat = new THREE.MeshStandardMaterial({ color: '#293846', roughness: 0.9 });
  const trousers = new THREE.MeshStandardMaterial({ color: '#18222a', roughness: 0.96 });
  const hair = new THREE.MeshStandardMaterial({ color: '#231915', roughness: 1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.55, 4, 8), coat);
  body.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skin);
  head.position.y = 1.26;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12, 0, Math.PI * 2, 0, Math.PI * .48), hair);
  hairCap.position.y = 1.31;
  avatar.add(body, head, hairCap);
  [-0.11, 0.11].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 3, 7), trousers);
    leg.position.set(x, 0.25, 0); avatar.add(leg);
  });
  avatar.position.set(0, 0, 2.1);
  avatar.castShadow = true;
  return avatar;
}
