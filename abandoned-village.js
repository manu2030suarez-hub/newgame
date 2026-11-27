// Pueblo abandonado: viviendas tropicales de madera envejecida y chapa oxidada.
export function createAbandonedVillage(THREE, scene, beach) {
  const group = new THREE.Group();
  group.name = 'Pueblo abandonado - viviendas';
  scene.add(group);

  function makeCanvasTexture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (kind === 'wood') {
      ctx.fillStyle = '#62503c'; ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 42) {
        const base = 68 + Math.floor(Math.random() * 32);
        ctx.fillStyle = `rgb(${base},${Math.floor(base*.78)},${Math.floor(base*.57)})`;
        ctx.fillRect(0, y, 512, 39);
        ctx.strokeStyle = 'rgba(25,18,12,.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0,y+39); ctx.lineTo(512,y+39); ctx.stroke();
        for (let k=0;k<24;k++) {
          const x=Math.random()*512, yy=y+Math.random()*35;
          ctx.strokeStyle = `rgba(22,15,10,${.08+Math.random()*.2})`;
          ctx.lineWidth=.5+Math.random()*2;
          ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+12+Math.random()*100,yy+(Math.random()-.5)*3);ctx.stroke();
        }
      }
      for(let i=0;i<28;i++){
        const x=Math.random()*512,y=Math.random()*512;
        ctx.strokeStyle='rgba(18,13,9,.36)';ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(x,y,3+Math.random()*7,2+Math.random()*4,0,0,Math.PI*2);ctx.stroke();
      }
    } else {
      ctx.fillStyle='#59483b';ctx.fillRect(0,0,512,512);
      for(let x=0;x<512;x+=32){
        const rust=Math.random();
        ctx.fillStyle=rust>.55?'#75452e':rust>.25?'#985d3b':'#51483c';
        ctx.fillRect(x,0,27,512);
        ctx.fillStyle='rgba(205,151,94,.22)';ctx.fillRect(x+3,0,3,512);
        ctx.strokeStyle='rgba(20,18,16,.55)';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(x+29,0);ctx.lineTo(x+29,512);ctx.stroke();
      }
      for(let i=0;i<180;i++){
        ctx.fillStyle=Math.random()>.5?'rgba(190,112,63,.20)':'rgba(25,24,21,.24)';
        ctx.fillRect(Math.random()*512,Math.random()*512,2+Math.random()*18,2+Math.random()*35);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.anisotropy=4;
    return tex;
  }

  const woodMap=makeCanvasTexture('wood'), rustMap=makeCanvasTexture('rust');
  const wood=new THREE.MeshStandardMaterial({map:woodMap,color:0xc0a17b,roughness:.96});
  const darkWood=new THREE.MeshStandardMaterial({color:0x493628,roughness:1});
  const rust=new THREE.MeshStandardMaterial({map:rustMap,color:0xc4a080,roughness:.88,metalness:.28});
  const glass=new THREE.MeshStandardMaterial({color:0x111a19,roughness:.22,metalness:.12});
  const concrete=new THREE.MeshStandardMaterial({color:0x686052,roughness:1});
  const porchMat=new THREE.MeshStandardMaterial({color:0x806448,roughness:1});

  function box(parent, material, x,y,z, sx,sy,sz, rx=0,ry=0,rz=0) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);
    mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function addCollider(x,z,r) { beach.colliders.push({x,z,r}); }

  function buildHouse(spec) {
    const x=spec.x, z=spec.z, w=spec.w, d=spec.d, floors=spec.floors||1;
    const base=beach.heightAt(x,z);
    const h=3.05, wallTop=h*floors;
    const house=new THREE.Group();house.position.set(x,base,z);house.rotation.y=spec.rot||0;group.add(house);
    // Piso elevado sobre pilotes, típico de una vivienda costera.
    box(house,concrete,0,.22,0,w+.55,.34,d+.55);
    for(let px of [-w*.42,w*.42]) for(let pz of [-d*.4,d*.4]) {
      box(house,darkWood,px,-.45,pz,.24,1.25,.24);
    }
    box(house,porchMat,0,.48,0,w,.18,d);
    // Pared trasera y laterales; la fachada queda dividida para dejar entrada.
    box(house,wood,0,1.98,-d/2,w,wallTop-.35,.22);
    box(house,wood,-w/2,1.98,0,.22,wallTop-.35,d);
    box(house,wood,w/2,1.98,0,.22,wallTop-.35,d);
    const doorW=1.15;
    box(house,wood,-w*.28,1.98,d/2,(w-doorW)*.5,wallTop-.35,.22);
    box(house,wood,w*.28,1.98,d/2,(w-doorW)*.5,wallTop-.35,.22);
    // Marco y puerta oscura entreabierta.
    box(house,darkWood,0,1.55,d/2+.03,.95,2.25,.12,0,-.12,0);
    // Ventanas negras con marcos de madera.
    for(const side of [-1,1]) {
      const wx=side*(w/2+.13);
      box(house,glass,wx,2.05,-.35,.035,1.0,1.15);
      box(house,darkWood,wx*1.01,2.58,-.35,.12,.12,1.35);
      box(house,darkWood,wx*1.01,1.52,-.35,.12,.12,1.35);
      box(house,darkWood,wx*1.01,2.05,-.35,.12,1.12,.12);
      box(house,darkWood,wx*1.01,2.05,-.35,.12,1.12,.12);
    }
    // Listones verticales y travesaños que dan aspecto de madera vieja.
    for(let xx=-w/2+.32;xx<w/2;xx+=.62) {
      box(house,darkWood,xx,1.98,d/2+.13,.055,wallTop-.38,.045);
    }
    box(house,darkWood,0,.88,d/2+.17,w,.13,.13);
    box(house,darkWood,0,wallTop-.12,d/2+.17,w,.13,.13);
    // Techo a dos aguas con chapa corrugada oxidada.
    const roofAngle=Math.atan2(1.45,w*.57);
    const roofLen=Math.hypot(w*.57,1.45);
    const roofY=wallTop+(floors===2?1.05:.68);
    box(house,rust,-w*.25,roofY,0,roofLen,.16,d+1.0,0,0,-roofAngle);
    box(house,rust,w*.25,roofY,0,roofLen,.16,d+1.0,0,0,roofAngle);
    // Ondas metálicas visibles en los faldones.
    for(let side of [-1,1]) for(let k=0;k<Math.floor((d+1)/.34);k++) {
      const zz=-d/2-.35+k*.34;
      box(house,darkWood,side*w*.25,roofY+.08,zz,roofLen*.98,.035,.035,0,0,side*roofAngle);
    }
    // Aleros, porche y escalones.
    box(house,darkWood,0,wallTop+.05,d/2+.65,w+.8,.18,.22);
    box(house,porchMat,0,.12,d/2+1.05,w*.62,.16,1.35);
    for(let px of [-w*.34,w*.34]) box(house,darkWood,px,1.65,d/2+.95,.18,2.45,.18);
    if(floors===2) {
      box(house,porchMat,0,h+.12,0,w*.92,.16,d*.88);
      // Baranda del balcón delantero.
      box(house,darkWood,0,h+.72,d/2+.25,w*.9,.12,.12);
      for(let xx=-w*.42;xx<=w*.42;xx+=.55) box(house,darkWood,xx,h+.42,d/2+.25,.075,.68,.075);
      for(let xx=-w*.42;xx<=w*.42;xx+=.62) {
        box(house,wood,xx,h+1.9,d/2+.13,.07,wallTop-.35,.05);
      }
      box(house,wood,0,h+1.98,-d/2,w,.22,d);
      box(house,wood,-w/2,h+1.98,0,.22,wallTop-.35,d);
      box(house,wood,w/2,h+1.98,0,.22,wallTop-.35,d);
      box(house,wood,-w*.25,h+1.98,d/2,(w*.5),wallTop-.35,.22);
      box(house,wood,w*.25,h+1.98,d/2,(w*.5),wallTop-.35,.22);
      for(const wx of [-w*.25,w*.25]) {
        box(house,glass,wx,h+2.05,d/2+.13,1.05,1.0,.035);
        box(house,darkWood,wx,h+2.58,d/2+.18,1.28,.12,.12);
        box(house,darkWood,wx,h+1.52,d/2+.18,1.28,.12,.12);
      }
    }
    // Colisión por tramos: permite entrar por el hueco de la puerta.
    const c=Math.cos(spec.rot||0),s=Math.sin(spec.rot||0);
    const world=(lx,lz)=>({x:x+lx*c+lz*s,z:z-lx*s+lz*c});
    for(const [lx,lz,r] of [[0,-d/2,w*.43],[-w/2,0,d*.43],[w/2,0,d*.43],[-w*.34,d/2,w*.15],[w*.34,d/2,w*.15]]) {
      const p=world(lx,lz);addCollider(p.x,p.z,r);
    }
  }

  // Caserío en una franja relativamente llana, lejos del naufragio y de la cueva.
  const homes=[
    {x:-126,z:beach.shoreZ(-126)+42,w:7.4,d:6.8,floors:1,rot:-.08},
    {x:-108,z:beach.shoreZ(-108)+47,w:8.2,d:7.2,floors:2,rot:.10},
    {x:-89,z:beach.shoreZ(-89)+40,w:7.1,d:6.4,floors:1,rot:-.14},
    {x:-70,z:beach.shoreZ(-70)+49,w:7.8,d:7.0,floors:1,rot:.06}
  ];
  homes.forEach(buildHouse);
  console.info('Pueblo abandonado: viviendas construidas',homes.length);
  return {group,homes};
}
