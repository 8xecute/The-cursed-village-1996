import * as THREE from 'three';
export function addHourglass(parent, targets, enabled, active) {
  const group=new THREE.Group();group.position.set(0.9,.04,.65);parent.add(group);
  const brass=new THREE.MeshStandardMaterial({color:active?0xd8ae63:0x987446,metalness:.65,roughness:.38});
  const glass=new THREE.MeshStandardMaterial({color:0xc3e0db,transparent:true,opacity:.2,roughness:.12,depthWrite:false});
  const sand=new THREE.MeshStandardMaterial({color:0xe4c28a,roughness:1});
  const add=(geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);if(enabled){m.userData.hourglass=true;targets.push(m);}return m;};
  for(const y of [0,.78]) add(new THREE.CylinderGeometry(.23,.23,.07,20),brass,0,y,0);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;add(new THREE.CylinderGeometry(.022,.022,.74,8),brass,Math.cos(a)*.19,.39,Math.sin(a)*.19);}
  add(new THREE.CylinderGeometry(.16,.025,.34,20,true),glass,0,.57,0);
  add(new THREE.CylinderGeometry(.025,.16,.34,20,true),glass,0,.21,0);
  add(new THREE.ConeGeometry(.13,.16,20),sand,0,.14,0);
  const top=add(new THREE.ConeGeometry(.12,.15,20),sand,0,.6,0);top.rotation.z=Math.PI;
  if(active)add(new THREE.CylinderGeometry(.009,.009,.28,6),sand,0,.35,0);
  return group;
}
