
// Wildlife + boats V18. GLB files are optional: missing files fall back to simple procedural animals.
export function createWildlifeSystem(THREE, scene, loader, player, beach, hooks = {}) {
  const species = [
    {id:'bear',name:'Oso',file:'bear.glb',predator:true,scale:1.05,speed:1.45,temper:0.9},
    {id:'horse',name:'Caballo',file:'horse.glb',predator:false,herbivore:true,scale:0.92,speed:1.8,temper:0.3},
    {id:'cow',name:'Vaca',file:'cow.glb',predator:false,herbivore:true,scale:0.9,speed:1.2,temper:0.25},
    {id:'pig',name:'Jabalí',file:'pig.glb',predator:false,scale:1.0,speed:1.6,temper:0.55},
    {id:'sheep',name:'Oveja',file:'sheep.glb',predator:false,herbivore:true,scale:1.0,speed:1.1,temper:0.18}
  ];
  const templates = {};
  let speciesLoads=0,pendingPopulation=0;
  let boatTemplate = null;
  loader.load('./cargo-boat.glb', g => { boatTemplate = g; }, undefined, err => console.warn('No se pudo cargar cargo-boat.glb; se usará el barco de respaldo.', err));
  for (const s of species) loader.load('./'+s.file, g => { templates[s.id] = g; speciesLoads++; console.info(`[Animales] Modelo cargado: ${s.file}`); if(speciesLoads>=species.length)flushPopulation(); }, undefined, err => { speciesLoads++; console.error(`[Animales] No se pudo cargar ./${s.file}. Comprueba que el archivo esté junto a index.html y que el nombre coincida exactamente.`, err); if(speciesLoads>=species.length)flushPopulation(); });
  const animals = [];
  let animalSerial = 0, mountedHorse = null, ridingInput = {x:0,z:0,run:false,yaw:0}, mountBlend = 0;
  let boat = null, crate = null, crateState = 'none', crateTransit = null, gangway = null, nextBoatAt = 120, lastTime = 0, startTime = null, nextBirthAt = 180, boatPhase='none', boatDepartAt=0, boatShore=0;
  let gameOverTimer = 1800, announced = false;
  const v = new THREE.Vector3();
  const rand = (a,b)=>a+Math.random()*(b-a);
  const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
  const ground = (x,z)=>Math.max(0,beach.surfaceHeightAt?.(x,z) ?? beach.heightAt(x,z));
  function makeBoatFromGLB() {
    const root = new THREE.Group();
    const model = boatTemplate.scene.clone(true);
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.add(model);
    const crateRoot = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({color:0x9a7041,roughness:.94});
    const slat = new THREE.MeshStandardMaterial({color:0x5a3b22,roughness:.96});
    const iron = new THREE.MeshStandardMaterial({color:0x343b3e,roughness:.58,metalness:.55});
    const add = (w,h,d,m,x,y,z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; crateRoot.add(mesh); return mesh; };
    add(2.0,1.0,2.0,wood,0,.52,0);
    for (const y of [.20,.82]) for (const side of [-1,1]) { add(2.12,.10,.10,slat,0,y,side); add(.10,.10,2.12,slat,side,y,0); }
    for (const x of [-.91,.91]) for (const z of [-.91,.91]) add(.13,1.05,.13,slat,x,.52,z);
    for (const y of [.14,.92]) for (const side of [-1,1]) { add(2.16,.045,.045,iron,0,y,side*1.04); add(.045,.045,2.16,iron,side*1.04,y,0); }
    crateRoot.position.set(0,.28,.85); root.add(crateRoot); root.userData.crate=crateRoot;
    const wake = new THREE.Group();
    const wakeMat = new THREE.MeshBasicMaterial({color:0xd8eef0,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
    for(let i=0;i<3;i++){const line=new THREE.Mesh(new THREE.TorusGeometry(1.15+i*.42,.035,5,32),wakeMat.clone());line.scale.set(1.45,.55,1);line.rotation.x=Math.PI/2;line.position.set(0,.08,-4.1-i*.55);wake.add(line);}
    root.add(wake);root.userData.wake=wake;scene.add(root);return root;
  }
  function makeBoat() {
    if (boatTemplate) return makeBoatFromGLB();
    // Lancha de carga costera: casco afinado, cubierta, cabina acristalada,
    // barandillas, defensas, luces, antena, motor y estela. Todo es geometría
    // Three.js nativa para no depender de un GLB externo.
    const root = new THREE.Group();
    const mat = (color, roughness=.72, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
    const hullMat=mat(0x263b49,.48,.18), trimMat=mat(0xe7e1d0,.55), deckMat=mat(0x98744d,.9);
    const dark=mat(0x172832,.38,.22), glass= new THREE.MeshStandardMaterial({color:0x79b7c8,roughness:.18,metalness:.28,transparent:true,opacity:.78});
    const red=mat(0xb94332,.55), white=mat(0xf0eee4,.58), rubber=mat(0x171d20,.9);
    const addBox=(parent,w,h,d,material,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;};
    const addCylinder=(parent,r1,r2,h,material,x,y,z,segments=10)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);m.position.set(x,y,z);parent.add(m);return m;};

    // Casco puntiagudo visto desde arriba, con volumen y borda clara.
    const hullShape=new THREE.Shape();
    hullShape.moveTo(-1.28,-3.65); hullShape.lineTo(1.28,-3.65);
    hullShape.lineTo(1.48,2.35); hullShape.quadraticCurveTo(1.35,3.45,0,4.05);
    hullShape.quadraticCurveTo(-1.35,3.45,-1.48,2.35); hullShape.closePath();
    const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:.92,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.12,bevelThickness:.12,curveSegments:8});
    const hull=new THREE.Mesh(hullGeo,hullMat); hull.rotation.x=Math.PI/2; hull.position.y=.54; root.add(hull);
    // Línea de flotación y cubierta superior.
    const deckShape=hullShape.clone();
    const deck=new THREE.Mesh(new THREE.ShapeGeometry(deckShape),deckMat); deck.rotation.x=Math.PI/2; deck.position.y=.56; root.add(deck);
    const gunwale=new THREE.Mesh(new THREE.TorusGeometry(1,.055,6,48),trimMat); gunwale.scale.set(1.42,1,3.2); gunwale.rotation.x=Math.PI/2; gunwale.position.y=.55; root.add(gunwale);
    addBox(root,2.55,.12,5.9,trimMat,0,.58,-.35);

    // Cabina marinera en popa, ventanas delanteras y laterales.
    const cabin=addBox(root,1.78,1.22,1.95,white,0,1.18,-1.82);
    cabin.material=white;
    addBox(root,1.92,.13,2.08,dark,0,1.85,-1.82);
    addBox(root,1.48,.72,.045,glass,0,1.37,-.82);
    for(const side of [-1,1]){
      addBox(root,.045,.62,1.15,glass,side*.905,1.24,-1.92);
      addBox(root,.07,.78,1.25,trimMat,side*.94,1.23,-1.92);
      // Pasamanos tubulares laterales.
      for(let z of [-3.0,-2.2,-1.4,-.6,.25,1.1,1.9]) addCylinder(root,.035,.035,.72,trimMat,side*1.34,.81,z,8);
      const rail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,5.2,8),trimMat); rail.rotation.x=Math.PI/2; rail.position.set(side*1.34,1.72,-.5); root.add(rail);
    }
    // Techo, chimenea, antena y mástil de navegación.
    addBox(root,2.05,.14,2.18,white,0,1.91,-1.82);
    addCylinder(root,.13,.17,.42,dark,.48,2.14,-2.28,10);
    addCylinder(root,.035,.035,1.15,dark,0,2.48,-2.3,8);
    const antennaCross=addBox(root,.72,.035,.035,trimMat,0,2.84,-2.3);
    addCylinder(root,.045,.045,.16,red,-.82,2.11,-2.58,8);
    addCylinder(root,.045,.045,.16,mat(0x2c9b62),.82,2.11,-2.58,8);

    // Defensa de proa, defensas de goma en los costados y ancla.
    for(const side of [-1,1]) for(const z of [-2.7,-.2,2.0]){
      const f=addCylinder(root,.16,.16,.34,rubber,side*1.48,.65,z,12); f.rotation.z=Math.PI/2;
    }
    const anchor=addCylinder(root,.035,.035,.9,dark,-.72,.94,3.0,8); anchor.rotation.x=.35;
    addBox(root,.62,.06,.06,dark,-.72,.55,3.0);

    // Motor fueraborda y hélice en popa.
    addBox(root,.62,.82,.5,dark,0,.48,-3.55);
    addBox(root,.42,.22,.28,red,0,.12,-3.7);
    const propHub=addCylinder(root,.09,.09,.25,trimMat,0,.18,-3.92,10); propHub.rotation.x=Math.PI/2;
    for(let i=0;i<3;i++){
      const blade=addBox(root,.10,.48,.035,trimMat,0,.18,-4.03);
      blade.rotation.z=i*Math.PI*2/3; blade.rotation.x=.18;
    }

    // Estela espumosa discreta detrás de la embarcación.
    const wakeMat=new THREE.MeshBasicMaterial({color:0xd8eef0,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
    const wake=new THREE.Group();
    for(let i=0;i<3;i++){
      const line=new THREE.Mesh(new THREE.TorusGeometry(1.15+i*.42,.035,5,32),wakeMat.clone());
      line.scale.set(1.45,.55,1); line.rotation.x=Math.PI/2; line.position.set(0,.08,-4.1-i*.55); wake.add(line);
    }
    root.add(wake); root.userData.wake=wake;

    // Caja grande de madera con travesaños y herrajes metálicos.
    const crateRoot=new THREE.Group();
    const wood=mat(0x9a7041,.94), slatMat=mat(0x5a3b22,.96), iron=mat(0x343b3e,.58,.55);
    const base=addBox(crateRoot,2.0,1.0,2.0,wood,0,.52,0);
    for(let y of [.20,.82]) for(let side of [-1,1]){
      addBox(crateRoot,2.12,.10,.10,slatMat,0,y,side*1.0);
      addBox(crateRoot,.10,.10,2.12,slatMat,side*1.0,y,0);
    }
    for(let x of [-.91,.91]) for(let z of [-.91,.91]) addBox(crateRoot,.13,1.05,.13,slatMat,x,.52,z);
    for(let y of [.14,.92]){
      for(let side of [-1,1]) addBox(crateRoot,2.16,.045,.045,iron,0,y,side*1.04);
      for(let side of [-1,1]) addBox(crateRoot,.045,.045,2.16,iron,side*1.04,y,0);
    }
    root.add(crateRoot); root.userData.crate=crateRoot;
    scene.add(root); return root;
  }
  function makeGangway(from,to,fromY,toY,yaw){
    const g=new THREE.Group(),len=Math.hypot(to.x-from.x,to.z-from.z),mid=new THREE.Vector3((from.x+to.x)/2,(fromY+toY)/2,(from.z+to.z)/2);
    const wood=new THREE.MeshStandardMaterial({color:0x765437,roughness:.92}),dark=new THREE.MeshStandardMaterial({color:0x493421,roughness:.98});
    const plank=new THREE.Mesh(new THREE.BoxGeometry(1.85,.14,len),wood);plank.position.y=0;plank.castShadow=true;plank.receiveShadow=true;g.add(plank);
    for(const x of [-.78,.78]){const beam=new THREE.Mesh(new THREE.BoxGeometry(.13,.2,len),dark);beam.position.set(x,-.12,0);beam.castShadow=true;g.add(beam);}
    for(let z=-len/2+.35;z<len/2;z+=.72){const seam=new THREE.Mesh(new THREE.BoxGeometry(1.82,.012,.025),dark);seam.position.set(0,.078,z);g.add(seam);}
    g.position.copy(mid);g.rotation.y=yaw;g.rotation.x=Math.atan2(fromY-toY,len);g.userData.length=len;scene.add(g);return g;
  }
  function spawnBoat(time) {
    if(boat) return;
    boat=makeBoat();
    crate=boat.userData.crate;
    crateState='none';
    const dockX=rand(-42,42);boat.userData.dockX=dockX;
    boatShore=beach.shoreZ(dockX);
    boat.position.set(dockX,0,boatShore-48);
    boat.userData.dockZ=boatShore-5;
    boat.userData.phase='inbound';
    boatPhase='inbound';
    boat.rotation.y=.1;
    if(crate) crate.position.set(0,.28,.85);
    hooks.status?.('Se ve una embarcación acercándose desde el horizonte. Trae una caja de suministros.');
  }
  function updateBoat(dt,time,gameTime) {
    if(!boat) { if(gameTime>=nextBoatAt) spawnBoat(gameTime); return; }
    const phase=boat.userData.phase;
    let targetZ=phase==='inbound'?boat.userData.dockZ:phase==='outbound'?boatShore-62:boat.position.z;
    const dz=targetZ-boat.position.z;
    const speed=phase==='inbound'?1.35:1.8;
    boat.userData.isMoving=Math.abs(dz)>.18;
    if(Math.abs(dz)>.12) boat.position.z+=Math.sign(dz)*Math.min(Math.abs(dz),speed*dt);
    boat.position.y=.035+Math.sin(time*1.7)*.025;
    boat.rotation.x=Math.sin(time*1.1)*.006;
    boat.rotation.z=Math.sin(time*.8)*.008;
    if(boat.userData.wake) boat.userData.wake.visible=boat.userData.isMoving;
    if(phase==='inbound'&&Math.abs(dz)<.22){
      // El barco queda frente a la playa y despliega una pasarela; la caja baja físicamente hasta la arena.
      if(crate){
        const from=crate.getWorldPosition(new THREE.Vector3());boat.remove(crate);scene.add(crate);
        const x=boat.userData.dockX??-28,z=beach.shoreZ(x)+5.2;
        const to=new THREE.Vector3(x,ground(x,z)+.015,z);
        crate.position.copy(from);crate.rotation.y=boat.rotation.y;crateState='transit';
        const deckY=boat.position.y+.82,landY=to.y+.52;
        gangway=makeGangway(new THREE.Vector3(boat.position.x,0,boat.position.z+4.1),new THREE.Vector3(x,0,z-1.0),deckY,landY,boat.rotation.y);
        crateTransit={from:from.clone(),to,duration:4.2,t:0};
      }else{crateState='closed';}
      boat.userData.phase='unloading';boatPhase='unloading';
      hooks.status?.('El barco llegó a la costa y está bajando la caja por una pasarela.');
    } else if(phase==='unloading'){
      if(crateTransit&&crate){crateTransit.t=Math.min(crateTransit.duration,crateTransit.t+dt);const t=crateTransit.t/crateTransit.duration,e=t*t*(3-2*t);crate.position.lerpVectors(crateTransit.from,crateTransit.to,e);crate.rotation.y=boat.rotation.y;crate.rotation.z=Math.sin(t*Math.PI)*-.035;}
      if(!crateTransit||crateTransit.t>=crateTransit.duration){crateTransit=null;crateState='closed';if(gangway){scene.remove(gangway);gangway=null;}boat.userData.phase='docked';boatPhase='docked';boatDepartAt=time+24;hooks.status?.('¡La caja llegó por la pasarela y quedó en la arena! Ya puedes abrirla.');}
    } else if(phase==='docked'&&time>=boatDepartAt){
      boat.userData.phase='outbound'; boatPhase='outbound';
      hooks.status?.('El barco vuelve a salir al mar. La caja quedó en la playa.');
    } else if(phase==='outbound'&&boat.position.z<=boatShore-61.5){
      scene.remove(boat);boat=null;boatPhase='none';if(gangway){scene.remove(gangway);gangway=null;}
      nextBoatAt=gameTime+240;
      hooks.status?.('La embarcación se perdió en el horizonte. Volverá a acercarse más adelante.');
    }
  }
  function findGrassPatch(x,z,maxDist=24){
    const patches=hooks.grassPatches?.()||[];let best=null,bd=maxDist;
    for(const patch of patches){if((patch.food??1)<=.08)continue;const d=Math.hypot(patch.x-x,patch.z-z);if(d<bd){bd=d;best=patch;}}
    return best;
  }
  function findNaturalShelter(x,z,maxDist=24){
    let best=null,bd=maxDist;
    for(const palm of (beach.harvestPalms||[])){if(palm.felled)continue;const d=Math.hypot(palm.x-x,palm.z-z);if(d<bd){bd=d;best={x:palm.x+rand(-1.2,1.2),z:palm.z+rand(-1.2,1.2)};}}
    for(const b of (hooks.structures?.()||[])){if(!b?.position)continue;const d=Math.hypot(b.position.x-x,b.position.z-z);if(d<bd){bd=d;best={x:b.position.x,z:b.position.z};}}
    return best;
  }
  function spawnAnimal(s, x, z) {
    const root=new THREE.Group(); root.position.set(x,ground(x,z),z); scene.add(root);
    const template=templates[s.id];
    let mixer=null, actions={}, model=null;
    if(template){
      model=template.scene.clone(true); model.scale.setScalar(s.scale); root.add(model);
      if(template.animations?.length){mixer=new THREE.AnimationMixer(model); for(const clip of template.animations){const key=clip.name.toLowerCase();actions[key]=mixer.clipAction(clip);if(key.includes('idle')||key.includes('stand'))actions.idle=actions[key];if(key.includes('walk'))actions.walk=actions[key];if(key.includes('run'))actions.run=actions[key];} const first=actions.idle||mixer.clipAction(template.animations[0]);first.play();}
    } else {
      const mat=new THREE.MeshStandardMaterial({color:s.predator?0x77736a:0xb59a72,roughness:.94});
      const body=new THREE.Mesh(new THREE.SphereGeometry(.55,12,9),mat);body.scale.set(1,.78,1.45);body.position.y=.7;root.add(body);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.27,10,8),mat);head.position.set(0,1.0,1.05);root.add(head);
      for(let sx of [-.32,.32])for(let sz of [-.65,.65]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.55,7),mat);leg.position.set(sx,.28,sz);root.add(leg);}
    }
    const a={id:++animalSerial,s,root,model,mixer,actions,memory:{lastThreat:null,lastFood:null,lastWater:null,alertUntil:0},personality:{curiosity:rand(.65,1.25),courage:rand(.75,1.25),social:rand(.7,1.3)},hunger:rand(12,55),thirst:rand(10,50),sleep:rand(5,35),fear:rand(0,22),health:100,bleed:0,infect:0,domestication:0,milkReserve:s.id==='cow'?100:0,milkingUntil:0,mode:'roam',target:new THREE.Vector3(x+rand(-12,12),0,z+rand(-12,12)),think:rand(2,5),age:0,dead:false,footprintClock:rand(.1,.5),sleeping:false,grazingClock:0};
    animals.push(a); return a;
  }
  function openCrate(time) {
    if(crateState!=='closed')return;
    crateState='opened';
    if(crate) { crate.rotation.z=-.28; crate.position.y=.25; }
    if(Math.random()<.16){
      hooks.loot?.();
      hooks.status?.('La caja traía suministros: comida, cocos y materiales. Esta vez no había un animal.');
      return;
    }
    const s=species[Math.floor(Math.random()*species.length)];
    const x=crate ? crate.position.x+rand(-3,3) : -28+rand(-3,3), z=beach.shoreZ(x)+rand(7,14);
    const a=spawnAnimal(s,x,z); a.mode='escape';a.fear=88;a.target.set(player.position.x+rand(-24,24),0,player.position.z+rand(-24,24));
    if(Math.random()<.08){a.s={...s,name:' '+s.name+' mutado',speed:s.speed*1.35,predator:true};a.health=150;a.hunger=72;}
    hooks.status?.(`La caja se abrió: ¡${a.s.name}! Se ha escapado. Ahora sobrevivirá por su cuenta.`);
  }
  function nearestAnimal() {
    let best=null,bd=2.7;
    for(const a of animals){if(a.dead)continue;const d=a.root.position.distanceTo(player.position);if(d<bd){best=a;bd=d;}}
    return best;
  }
  function nearestCarcass(){let best=null,bd=2.8;for(const a of animals){if(!a.dead||a.harvested||!a.root)continue;const d=a.root.position.distanceTo(player.position);if(d<bd){best=a;bd=d;}}return best;}
  function crateDistance() {
    if (!crate || crateState !== 'closed') return Infinity;
    const world = crate.getWorldPosition(new THREE.Vector3());
    if (world.z-beach.shoreZ(world.x)<2.2 || beach.heightAt(world.x,world.z)<.12) return Infinity;
    return Math.hypot(world.x-player.position.x, world.z-player.position.z);
  }
  function mountNearestHorse() {
    let best=null,bd=3.25;
    for(const a of animals){if(a.dead||a.s.id!=='horse'||a.ridden)continue;const d=Math.hypot(a.root.position.x-player.position.x,a.root.position.z-player.position.z);if(d<bd){bd=d;best=a;}}
    if(!best)return false;
    if(best.mode==='flee'||best.mode==='hunt'||best.fear>58){hooks.status?.('El caballo está asustado o alterado. Acércate con calma cuando se tranquilice.');return true;}
    mountedHorse=best;best.ridden=true;best.mode='ridden';best.fear=Math.max(0,best.fear-16);best.sleeping=false;best.target.set(best.root.position.x,0,best.root.position.z);mountBlend=0;
    player.position.set(best.root.position.x,best.root.position.y+1.36,best.root.position.z);player.rotation.y=best.root.rotation.y;
    hooks.status?.('Has montado el caballo. W/A/S/D para dirigir, Shift para galopar y E para desmontar.');
    return true;
  }
  function dismountHorse() {
    if(!mountedHorse)return false;
    const h=mountedHorse;h.ridden=false;h.mode='roam';h.fear=Math.max(h.fear,8);h.think=.4;h.target.set(h.root.position.x+rand(-7,7),0,h.root.position.z+rand(-7,7));
    const side=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),h.root.rotation.y);
    const x=h.root.position.x+side.x*1.25,z=h.root.position.z+side.z*1.25;
    player.position.set(x,ground(x,z)+.035,z);player.rotation.y=h.root.rotation.y;mountedHorse=null;mountBlend=0;
    hooks.status?.('Has desmontado del caballo.');return true;
  }
  function setRidingInput(x,z,run,yaw){ridingInput={x:clamp(x,-1,1),z:clamp(z,-1,1),run:!!run,yaw};}
  function updateRiddenHorse(dt,time){
    if(!mountedHorse)return;
    if(mountedHorse.dead){const h=mountedHorse;const x=h.root.position.x+1,z=h.root.position.z;player.position.set(x,ground(x,z)+.035,z);mountedHorse=null;mountBlend=0;hooks.status?.('El caballo ya no puede llevarte.');return;}
    const h=mountedHorse,p=h.root.position;mountBlend=Math.min(1,mountBlend+dt*1.65);
    const old={x:p.x,z:p.z};
    const local=new THREE.Vector3(ridingInput.x,0,ridingInput.z);
    if(local.lengthSq()>.02){local.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),ridingInput.yaw);const speed=ridingInput.run?7.1:4.1;p.x+=local.x*speed*dt;p.z+=local.z*speed*dt;h.root.rotation.y=Math.atan2(local.x,local.z);}
    else {h.target.set(p.x,0,p.z);}   // v49: sin órdenes se queda quieto donde está (antes se arrastraba hasta el punto de montaje)
    p.x=clamp(p.x,-132,132);p.z=clamp(p.z,beach.shoreZ(p.x)+1.2,138);beach.constrain?.(p,old);p.y=ground(p.x,p.z);
    player.position.set(p.x,p.y+1.36,p.z);player.rotation.y=h.root.rotation.y;
    if(h.mixer){const act=(Math.hypot(ridingInput.x,ridingInput.z)>.12)?(ridingInput.run?'run':'walk'):'idle';const chosen=h.actions[act]||h.actions[act==='run'?'walk':'idle'];if(chosen&&!chosen.isRunning()){Object.values(h.actions).forEach(q=>q.fadeOut(.2));chosen.reset().fadeIn(.2).play();}}
    if(h.mixer)h.mixer.update(dt);
  }
  function interact() {
    if(mountedHorse)return dismountHorse();
    if(mountNearestHorse())return true;
    if(crateState==='closed'&&crate&&crateDistance()<3.6){openCrate(lastTime);return true;}
    const carcass=nearestCarcass();
    if(carcass){
      if(!hooks.hasKnife?.()){hooks.status?.('Necesitas fabricar y equipar un cuchillo para cortar el animal. Sin cuchillo solo puedes arrastrar el cuerpo.');return true;}
      carcass.harvested=true;scene.remove(carcass.root);hooks.harvestMeat?.(carcass,carcass.s.id==='cow'?4:2);hooks.status?.(`Has cortado al ${carcass.s.name.toLowerCase()} con el cuchillo. La carne quedó preparada para cocinar.`);return true;
    }
    const a=nearestAnimal();
    if(a){
      if(a.s.id==='cow'&&hooks.hasStoneBowl?.()){
        if((a.domestication<55||a.fear>48||a.mode==='flee')&&!hooks.isEnclosed?.(a)){
          a.mode='flee';a.fear=Math.min(100,a.fear+24);a.target.set(a.root.position.x+rand(-13,13),0,a.root.position.z+rand(8,18));
          hooks.status?.('La vaca todavía no confía en ti y se escapa. Aliméntala varias veces y deja que se acostumbre a tu presencia.');
        }else if((a.milkReserve??100)<12){hooks.status?.('La vaca necesita tiempo, agua y alimento antes de producir más leche.');}
        else if(hooks.milkCow?.(.28)){a.milkReserve=Math.max(0,(a.milkReserve??100)-28);a.fear=Math.max(0,a.fear-8);a.mode='milking';a.milkingUntil=lastTime+2.8;hooks.status?.('Estás ordeñando la vaca con cuidado. La leche cayó dentro de tu olla de piedra.');}
        return true;
      }
      if(hooks.feed?.()){a.domestication=Math.min(100,a.domestication+(a.s.id==='cow'?25:22));a.hunger=Math.max(0,a.hunger-38);a.fear=Math.max(0,a.fear-28);if(a.s.id==='cow'&&a.domestication>=55)hooks.status?.('La vaca ya confía en ti. Si sostienes una olla de piedra podrás ordeñarla.');else hooks.status?.(a.domestication>70?`${a.s.name}: empieza a confiar en ti.`:`Has alimentado al ${a.s.name}. Se está acostumbrando a ti.`);}
      else hooks.status?.(`${a.s.name} · Salud ${Math.round(a.health)} · Hambre ${Math.round(a.hunger)} · Sed ${Math.round(a.thirst)} · Confianza ${Math.round(a.domestication)}. Lleva cocos para acercarte.`);
      return true;
    }
    return false;
  }
  function startDraggingCarcass(){const a=nearestCarcass();if(!a)return false;draggedCarcass=a;hooks.status?.('Estás arrastrando el cuerpo con esfuerzo. Suelta E para dejarlo.');return true;}
  function stopDraggingCarcass(){if(!draggedCarcass)return false;draggedCarcass=null;return true;}
  let draggedCarcass=null;
  function updateDragging(dt){if(!draggedCarcass)return;const a=draggedCarcass;if(!a.root){draggedCarcass=null;return;}const yaw=player.rotation.y;const tx=player.position.x-Math.sin(yaw)*1.05,tz=player.position.z-Math.cos(yaw)*1.05;a.root.position.x+=(tx-a.root.position.x)*Math.min(1,dt*3.4);a.root.position.z+=(tz-a.root.position.z)*Math.min(1,dt*3.4);a.root.position.y=ground(a.root.position.x,a.root.position.z)+.02;a.root.rotation.y=yaw;hooks.drainPlayerEnergy?.(dt*3.8);}

  function moveAnimal(a,dt,time) {
    if(a===mountedHorse)return;
    const p=a.root.position,s=a.s,dist=p.distanceTo(player.position);
    a.age+=dt;if(s.id==='cow'&&a.mode==='graze'&&a.hunger<55)a.milkReserve=Math.min(100,(a.milkReserve??0)+dt*.22);
    if(a.mode==='milking'&&lastTime<a.milkingUntil){a.root.rotation.y=Math.atan2(player.position.x-p.x,player.position.z-p.z);if(a.mixer){a.mixer.update(dt);const idle=a.actions.idle;if(idle&&!idle.isRunning())idle.play();}return;}else if(a.mode==='milking'){a.mode='roam';a.think=.5;}a.hunger=Math.min(100,a.hunger+(s.predator?1.05:.62)*dt);a.thirst=Math.min(100,a.thirst+.68*dt);a.sleep=Math.min(100,a.sleep+.22*dt);a.fear=Math.max(0,a.fear-2.2*dt);a.footprintClock-=dt;
    if(a.bleed>0){a.health=Math.max(0,a.health-a.bleed*dt);a.bleed=Math.max(0,a.bleed-.015*dt);}
    if(a.infect>0){a.health=Math.max(0,a.health-a.infect*dt);a.infect=Math.max(0,a.infect-.004*dt);}
    if(a.health<=0){a.dead=true;a.carcass=true;a.root.rotation.z=Math.PI/2;a.root.position.y=ground(p.x,p.z)+.03;hooks.status?.(`El ${a.s.name.toLowerCase()} murió. Puedes arrastrarlo o cortarlo con un cuchillo.`);return;}
    a.think-=dt;
    if(a.think<=0){
      a.think=rand(2,5);
      if(a.mode==='escape')a.mode='roam';
      // Percepción local: vista, distancia, hambre y amenazas de otros individuos.
      let nearestThreat=null, threatD=Infinity, nearestPrey=null, preyD=Infinity, nearestFood=null, foodD=Infinity;
      for(const other of animals){if(other===a||other.dead)continue;const od=Math.hypot(other.root.position.x-p.x,other.root.position.z-p.z);if(!s.predator&&other.s.predator&&od<13&&od<threatD){nearestThreat=other;threatD=od;}if(s.predator&&!other.s.predator&&od<18&&od<preyD){nearestPrey=other;preyD=od;}}
      for(const rack of (hooks.foodRacks?.()||[])){if(!rack?.userData?.foods?.length)continue;const fd=Math.hypot(rack.position.x-p.x,rack.position.z-p.z);if(fd<24&&fd<foodD){nearestFood=rack;foodD=fd;}}
      const playerThreat=dist< (s.predator?7: a.domestication>60?3.5:11) && a.domestication<(s.id==='cow'?55:72) && !(s.id==='cow'&&hooks.isEnclosed?.(a));
      const isScared=a.fear>38||playerThreat||!!nearestThreat||(hooks.raining?.()&&Math.random()<.18);
      if(isScared){a.mode='flee';const threat=nearestThreat?.root.position||player.position;v.subVectors(p,threat).normalize();if(v.lengthSq()<.01)v.set(rand(-1,1),0,rand(-1,1)).normalize();a.target.copy(p).addScaledVector(v,rand(13,26));a.memory.lastThreat={x:threat.x,z:threat.z};a.memory.alertUntil=time+12;}
      else if(nearestFood&&a.hunger>28){a.mode='forage';a.target.set(nearestFood.position.x,0,nearestFood.position.z);a.memory.lastFood={x:a.target.x,z:a.target.z};}
      else if(s.predator&&a.hunger>48&&nearestPrey){a.mode='hunt';a.target.copy(nearestPrey.root.position);a.memory.lastFood={x:a.target.x,z:a.target.z};}
      else if(s.predator&&a.hunger>72&&dist<18){a.mode='hunt';a.target.copy(player.position);}
      else if(hooks.raining?.() && Math.random()<.72){
        const shelter=findNaturalShelter(p.x,p.z,28);
        if(shelter){a.mode='shelter';a.target.set(shelter.x,0,shelter.z);a.memory.shelter={x:shelter.x,z:shelter.z};}
        else if(a.thirst>58){a.mode='seek-water';}
      }
      else if(a.thirst>58){a.mode='seek-water';const shoreX=clamp(p.x+rand(-9,9),-78,78);a.target.set(shoreX,0,beach.shoreZ(shoreX)+rand(1.5,4));a.memory.lastWater={x:a.target.x,z:a.target.z};}
      else if(a.hunger>52){const grass=s.herbivore?findGrassPatch(p.x,p.z,30):null;a.mode=grass?'graze':'forage';if(grass){a.target.set(grass.x,0,grass.z);a.memory.lastFood={x:grass.x,z:grass.z};}else{a.target.set(clamp(p.x+rand(-16,16),-82,82),0,p.z+rand(-12,18));a.memory.lastFood={x:a.target.x,z:a.target.z};}}
      else if(a.sleep>72){a.mode='sleep';a.target.copy(p);a.sleeping=true;}
      else if(s.herbivore&&a.hunger>22){const grass=findGrassPatch(p.x,p.z,18);if(grass){a.mode='graze';a.target.set(grass.x,0,grass.z);}else{a.mode='roam';a.target.set(p.x+rand(-12,12),0,p.z+rand(-12,12));}a.sleeping=false;}
      else if(a.personality.curiosity>1.05&&Math.random()<.28){a.mode='investigate';a.target.set(p.x+rand(-9,9),0,p.z+rand(-9,9));}
      else {a.mode='roam';a.target.set(p.x+rand(-18,18),0,p.z+rand(-18,18));}
    }
    // constructions attract animals during rain; they seek cover around the player's base
    if(hooks.raining?.()&&hooks.structures?.().length&&Math.random()<dt*.06){
      const b=hooks.structures()[Math.floor(Math.random()*hooks.structures().length)];
      if(b)a.target.set(b.position.x,0,b.position.z);
    }
    const oldX=p.x,oldZ=p.z;
    let dx=a.target.x-p.x,dz=a.target.z-p.z;
    // Percepción espacial: separación entre animales, cohesión de manada y desvío de obstáculos.
    let steerX=0,steerZ=0,herdX=0,herdZ=0,herdN=0;
    for(const other of animals){if(other===a||other.dead)continue;const ox=p.x-other.root.position.x,oz=p.z-other.root.position.z,od=Math.hypot(ox,oz);if(od>0&&od<1.35){const k=(1.35-od)/1.35;steerX+=(ox/od)*k;steerZ+=(oz/od)*k;}if(!s.predator&&other.s.id===s.id&&od<13){herdX+=other.root.position.x;herdZ+=other.root.position.z;herdN++;}}
    if(herdN&&a.mode!=='flee'&&a.mode!=='hunt'){herdX/=herdN;herdZ/=herdN;const hx=herdX-p.x,hz=herdZ-p.z,hd=Math.hypot(hx,hz);if(hd>3){steerX+=hx/hd*.34;steerZ+=hz/hd*.34;}}
    // Palmeras y construcciones se consideran obstáculos sólidos: el animal busca rodearlos.
    for(const palm of (beach.harvestPalms||[])){if(palm.felled)continue;const ox=p.x-palm.x,oz=p.z-palm.z,od=Math.hypot(ox,oz);if(od>0&&od<1.65){const k=(1.65-od)/1.65;steerX+=(ox/od)*k*1.8;steerZ+=(oz/od)*k*1.8;}}
    if(hooks.structures){for(const b of hooks.structures()){if(!b?.position||b.userData?.buildType==='door'&&b.userData?.doorOpen)continue;const ox=p.x-b.position.x,oz=p.z-b.position.z,od=Math.hypot(ox,oz);if(od>0&&od<1.7){const k=(1.7-od)/1.7;steerX+=(ox/od)*k*1.7;steerZ+=(oz/od)*k*1.7;}}}
    dx+=steerX*3.2;dz+=steerZ*3.2;const len=Math.hypot(dx,dz);
    let speed=s.speed*(a.mode==='flee'?1.65:a.mode==='hunt'?1.35:a.mode==='rest'||(a.mode==='shelter'&&len<2.2)||(a.mode==='graze'&&len<1.4)||a.mode==='seek-water'&&a.thirst<28?.025:1);
    if(a.health<45)speed*=.72;
    if(a.mode==='sleep'||(a.mode==='shelter'&&len<2.2)){a.sleep=Math.max(0,a.sleep-(a.mode==='sleep'?1.35:.8)*dt);a.sleeping=true;speed=0;}else{a.sleeping=false;if(a.mode==='graze'&&len<1.6){a.grazingClock+=dt;if(a.grazingClock>2.0){const patch=findGrassPatch(p.x,p.z,2.2);if(patch){patch.food=Math.max(0,(patch.food??1)-.12);a.hunger=Math.max(0,a.hunger-5.5);}a.grazingClock=0;}}if(len>.8){p.x+=dx/len*speed*dt;p.z+=dz/len*speed*dt;a.root.rotation.y=Math.atan2(dx,dz);}}
    // Colisión por segmento y huella orientada: evita que la fauna atraviese paredes finas incluso con pasos largos.
    if(hooks.structures){for(const b of hooks.structures()){if(!b?.position||!['wall','door'].includes(b.userData?.buildType)||(b.userData?.buildType==='door'&&b.userData?.doorOpen))continue;
      const c=Math.cos(-b.rotation.y),sn=Math.sin(-b.rotation.y);const local=(x,z)=>{const ox=x-b.position.x,oz=z-b.position.z;return {x:ox*c-oz*sn,z:ox*sn+oz*c};};
      const a0=local(oldX,oldZ),a1=local(p.x,p.z);const half=b.userData.buildType==='door'?.73:1.30;
      const crossed=(a0.z<=0&&a1.z>=0)||(a0.z>=0&&a1.z<=0);let hit=false;
      if(crossed&&Math.abs(a1.z-a0.z)>.0001){const t=-a0.z/(a1.z-a0.z),ix=a0.x+(a1.x-a0.x)*t;hit=t>=0&&t<=1&&Math.abs(ix)<half;}
      if(!hit&&Math.abs(a1.z)<.40&&Math.abs(a1.x)<half)hit=true;
      if(hit){p.x=oldX;p.z=oldZ;a.target.set(p.x+rand(-7,7),0,p.z+rand(7,13));if(speed>2.2){b.userData.animalDamage=(b.userData.animalDamage||0)+dt*2.2;if(b.userData.animalDamage>3.4){scene.remove(b);hooks.removeStructure?.(b);hooks.status?.(`¡${a.s.name} rompió una construcción al embestirla!`);}}else if(a.mode!=='flee')a.mode='roam';}
    }}
    p.x=clamp(p.x,-138,138);p.z=clamp(p.z,beach.shoreZ(p.x)+1.1,142);
    if(p.z-beach.shoreZ(p.x)<1.0){p.z=beach.shoreZ(p.x)+1.0;a.target.set(p.x+rand(-10,10),0,p.z+rand(5,15));a.mode='roam';}
    p.y=ground(p.x,p.z)+((a.mode==='graze'||a.mode==='rest')?Math.sin(time*1.8+a.age)*.012:0);
    if(a.mixer){a.mixer.update(dt);if(a.model){const grazing=a.mode==='graze'&&len<1.6;a.model.rotation.x+=((grazing?.16:0)-a.model.rotation.x)*(1-Math.exp(-dt*3));}const moving=len>.8;const act=moving?(a.mode==='hunt'||a.mode==='flee'?'run':'walk'):'idle';const chosen=a.actions[act]||a.actions[act==='run'?'walk':'idle'];if(chosen&&!chosen.isRunning()){Object.values(a.actions).forEach(q=>q.fadeOut(.18));chosen.reset().fadeIn(.18).play();}}else if(a.model){a.model.rotation.x+=((a.mode==='graze'&&len<1.6?.16:0)-a.model.rotation.x)*(1-Math.exp(-dt*3));const gait=len>.8?Math.sin(time*(a.mode==='flee'||a.mode==='hunt'?13:8)+a.age*2):Math.sin(time*1.8+a.age)*.18;a.model.position.y=Math.abs(gait)*.055;a.model.rotation.z=len>.8?gait*.035:Math.sin(time*.8+a.age)*.012;}
    // Beber agua salada en la orilla (reduce sed, pero no la elimina por completo).
    if(a.thirst>55 && Math.abs(p.z-beach.shoreZ(p.x))<2.8){a.thirst=Math.max(18,a.thirst-5*dt);}
    // El fuego quema: deja una herida persistente y puede provocar sangrado.
    if(hooks.fires){for(const f of hooks.fires()){if(f.lit&&Math.hypot(p.x-f.x,p.z-f.z)<1.35){a.health=Math.max(0,a.health-7*dt);a.bleed=Math.max(a.bleed,.08);a.fear=Math.min(100,a.fear+18*dt);}}}
    // Depredación sobre presas: contacto físico cercano y persecución, no teletransporte.
    const currentPlayerDist=Math.hypot(player.position.x-p.x,player.position.z-p.z);
    // Huellas pequeñas de pezuñas/patas en arena seca; se desvanecen solas.
    if(a.footprintClock<=0 && len>.8 && p.z-beach.shoreZ(p.x)>0.5 && p.z-beach.shoreZ(p.x)<18){
      a.footprintClock= s.id==='bear'?.34:.48;
      hooks.footprint?.(p.x,p.z,a.root.rotation.y,s.id);
    }
    if(s.predator&&a.mode==='hunt'){
      let prey=null,near=1.15;for(const other of animals){if(other===a||other.dead||other.s.predator)continue;const dd=Math.hypot(other.root.position.x-p.x,other.root.position.z-p.z);if(dd<near){near=dd;prey=other;}}
      if(prey&&a.hunger>35){prey.health=Math.max(0,prey.health-(s.id==='bear'?9:5)*dt);prey.fear=Math.min(100,prey.fear+24*dt);if(prey.health<=0){prey.dead=true;prey.carcass=true;prey.root.rotation.z=Math.PI/2;prey.root.position.y=ground(prey.root.position.x,prey.root.position.z)+.03;a.hunger=Math.max(0,a.hunger-42);hooks.status?.(`Un ${a.s.name.toLowerCase()} cazó a un ${prey.s.name.toLowerCase()}. El cuerpo quedó en la isla.`);}}
    }
    // A predator that reaches the player attacks; domestication reduces aggression.
    if(s.predator&&currentPlayerDist<1.7&&a.hunger>45&&a.domestication<60){
      hooks.damagePlayer?.((s.id==='bear'?13:8)*dt);
      a.hunger=Math.max(0,a.hunger-2*dt);
      if(Math.random()<dt*.12)hooks.status?.(`¡El ${s.name} te está atacando! Aléjate o distráelo con comida.`);
    }
    // Impact with built pieces: weak structures can be damaged by a fleeing/heavy animal.
    if(hooks.structures){for(const b of hooks.structures()){if(!b?.position)continue;const dd=Math.hypot(p.x-b.position.x,p.z-b.position.z);if(dd<1.2&&speed>2.2&&b.userData?.buildType){b.userData.animalDamage=(b.userData.animalDamage||0)+dt;if(b.userData.animalDamage>8){a.health=Math.max(0,a.health-14);a.bleed=Math.max(a.bleed,.045);scene.remove(b);hooks.removeStructure?.(b);hooks.status?.('¡Un animal ha derribado una construcción y quedó herido!');}break;}}}
  }
  function hitAnimalAt(x,y,z,kind='stone',speed=0){
    // V28: zona de impacto proporcional al tamaño del animal (las crías son más pequeñas).
    let hit=null,nearest=Infinity;
    for(const a of animals){
      if(a.dead)continue;
      const k=Math.max(.6,a.root.scale.x||1);
      const dx=a.root.position.x-x,dz=a.root.position.z-z,dy=(a.root.position.y+0.75*k)-y,d=Math.hypot(dx,dz);
      if(d<0.82*k&&Math.abs(dy)<1.15*k&&d<nearest){nearest=d;hit=a;}
    }
    if(!hit)return false;
    // El daño crece con la velocidad del impacto: un objeto que rueda por el suelo apenas hace daño.
    const power=clamp(.55+speed/30,.6,1.2);
    const base=kind==='stone'?34:kind==='branch'?18:24;
    const damage=Math.round(base*power);
    hit.health=Math.max(0,hit.health-damage);hit.fear=Math.min(100,hit.fear+42);hit.bleed=Math.max(hit.bleed,kind==='stone'?.12:.07);hit.mode='flee';
    const dx=hit.root.position.x-x,dz=hit.root.position.z-z,len=Math.hypot(dx,dz)||1;hit.target.set(hit.root.position.x+dx/len*15,0,hit.root.position.z+dz/len*15);
    hooks.impact?.(hit.root.position,kind);
    hooks.status?.(hit.health<=0?`¡El ${hit.s.name.toLowerCase()} cayó por el impacto!`:`¡Impactaste al ${hit.s.name.toLowerCase()} con ${kind==='stone'?'una piedra':kind==='branch'?'una rama':'un coco'}! -${damage} de salud. ¡Se enfureció y huye/contraataca!`);
    if(hit.health<=0){hit.dead=true;hit.carcass=true;hit.root.rotation.z=Math.PI/2;hit.root.position.y=ground(hit.root.position.x,hit.root.position.z)+.03;hooks.status?.(`El ${hit.s.name.toLowerCase()} murió. Necesitas un cuchillo para obtener su carne; también puedes arrastrarlo.`);}
    return true;
  }
  function flushPopulation(){
    const count=pendingPopulation;pendingPopulation=0;if(!count)return;
    const spawnCenter={x:76,z:124};
    for(let i=0;i<count;i++){
      const s=species[Math.floor(Math.random()*species.length)];
      let x=spawnCenter.x+rand(-17,17),z=spawnCenter.z+rand(-9,8);
      x=clamp(x,48,104);z=clamp(z,112,138);
      const a=spawnAnimal(s,x,z);a.mode='roam';a.think=rand(.5,2.2);a.nextCall=rand(8,22);a.target.set(x+rand(-20,20),0,z+rand(-18,18));
      a.hunger=rand(18,42);a.thirst=rand(15,38);a.sleep=rand(8,42);a.fear=rand(0,8);
    }
  }
  function populateIsland(count=6){pendingPopulation=count;if(speciesLoads>=species.length)flushPopulation();return animals.length+pendingPopulation;}
  function update(dt,time){
    if(startTime===null)startTime=time;
    const gameTime=time-startTime; lastTime=gameTime;updateDragging(dt);
    if(gameTime>=nextBoatAt&&!boat)spawnBoat(gameTime);
    if(boat){if(boat.userData.phase==='docked'&&crateState==='closed')boat.rotation.y=.1+Math.sin(time*.35)*.012;updateBoat(dt,time,gameTime);}
    for(const patch of (hooks.grassPatches?.()||[])){if(patch.food!==undefined&&patch.food<1)patch.food=Math.min(1,patch.food+dt*.0015);}
    for(const a of animals)if(!a.dead){moveAnimal(a,dt,time);a.nextCall=(a.nextCall??rand(8,20))-dt;if(a.nextCall<=0){const d=Math.hypot(a.root.position.x-player.position.x,a.root.position.z-player.position.z);if(d<82)hooks.animalSound?.(a.s.id,a.root.position,d);a.nextCall=rand(a.s.id==='bear'?19:13,a.s.id==='bear'?38:31);}}
    for(let i=animals.length-1;i>=0;i--)if(animals[i].dead&&animals[i].harvested)animals.splice(i,1);
    if(gameTime>=nextBirthAt){
      nextBirthAt=gameTime+120;
      const parents=animals.filter(a=>!a.dead&&a.age>55&&a.hunger<48&&a.thirst<48&&a.health>65);
      for(let i=0;i<parents.length;i++)for(let j=i+1;j<parents.length;j++){
        const p1=parents[i],p2=parents[j];
        if(p1.s.id===p2.s.id&&p1.root.position.distanceTo(p2.root.position)<2.5){
          const baby=spawnAnimal(p1.s,p1.root.position.x+rand(-1,1),p1.root.position.z+rand(-1,1));
          baby.root.scale.setScalar(.48);baby.health=65;baby.hunger=18;baby.thirst=18;baby.fear=35;
          hooks.status?.(`¡Ha nacido una cría de ${p1.s.name}! La población salvaje crece.`);i=parents.length;break;
        }
      }
    }
    if(!announced&&gameTime>=gameOverTimer){announced=true;hooks.status?.('¡Has sobrevivido 30 minutos en la isla! Reto completado.');}
  }
  return {update,updateRider:updateRiddenHorse,interact,hitAnimalAt,populateIsland,startDraggingCarcass,stopDraggingCarcass,isDraggingCarcass:()=>!!draggedCarcass,setRidingInput,isMounted:()=>!!mountedHorse,getMountBlend:()=>mountBlend,isCrateNearby:()=>crateState==='closed'&&crateDistance()<3.6,getBoat:()=>boat,getCrate:()=>crate,getGangway:()=>gangway,get animals(){return animals;},get crateState(){return crateState;},get boatPhase(){return boatPhase;}};
}
