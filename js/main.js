import * as THREE from "three"; // Importa el núcleo de Three.js (escena, cámara, luces, etc.)
import Stats from "three/addons/libs/stats.module.js"; // Módulo para mostrar FPS/tiempos de render
import { OrbitControls } from "three/addons/controls/OrbitControls.js"; // Control de cámara con mouse
import { FBXLoader } from "three/addons/loaders/FBXLoader.js"; // Cargador de modelos FBX
import { GUI } from "three/addons/libs/lil-gui.module.min.js"; // Pequeño panel GUI para sliders (morphs)

const manager = new THREE.LoadingManager(); // Manager opcional para controlar la carga de recursos

let camera, scene, renderer, stats, object, loader, guiMorphsFolder; // Refs globales de renderizado y GUI
let mixer; // AnimationMixer para reproducir animaciones del FBX

// refs UI
let wrapEl, bodyEl, dropdownEl, ddListEl, sambaItemEl; // Referencias a nodos del menú de la derecha
// botones
let xbotBtnEl, punchBtnEl, bboyBtnEl, sillyBtnEl, jumpingBtnEl, tauntBtnEl; // Botones laterales (aparecen junto a "Samba Dancing")
let sideButtons = []; // Lista de los botones para mostrarlos/ocultarlos y posicionarlos

const clock = new THREE.Clock(); // Reloj para delta time en el loop

// ====== NUEVO: referencias para atajos visibles ======
let orbitControls;         // para auto-rotate (tecla O)
let gridRef;               // referencia a la grilla (tecla G)
let wireframeOn = false;   // estado del modo wireframe (V)
let slowMoOn = false;      // estado de cámara lenta (L)
let paused = false;        // estado de pausa de animación (P)
let bgDark = false;        // estado del fondo (B)
const BG_LIGHT = 0xa0a0a0; // color de fondo claro
const BG_DARK  = 0x070707; // color de fondo oscuro

// Asset inicial
const params = { asset: "Samba Dancing" }; // Nombre del modelo que se carga al iniciar

// Opciones del menú bajo "Controls"
const DROPDOWN_ASSETS = [
  "Samba Dancing",
  "morph_test",
  "monkey",
  "monkey_embedded_texture",
  "vCube",
]; // Lista mostrada en el dropdown para cambiar de asset

const FBX_BASE = "models/fbx/"; // Carpeta base donde residen los FBX

/* -------------------- Init -------------------- */
init(); // Arranca la app

