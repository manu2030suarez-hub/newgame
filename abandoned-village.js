// Vivienda GLB original del pueblo abandonado. Se conservan sus materiales y texturas.
export function createAbandonedVillage(THREE, scene, beach, loader) {
  const root = new THREE.Group();
  root.name = 'Pueblo abandonado - Swamp Shack';
  scene.add(root);

  const houseX = 94;
  const houseZ = 137;
  const houseScaleWidth = 11.5;

  loader.load(
    new URL('./casas/swamp-shack-v1-lod0.glb', import.meta.url).href,
    gltf => {
      const model = gltf.scene;
      model.name = 'Swamp Shack - vivienda GLB';
      model.updateMatrixWorld(true);
      let bounds = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      const maxXZ = Math.max(size.x, size.z);
      if (maxXZ > 0) model.scale.setScalar(houseScaleWidth / maxXZ);
      model.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(model);
      model.position.x -= (bounds.min.x + bounds.max.x) * .5;
      model.position.z -= (bounds.min.z + bounds.max.z) * .5;
      model.position.y -= bounds.min.y;
      model.position.y += beach.heightAt(houseX, houseZ);
      model.position.x += houseX;
      model.position.z += houseZ;
      model.rotation.y = Math.PI * .12;
      model.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          // No reemplazar mapas ni colores: conservar el acabado del GLB descargado.
        }
      });
      root.add(model);
      root.userData.loaded = true;
      console.info('Pueblo abandonado: Swamp Shack GLB cargado', size);
    },
    undefined,
    error => console.error('No se pudo cargar casas/swamp-shack-v1-lod0.glb', error)
  );

  // Área libre junto a la vivienda para que el jugador aparezca sin quedar dentro del modelo.
  const spawn = { x: houseX + 12, z: houseZ + 1 };
  beach.colliders.push({ x: houseX, z: houseZ, r: 5.2 });
  return { group: root, spawn, house: { x: houseX, z: houseZ } };
}
