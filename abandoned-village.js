// Casa Swamp Shack original, ubicada en el claro de la selva junto a la costa.
export function createAbandonedVillage(THREE, scene, beach, loader) {
  const root=new THREE.Group();
  root.name='Pueblo abandonado - casa Swamp Shack';
  const house={x:94,z:beach.shoreZ(94)+5.5};
  const spawn={x:102,z:beach.shoreZ(102)+7.5};
  root.position.set(0,0,0);
  scene.add(root);

  loader.load(new URL('./casas/swamp-shack-v1-lod0.glb',import.meta.url).href,gltf=>{
    const model=gltf.scene;
    model.name='Swamp Shack GLB original';
    model.updateMatrixWorld(true);
    let bounds=new THREE.Box3().setFromObject(model);
    const size=new THREE.Vector3();bounds.getSize(size);
    const maxXZ=Math.max(size.x,size.z);
    // Escala de una cabaña grande, visible desde el claro y la playa.
    const scale= maxXZ>0 ? 13.5/maxXZ : 1;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    bounds=new THREE.Box3().setFromObject(model);
    const centerX=(bounds.min.x+bounds.max.x)/2;
    const centerZ=(bounds.min.z+bounds.max.z)/2;
    model.position.set(-centerX,-bounds.min.y,-centerZ);
    model.updateMatrixWorld(true);
    const houseGroup=new THREE.Group();
    houseGroup.position.set(house.x,beach.heightAt(house.x,house.z),house.z);
    houseGroup.rotation.y=-Math.PI*.08;
    houseGroup.add(model);
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    root.add(houseGroup);
    root.userData.loaded=true;
    console.info('Swamp Shack visible en claro de selva', {size,scale,position:houseGroup.position});
  },undefined,error=>console.error('Error cargando casa GLB:',error));
  // Mantener despejada la entrada y evitar que el personaje aparezca dentro del modelo.
  beach.colliders.push({x:house.x,z:house.z,r:5.2});
  return {group:root,spawn,house};
}