function init() {
  const container = document.createElement("div"); // Crea un contenedor para stats u otros overlays
  document.body.appendChild(container); // Lo inserta al body

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000); // Cámara perspectiva
  camera.position.set(100, 200, 300); // Posición inicial de la cámara

  scene = new THREE.Scene(); // Crea escena
  scene.background = new THREE.Color(BG_LIGHT); // Fondo (claro por defecto)
  scene.fog = new THREE.Fog(BG_LIGHT, 200, 1000); // Niebla para dar profundidad

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5); // Luz hemisférica (cielo/tierra)
  hemiLight.position.set(0, 200, 0); // Posición de la luz
  scene.add(hemiLight); // Añade a la escena

  const dirLight = new THREE.DirectionalLight(0xffffff, 5); // Luz direccional (como sol)
  dirLight.position.set(0, 200, 100); // Posición de la luz
  dirLight.castShadow = true; // Habilita sombras
  scene.add(dirLight); // Añade a la escena

  // ground
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000), // Plano grande (suelo)
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }) // Material gris (no escribe profundidad)
  );
  mesh.rotation.x = -Math.PI / 2; // Plano horizontal
  mesh.receiveShadow = true; // Recibe sombras del modelo
  scene.add(mesh); // Añade a la escena

  // grid (guardar ref para G)
  gridRef = new THREE.GridHelper(2000, 20, 0x000000, 0x000000); // Grilla de referencia
  gridRef.material.opacity = 0.2; // Transparencia
  gridRef.material.transparent = true; // Habilita transparencia
  scene.add(gridRef); // Añade grilla a la escena

  loader = new FBXLoader(manager); // Crea un FBXLoader usando el manager
  loadAsset(params.asset); // Carga el asset inicial

  renderer = new THREE.WebGLRenderer({ antialias: true }); // Crea renderer con antialiasing
  renderer.setPixelRatio(window.devicePixelRatio); // Ajusta al pixel ratio del dispositivo
  renderer.setSize(window.innerWidth, window.innerHeight); // Tamaño inicial del canvas
  renderer.setAnimationLoop(animate); // Loop de render (requestAnimationFrame interno)
  renderer.shadowMap.enabled = true; // Habilita sombras
  document.body.appendChild(renderer.domElement); // Inserta el canvas al body

  orbitControls = new OrbitControls(camera, renderer.domElement); // Controles de órbita con mouse
  orbitControls.target.set(0, 100, 0); // Punto de interés de la cámara
  orbitControls.update(); // Aplica el target inicial
  orbitControls.autoRotate = false; // se activa con la tecla O (por defecto apagado)
  orbitControls.autoRotateSpeed = 1.6; // Velocidad de auto-rotación

  window.addEventListener("resize", onWindowResize); // Maneja cambios de tamaño de ventana

  // stats
  stats = new Stats(); // Crea panel de FPS/tiempos
  container.appendChild(stats.dom); // Inserta el panel de stats

  // lil-gui solo para Morphs (sin panel negro)
  const gui = new GUI({ autoPlace: false }); // Evita autocolocar la GUI (no queremos panel base)
  guiMorphsFolder = gui.addFolder("Morphs").hide(); // Crea carpeta "Morphs" (oculta por defecto)
  document.body.appendChild(gui.domElement); // Inserta solo la GUI (aparecerá al mostrar morphs)

  // Menú derecho
  buildRightMenu(); // Crea el menú de "Controls" (custom)
  bindGlobalMenuHandlers(); // Cierra el menú al hacer click fuera / Escape

  // ===== Atajos visibles =====
  window.addEventListener("keydown", (e) => { // Listener para atajos de teclado
    switch (e.code) {
      case "KeyV": toggleWireframe(); break;  // Wireframe ON/OFF
      case "KeyL": toggleSlowMo();    break;  // Cámara lenta ON/OFF
      case "KeyG":
        if (gridRef) gridRef.visible = !gridRef.visible; // Mostrar/ocultar grilla
        break;
      case "KeyO":
        if (orbitControls) {
          orbitControls.autoRotate = !orbitControls.autoRotate; // Auto-rotar cámara
        }
        break;
      case "KeyP":
        togglePause(); // Pausar/Reanudar animación
        break;
      case "KeyB":
        toggleBackground(); // Cambiar fondo claro/oscuro
        break;
    }
  });

  // Rótulo inferior centrado con indicaciones
  const help = document.createElement("div"); // Crea nodo para el HUD de teclas
  help.id = "help-hotkeys"; // ID para localizar si hace falta
  help.style.cssText = `
    position:fixed;left:50%;bottom:14px;transform:translateX(-50%);
    padding:8px 12px;border-radius:10px;
    background:rgba(0,0,0,.55);color:#fff;font:12px/1.3 system-ui, sans-serif;
    z-index:5;backdrop-filter:blur(2px);
    text-align:center; white-space:nowrap;
  `; // Estilos inline del rótulo
  help.innerHTML = `
    <b>V</b>: Wireframe &nbsp;•&nbsp; 
    <b>L</b>: Cámara lenta &nbsp;•&nbsp; 
    <b>G</b>: Grid ON/OFF &nbsp;•&nbsp;
    <b>O</b>: Auto-rotar &nbsp;•&nbsp;
    <b>P</b>: Pausa &nbsp;•&nbsp;
    <b>B</b>: Fondo claro/oscuro
  `; // Texto con lista de atajos
  document.body.appendChild(help); // Inserta el rótulo en pantalla
}

/* -------------------- Cargar FBX -------------------- */
function loadAsset(assetName) {
  loader.load(FBX_BASE + assetName + ".fbx", (group) => { // Carga el archivo FBX indicado
    if (object) { // Si ya había un objeto cargado, liberar sus recursos
      object.traverse((child) => {
        if (child.isSkinnedMesh) child.skeleton.dispose(); // Libera esqueleto si existe
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]; // Normaliza a array
          mats.forEach((m) => {
            if (m?.map) m.map.dispose(); // Libera texturas
            m?.dispose?.(); // Libera material
          });
        }
        if (child.geometry) child.geometry.dispose(); // Libera geometría
      });
      scene.remove(object); // Quita el objeto anterior de la escena
    }

    object = group; // Guarda el nuevo grupo cargado

    if (object.animations && object.animations.length) { // Si el FBX trae animaciones…
      mixer = new THREE.AnimationMixer(object); // Crea un mixer
      mixer.clipAction(object.animations[0]).play(); // Reproduce la primera animación
      mixer.timeScale = paused ? 0 : (slowMoOn ? 0.35 : 1.0); // Ajusta velocidad según estados (P / L)
    } else {
      mixer = null; // Si no hay animaciones, no hay mixer
    }

    // Morphs
    guiMorphsFolder.children.forEach((c) => c.destroy()); // Limpia sliders anteriores
    guiMorphsFolder.hide(); // Oculta la carpeta si no hay morphs

    object.traverse((child) => { // Recorre el nuevo objeto
      if (child.isMesh) {
        child.castShadow = true; // Proyecta sombra
        child.receiveShadow = true; // Recibe sombra

        if (child.morphTargetDictionary) { // Si el mesh tiene morph targets…
          guiMorphsFolder.show(); // Muestra la carpeta “Morphs”
          const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid); // Subcarpeta por mesh
          Object.keys(child.morphTargetDictionary).forEach((key) => { // Crea un slider por morph
            meshFolder.add(
              child.morphTargetInfluences,
              child.morphTargetDictionary[key],
              0, 1, 0.01
            );
          });
        }
      }
    });

    scene.add(object); // Añade el nuevo asset a la escena
  });
}

