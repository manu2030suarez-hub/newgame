// Daniel: superviviente autónomo inicial. Movimiento exploratorio y animación independiente.
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/utils/SkeletonUtils.js';

export function createSurvivorNPC(THREE, scene, loader, beach, options = {}) {
  const MODEL_PATH = './man-base-character-rigged.glb';
  const HEIGHT = 1.8;
  const home = { x: 94, z: 145 }; // claro de la pradera, detrás de la montaña
  const root = new THREE.Group();
  root.name = 'daniel-survivor';
  root.visible = false;
  scene.add(root);

  let mixer = null, model = null, walkAction = null, idleAction = null;
  let currentAction = null, target = null, pause = 1.5, moveBlend = 0;
  let clock = 0, ready = false, failed = false;
  const bones = {};
  const rest = new Map();
  const rand = (a,b) => a + Math.random() * (b-a);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const smooth = v => { v=clamp(v,0,1); return v*v*(3-2*v); };
  const groundAt = (x,z) => beach.surfaceHeightAt?.(x,z) ?? beach.heightAt(x,z);

  function chooseTarget() {
    // Daniel permanece en el claro y sus alrededores; evita acercarse al borde del mapa.
    for (let i=0;i<24;i++) {
      const a = Math.random()*Math.PI*2, r = rand(5,15);
      const x = clamp(home.x + Math.cos(a)*r, 76, 112);
      const z = clamp(home.z + Math.sin(a)*r*.72, 132, 149);
      const slope = Math.hypot(groundAt(x+1,z)-groundAt(x-1,z), groundAt(x,z+1)-groundAt(x,z-1));
      if (slope < 2.2) return new THREE.Vector3(x,groundAt(x,z),z);
    }
    return new THREE.Vector3(home.x+rand(-5,5),groundAt(home.x,home.z),home.z+rand(-4,4));
  }

  function fadeTo(action, duration=.35) {
    if (!action || currentAction===action) return;
    if (currentAction) currentAction.fadeOut(duration);
    action.reset().fadeIn(duration).play();
    currentAction=action;
  }

  function addProceduralPose(dt,time,walking) {
    const w = walking ? 1 : 0;
    const phase = time * (walking ? 7.2 : 1.5);
    const gait = Math.sin(phase) * w;
    const breathe = Math.sin(time*1.7)*.018;
    if (bones.spine) bones.spine.rotation.x = (rest.get(bones.spine)?.x||0) + breathe;
    if (bones.head) bones.head.rotation.y = (rest.get(bones.head)?.y||0) + Math.sin(time*.72)*.035;
    if (!walkAction) {
      if (bones.leftLeg) bones.leftLeg.rotation.x = (rest.get(bones.leftLeg)?.x||0) + gait*.42;
      if (bones.rightLeg) bones.rightLeg.rotation.x = (rest.get(bones.rightLeg)?.x||0) - gait*.42;
      if (bones.leftArm) bones.leftArm.rotation.x = (rest.get(bones.leftArm)?.x||0) - gait*.22;
      if (bones.rightArm) bones.rightArm.rotation.x = (rest.get(bones.rightArm)?.x||0) + gait*.22;
    }
  }

  function update(dt,time,playerPosition) {
    if (!ready || failed) return;
    clock += dt;
    if (mixer) mixer.update(dt);
    const distanceToPlayer = playerPosition ? Math.hypot(playerPosition.x-root.position.x,playerPosition.z-root.position.z) : Infinity;
    // Por ahora Daniel explora la pradera por su cuenta; si el jugador se acerca, se detiene y lo mira.
    const meeting = distanceToPlayer < 5.2;
    if (meeting) {
      target = null; pause = Math.max(pause, .8);
      const dx=playerPosition.x-root.position.x, dz=playerPosition.z-root.position.z;
      if (Math.hypot(dx,dz)>.1) {
        const desired=Math.atan2(dx,dz), delta=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));
        root.rotation.y += delta*Math.min(1,dt*3.2);
      }
    } else {
      pause -= dt;
      if (!target && pause<=0) target=chooseTarget();
      if (target) {
        const dx=target.x-root.position.x, dz=target.z-root.position.z, dist=Math.hypot(dx,dz);
        if (dist<.65) { target=null; pause=rand(1.8,4.8); }
        else {
          const desired=Math.atan2(dx,dz), delta=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));
          root.rotation.y += delta*Math.min(1,dt*2.4);
          const turnPenalty=1-clamp(Math.abs(delta)/Math.PI,0,.55);
          const speed=1.05*turnPenalty;
          root.position.x += Math.sin(root.rotation.y)*speed*dt;
          root.position.z += Math.cos(root.rotation.y)*speed*dt;
          const bounded=beach.constrain?.(root.position) || root.position;
          root.position.x=clamp(bounded.x,70,118);
          root.position.z=clamp(bounded.z,128,150);
        }
      }
    }
    const floor=groundAt(root.position.x,root.position.z);
    root.position.y += (floor-root.position.y)*Math.min(1,dt*12);
    const walking=!!target && !meeting;
    moveBlend += ((walking?1:0)-moveBlend)*(1-Math.exp(-dt*7));
    if (walking) fadeTo(walkAction,.28); else fadeTo(idleAction,.45);
    addProceduralPose(dt,clock,walking);
    root.visible=true;
  }

  loader.load(MODEL_PATH, gltf => {
    try {
      model=SkeletonUtils.clone(gltf.scene);
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
      root.add(model);
      model.updateMatrixWorld(true);
      let box=new THREE.Box3().setFromObject(model,true);
      const h=box.max.y-box.min.y;
      if (!Number.isFinite(h)||h<.001) throw new Error('El modelo de Daniel no tiene una altura válida.');
      model.scale.multiplyScalar(HEIGHT/h);
      model.updateMatrixWorld(true);
      box.setFromObject(model,true);
      model.position.y -= box.min.y;
      const center=box.getCenter(new THREE.Vector3());
      model.position.x -= center.x; model.position.z -= center.z;
      model.updateMatrixWorld(true);

      model.traverse(o=>{
        if(!o.isBone)return;
        const n=o.name.toLowerCase();
        if(/spine/.test(n)&&!bones.spine)bones.spine=o;
        if(/head/.test(n)&&!bones.head)bones.head=o;
        if(/left.*(thigh|upleg|leg)$/.test(n)||/thigh.*left/.test(n))bones.leftLeg=o;
        if(/right.*(thigh|upleg|leg)$/.test(n)||/thigh.*right/.test(n))bones.rightLeg=o;
        if(/left.*upper.?arm/.test(n))bones.leftArm=o;
        if(/right.*upper.?arm/.test(n))bones.rightArm=o;
        rest.set(o,o.rotation.clone());
      });
      mixer=new THREE.AnimationMixer(model);
      const clips=[...(gltf.animations||[])];
      // Reutiliza también las animaciones manuales guardadas por el editor del juego.
      try {
        const edits=JSON.parse(localStorage.getItem('survivalPlaya.animationEdits.v1')||'{}');
        for(const edit of Object.values(edits)) if(edit?.clip?.tracks?.length) {
          try { clips.push(THREE.AnimationClip.parse(edit.clip)); } catch(e) { console.warn('[Daniel] Animación editada inválida:',e); }
        }
      } catch(e) { console.warn('[Daniel] No se pudieron leer animaciones guardadas:',e); }
      const actions=clips.map(c=>({name:c.name.toLowerCase(),action:mixer.clipAction(c)}));
      walkAction=actions.find(a=>/(walk|caminar|andar|walking)/.test(a.name))?.action||null;
      idleAction=actions.find(a=>/(idle|quieto|standing|stand)/.test(a.name))?.action||null;
      root.position.set(home.x,groundAt(home.x,home.z),home.z);
      root.rotation.y=rand(0,Math.PI*2);
      target=chooseTarget();
      ready=true;root.visible=true;
      if(!walkAction) console.warn('[Daniel] No se encontró clip de caminar; se usará una marcha procedural sencilla.');
      console.info('[Daniel] Superviviente cargado en la pradera.',{walk:!!walkAction,idle:!!idleAction,clips:clips.map(c=>c.name)});
    } catch(e) { failed=true; console.error('[Daniel] No se pudo preparar el personaje:',e); options.onError?.(e); }
  },undefined,error=>{failed=true;console.error('[Daniel] No se pudo cargar el modelo:',error);options.onError?.(error);});

  return {root,update,get ready(){return ready;},get failed(){return failed;},dispose(){scene.remove(root);}};
}
