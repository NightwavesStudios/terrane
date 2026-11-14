/* Orthographic dot-globe. Geometry comes from a 180×90 Natural Earth land bitmask. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const M = window.LAND;
  if (!M) return;
  const bin = atob(M.data);

  function isLand(c, r) {
    const i = r * M.w + c;
    return (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  }

  function proj(lat, lon, centerLon, R) {
    const dLon = (lon - centerLon) * Math.PI / 180;
    const latR = lat * Math.PI / 180;
    const z = Math.cos(latR) * Math.cos(dLon);
    if (z < 0.10) return null;
    return { x: R + Math.cos(latR) * Math.sin(dLon) * R, y: R - Math.sin(latR) * R, z };
  }

  function buildGlobe(el) {
    const size = +el.dataset.size;
    const center = +(el.dataset.center || 0);
    const step = +(el.dataset.step || 1);
    const R = size / 2;
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    let svg = el.querySelector('svg.globe-svg');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'globe-svg');
      svg.style.position = 'absolute';
      svg.style.inset = '0';
      svg.style.zIndex = '2';
      svg.style.overflow = 'visible';
      el.prepend(svg);
    }
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);

    const base = size * 0.0042;
    let dots = '';
    for (let r = 0; r < M.h; r += step) {
      for (let c = 0; c < M.w; c += step) {
        if (!isLand(c, r)) continue;
        const lon = -180 + (c + step / 2) * (360 / M.w);
        const lat = 90 - (r + step / 2) * (180 / M.h);
        if (Math.abs(lat) > 70) continue;
        const p = proj(lat, lon, center, R);
        if (!p) continue;
        const rr = (base * (0.40 + 0.64 * Math.pow(p.z, 0.65))).toFixed(2);
        dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rr}"/>`;
      }
    }
    svg.innerHTML = `<g fill="currentColor">${dots}</g>`;

    /* great-circle-ish arcs between place pairs */
    if (el.dataset.arcs) {
      try {
        const g = document.createElementNS(NS, 'g');
        JSON.parse(el.dataset.arcs).forEach((q, idx) => {
          const p1 = proj(q[0], q[1], center, R);
          const p2 = proj(q[2], q[3], center, R);
          if (!p1 || !p2) return;
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
          const dx = mx - R, dy = my - R, len = Math.hypot(dx, dy) || 1;
          const cx = mx + (dx / len) * R * 0.46;
          const cy = my + (dy / len) * R * 0.46;
          const d = `M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`;
          const col = idx % 2 ? '#8E9BFF' : '#7CE0C0';
          [[3.6, 0.09], [1.15, 0.8]].forEach(([w, o]) => {
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', col);
            path.setAttribute('stroke-width', w);
            path.setAttribute('stroke-opacity', o);
            path.setAttribute('stroke-linecap', 'round');
            g.appendChild(path);
          });
          [p1, p2].forEach(p => {
            const dot = document.createElementNS(NS, 'circle');
            dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', 2.2);
            dot.setAttribute('fill', col); dot.setAttribute('opacity', '0.9');
            g.appendChild(dot);
          });
        });
        svg.appendChild(g);
      } catch (e) { /* malformed data — skip arcs */ }
    }

    el.querySelectorAll('.pin').forEach(pin => {
      const p = proj(+pin.dataset.lat, +pin.dataset.lon, center, R);
      if (!p) { pin.style.display = 'none'; return; }
      pin.style.left = p.x + 'px';
      pin.style.top = p.y + 'px';
      pin.style.opacity = (0.45 + 0.55 * p.z).toFixed(2);
    });
  }

  document.querySelectorAll('.globe').forEach(buildGlobe);
})();
