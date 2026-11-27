// Lector GLB integrado en Survival Playa: mide la caja real del modelo y crea una colisión basada en sus dimensiones.
export function createGLBReader(THREE, scene, beach, loader, player) {
  const style=document.createElement('style');
  style.textContent=`
  #glbReaderToggle{position:fixed;right:18px;top:104px;z-index:80;background:#183b2a;color:#f1fff4;border:1px solid #77a989;border-radius:9px;padding:10px 13px;font:600 13px system-ui;cursor:pointer;box-shadow:0 4px 18px #0008}
  #glbReaderPanel{position:fixed;right:18px;top:150px;z-index:81;width:min(360px,calc(100vw - 28px));max-height:70vh;overflow:auto;background:#101b17f2;color:#eff8f0;border:1px solid #52715c;border-radius:12px;padding:14px;box-shadow:0 12px 35px #000a;display:none;font:13px/1.45 system-ui}
  #glbReaderPanel h3{margin:0 0 8px;font-size:16px}#glbReaderPanel p{color:#c2d2c6;margin:6px 0}
  #glbReaderPanel input{max-width:100%;margin:8px 0}#glbReaderPanel button{background:#285b3b;color:white;border:1px solid #78a989;border-radius:7px;padding:8px 10px;margin:5px 5px 0 0;cursor:pointer}
  #glbReaderPanel button.secondary{background:#29352e}#glbReaderResult{white-space:pre-wrap;background:#192820;border-radius:8px;padding:10px;margin-top:10px;color:#e4f4e7;font-variant-numeric:tabular-nums}
  `;
  document.head.appendChild(style);
  const toggle=document.createElement('button');toggle.id='glbReaderToggle';toggle.textContent='📐 Lector GLB';
  const panel=document.createElement('section');panel.id='glbReaderPanel';
  panel.innerHTML='<h3>Lector inteligente de GLB</h3><p>Seleccioná un modelo 3D. El lector calcula alto, ancho, largo, profundidad, centro y una caja de colisión a partir de la geometría real.</p><input id="glbReaderFile" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json"><div><button id="glbReaderPlace" disabled>Colocar modelo + colisión</button><button id="glbReaderClose" class="secondary">Cerrar</button></div><div id="glbReaderResult">Esperando un archivo GLB…</div>';
  document.body.append(toggle,panel);
  toggle.addEventListener('click',()=>panel.style.display=panel.style.display==='block'?'none':'block');
  panel.querySelector('#glbReaderClose').addEventListener('click',()=>panel.style.display='none');
  const fileInput=panel.querySelector('#glbReaderFile'), result=panel.querySelector('#glbReaderResult'), place=panel.querySelector('#glbReaderPlace');
  let analyzed=null,placedRoot=null,placedMeshes=[];
  function removePlaced(){
    if(!placedRoot)return;
    scene.remove(placedRoot);
    for(const mesh of placedMeshes){const k=beach.rockMeshes.indexOf(mesh);if(k>=0)beach.rockMeshes.splice(k,1);}
    const c=beach.colliders.findIndex(v=>v.glbReader===placedRoot);if(c>=0)beach.colliders.splice(c,1);
    placedRoot.traverse(o=>{if(o.isMesh){o.geometry?.dispose();}});
    placedRoot=null;placedMeshes=[];
  }
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    result.textContent='Analizando geometría…';place.disabled=true;analyzed=null;
    try{
      const buffer=await file.arrayBuffer();
      loader.parse(buffer,'',gltf=>{
        try{
          const model=gltf.scene;model.updateMatrixWorld(true);
          const box=new THREE.Box3().setFromObject(model);
          const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
          if(!Number.isFinite(size.x+size.y+size.z)||Math.max(size.x,size.y,size.z)<.0001)throw new Error('El GLB no contiene geometría medible.');
          analyzed={model,size,center,fileName:file.name};
          const fmt=n=>n.toFixed(3)+' m';
          result.textContent='ARCHIVO: '+file.name+'\n\nANÁLISIS DE DIMENSIONES\nAncho X: '+fmt(size.x)+'\nAltura Y: '+fmt(size.y)+'\nProfundidad Z: '+fmt(size.z)+'\nLargo horizontal: '+fmt(Math.max(size.x,size.z))+'\nCentro local: ('+[center.x,center.y,center.z].map(v=>v.toFixed(3)).join(', ')+')\n\nCOLISIÓN PROPUESTA\nCaja: '+fmt(size.x/2)+' × '+fmt(size.y/2)+' × '+fmt(size.z/2)+' (semiextensiones)\nAjuste: calculado desde todos los meshes y sus transformaciones.';
          place.disabled=false;
        }catch(e){result.textContent='No se pudo medir el modelo: '+e.message;}
      },e=>{result.textContent='Error leyendo GLB: '+(e?.message||e);});
    }catch(e){result.textContent='No se pudo abrir el archivo: '+e.message;}
  });
  place.addEventListener('click',()=>{
    if(!analyzed||!beach)return;
    removePlaced();
    const {model,size,center,fileName}=analyzed;
    // Coloca el modelo unos metros delante del personaje, apoyado en la superficie.
    const yaw=player.rotation?.y||0;
    const x=player.position.x-Math.sin(yaw)*5,z=player.position.z-Math.cos(yaw)*5;
    model.position.x-=center.x;model.position.z-=center.z;model.updateMatrixWorld(true);
    const localBox=new THREE.Box3().setFromObject(model);
    model.position.y-=localBox.min.y;model.updateMatrixWorld(true);
    const ground=beach.surfaceHeightAt?beach.surfaceHeightAt(x,z):beach.heightAt(x,z);
    const root=new THREE.Group();root.name='GLB '+fileName;root.position.set(x,ground,z);root.add(model);root.updateMatrixWorld(true);
    const worldBox=new THREE.Box3().setFromObject(root),worldSize=worldBox.getSize(new THREE.Vector3());
    const meshes=[];root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;meshes.push(o);}});
    scene.add(root);
    const collider={x,z,r:Math.max(worldSize.x,worldSize.z)*.5,rx:Math.max(.08,worldSize.x*.5),rz:Math.max(.08,worldSize.z*.5),rock:true,bottom:worldBox.min.y,top:worldBox.max.y,mesh:root,glbReader:root};
    beach.colliders.push(collider);beach.rockMeshes.push(...meshes);
    placedRoot=root;placedMeshes=meshes;
    result.textContent+='\n\n✓ Modelo colocado delante del personaje. Colisión añadida al mapa con sus dimensiones medidas.';
    place.textContent='Reemplazar modelo + colisión';
  });
  return {toggle:()=>{panel.style.display='block';},remove:removePlaced};
}
