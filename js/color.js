/*
 * ============================================================
 *  Muestrario · Utilidades de color
 * ============================================================
 *  Conversiones entre espacios de color y cálculo de contraste.
 *   - RGB: el formato de los píxeles (0–255 por canal).
 *   - HEX y HSL: los formatos que se muestran al usuario.
 *   - CIELAB: espacio "perceptual" en el que se agrupan los colores,
 *     porque en él la distancia entre dos colores se parece mucho más
 *     a la diferencia que percibe el ojo humano que en RGB.
 * ============================================================
 */
window.Color = (function () {
  'use strict';

  const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0');

  function rgbAHex([r, g, b]) {
    return '#' + hex2(r) + hex2(g) + hex2(b);
  }

  /** RGB (0–255) → HSL (tono 0–360, saturación y luminosidad 0–100). */
  function rgbAHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }

  // ---------- RGB → CIELAB (iluminante D65) ----------

  /** Paso de sRGB a valor lineal (quita la corrección gamma). */
  function lineal(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  // Tabla precalculada para acelerar la conversión de millones de píxeles
  const LINEAL = new Float32Array(256);
  for (let i = 0; i < 256; i++) LINEAL[i] = lineal(i);

  function f(t) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  }

  /** Convierte un color RGB a CIELAB. Devuelve [L, a, b]. */
  function rgbALab(r, g, b) {
    const R = LINEAL[r], G = LINEAL[g], B = LINEAL[b];
    const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
    const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  // ---------- Contraste WCAG 2.1 ----------

  /** Luminancia relativa según WCAG 2.1. */
  function luminancia([r, g, b]) {
    return 0.2126 * LINEAL[Math.round(r)] + 0.7152 * LINEAL[Math.round(g)] + 0.0722 * LINEAL[Math.round(b)];
  }

  /** Relación de contraste entre dos colores RGB (de 1 a 21). */
  function contraste(c1, c2) {
    const l1 = luminancia(c1), l2 = luminancia(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  /** Color de texto (negro o blanco) que mejor se lee sobre un fondo. */
  function textoSobre(rgb) {
    return contraste(rgb, [0, 0, 0]) >= contraste(rgb, [255, 255, 255]) ? '#000000' : '#ffffff';
  }

  return { rgbAHex, rgbAHsl, rgbALab, luminancia, contraste, textoSobre };
})();
