export function createSharkSystem(THREERef, scene, beach, options = {}) {
  const T = THREERef;
  const sharks = [];
  const gltfLoader = options.gltfLoader;
  let sharkTemplate = null;
  if (gltfLoader) {
    gltfLoader.load('./oceano/shark.glb', gltf => {
      sharkTemplate = gltf.scene;
      sharkTemplate.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(sharkTemplate);
      const size = bounds.getSize(new T.Vector3());
      const center = bounds.getCenter(new T.Vector3());
      const horizontalLength = Math.max(size.x, size.z);
      const scale = 4.8 / Math.max(horizontalLength, 0.001);
      const pointsAlongX = size.x > size.z;
      for (const shark of sharks) {
        const fit = new T.Group();
        fit.scale.setScalar(scale);
        if (pointsAlongX) fit.rotation.y = Math.PI / 2;
        const model = sharkTemplate.clone(true);
        model.position.set(-center.x, -center.y, -center.z);
        model.traverse(obj => {
          if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
        });
        fit.add(model);
        shark.body.add(fit);
        shark.root.visible = true;
      }
      console.info('[Tiburones] Modelo shark.glb cargado; ejemplares:', sharks.length);
    }, undefined, error => console.error('[Tiburones] No se pudo cargar shark.glb:', error));
  } else { console.error('[Tiburones] No se recibió GLTFLoader; shark.glb no puede cargarse.'); }
  function makeShark(id,x,z,phase) {
    const root=new T.Group(); root.name='patrolling-shark-'+id; root.visible=false; scene.add(root);
    const body=new T.Group(); root.add(body);
    // El modelo GLB real se añade cuando termina de cargar.
    const tail=new T.Group(); body.add(tail);
    const jaw=new T.Group(); body.add(jaw);
    root.position.set(x,-.72,z);
    return {id,root,body,tail,jaw,phase,x,z,heading:Math.PI,attackCooldown:3+id*1.7,attackBlend:0,patrol:0};
  }
  const positions=[[-112,24],[-42,34],[34,27],[112,38]];
  positions.forEach((p,i)=>sharks.push(makeShark(i,p[0],beach.shoreZ(p[0])-p[1],i*1.8)));
  let globalAttackCooldown=0;
  function update(dt,time,player) {
    if(!player) return;
    globalAttackCooldown=Math.max(0,globalAttackCooldown-dt);
    const shoreDist=player.z-beach.shoreZ(player.x);
    const swimming=shoreDist < -2.1 && player.y < .9;
    for(const s of sharks){
      s.attackCooldown=Math.max(0,s.attackCooldown-dt);
      const dx=player.x-s.root.position.x,dz=player.z-s.root.position.z;
      const dist=Math.hypot(dx,dz);
      const hunting=swimming && dist<31;
      let tx=s.x+Math.sin(time*.13+s.phase)*17, tz=beach.shoreZ(s.x)-25+Math.cos(time*.17+s.phase)*9;
      let speed=.95;
      if(hunting){tx=player.x;tz=player.z;speed=dist>5?3.15:1.65;}
      const vx=tx-s.root.position.x,vz=tz-s.root.position.z;
      const desired=Math.atan2(vx,vz);
      let turn=desired-s.heading;turn=Math.atan2(Math.sin(turn),Math.cos(turn));
      s.heading+=turn*Math.min(1,dt*(hunting?2.8:1.0));
      const len=Math.hypot(vx,vz)||1;
      s.root.position.x+=(vx/len)*speed*dt;
      s.root.position.z+=(vz/len)*speed*dt;
      s.root.position.y=-.76+Math.sin(time*2.1+s.phase)*.09;
      s.root.rotation.y=s.heading;
      s.tail.rotation.y=Math.sin(time*7+s.phase)*.48;
      s.body.rotation.z=Math.sin(time*3.2+s.phase)*.045;
      s.body.position.y=Math.sin(time*4.2+s.phase)*.055;
      const bite=s.attackBlend>0?Math.sin((.32-s.attackBlend)/.32*Math.PI):0;
      s.body.position.z=bite*.72;
      s.jaw.rotation.x=bite*.52;
      s.root.visible=s.root.position.z<beach.shoreZ(s.root.position.x)-.7;
      if(hunting && dist<2.45 && s.attackCooldown<=0 && globalAttackCooldown<=0){
        s.attackCooldown=5.5;globalAttackCooldown=2.2;s.attackBlend=.32;
        options.damagePlayer?.(17,'¡Un tiburón te mordió! ¡Nada hacia la orilla para escapar!');
        options.onAttack?.(s.root.position);
      }
      s.attackBlend=Math.max(0,s.attackBlend-dt);
    }
  }
  function dispose(){for(const s of sharks)scene.remove(s.root);}
  return {sharks,update,dispose};
}
