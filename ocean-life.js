// Fauna marina de Survival Playa. Los modelos se cargan de forma independiente y no bloquean el inicio.
export function createOceanLife(THREE, scene, beach, loader) {
  const entries = [];
  const specs = [
    {file:'crab.glb',count:1,size:1.15,depth:.38,shore:5,positions:[[-72,0]]},
    {file:'dolphin.glb',count:1,size:3.1,depth:2.2,shore:19,positions:[[65,0]]},
    {file:'fish-school.glb',count:3,size:2.15,depth:1.5,shore:13,positions:[[-92,0],[8,0],[102,0]]},
    {file:'jellyfish.glb',count:1,size:1.25,depth:2.7,shore:15,positions:[[-28,0]]},
    {file:'manta-ray.glb',count:1,size:3.4,depth:2.8,shore:27,positions:[[38,0]]},
    {file:'octopus.glb',count:1,size:1.65,depth:3.1,shore:9,positions:[[-112,0]]},
    {file:'reef-fish.glb',count:1,size:1.25,depth:1.3,shore:8,positions:[[78,0]]},
    {file:'sea-turtle.glb',count:1,size:2.1,depth:1.8,shore:23,positions:[[-52,0]]},
    {file:'whale.glb',count:1,size:7.2,depth:5.2,shore:43,positions:[[0,0]]}
  ];
  let disposed=false;
  for (const spec of specs) {
    loader.load('./oceano/'+spec.file, gltf => {
      if(disposed)return;
      const template=gltf.scene;
      template.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(template);
      const size=bounds.getSize(new THREE.Vector3());
      const center=bounds.getCenter(new THREE.Vector3());
      const longest=Math.max(size.x,size.z,.001);
      for(let i=0;i<spec.count;i++){
        const [xOffset]=spec.positions[i]||[0];
        const x=xOffset+(i===0?0:(i-1)*3);
        const shore=beach.shoreZ(x);
        const root=new THREE.Group();
        root.name='ocean-'+spec.file.replace('.glb','')+'-'+i;
        root.position.set(x,-Math.min(.55,spec.depth*.18),shore-spec.shore-(i%2)*3);
        const model=template.clone(true);
        model.position.set(-center.x,-center.y,-center.z);
        const fit=new THREE.Group();
        fit.scale.setScalar(spec.size/longest);
        // Normaliza el eje largo de los animales para que naden en el plano del mar.
        if(size.x>size.z) fit.rotation.y=Math.PI/2;
        fit.add(model);root.add(fit);
        model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.renderOrder=3;}});
        scene.add(root);
        const mixer=gltf.animations?.length?new THREE.AnimationMixer(model):null;
        if(mixer)gltf.animations.forEach(clip=>mixer.clipAction(clip).play());
        entries.push({root,model,mixer,x,z:root.position.z,y:root.position.y,phase:(i+1)*1.73+spec.shore*.17,speed:.12+(i%3)*.035,turn:(i%2?1:-1),file:spec.file});
      }
      console.info('[Fauna marina] Cargado:',spec.file,'ejemplares:',spec.count);
    },undefined,error=>console.warn('[Fauna marina] No se pudo cargar '+spec.file,error));
  }
  function update(dt,time){
    for(const e of entries){
      if(e.mixer)e.mixer.update(dt);
      const t=time*e.speed+e.phase;
      e.root.position.x=e.x+Math.sin(t)*2.3;
      e.root.position.z=e.z+Math.cos(t*.73)*1.7;
      const bob=e.file==='jellyfish.glb'?Math.sin(time*1.45+e.phase)*.34:Math.sin(time*1.1+e.phase)*.10;
      e.root.position.y=e.y+bob;
      e.root.rotation.y=Math.sin(t*.48)*.24*e.turn;
      if(e.file==='jellyfish.glb')e.model.rotation.z=Math.sin(time*1.2+e.phase)*.12;
      else if(e.file==='manta-ray.glb'||e.file==='dolphin.glb'||e.file==='sea-turtle.glb')e.model.rotation.z=Math.sin(time*1.7+e.phase)*.035;
    }
  }
  function dispose(){disposed=true;for(const e of entries){scene.remove(e.root);e.mixer?.stopAllAction();}}
  return {update,dispose,entries};
}
