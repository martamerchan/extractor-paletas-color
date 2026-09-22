/*
 * ============================================================
 *  Muestrario · Interfaz
 * ============================================================
 *  Carga las imágenes, lanza k-means (js/kmeans.js), y pinta la
 *  paleta, el moodboard y las combinaciones con contraste.
 *  Todo ocurre en el navegador.
 * ============================================================
 */
(function () {
  'use strict';

  const C = window.Color;
  const K = window.KMeans;
  const E = window.Exportar;
  const $ = (id) => document.getElementById(id);

  const MAX_IMAGENES = 12;
  // Píxeles que aporta cada imagen y tamaño al que se reduce, según la precisión
  const CALIDAD = { rapida: [4000, 100], normal: [12000, 200], alta: [30000, 320] };

  const estado = { imagenes: [], paleta: [], combinaciones: [] };

  // ============================================================
  //  Carga de imágenes
  // ============================================================

  function cargarImagen(src, nombre) {
    return new Promise((resolver) => {
      const img = new Image();
      img.onload = () => resolver({ img, nombre, src });
      img.onerror = () => { avisar(`No se ha podido abrir «${nombre}».`); resolver(null); };
      img.src = src;
    });
  }

  async function anadirArchivos(lista) {
    const archivos = Array.from(lista).filter((a) => a.type.startsWith('image/'));
    if (!archivos.length) return avisar('Elige archivos de imagen (JPG, PNG o WebP).');
    const hueco = MAX_IMAGENES - estado.imagenes.length;
    if (archivos.length > hueco) avisar(`Se admiten hasta ${MAX_IMAGENES} imágenes a la vez.`);
    // URL temporal en memoria: la imagen no sale del navegador
    const nuevas = await Promise.all(archivos.slice(0, hueco).map((a) => cargarImagen(URL.createObjectURL(a), a.name)));
    estado.imagenes.push(...nuevas.filter(Boolean));
    analizar();
  }

  $('archivos').addEventListener('change', (e) => { anadirArchivos(e.target.files); e.target.value = ''; });

  const zona = $('zonaSoltar');
  ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('activa'); }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('activa'); }));
  zona.addEventListener('drop', (e) => anadirArchivos(e.dataTransfer.files));

  $('botonEjemplo').addEventListener('click', async () => {
    estado.imagenes.forEach((i) => i.src.startsWith('blob:') && URL.revokeObjectURL(i.src));
    const nombres = ['ejemplo-1.jpg', 'ejemplo-2.jpg', 'ejemplo-3.jpg'];
    estado.imagenes = (await Promise.all(nombres.map((n) => cargarImagen(n, n)))).filter(Boolean);
    $('tituloMb').value = 'Moodboard de ejemplo';
    analizar();
  });

  function quitarImagen(i) {
    const [q] = estado.imagenes.splice(i, 1);
    if (q && q.src.startsWith('blob:')) URL.revokeObjectURL(q.src);
    analizar();
  }

  // ============================================================
  //  Análisis
  // ============================================================

  function analizar() {
    pintarMiniaturas();
    if (!estado.imagenes.length) {
      $('resultados').hidden = true;
      pintarLogo([]);
      return;
    }
    const k = Number($('k').value);
    const [porImagen, lado] = CALIDAD[$('calidad').value];
    const t0 = performance.now();
    let muestra;
    try {
      muestra = K.muestrear(estado.imagenes.map((i) => i.img), porImagen, lado);
    } catch (e) {
      // Ocurre con las imágenes de ejemplo si se abre index.html sin servidor
      return avisar('El navegador no permite leer estas imágenes al abrir el archivo desde tu ordenador. Usa tus propias imágenes o la versión publicada.');
    }
    estado.paleta = K.agrupar(muestra, k);
    const ms = Math.round(performance.now() - t0);
    $('infoPaleta').textContent = `${estado.paleta.length} colores · ${muestra.n.toLocaleString('es-ES')} píxeles analizados de ${estado.imagenes.length} ${estado.imagenes.length === 1 ? 'imagen' : 'imágenes'} · ${ms} ms`;
    calcularCombinaciones();
    $('resultados').hidden = false;
    pintarPaleta();
    pintarMoodboard();
    pintarCombinaciones();
    pintarLogo(estado.paleta);
  }

  // Todas las parejas texto/fondo con su contraste, de mayor a menor
  function calcularCombinaciones() {
    const p = estado.paleta;
    const lista = [];
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < p.length; j++) {
        if (i === j) continue;
        const ratio = C.contraste(p[i].rgb, p[j].rgb);
        const nivel = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'Solo títulos' : 'No cumple';
        lista.push({ texto: p[i], fondo: p[j], ratio, nivel, i, j });
      }
    }
    estado.combinaciones = lista.sort((a, b) => b.ratio - a.ratio);
  }

  // ============================================================
  //  Pintado
  // ============================================================

  function pintarMiniaturas() {
    $('miniaturas').innerHTML = '';
    estado.imagenes.forEach((im, i) => {
      const li = document.createElement('li');
      li.className = 'miniatura';
      li.innerHTML = `<img src="${im.src}" alt="${im.nombre.replace(/"/g, '')}"><button type="button" aria-label="Quitar ${im.nombre.replace(/"/g, '')}" title="Quitar">×</button>`;
      li.querySelector('button').addEventListener('click', () => quitarImagen(i));
      $('miniaturas').appendChild(li);
    });
  }

  const pct = (p) => `${(p * 100).toFixed(1).replace('.', ',')} %`;

  function pintarPaleta() {
    // Barra con la proporción de cada color
    $('proporcion').innerHTML = estado.paleta.map((c) => `<i style="flex:${c.proporcion};background:${C.rgbAHex(c.rgb)}"></i>`).join('');

    $('paleta').innerHTML = '';
    estado.paleta.forEach((c, i) => {
      const hex = C.rgbAHex(c.rgb).toUpperCase();
      const rgb = `rgb(${c.rgb.join(', ')})`;
      const [h, s, l] = C.rgbAHsl(c.rgb);
      const hsl = `hsl(${h}, ${s}%, ${l}%)`;
      const li = document.createElement('li');
      li.className = 'color';
      li.innerHTML = `
        <div class="color__muestra" style="background:${hex};color:${C.textoSobre(c.rgb)}">
          <span class="color__num">${i + 1}</span>
          <span class="color__pct">${pct(c.proporcion)}</span>
        </div>
        <dl class="color__codigos">
          ${[['HEX', hex], ['RGB', rgb], ['HSL', hsl]].map(([k, v]) => `
            <div>
              <dt>${k}</dt>
              <dd><code>${v}</code><button type="button" class="copiar" data-valor="${v}" aria-label="Copiar ${k} ${v}">Copiar</button></dd>
            </div>`).join('')}
        </dl>`;
      $('paleta').appendChild(li);
    });
    $('paleta').querySelectorAll('.copiar').forEach((b) => b.addEventListener('click', () => copiar(b)));
  }

  function pintarMoodboard() {
    $('mbTitulo').textContent = $('tituloMb').value || 'Moodboard';
    const imgs = estado.imagenes.slice(0, 5);
    const col = $('mbCollage');
    col.dataset.n = imgs.length;
    col.innerHTML = imgs.map((im) => `<img src="${im.src}" alt="">`).join('');
    $('mbFranja').innerHTML = estado.paleta.map((c) => {
      const hex = C.rgbAHex(c.rgb);
      return `<span style="background:${hex};color:${C.textoSobre(c.rgb)}">${hex.toUpperCase()}</span>`;
    }).join('');
  }

  function pintarCombinaciones() {
    const todas = $('verTodas').checked;
    const lista = estado.combinaciones.filter((c) => todas || c.ratio >= 3);
    const ul = $('combinaciones');
    if (!lista.length) {
      ul.innerHTML = '<li class="vacio">Ninguna pareja de esta paleta llega a 3:1. Para el texto, combina estos colores con blanco o negro.</li>';
      return;
    }
    ul.innerHTML = lista.map((c) => {
      const t = C.rgbAHex(c.texto.rgb), f = C.rgbAHex(c.fondo.rgb);
      const clase = c.nivel === 'No cumple' ? 'no' : c.nivel === 'Solo títulos' ? 'titulos' : 'si';
      return `<li class="combi">
        <div class="combi__muestra" style="background:${f};color:${t}">
          <span class="combi__grande">Aa</span>
          <span class="combi__texto">Texto de ejemplo</span>
        </div>
        <div class="combi__datos">
          <span class="combi__ratio">${c.ratio.toFixed(2).replace('.', ',')}:1</span>
          <span class="nivel nivel--${clase}">${c.nivel}</span>
          <span class="combi__cod">Texto ${c.i + 1} ${t.toUpperCase()} sobre fondo ${c.j + 1} ${f.toUpperCase()}</span>
        </div>
      </li>`;
    }).join('');
  }

  /** Las muestras del logotipo toman los colores de la paleta. */
  function pintarLogo(paleta) {
    const base = ['#c8553d', '#f2d0a4', '#588b8b', '#284b63', '#1d1d1b'];
    $('muestrasLogo').querySelectorAll('i').forEach((el, i) => {
      el.style.background = paleta[i] ? C.rgbAHex(paleta[i].rgb) : base[i];
    });
  }

  // ============================================================
  //  Copiar y exportar
  // ============================================================

  async function copiar(boton) {
    const v = boton.dataset.valor;
    try {
      await navigator.clipboard.writeText(v);
      boton.textContent = '¡Copiado!';
    } catch (e) {
      boton.textContent = 'No se pudo copiar';
    }
    setTimeout(() => { boton.textContent = 'Copiar'; }, 1400);
  }

  $('expPng').addEventListener('click', () => E.descargarCanvas(E.paletaPng(estado.paleta), 'paleta.png'));
  $('expCss').addEventListener('click', () => E.descargar(E.css(estado.paleta), 'paleta.css', 'text/css'));
  $('expJson').addEventListener('click', () => E.descargar(E.json(estado.paleta, estado.combinaciones.filter((c) => c.ratio >= 3)), 'paleta.json', 'application/json'));
  $('expMoodboard').addEventListener('click', () => {
    try {
      E.descargarCanvas(E.moodboardPng(estado.imagenes.map((i) => i.img), estado.paleta, $('tituloMb').value), 'moodboard.png');
    } catch (e) {
      avisar('No se ha podido generar el moodboard.');
    }
  });

  // ============================================================
  //  Otros controles
  // ============================================================

  let espera;
  $('k').addEventListener('input', (e) => {
    $('valorK').textContent = e.target.value;
    clearTimeout(espera);
    espera = setTimeout(analizar, 150);
  });
  $('calidad').addEventListener('change', analizar);
  $('verTodas').addEventListener('change', pintarCombinaciones);
  $('tituloMb').addEventListener('input', () => { $('mbTitulo').textContent = $('tituloMb').value || 'Moodboard'; });

  let temporizador;
  function avisar(t) {
    const a = $('aviso');
    a.textContent = t;
    a.hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { a.hidden = true; }, 5000);
  }

  pintarLogo([]);
})();
