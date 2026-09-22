/*
 * ============================================================
 *  Muestrario · Exportación
 * ============================================================
 *  Genera los archivos que se descargan: la paleta en PNG, el
 *  moodboard en PNG, las variables CSS y el JSON.
 * ============================================================
 */
window.Exportar = (function () {
  'use strict';

  const C = window.Color;
  const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const pct = (p) => `${(p * 100).toFixed(1).replace('.', ',')} %`;

  function descargar(contenido, nombre, tipo) {
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function descargarCanvas(canvas, nombre) {
    canvas.toBlob((b) => descargar(b, nombre), 'image/png');
  }

  /** Paleta en PNG: una franja por color con sus códigos. */
  function paletaPng(paleta) {
    const W = 1600, H = 900, pie = 260;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const ancho = W / paleta.length;
    paleta.forEach((col, i) => {
      const x = i * ancho;
      ctx.fillStyle = C.rgbAHex(col.rgb);
      ctx.fillRect(x, 0, Math.ceil(ancho), H - pie);
      // Códigos debajo de cada franja
      ctx.fillStyle = '#111111';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const t = Math.min(34, ancho / 6);
      ctx.font = `700 ${t}px ${FUENTE}`;
      ctx.fillText(C.rgbAHex(col.rgb).toUpperCase(), x + 20, H - pie + 30);
      ctx.font = `400 ${t * 0.62}px ${FUENTE}`;
      ctx.fillStyle = '#444444';
      const hsl = C.rgbAHsl(col.rgb);
      ctx.fillText(`RGB ${col.rgb.join(', ')}`, x + 20, H - pie + 30 + t * 1.5);
      ctx.fillText(`HSL ${hsl[0]}, ${hsl[1]} %, ${hsl[2]} %`, x + 20, H - pie + 30 + t * 2.4);
      ctx.fillText(pct(col.proporcion), x + 20, H - pie + 30 + t * 3.3);
    });
    return c;
  }

  /** Dibuja una imagen recortada para cubrir un rectángulo. */
  function cubrir(ctx, img, x, y, w, h) {
    const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    ctx.restore();
  }

  /** Moodboard en PNG: collage de imágenes y franja de paleta. */
  function moodboardPng(imagenes, paleta, titulo) {
    const W = 1600, H = 1200, m = 40, hueco = 16, franja = 200;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f6f4ef';
    ctx.fillRect(0, 0, W, H);

    // Título
    ctx.fillStyle = '#111111';
    ctx.font = `800 44px ${FUENTE}`;
    ctx.textBaseline = 'top';
    ctx.fillText(titulo || 'Moodboard', m, m);
    const top = m + 80;
    const altoCollage = H - top - franja - m - hueco;

    // Collage: 1 imagen grande a la izquierda y el resto en rejilla a la derecha
    const imgs = imagenes.slice(0, 5);
    if (imgs.length === 1) {
      cubrir(ctx, imgs[0], m, top, W - m * 2, altoCollage);
    } else if (imgs.length) {
      const anchoGrande = (W - m * 2 - hueco) * 0.55;
      cubrir(ctx, imgs[0], m, top, anchoGrande, altoCollage);
      const resto = imgs.slice(1);
      const xR = m + anchoGrande + hueco, wR = W - m - xR;
      const cols = resto.length > 2 ? 2 : 1;
      const filas = Math.ceil(resto.length / cols);
      const wc = (wR - hueco * (cols - 1)) / cols, hc = (altoCollage - hueco * (filas - 1)) / filas;
      resto.forEach((img, i) => {
        const col = i % cols, fila = Math.floor(i / cols);
        // Si la última fila tiene una sola imagen, ocupa todo el ancho
        const sola = i === resto.length - 1 && resto.length % cols === 1 && cols > 1;
        cubrir(ctx, img, xR + col * (wc + hueco), top + fila * (hc + hueco), sola ? wR : wc, hc);
      });
    }

    // Franja de paleta con códigos HEX
    const yF = H - m - franja;
    const anchoC = (W - m * 2) / paleta.length;
    paleta.forEach((col, i) => {
      const hex = C.rgbAHex(col.rgb);
      ctx.fillStyle = hex;
      ctx.fillRect(m + i * anchoC, yF, Math.ceil(anchoC), franja);
      ctx.fillStyle = C.textoSobre(col.rgb);
      ctx.font = `700 ${Math.min(26, anchoC / 7)}px ${FUENTE}`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(hex.toUpperCase(), m + i * anchoC + 16, yF + franja - 16);
    });
    return c;
  }

  /** Variables CSS con los colores de la paleta. */
  function css(paleta) {
    const lineas = paleta.map((col, i) => {
      const hsl = C.rgbAHsl(col.rgb);
      return `  --color-${i + 1}: ${C.rgbAHex(col.rgb)}; /* rgb(${col.rgb.join(', ')}) · hsl(${hsl[0]} ${hsl[1]}% ${hsl[2]}%) · ${pct(col.proporcion)} */`;
    });
    return `/* Paleta generada con Muestrario (ordenada de más a menos presente) */\n:root {\n${lineas.join('\n')}\n}\n`;
  }

  /** Paleta y combinaciones con contraste en JSON. */
  function json(paleta, combinaciones) {
    return JSON.stringify({
      generador: 'Muestrario',
      fecha: new Date().toISOString().slice(0, 10),
      colores: paleta.map((col, i) => ({
        nombre: `color-${i + 1}`,
        hex: C.rgbAHex(col.rgb),
        rgb: col.rgb,
        hsl: C.rgbAHsl(col.rgb),
        proporcion: +col.proporcion.toFixed(4)
      })),
      combinacionesTexto: combinaciones.map((cb) => ({
        texto: C.rgbAHex(cb.texto.rgb),
        fondo: C.rgbAHex(cb.fondo.rgb),
        contraste: +cb.ratio.toFixed(2),
        nivel: cb.nivel
      }))
    }, null, 2);
  }

  return { descargar, descargarCanvas, paletaPng, moodboardPng, css, json };
})();
