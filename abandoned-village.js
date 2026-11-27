// Pueblo tropical abandonado: tablas pintadas y despintadas, chapa acanalada y óxido.
export function createAbandonedVillage(THREE, scene, beach) {
  const group = new THREE.Group();
  group.name = 'Pueblo abandonado - viviendas';
  scene.add(group);

  const palettes = [
    {base:'#9b927c', light:'#c2b69a', worn:'#756b59', paint:'#b8b09a'},
    {base:'#71847d', light:'#9ca99a', worn:'#59665e', paint:'#a8b3a5'},
    {base:'#9a765d', light:'#bd9878', worn:'#70513e', paint:'#c5a184'},
    {base:'#777c78', light:'#a2a39a', worn:'#555b58', paint:'#b6b5a8'}
  ];

  function makeWoodTexture(p) {
    const c=document.createElement('canvas'); c.width=1024; c.height=512;
    const g=c.getContext('2d');
    g.fillStyle=p.base;g.fillRect(0,0,c.width,c.height);
    // Tablas horizontales individuales, cada una con tono y desgaste propio.
    for(let y=0;y<512;y+=42) {
      const v=(Math.random()-.5)*28;
      g.fillStyle=Math.random()>.25?p.light:p.worn;
      g.globalAlpha=.25+Math.random()*.35;g.fillRect(0,y,1024,39);g.globalAlpha=1;
      g.fillStyle=p.base;g.globalAlpha=.45;g.fillRect(0,y+3,1024,32);g.globalAlpha=1;
      g.strokeStyle='rgba(37,29,21,.65)';g.lineWidth=2;g.beginPath();g.moveTo(0,y+40);g.lineTo(1024,y+40);g.stroke();
      // Vetas, grietas y manchas de humedad.
      for(let k=0;k<32;k++){
        const x=Math.random()*1024, yy=y+Math.random()*37;
        g.strokeStyle=Math.random()>.5?'rgba(35,27,20,.34)':'rgba(225,211,181,.25)';
        g.lineWidth=.5+Math.random()*2;g.beginPath();g.moveTo(x,yy);g.lineTo(x+18+Math.random()*130,yy+(Math.random()-.5)*3);g.stroke();
      }
      for(let k=0;k<5;k++){
        const x=Math.random()*1000, yy=y+Math.random()*28;
        g.fillStyle='rgba(34,29,24,.18)';g.fillRect(x,yy,25+Math.random()*90,2+Math.random()*5);
      }
      // Pintura descascarada: deja ver madera gris y oscura debajo.
      for(let k=0;k<10;k++){
        const x=Math.random()*1010, yy=y+Math.random()*34;
        g.fillStyle=Math.random()>.5?'rgba(213,205,181,.48)':'rgba(48,42,34,.32)';
        g.beginPath();g.ellipse(x,yy,3+Math.random()*17,1+Math.random()*5,(Math.random()-.5)*.2,0,Math.PI*2);g.fill();
      }
      // Clavos oxidados.
      for(const x of [24+Math.random()*12,980+Math.random()*18]){
        g.fillStyle='#443a31';g.beginPath();g.arc(x,y+19,2.3,0,Math.PI*2);g.fill();
        g.fillStyle='rgba(192,111,65,.65)';g.beginPath();g.arc(x-1,y+18,1,0,Math.PI*2);g.fill();
      }
    }
    // Escurridos de lluvia y musgo en bordes.
    for(let i=0;i<65;i++){
      const x=Math.random()*1024,y=Math.random()*512;
      g.fillStyle=Math.random()>.5?'rgba(44,67,43,.16)':'rgba(35,30,25,.13)';
      g.fillRect(x,y,1+Math.random()*5,12+Math.random()*90);
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
  }

  function makeRoofTexture() {
    const c=document.createElement('canvas');c.width=512;c.height=512;
    const g=c.getContext('2d');g.fillStyle='#75432f';g.fillRect(0,0,512,512);
    for(let x=0;x<512;x+=32){
      const tone=['#9c6244','#b2764e','#654b3c','#8b5138','#777064'][Math.floor(Math.random()*5)];
      g.fillStyle=tone;g.fillRect(x,0,28,512);
      g.fillStyle='rgba(222,163,111,.35)';g.fillRect(x+3,0,4,512);
      g.fillStyle='rgba(32,29,26,.42)';g.fillRect(x+27,0,4,512);
      for(let k=0;k<9;k++){
        g.fillStyle=Math.random()>.5?'rgba(47,40,32,.34)':'rgba(207,125,75,.32)';
        g.fillRect(x+Math.random()*27,Math.random()*512,2+Math.random()*9,8+Math.random()*55);
      }
    }
    for(let i=0;i<90;i++){
      g.fillStyle='rgba(42,37,30,.24)';g.beginPath();g.ellipse(Math.random()*512,Math.random()*512,4+Math.random()*22,3+Math.random()*13,0,0,Math.PI*2);g.fill();
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
  }

  const roofMap=makeRoofTexture();
  const roofMats=[
    new THREE.MeshStandardMaterial({map:roofMap,color:0xd6a17d,roughness:.92,metalness:.18}),
    new THREE.MeshStandardMaterial({map:roofMap,color:0xaeb0a4,roughness:.95,metalness:.12}),
    new THREE.MeshStandardMaterial({map:roofMap,color:0xc68a68,roughness:.94,metalness:.2})
  ];
  const glass=new THREE.MeshStandardMaterial({color:0x18201d,roughness:.32});
  const shadowWood=new THREE.MeshStandardMaterial({color:0x514538,roughness:1});
  const floorMat=new THREE.MeshStandardMaterial({color:0x82735e,roughness:1});
  const mossMat=new THREE.MeshStandardMaterial({color:0x465b3b,roughness:1});

  function box(parent,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
    const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);
    m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function addCollider(x,z,r){beach.colliders.push({x,z,r});}

  function buildHouse(spec,index){
    const {x,z,w,d,floors=1}=spec, base=beach.heightAt(x,z), h=3.05, wallTop=h*floors;
    const palette=palettes[index%palettes.length];
    const woodMap=makeWoodTexture(palette);
    const wood=new THREE.MeshStandardMaterial({map:woodMap,color:0xffffff,roughness:.98});
    const trim=new THREE.MeshStandardMaterial({color:palette.worn,roughness:1});
    const roof=roofMats[index%roofMats.length];
    const house=new THREE.Group();house.position.set(x,base,z);house.rotation.y=spec.rot||0;group.add(house);

    // Casa levantada sobre pilotes y piso de tablas desparejas.
    box(house,floorMat,0,.27,0,w+.45,.28,d+.45);
    for(let px of [-w*.42,w*.42])for(let pz of [-d*.4,d*.4])box(house,shadowWood,px,-.35,pz,.22,1.15,.22);
    for(let xx=-w/2;xx<w/2;xx+=.72)box(house,wood,xx+.34,.47,0,.68,.12,d);

    // Paredes revestidas con tablas horizontales visibles.
    box(house,wood,0,1.98,-d/2,w,wallTop-.35,.20);
    box(house,wood,-w/2,1.98,0,.20,wallTop-.35,d);
    box(house,wood,w/2,1.98,0,.20,wallTop-.35,d);
    const doorW=1.15;
    box(house,wood,-w*.28,1.98,d/2,(w-doorW)/2,wallTop-.35,.20);
    box(house,wood,w*.28,1.98,d/2,(w-doorW)/2,wallTop-.35,.20);

    // Puerta vieja, marcos, ventanas oscuras y postigos torcidos.
    box(house,trim,0,1.55,d/2+.13,.98,2.25,.13,0,-.09,0);
    box(house,shadowWood,0,1.55,d/2+.205,.78,2.02,.025,0,-.09,0);
    for(const side of [-1,1]){
      const wx=side*(w/2+.12);
      box(house,glass,wx,2.12,-.45,.035,1.0,1.22);
      for(const yy of [1.59,2.65])box(house,trim,wx,yy,-.45,.13,.12,1.4);
      box(house,trim,wx,2.12,-.45,.13,1.12,.12);
      box(house,shadowWood,wx*1.015,2.12,-1.13,.12,.9,.055,0,0,side*.12);
    }

    // Porche frontal con postes y baranda incompleta.
    box(house,shadowWood,0,.88,d/2+.18,w,.13,.13);
    box(house,trim,0,wallTop-.12,d/2+.18,w,.12,.12);
    for(let px of [-w*.43,w*.43])box(house,shadowWood,px,1.7,d/2+.78,.15,2.55,.15);
    box(house,wood,0,.12,d/2+1.05,w*.62,.16,1.35);
    for(let xx=-w*.38;xx<w*.4;xx+=.68)box(house,trim,xx,1.05,d/2+.18,.065,.9,.065);

    // Techo de chapa oxidada a dos aguas, con aleros anchos.
    const roofAngle=Math.atan2(1.45,w*.57), roofLen=Math.hypot(w*.57,1.45);
    const roofY=wallTop+.7;
    box(house,roof,-w*.25,roofY,0,roofLen,.13,d+1.25,0,0,-roofAngle);
    box(house,roof,w*.25,roofY,0,roofLen,.13,d+1.25,0,0,roofAngle);
    // Nervaduras corrugadas y remates oscuros para que la chapa se lea desde lejos.
    for(const side of [-1,1])for(let k=0;k<Math.floor((d+1.25)/.28);k++){
      const zz=-d/2-.62+k*.28;
      box(house,roof,side*w*.25,roofY+.08,zz,roofLen*.99,.035,.055,0,0,side*roofAngle);
    }
    box(house,shadowWood,0,wallTop+.08,d/2+.7,w+.9,.12,.18);

    if(floors===2){
      // Segundo nivel con balcón abierto y fachada de otro tono gastado.
      box(house,wood,0,h+1.98,-d/2,w,.20,.20);
      box(house,wood,-w/2,h+1.98,0,.20,wallTop-.35,d);
      box(house,wood,w/2,h+1.98,0,.20,wallTop-.35,d);
      box(house,wood,-w*.25,h+1.98,d/2,w*.5,wallTop-.35,.20);
      box(house,wood,w*.25,h+1.98,d/2,w*.5,wallTop-.35,.20);
      for(const wx of [-w*.25,w*.25]){
        box(house,glass,wx,h+2.05,d/2+.12,1.0,1.05,.035);
        box(house,trim,wx,h+2.58,d/2+.18,1.25,.12,.12);
        box(house,trim,wx,h+1.52,d/2+.18,1.25,.12,.12);
      }
      box(house,wood,0,h+.12,d/2+.34,w*.94,.15,.9);
      box(house,trim,0,h+.72,d/2+.82,w*.92,.12,.12);
      for(let xx=-w*.42;xx<=w*.42;xx+=.55)box(house,trim,xx,h+.42,d/2+.82,.07,.68,.07);
      const upperY=wallTop+.7;
      box(house,roof,-w*.25,upperY,0,roofLen,.13,d+1.25,0,0,-roofAngle);
      box(house,roof,w*.25,upperY,0,roofLen,.13,d+1.25,0,0,roofAngle);
    }

    // Manchas de musgo en la base y tablas sueltas decorativas.
    for(let i=0;i<7;i++){
      const xx=(Math.random()-.5)*w*.8;
      box(house,mossMat,xx,.64,d/2+.115,.12,.08,.025,0,0,(Math.random()-.5)*.3);
    }

    // Colisiones en perímetro dejando el hueco central de entrada.
    const c=Math.cos(spec.rot||0),s=Math.sin(spec.rot||0);
    const world=(lx,lz)=>({x:x+lx*c+lz*s,z:z-lx*s+lz*c});
    for(const [lx,lz,r] of [[0,-d/2,w*.43],[-w/2,0,d*.43],[w/2,0,d*.43],[-w*.34,d/2,w*.15],[w*.34,d/2,w*.15]]){
      const p=world(lx,lz);addCollider(p.x,p.z,r);
    }
  }

  const homes=[
    {x:-126,z:beach.shoreZ(-126)+42,w:7.4,d:6.8,floors:1,rot:-.08},
    {x:-108,z:beach.shoreZ(-108)+47,w:8.2,d:7.2,floors:2,rot:.10},
    {x:-89,z:beach.shoreZ(-89)+40,w:7.1,d:6.4,floors:1,rot:-.14},
    {x:-70,z:beach.shoreZ(-70)+49,w:7.8,d:7.0,floors:1,rot:.06}
  ];
  homes.forEach(buildHouse);
  console.info('Pueblo abandonado: viviendas envejecidas construidas',homes.length);
  return {group,homes};
}