/* -------------------- UI: Menú derecho -------------------- */
function buildRightMenu() {
  // wrapper
  wrapEl = document.createElement("div"); // Contenedor del panel “Controls”
  wrapEl.className = "ctrl-wrap"; // Clase para estilos

  const title = document.createElement("div"); // Título clickable
  title.className = "ctrl-title"; // Clase para estilos
  title.textContent = "Controls"; // Texto del título

  bodyEl = document.createElement("div"); // Cuerpo colapsable
  bodyEl.className = "ctrl-body"; // Clase para estilos

  // Botones a la izquierda (ocultos por defecto)
  xbotBtnEl = document.createElement("div"); // Botón “X Bot”
  xbotBtnEl.className = "xbot-btn"; // Clase para estilos/posicionamiento
  xbotBtnEl.textContent = "X Bot"; // Texto del botón
  xbotBtnEl.style.display = "none"; // Invisible salvo con “Samba Dancing”
  xbotBtnEl.addEventListener("click", () => { // Al pulsar, carga el asset
    params.asset = "X Bot";
    loadAsset("X Bot");
  });

  punchBtnEl = document.createElement("div"); // Botón “Punching”
  punchBtnEl.className = "punch-btn";
  punchBtnEl.textContent = "Punching";
  punchBtnEl.style.display = "none";
  punchBtnEl.addEventListener("click", () => {
    params.asset = "Punching";
    loadAsset("Punching");
  });

  // NUEVOS BOTONES (reutilizan estilo 'punch-btn')
  bboyBtnEl = document.createElement("div"); // “Bboy Uprock Start”
  bboyBtnEl.className = "punch-btn";
  bboyBtnEl.textContent = "Bboy Uprock Start";
  bboyBtnEl.style.display = "none";
  bboyBtnEl.addEventListener("click", () => {
    params.asset = "Bboy Uprock Start";
    loadAsset("Bboy Uprock Start");
  });

  sillyBtnEl = document.createElement("div"); // “Silly Dancing”
  sillyBtnEl.className = "punch-btn";
  sillyBtnEl.textContent = "Silly Dancing";
  sillyBtnEl.style.display = "none";
  sillyBtnEl.addEventListener("click", () => {
    params.asset = "Silly Dancing";
    loadAsset("Silly Dancing");
  });

  jumpingBtnEl = document.createElement("div"); // “Jumping Down”
  jumpingBtnEl.className = "punch-btn";
  jumpingBtnEl.textContent = "Jumping Down";
  jumpingBtnEl.style.display = "none";
  jumpingBtnEl.addEventListener("click", () => {
    params.asset = "Jumping Down";
    loadAsset("Jumping Down");
  });

  tauntBtnEl = document.createElement("div"); // “Taunt”
  tauntBtnEl.className = "punch-btn";
  tauntBtnEl.textContent = "Taunt";
  tauntBtnEl.style.display = "none";
  tauntBtnEl.addEventListener("click", () => {
    params.asset = "Taunt";
    loadAsset("Taunt");
  });

  // guardamos referencia en un arreglo para posicionar/mostrar
  sideButtons = [xbotBtnEl, punchBtnEl, bboyBtnEl, sillyBtnEl, jumpingBtnEl, tauntBtnEl]; // Array de botones laterales

  // Lista (dropdown de assets)
  dropdownEl = document.createElement("div"); // Contenedor del dropdown
  dropdownEl.className = "dropdown"; // Clase para estilos

  ddListEl = document.createElement("div"); // Lista de opciones
  ddListEl.className = "dd-list"; // Clase para estilos

  DROPDOWN_ASSETS.forEach((name) => { // Crea item por cada asset disponible
    const item = document.createElement("div");
    item.className = "dd-item";
    item.textContent = name;

    if (name === "Samba Dancing") {
      sambaItemEl = item; // referencia para posicionar los botones a su lado
    }

    item.addEventListener("click", () => { // Al click, carga el asset
      params.asset = name;
      loadAsset(name);

      const show = name === "Samba Dancing"; // Solo con “Samba Dancing” se muestran los botones laterales
      toggleSideButtons(show); // Muestra/oculta botones
      if (show) positionButtonsNextToSamba(); // Reposiciona botones junto al item
    });

    ddListEl.appendChild(item); // Inserta cada item al listado
  });

  dropdownEl.appendChild(ddListEl); // Inserta la lista al dropdown

  // Añadir botones y dropdown
  sideButtons.forEach((btn) => bodyEl.appendChild(btn)); // Inserta todos los botones laterales al cuerpo del panel
  bodyEl.appendChild(dropdownEl); // Inserta el dropdown al cuerpo

  // Toggle open/cerrar
  title.addEventListener("click", () => { // Al click del título, abre/cierra el panel
    bodyEl.classList.toggle("open");
    if (bodyEl.classList.contains("open") && sambaItemEl) {
      positionButtonsNextToSamba(); // Si abre y existe el item “Samba Dancing”, alinea los botones
    }
  });

  wrapEl.appendChild(title); // Mete el título al wrapper
  wrapEl.appendChild(bodyEl); // Mete el cuerpo al wrapper
  document.body.appendChild(wrapEl); // Inserta el wrapper en el documento
}

