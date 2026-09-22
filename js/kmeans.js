/*
 * ============================================================
 *  Muestrario · Algoritmo k-means
 * ============================================================
 *  Agrupa los píxeles de las imágenes en k grupos de colores
 *  parecidos. El color medio de cada grupo es un color de la paleta
 *  y el tamaño del grupo indica cuánto aparece en las imágenes.
 *
 *  Pasos:
 *   1. Muestreo: se reduce cada imagen (máx. 200 px de lado) y se
 *      toman sus píxeles, descartando los transparentes.
 *   2. Conversión a CIELAB, donde la distancia entre colores se
 *      parece a la diferencia que percibe el ojo.
 *   3. Inicio k-means++: el primer centro se elige al azar y cada
 *      centro siguiente, con más probabilidad cuanto más lejos esté
 *      de los ya elegidos. Así los grupos empiezan bien repartidos.
 *   4. Iteraciones: se asigna cada píxel al centro más cercano y se
 *      recalcula cada centro como la media de sus píxeles. Se repite
 *      hasta que los centros casi no se mueven (o 40 veces).
 *
 *  Se usa un generador de números aleatorios con semilla fija para
 *  que la misma imagen dé siempre la misma paleta.
 * ============================================================
 */
window.KMeans = (function () {
  'use strict';

  const C = window.Color;

  /** Generador pseudoaleatorio con semilla (mulberry32). */
  function aleatorio(semilla) {
    let a = semilla >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Extrae los píxeles de varias imágenes.
   * Cada imagen aporta como máximo "porImagen" píxeles, para que una
   * imagen grande no domine la paleta.
   * Devuelve { lab: Float32Array (L,a,b...), rgb: Uint8Array (r,g,b...), n }.
   */
  function muestrear(imagenes, porImagen, lado) {
    const rgbs = [];
    imagenes.forEach((img) => {
      const esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * esc));
      const h = Math.max(1, Math.round(img.naturalHeight * esc));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      const total = w * h;
      const paso = Math.max(1, Math.floor(total / porImagen));
      for (let i = 0; i < total; i += paso) {
        const k = i * 4;
        if (d[k + 3] < 128) continue; // píxel transparente
        rgbs.push(d[k], d[k + 1], d[k + 2]);
      }
    });
    const n = rgbs.length / 3;
    const rgb = Uint8Array.from(rgbs);
    const lab = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [L, A, B] = C.rgbALab(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
      lab[i * 3] = L; lab[i * 3 + 1] = A; lab[i * 3 + 2] = B;
    }
    return { lab, rgb, n };
  }

  /** Distancia al cuadrado entre el punto i y un centro (en CIELAB). */
  function dist2(lab, i, c) {
    const dL = lab[i * 3] - c[0], dA = lab[i * 3 + 1] - c[1], dB = lab[i * 3 + 2] - c[2];
    return dL * dL + dA * dA + dB * dB;
  }

  /** Inicio k-means++. */
  function iniciar(lab, n, k, azar) {
    const centros = [];
    const primero = Math.floor(azar() * n);
    centros.push([lab[primero * 3], lab[primero * 3 + 1], lab[primero * 3 + 2]]);
    const d = new Float64Array(n).fill(Infinity);
    while (centros.length < k) {
      const ult = centros[centros.length - 1];
      let suma = 0;
      for (let i = 0; i < n; i++) {
        d[i] = Math.min(d[i], dist2(lab, i, ult));
        suma += d[i];
      }
      if (suma === 0) break; // no hay más colores distintos
      let r = azar() * suma;
      let elegido = n - 1;
      for (let i = 0; i < n; i++) { r -= d[i]; if (r <= 0) { elegido = i; break; } }
      centros.push([lab[elegido * 3], lab[elegido * 3 + 1], lab[elegido * 3 + 2]]);
    }
    return centros;
  }

  /**
   * Ejecuta k-means y devuelve la paleta ordenada de mayor a menor presencia:
   * [{ rgb: [r,g,b], proporcion: 0–1, lab: [L,a,b] }, …]
   */
  function agrupar(muestra, k, opciones) {
    const { lab, rgb, n } = muestra;
    if (!n) return [];
    const azar = aleatorio((opciones && opciones.semilla) || 2026);
    const maxIter = (opciones && opciones.iteraciones) || 40;
    let centros = iniciar(lab, n, Math.min(k, n), azar);
    const kk = centros.length;
    const asignado = new Int32Array(n);

    for (let iter = 0; iter < maxIter; iter++) {
      // 1) Asignar cada píxel al centro más cercano
      for (let i = 0; i < n; i++) {
        let mejor = 0, dmin = Infinity;
        for (let c = 0; c < kk; c++) {
          const dd = dist2(lab, i, centros[c]);
          if (dd < dmin) { dmin = dd; mejor = c; }
        }
        asignado[i] = mejor;
      }
      // 2) Recalcular cada centro como la media de sus píxeles
      const sumas = Array.from({ length: kk }, () => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) {
        const s = sumas[asignado[i]];
        s[0] += lab[i * 3]; s[1] += lab[i * 3 + 1]; s[2] += lab[i * 3 + 2]; s[3]++;
      }
      let movimiento = 0;
      const nuevos = sumas.map((s, c) => {
        if (!s[3]) return centros[c]; // grupo vacío: se queda donde estaba
        const nc = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
        movimiento = Math.max(movimiento, Math.hypot(nc[0] - centros[c][0], nc[1] - centros[c][1], nc[2] - centros[c][2]));
        return nc;
      });
      centros = nuevos;
      if (movimiento < 0.5) break; // ya no cambia de forma apreciable
    }

    // Color final de cada grupo: media de sus píxeles en RGB (así nunca sale de gama)
    const acum = Array.from({ length: kk }, () => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const a = acum[asignado[i]];
      a[0] += rgb[i * 3]; a[1] += rgb[i * 3 + 1]; a[2] += rgb[i * 3 + 2]; a[3]++;
    }
    return acum
      .map((a, c) => ({ rgb: a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]].map(Math.round) : [0, 0, 0], proporcion: a[3] / n, lab: centros[c] }))
      .filter((g) => g.proporcion > 0)
      .sort((x, y) => y.proporcion - x.proporcion);
  }

  return { muestrear, agrupar, aleatorio };
})();
