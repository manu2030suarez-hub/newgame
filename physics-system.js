// Survival Playa V24 — capa física Rapier 3D.
// Los cuerpos visuales siguen en Three.js; Rapier resuelve contactos y desplazamientos.
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/+esm';

export async function createPhysicsSystem(THREE, player, beach) {
  await RAPIER.init();
  const world = new RAPIER.World({x:0,y:-9.81,z:0});
  world.timestep = 1/60;
  const controller = world.createCharacterController(0.035);
  controller.setSlideEnabled(true);
  controller.setMaxSlopeClimbAngle( Math.PI * 0.27 );
  controller.setMinSlopeSlideAngle( Math.PI * 0.36 );
  controller.enableAutostep(0.32, 0.18, true);
  controller.setApplyImpulsesToDynamicBodies(true);
  const playerBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(player.position.x, player.position.y+0.9, player.position.z));
  const playerCollider = world.createCollider(RAPIER.ColliderDesc.capsule(0.57,0.29).setFriction(0.0).setRestitution(0),playerBody);
  const fixed = new Map(), moving = new Map();
  const qFromYaw = yaw => ({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)});

  function addFixedBox(id, position, halfExtents, yaw=0) {
    if(fixed.has(id)) return fixed.get(id);
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x,position.y,position.z).setRotation(qFromYaw(yaw)));
    const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(halfExtents.x,halfExtents.y,halfExtents.z).setFriction(.8),body);
    const rec={body,collider}; fixed.set(id,rec); return rec;
  }
  function addKinematicCapsule(id, position, radius=.42, halfHeight=.48) {
    let rec=moving.get(id);
    if(!rec){const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x,position.y+halfHeight+radius,position.z));const collider=world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight,radius).setFriction(.7),body);rec={body,collider};moving.set(id,rec);}
    else rec.body.setNextKinematicTranslation({x:position.x,y:position.y+halfHeight+radius,z:position.z});
    return rec;
  }
  function syncKinematicBox(id, position, halfExtents, yaw=0) {
    let rec=moving.get(id);
    if(!rec){const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x,position.y,position.z).setRotation(qFromYaw(yaw)));const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(halfExtents.x,halfExtents.y,halfExtents.z).setFriction(.85),body);rec={body,collider};moving.set(id,rec);}
    else {rec.body.setNextKinematicTranslation({x:position.x,y:position.y,z:position.z});rec.body.setNextKinematicRotation(qFromYaw(yaw));}
    return rec;
  }
  function remove(id){const r=fixed.get(id)||moving.get(id);if(!r)return;world.removeRigidBody(r.body);fixed.delete(id);moving.delete(id);}

  // Trunks: colliders simples, persistentes y mucho más estables que empujar el personaje a mano.
  for(const p of (beach.harvestPalms||[])) if(!p.felled) addFixedBox('palm-'+p.id,{x:p.x,y:1.55,z:p.z},{x:.24,y:1.55,z:.24});

  function movePlayerTo(origin, target) {
    const current={x:origin.x,y:origin.y+0.9,z:origin.z};
    playerBody.setTranslation(current,true);
    const desired={x:target.x-origin.x,y:0,z:target.z-origin.z};
    controller.computeColliderMovement(playerCollider,desired);
    const corrected=controller.computedMovement();
    const result={x:origin.x+corrected.x,y:target.y,z:origin.z+corrected.z};
    playerBody.setNextKinematicTranslation({x:result.x,y:result.y+0.9,z:result.z});
    world.step();
    return result;
  }
  // V28: rayo contra cuerpos fijos (palmeras, construcciones, barco, caja). Ignora al jugador y a los animales cinemáticos.
  const _flags = RAPIER.QueryFilterFlags ? RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC : undefined;
  function castRay(o, d, maxT) {
    try {
      const len = Math.hypot(d.x, d.y, d.z) || 1;
      const ray = new RAPIER.Ray({x:o.x,y:o.y,z:o.z}, {x:d.x/len,y:d.y/len,z:d.z/len});
      const hit = world.castRayAndGetNormal(ray, maxT, true, _flags, undefined, playerCollider);
      if (!hit) return null;
      const n = hit.normal;
      return { t: hit.timeOfImpact, nx: n.x, ny: n.y, nz: n.z };
    } catch (e) { return null; }
  }
  function step(){world.step();}
  return {world,controller,castRay,addFixedBox,addKinematicCapsule,syncKinematicBox,remove,movePlayerTo,step,get stats(){return {fixed:fixed.size,moving:moving.size};}};
}
