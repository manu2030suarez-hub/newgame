// Daniel: el modelo de IA decide sus acciones; Three.js ejecuta el desplazamiento y las animaciones.
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/utils/SkeletonUtils.js';

export function createSurvivorNPC(THREE, scene, loader, beach, options = {}) {
  const MODEL_PATH='./man-base-character-rigged.glb', HEIGHT=1.8;
  const home={x:94,z:145}, bounds={minX:70,maxX:118,minZ:128,maxZ:150};
  const root=new THREE.Group();root.name='daniel-survivor';root.visible=false;scene.add(root);
  let mixer=null,model=null,walkAction=null,idleAction=null,currentAction=null;
  let ready=false,failed=false,engine=null,brainBusy=false,planBusy=false,lastPlanAt=0;
  let target=null,mode='waiting',clock=0,moveBlend=0;
  const bones={},rest=new Map(),history=[];
  const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const groundAt=(x,z)=>beach.surfaceHeightAt?.(x,z)??beach.heightAt(x,z);
  const ui=buildPanel();

  function buildPanel(){
    const style=document.createElement('style');style.textContent=`
      #daniel-ai-panel{position:fixed;z-index:75;right:12px;top:76px;width:min(340px,calc(100vw - 24px));color:#f5f1e8;font:12px system-ui;background:rgba(12,22,27,.94);border:1px solid #ffffff35;border-radius:13px;box-shadow:0 10px 35px #0008;backdrop-filter:blur(12px);overflow:hidden}
      #daniel-ai-head{display:flex;align-items:center;gap:8px;padding:10px 11px}
      #daniel-ai-title{flex:1;font-weight:800;letter-spacing:.04em}#daniel-ai-status{display:block;color:#c9d2cc;font-size:10px;font-weight:400;margin-top:3px}
      #daniel-ai-toggle,#daniel-ai-start,#daniel-ai-send{border:1px solid #ffffff35;border-radius:8px;background:#263a35;color:#fff;padding:8px 10px;font-weight:750}
      #daniel-ai-start{background:#c49a5c;color:#171c1a;border:0}
      #daniel-ai-body{display:none;border-top:1px solid #ffffff22}
      #daniel-ai-log{height:150px;max-height:25vh;overflow:auto;padding:9px;display:flex;flex-direction:column;gap:7px}
      .daniel-ai-msg{padding:8px 10px;border-radius:10px;max-width:94%;white-space:pre-wrap;line-height:1.4;background:#ffffff12;align-self:flex-start}
      .daniel-ai-msg.you{background:#b98a53;color:#171b1c;align-self:flex-end}
      #daniel-ai-compose{display:flex;gap:6px;padding:8px;border-top:1px solid #ffffff20}
      #daniel-ai-input{min-width:0;flex:1;background:#ffffff12;color:white;border:1px solid #ffffff28;border-radius:8px;padding:10px;font:inherit}
      #daniel-ai-note{padding:0 10px 9px;color:#b9c7c2;font-size:10px;line-height:1.4}
      @media(max-width:600px){#daniel-ai-panel{top:74px;right:7px;width:min(300px,calc(100vw - 14px))}#daniel-ai-log{height:112px}}
    `;document.head.appendChild(style);
    const panel=document.createElement('section');panel.id='daniel-ai-panel';
    panel.innerHTML='<div id="daniel-ai-head"><div id="daniel-ai-title">DANIEL · SUPERVIVIENTE IA<span id="daniel-ai-status">Cerebro apagado · esperando</span></div><button id="daniel-ai-start" type="button">Encender IA</button><button id="daniel-ai-toggle" type="button" aria-label="Abrir chat">Chat</button></div><div id="daniel-ai-body"><div id="daniel-ai-log" aria-live="polite"><div class="daniel-ai-msg">Estoy acá. Cuando enciendas mi cerebro voy a poder decidir qué hacer y hablar con vos.</div></div><form id="daniel-ai-compose"><input id="daniel-ai-input" autocomplete="off" placeholder="Hablá con Daniel…"><button id="daniel-ai-mic" type="button" aria-label="Hablar por micrófono">🎙</button><button id="daniel-ai-send" type="submit">Enviar</button></form><div id="daniel-ai-note">IA local experimental. El modelo se descarga una vez y se ejecuta en este dispositivo; no usa una API paga.</div></div>';
    document.body.appendChild(panel);
    const body=panel.querySelector('#daniel-ai-body');
    panel.querySelector('#daniel-ai-toggle').addEventListener('click',()=>{body.style.display=body.style.display==='block'?'none':'block';});
    panel.querySelector('#daniel-ai-start').addEventListener('click',startBrain);
    panel.querySelector('#daniel-ai-compose').addEventListener('submit',e=>{e.preventDefault();const input=panel.querySelector('#daniel-ai-input');const value=input.value.trim();if(value){input.value='';sendMessage(value);}});
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;const mic=panel.querySelector('#daniel-ai-mic');if(Recognition){const rec=new Recognition();rec.lang='es-UY';rec.interimResults=false;rec.maxAlternatives=1;mic.addEventListener('click',()=>{try{rec.start();status('Te estoy escuchando…');mic.textContent='⏺';}catch{}});rec.onresult=e=>{const said=e.results?.[0]?.[0]?.transcript||'';if(said)sendMessage(said);};rec.onerror=()=>status('No pude usar el micrófono');rec.onend=()=>{mic.textContent='🎙';if(engine)status('IA encendida · decido mis propias acciones');};}else{mic.addEventListener('click',()=>status('Este navegador no admite dictado por voz'));}
    return {panel,status:panel.querySelector('#daniel-ai-status'),start:panel.querySelector('#daniel-ai-start'),log:panel.querySelector('#daniel-ai-log'),body};
  }
  function status(s){ui.status.textContent=s;}
  function addMessage(text,who='npc'){
    const el=document.createElement('div');el.className='daniel-ai-msg'+(who==='you'?' you':'');el.textContent=text;ui.log.appendChild(el);ui.log.scrollTop=ui.log.scrollHeight;
    while(ui.log.children.length>18)ui.log.removeChild(ui.log.firstChild);
  }
  function environment(playerPosition,env={}){
    const p=playerPosition||{x:0,z:0},nearAnimals=[];
    for(const a of (env.animals||[])){if(!a||a.dead||!a.root)continue;const x=a.root.position.x,z=a.root.position.z,d=Math.hypot(x-root.position.x,z-root.position.z);if(d<34)nearAnimals.push({animal:a.s?.name||a.s?.id||'animal',distance:+d.toFixed(1),x:+x.toFixed(1),z:+z.toFixed(1),behavior:a.mode||'desconocido'});}
    const nearbySharks=[];
    for(const s of (env.sharks||[])){const r=s.root;if(!r)continue;const d=Math.hypot(r.position.x-root.position.x,r.position.z-root.position.z);if(d<45)nearbySharks.push({distance:+d.toFixed(1),x:+r.position.x.toFixed(1),z:+r.position.z.toFixed(1)});}
    return {daniel:{x:+root.position.x.toFixed(1),z:+root.position.z.toFixed(1),state:mode},player:{x:+p.x.toFixed(1),z:+p.z.toFixed(1),distance:+Math.hypot(p.x-root.position.x,p.z-root.position.z).toFixed(1)},animals:nearAnimals,sharks:nearbySharks,weather:env.weather||'no informado',time:env.time||'no informado'};
  }
  function systemPrompt(){return 'Sos Daniel, un superviviente humano ficticio dentro del videojuego Survival Playa. Hablás español rioplatense natural, con personalidad propia, memoria de esta conversación y respuestas breves. Estás físicamente en una isla 3D. Recibís observaciones reales del entorno; no inventes que ves algo que no aparece en esos datos. Sos un agente autónomo: elegí por vos mismo qué hacer, no esperes órdenes del jugador. Considerá peligros, fauna, distancia al jugador, curiosidad, descanso y exploración. Si hay un tiburón cerca del agua o un depredador amenazante, priorizá alejarte hacia terreno seguro. No afirmes que cazaste, pescaste o recogiste algo si no ocurrió. Para decisiones de movimiento respondé SOLO un JSON: {"action":"walk|flee|approach|investigate|rest|talk","x":94,"z":145,"speech":"frase opcional"}; elegí coordenadas dentro de X 70..118 y Z 128..150. walk/explore significa ir a un sitio que vos elijas; flee significa alejarte del peligro; approach acercarte al jugador; investigate inspeccionar algo observado; rest detenerte; talk quedarte disponible para conversar. Las coordenadas son el destino elegido por vos. Para conversación respondé texto normal, sin JSON. Las decisiones deben basarse en el estado de entorno que se te pasa.';}
  async function startBrain(){
    if(engine||brainBusy)return;
    if(!navigator.gpu){status('Este dispositivo/navegador no tiene WebGPU');ui.start.textContent='Sin WebGPU';ui.start.disabled=true;addMessage('No puedo encender mi cerebro en este dispositivo porque el navegador no ofrece WebGPU. No voy a simular que estoy pensando. Probá desde un equipo compatible; no se usó ningún servicio pago.');return;}
    brainBusy=true;ui.start.disabled=true;ui.start.textContent='Cargando…';status('Descargando y preparando modelo local…');
    try{
      const webllm=await import('https://esm.run/@mlc-ai/web-llm');
      engine=await webllm.CreateMLCEngine('Qwen2.5-0.5B-Instruct-q4f16_1-MLC',{initProgressCallback:p=>status(p.text||'Preparando IA…')});
      history.push({role:'system',content:systemPrompt()});
      status('IA encendida · decido mis propias acciones');ui.start.textContent='IA encendida';ui.start.disabled=true;
      addMessage('Listo. Ahora puedo observar lo que pasa en la isla y decidir qué hacer por mi cuenta.');
      ui.body.style.display='block';ui.log.scrollTop=ui.log.scrollHeight;
      lastPlanAt=0;
    }catch(e){console.error('[Daniel IA]',e);engine=null;status('No se pudo iniciar: '+(e?.message||'compatibilidad o memoria'));ui.start.textContent='Reintentar';ui.start.disabled=false;}
    brainBusy=false;
  }
  async function askModel(userContent,maxTokens=150,temperature=.75){
    const messages=[{role:'system',content:systemPrompt()},...history.filter(m=>m.role!=='system').slice(-12),{role:'user',content:userContent}];
    const result=await engine.chat.completions.create({messages,temperature,top_p:.9,max_tokens:maxTokens});
    return result.choices?.[0]?.message?.content?.trim()||'';
  }
  function parseDecision(raw){
    const match=raw.match(/\{[\s\S]*\}/);if(!match)return null;
    try{const d=JSON.parse(match[0]);if(!['walk','flee','approach','investigate','rest','talk'].includes(d.action))return null;
      return {action:d.action,x:clamp(Number(d.x)||home.x,bounds.minX,bounds.maxX),z:clamp(Number(d.z)||home.z,bounds.minZ,bounds.maxZ),speech:typeof d.speech==='string'?d.speech.slice(0,180):''};
    }catch{return null;}
  }
  async function think(playerPosition,env){
    if(!engine||planBusy||clock-lastPlanAt<7)return;
    planBusy=true;lastPlanAt=clock;
    try{
      const snapshot=environment(playerPosition,env);
      const raw=await askModel('Observá esta situación actual y elegí tu próxima acción autónoma. No repitas una rutina fija; razoná según lo que ocurre ahora. Estado: '+JSON.stringify(snapshot)+'. Devolvé únicamente el JSON de acción.',120,.55);
      const decision=parseDecision(raw);
      if(decision){
        mode=decision.action;
        if(['walk','flee','approach','investigate'].includes(mode)){
          let x=decision.x,z=decision.z;
          // La IA elige el destino; el controlador solo impide salir de la pradera y corrige el suelo.
          const safe=beach.constrain?.({x,y:groundAt(x,z),z})||{x,z};
          target=new THREE.Vector3(clamp(safe.x,bounds.minX,bounds.maxX),groundAt(clamp(safe.x,bounds.minX,bounds.maxX),clamp(safe.z,bounds.minZ,bounds.maxZ)),clamp(safe.z,bounds.minZ,bounds.maxZ));
        }else target=null;
        if(decision.speech)addMessage(decision.speech);
        if(mode==='flee')status('IA decidió escapar de un peligro');else status('IA activa · '+mode);
      }
    }catch(e){console.warn('[Daniel IA] Error al decidir:',e);status('IA activa · reintentando decisión');}
    finally{planBusy=false;}
  }
  async function sendMessage(text){
    ui.body.style.display='block';addMessage(text,'you');
    if(!engine){addMessage('Todavía no tengo el cerebro encendido. Tocá «Encender IA» para iniciar el modelo local.');return;}
    status('Daniel está pensando…');
    try{
      const snapshot=environment(options.getPlayerPosition?.(),options.getEnvironment?.()||{});
      const prompt='El jugador te dice: '+text+'\nObservación actual del entorno: '+JSON.stringify(snapshot)+'\nContestale directamente, de forma natural y coherente. Si hay peligro cercano, podés mencionarlo solo si está en los datos.';
      const answer=await askModel(prompt,170,.82);
      if(answer){history.push({role:'user',content:prompt},{role:'assistant',content:answer});addMessage(answer);speak(answer);}
      status('IA encendida · decido mis propias acciones');
    }catch(e){console.error(e);addMessage('Perdón, tuve un problema al responder.');status('IA activa · error al responder');}
  }
  function speak(text){if(!('speechSynthesis'in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='es-UY';u.rate=.96;speechSynthesis.speak(u);}catch{}}
  function fadeTo(action,duration=.35){if(!action||currentAction===action)return;if(currentAction)currentAction.fadeOut(duration);action.reset().fadeIn(duration).play();currentAction=action;}
  function pose(time,walking){
    const gait=Math.sin(time*(walking?7.2:1.5))*(walking?1:0);
    if(bones.spine)bones.spine.rotation.x=(rest.get(bones.spine)?.x||0)+Math.sin(time*1.7)*.018;
    if(bones.head)bones.head.rotation.y=(rest.get(bones.head)?.y||0)+Math.sin(time*.72)*.035;
    if(!walkAction){if(bones.leftLeg)bones.leftLeg.rotation.x=(rest.get(bones.leftLeg)?.x||0)+gait*.42;if(bones.rightLeg)bones.rightLeg.rotation.x=(rest.get(bones.rightLeg)?.x||0)-gait*.42;if(bones.leftArm)bones.leftArm.rotation.x=(rest.get(bones.leftArm)?.x||0)-gait*.22;if(bones.rightArm)bones.rightArm.rotation.x=(rest.get(bones.rightArm)?.x||0)+gait*.22;}
  }
  function update(dt,time,playerPosition,env={}){
    if(!ready||failed)return;clock+=dt;if(mixer)mixer.update(dt);
    if(engine)think(playerPosition,env);
    const distance=playerPosition?Math.hypot(playerPosition.x-root.position.x,playerPosition.z-root.position.z):Infinity;
    if(target){
      const dx=target.x-root.position.x,dz=target.z-root.position.z,dist=Math.hypot(dx,dz);
      if(dist<.7){target=null;lastPlanAt=Math.min(lastPlanAt,clock-5);}
      else{
        const desired=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));
        root.rotation.y+=delta*Math.min(1,dt*2.7);
        const speed=(mode==='flee'?2.7:mode==='approach'?1.15:1.05)*(1-clamp(Math.abs(delta)/Math.PI,0,.48));
        root.position.x+=Math.sin(root.rotation.y)*speed*dt;root.position.z+=Math.cos(root.rotation.y)*speed*dt;
        const bounded=beach.constrain?.(root.position)||root.position;
        root.position.x=clamp(bounded.x,bounds.minX,bounds.maxX);root.position.z=clamp(bounded.z,bounds.minZ,bounds.maxZ);
      }
    }else if(distance<6&&playerPosition){
      const dx=playerPosition.x-root.position.x,dz=playerPosition.z-root.position.z;
      if(Math.hypot(dx,dz)>.1){const desired=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));root.rotation.y+=delta*Math.min(1,dt*2.5);}
    }
    const floor=groundAt(root.position.x,root.position.z);root.position.y+=(floor-root.position.y)*Math.min(1,dt*12);
    const walking=!!target;moveBlend+=( (walking?1:0)-moveBlend)*(1-Math.exp(-dt*7));
    if(walking)fadeTo(walkAction,.28);else fadeTo(idleAction,.45);
    pose(clock,walking);root.visible=true;
  }
  loader.load(MODEL_PATH,gltf=>{
    try{
      model=SkeletonUtils.clone(gltf.scene);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
      root.add(model);model.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(model,true),h=box.max.y-box.min.y;
      if(!Number.isFinite(h)||h<.001)throw new Error('El modelo de Daniel no tiene una altura válida.');
      model.scale.multiplyScalar(HEIGHT/h);model.updateMatrixWorld(true);box.setFromObject(model,true);model.position.y-=box.min.y;
      const center=box.getCenter(new THREE.Vector3());model.position.x-=center.x;model.position.z-=center.z;model.updateMatrixWorld(true);
      model.traverse(o=>{if(!o.isBone)return;const n=o.name.toLowerCase();if(/spine/.test(n)&&!bones.spine)bones.spine=o;if(/head/.test(n)&&!bones.head)bones.head=o;if(/left.*(thigh|upleg|leg)$/.test(n)||/thigh.*left/.test(n))bones.leftLeg=o;if(/right.*(thigh|upleg|leg)$/.test(n)||/thigh.*right/.test(n))bones.rightLeg=o;if(/left.*upper.?arm/.test(n))bones.leftArm=o;if(/right.*upper.?arm/.test(n))bones.rightArm=o;rest.set(o,o.rotation.clone());});
      mixer=new THREE.AnimationMixer(model);const clips=[...(gltf.animations||[])];
      try{const edits=JSON.parse(localStorage.getItem('survivalPlaya.animationEdits.v1')||'{}');for(const edit of Object.values(edits))if(edit?.clip?.tracks?.length){try{clips.push(THREE.AnimationClip.parse(edit.clip));}catch(e){console.warn('[Daniel] Animación manual inválida:',e);}}}catch{}
      const actions=clips.map(c=>({name:c.name.toLowerCase(),action:mixer.clipAction(c)}));
      walkAction=actions.find(a=>/(walk|caminar|andar|walking)/.test(a.name))?.action||null;idleAction=actions.find(a=>/(idle|quieto|standing|stand)/.test(a.name))?.action||null;
      root.position.set(home.x,groundAt(home.x,home.z),home.z);root.rotation.y=rand(0,Math.PI*2);ready=true;root.visible=true;
      status('Cerebro apagado · Daniel espera la IA');
      console.info('[Daniel] Modelo cargado. No camina hasta que el modelo de IA decida una acción.',{walk:!!walkAction,idle:!!idleAction,clips:clips.map(c=>c.name)});
    }catch(e){failed=true;console.error('[Daniel] No se pudo preparar el personaje:',e);options.onError?.(e);}
  },undefined,error=>{failed=true;console.error('[Daniel] No se pudo cargar el modelo:',error);options.onError?.(error);});
  return {root,update,get ready(){return ready;},get failed(){return failed;},get aiReady(){return !!engine;},dispose(){scene.remove(root);ui.panel.remove();}};
}
