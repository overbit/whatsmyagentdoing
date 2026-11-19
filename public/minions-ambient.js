// Tiny deterministic background-actor simulation shared by the 2D/3D lab.
// These characters are scenery, NOT agent sessions. No timers, networking,
// persistence or shared Office.people / POI reservations.
(() => {
  'use strict';

  function create(scene, grid) {
    if (scene?.id !== 'minions') return [];
    const activities = new Map((scene.ambientActivities || []).map((p) => [p.id, p]));
    return (scene.ambientMinions || []).map((cfg, i) => {
      const route = (cfg.route || []).map((id) => activities.get(id))
        .filter((p) => p && !grid.blocked(p.x, p.y));
      if (!route.length || grid.blocked(cfg.x, cfg.y)) return null;
      return {
        key: `ambient:${cfg.id || i}`, ambient: true,
        h: cfg.h ?? (i + 31) * 17, phase: i * 1.7,
        x: cfg.x, y: cfg.y, s: { status: 'idle' },
        mode: 'wander', walkFace: 'front', path: [],
        route, routeIndex: 0, poi: null, target: null,
        act: null, actionProgress: 0, actionElapsed: 0,
        actionDuration: 0, wait: 0.35 + i * 0.4,
      };
    }).filter(Boolean);
  }

  function startActivity(npc) {
    npc.act = npc.target.act;
    npc.poi = npc.target;
    npc.actionElapsed = 0;
    npc.actionDuration = npc.target.hold || 4;
    npc.actionProgress = 0;
  }

  function tick(actors, grid, elapsed) {
    const dt = Math.max(0, Math.min(Number.isFinite(elapsed) ? elapsed : 0, 0.1));
    for (const npc of actors || []) {
      if (npc.path.length) {
        // Follow the map's A* waypoints instead of walking through props.
        let distance = dt * 1.45;
        while (npc.path.length && distance > 0) {
          const next = npc.path[0];
          const dx = next.x - npc.x, dy = next.y - npc.y;
          const step = Math.hypot(dx, dy);
          if (step <= distance) {
            npc.x = next.x;
            npc.y = next.y;
            npc.path.shift();
            distance -= step;
          } else {
            npc.x += dx / step * distance;
            npc.y += dy / step * distance;
            distance = 0;
          }
          if (Math.abs(dx) + Math.abs(dy) > 0.0001)
            npc.walkFace = dx + dy >= 0 ? 'front' : 'back';
        }
        if (!npc.path.length && npc.target) startActivity(npc);
        continue;
      }
      if (npc.act) {
        npc.actionElapsed += dt;
        npc.actionProgress = Math.min(1, npc.actionElapsed / npc.actionDuration);
        if (npc.actionElapsed >= npc.actionDuration) {
          npc.act = null;
          npc.poi = null;
          npc.target = null;
          npc.actionProgress = 0;
          npc.wait = 0.35 + (npc.h % 5) * 0.17;
        }
        continue;
      }
      npc.wait -= dt;
      if (npc.wait > 0 || !npc.route.length) continue;
      const point = npc.route[npc.routeIndex++ % npc.route.length];
      const route = grid.path(npc.x, npc.y, point.x, point.y);
      // Grid.path always produces an endpoint, even for blocked targets.
      // Reject bad destinations and any route that would cross solid cells.
      if (grid.blocked(point.x, point.y) || route.some((p) => grid.blocked(p.x, p.y))) {
        npc.wait = 1.5;
        continue;
      }
      npc.target = point;
      npc.poi = null;
      npc.path = route;
      npc.wait = 0;
    }
  }

  window.MinionsAmbient = { create, tick };
})();