// Posiciona todos los botones alineados al ítem "Samba Dancing"
function positionButtonsNextToSamba() {
  if (!sambaItemEl) return; // Si no existe el item, salir
  const parentRect = bodyEl.getBoundingClientRect(); // Rect del contenedor
  const itemRect = sambaItemEl.getBoundingClientRect(); // Rect del item “Samba Dancing”
  const centerTop = itemRect.top - parentRect.top + itemRect.height / 2; // Centro vertical relativo al parent

  const gap = 46; // separación vertical entre botones
  sideButtons.forEach((btn, i) => {
    btn.style.top = `${centerTop + i * gap}px`; // Posiciona cada botón con cierto gap
    btn.style.transform = "translateY(-50%)"; // Centra verticalmente el botón
  });
}

function toggleSideButtons(show) {
  sideButtons.forEach((btn) => (btn.style.display = show ? "block" : "none")); // Muestra/oculta todos los botones laterales
}

/* Cerrar menú al hacer click fuera o con Escape */
function bindGlobalMenuHandlers() {
  document.addEventListener("click", (e) => { // Cierra el panel si haces click fuera
    if (!wrapEl) return;
    if (!wrapEl.contains(e.target)) bodyEl.classList.remove("open");
  });
  document.addEventListener("keydown", (e) => { // Cierra el panel con ESC
    if (e.key === "Escape") bodyEl.classList.remove("open");
  });
}

/* -------------------- Helpers visibles -------------------- */
function toggleWireframe() {
  wireframeOn = !wireframeOn; // Cambia estado del wireframe
  if (!object) return; // Si no hay objeto cargado, salir
  object.traverse((ch) => { // Recorre todos los meshes del asset
    if (ch.isMesh) {
      const mats = Array.isArray(ch.material) ? ch.material : [ch.material]; // Normaliza a array
      mats.forEach((m) => { if (m) m.wireframe = wireframeOn; }); // Activa/desactiva wireframe en cada material
    }
  });
}

function toggleSlowMo() {
  slowMoOn = !slowMoOn; // Cambia estado de slow motion
  if (mixer && !paused) mixer.timeScale = slowMoOn ? 0.35 : 1.0; // Ajusta timeScale si no está en pausa
}

function togglePause() {
  paused = !paused; // Cambia estado de pausa
  if (mixer) mixer.timeScale = paused ? 0.0 : (slowMoOn ? 0.35 : 1.0); // Si pausa => 0, si no, respeta slowMo
}

function toggleBackground() {
  bgDark = !bgDark; // Cambia estado de fondo
  const col = bgDark ? BG_DARK : BG_LIGHT; // Selecciona color según estado
  scene.background.setHex(col); // Aplica color al fondo
  if (scene.fog) {
    scene.fog.color.setHex(col); // Sincroniza niebla con el fondo
  }
}

/* -------------------- Render loop -------------------- */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight; // Actualiza aspect
  camera.updateProjectionMatrix(); // Recalcula proyección
  renderer.setSize(window.innerWidth, window.innerHeight); // Ajusta tamaño del canvas
  if (sambaItemEl && sideButtons.some((b) => b.style.display !== "none")) {
    positionButtonsNextToSamba(); // Reposiciona botones si están visibles
  }
}

function animate() {
  const delta = clock.getDelta(); // Delta time entre frames
  if (mixer) mixer.update(delta); // Avanza animación si existe mixer

  // OrbitControls auto-rotate necesita update por frame
  if (orbitControls) orbitControls.update(); // Actualiza los controles (incluye autoRotate si está ON)

  renderer.render(scene, camera); // Renderiza la escena con la cámara
  stats.update(); // Actualiza panel de FPS/tiempos
}
