// Fauna marina de Survival Playa.
// La carga, centrado, ajuste de escala y montaje de cada GLB siguen el mismo patrón
// que shark-system.js, que ya está comprobado en el juego.
export function createOceanLife(THREE, scene, beach, loader) {
  const entries = [];
  const specs = [
    {file:'crab.glb',count:1,size:1.15,shore:22,positions:[[-72,0]]},
    {file:'dolphin.glb',count:1,size:3.1,shore:30,positions:[[65,0]]},
    {file:'fish-school.glb',count:3,size:2.15,shore:5,positions:[[-92,0],[8,0],[102,0]]},
    {file:'jellyfish.glb',count:1,size:1.25,shore:23,positions:[[-28,0]]},
    {file:'manta-ray.glb',count:1,size:3.4,shore:35,positions:[[38,0]]},
    {file:'octopus.glb',count:1,size:1.65,shore:24,positions:[[-112,0]]},
    {file:'reef-fish.glb',count:1,size:1.25,shore:5,positions:[[78,0]]},
    {file:'sea-turtle.glb',count:1,size:2.1,shore:28,positions:[[-52,0]]},
    {file:'whale.glb',count:1,size:7.2,shore:50,positions:[[0,0]]}
  ];
  let disposed=false;
  for (const spec of specs) {
    const assetUrl = new URL('./oceano/'+spec.file, import.meta.url).href;
    loader.load(assetUrl, gltf => {
      if(disposed)return;
      const template=gltf.scene;
      template.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(template);
      const dimensions=bounds.getSize(new THREE.Vector3());
      const center=bounds.getCenter(new THREE.Vector3());
      const horizontalLength=Math.max(dimensions.x,dimensions.z,.001);
      for(let i=0;i<spec.count;i++){
        const [xOffset]=spec.positions[i]||[0];
        const x=xOffset+(i===0?0:(i-1)*3);
        const root=new THREE.Group();
        root.name='ocean-'+spec.file.replace('.glb','')+'-'+i;
        root.visible=false;
        const body=new THREE.Group();
        root.add(body);
        // Igual que el tiburón: clonar el scene del GLB, centrarlo en un grupo
        // y aplicar la escala de ajuste en un grupo padre.
        const fit=new THREE.Group();
        fit.scale.setScalar(spec.size/horizontalLength);
        if(dimensions.x>dimensions.z)fit.rotation.y=Math.PI/2;
        const model=template.clone(true);
        model.position.set(-center.x,-center.y,-center.z);
        model.traverse(obj=>{
          if(!obj.isMesh)return;
          obj.castShadow=true;
          obj.receiveShadow=true;
          obj.frustumCulled=false;
          obj.renderOrder=3;
        });
        fit.add(model);
        body.add(fit);
        root.position.set(x,-.76,beach.shoreZ(x)-spec.shore-(i%2)*3);
        scene.add(root);
        root.visible=true;
        const mixer=gltf.animations?.length?new THREE.AnimationMixer(model):null;
        if(mixer)gltf.animations.forEach(clip=>mixer.clipAction(clip).play());
        entries.push({root,body,model,mixer,x,z:root.position.z,shoreDistance:spec.shore,phase:(i+1)*1.73+spec.shore*.17,speed:.12+(i%3)*.035,turn:(i%2?1:-1),file:spec.file});
      }
      console.info('[Fauna marina] Modelo cargado:',spec.file,'ejemplares:',spec.count);
    },undefined,error=>console.error('[Fauna marina] Error al cargar '+assetUrl+':',error));
  }
  function update(dt,time){
    for(const e of entries){
      if(e.mixer)e.mixer.update(dt);
      const t=time*e.speed+e.phase;
      e.root.position.x=e.x+Math.sin(t)*2.3;
      e.root.position.z=beach.shoreZ(e.root.position.x)-e.shoreDistance+Math.cos(t*.73)*(e.shoreDistance<=6?1.7:.65);
      e.root.position.y=-.76+(e.file==='jellyfish.glb'?Math.sin(time*1.45+e.phase)*.34:Math.sin(time*1.1+e.phase)*.10);
      e.root.rotation.y=Math.sin(t*.48)*.24*e.turn;
      if(e.file==='jellyfish.glb')e.model.rotation.z=Math.sin(time*1.2+e.phase)*.12;
      else if(e.file==='manta-ray.glb'||e.file==='dolphin.glb'||e.file==='sea-turtle.glb')e.model.rotation.z=Math.sin(time*1.7+e.phase)*.035;
    }
  }
  function dispose(){
    disposed=true;
    for(const e of entries){scene.remove(e.root);e.mixer?.stopAllAction();}
    entries.length=0;
  }
  return {update,dispose,entries};
}
