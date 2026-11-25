export function createSharkSystem(THREERef, scene, beach, options = {}) {
  const T = THREERef;
  const sharks = [];
  const bodyMat = new T.MeshStandardMaterial({ color: 0x53636a, roughness: .72, metalness: .08 });
  const bellyMat = new T.MeshStandardMaterial({ color: 0xb8b9ad, roughness: .88 });
  const finMat = new T.MeshStandardMaterial({ color: 0x3c4a50, roughness: .8 });
  const eyeMat = new T.MeshStandardMaterial({ color: 0x080b0d, roughness: .25 });
  const mouthMat = new T.MeshStandardMaterial({ color: 0x251d1b, roughness: .95 });
  const sphere = new T.SphereGeometry(1, 20, 14);
  const finGeo = new T.BufferGeometry();
  finGeo.setAttribute('position', new T.Float32BufferAttribute([
    0,0,0, 0,.95,-.15, 0,.05,.52,
    0,0,0, 0,.05,.52, 0,-.22,.36
  ],3));
  finGeo.setIndex([0,1,2,3,4,5]); finGeo.computeVertexNormals();
  const makeMesh = (parent, geo, mat, pos, scale) => {
    const m = new T.Mesh(geo,mat); m.position.set(...pos); m.scale.set(...scale);
    m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
  };
  function makeShark(id,x,z,phase) {
    const root=new T.Group(); root.name='patrolling-shark-'+id; scene.add(root);
    const body=new T.Group(); root.add(body);
    makeMesh(body,sphere,bodyMat,[0,0,0],[.58,.48,1.85]);
    makeMesh(body,sphere,bellyMat,[0,-.23,.03],[.49,.27,1.62]);
    makeMesh(body,sphere,bodyMat,[0,.02,1.52],[.34,.30,.65]);
    // Cola vertical móvil, aletas pectorales y dorsal de silueta reconocible.
    const tail=new T.Group(); tail.position.set(0,0,-1.58); body.add(tail);
    makeMesh(tail,finGeo,finMat,[0,0,-.18],[1,1,1]).rotation.y=Math.PI;
    const dorsal=makeMesh(body,finGeo,finMat,[0,.32,-.2],[.72,.9,1]); dorsal.rotation.y=Math.PI;
    const jaw=new T.Group(); jaw.position.set(0,-.19,1.68); body.add(jaw);
    makeMesh(jaw,sphere,bellyMat,[0,-.05,.12],[.27,.075,.25]);
    for(const side of [-1,1]){
      const pectoral=makeMesh(body,finGeo,finMat,[side*.36,-.12,.05],[.78,.55,1]);
      pectoral.rotation.z=side*.55; pectoral.rotation.y=side*.95;
      makeMesh(body,sphere,eyeMat,[side*.48,.12,1.38],[.055,.055,.07]);
      makeMesh(body,sphere,mouthMat,[side*.02,-.22,1.83],[.20,.035,.12]);
    }
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
