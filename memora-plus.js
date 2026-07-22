import { escapeHTML } from './utils.js?v=71';
import { getCurrentSession } from './account.js?v=25';
import { loadFirebaseHistory, saveFirebaseHistory, saveFirebaseProgress } from './firebase-service.js?v=10';

const STORAGE_KEY = 'memoraplusProgress';
const HISTORY_KEY = 'memoraplusHistory';
const HISTORY_LIMIT = 50;
const ANIMATION_SPEEDS = {
  normal:{ sequence:4700, feedback:1000, flip:520 },
  reduced:{ sequence:6200, feedback:1250, flip:0 }
};

const LEVELS = [
  {
    id:'visual',
    tag:'Actividad 1',
    title:'Encuentra las parejas',
    prompt:'Encuentra pares iguales.',
    explanation:'Encuentra las parejas iguales. Da vuelta dos cartas por turno y recuerda sus posiciones para completar todos los pares.',
    type:'pairs',
    pairs:[
      { id:'apple', faces:[{ label:'Manzana', image:'assets/cards/level1-apple.png' }, { label:'Manzana', image:'assets/cards/level1-apple.png' }] },
      { id:'cup', faces:[{ label:'Taza', image:'assets/cards/level1-cup.png' }, { label:'Taza', image:'assets/cards/level1-cup.png' }] },
      { id:'house', faces:[{ label:'Casa', image:'assets/cards/level1-house.png' }, { label:'Casa', image:'assets/cards/level1-house.png' }] },
      { id:'flower', faces:[{ label:'Flor', image:'assets/cards/level1-flower.png' }, { label:'Flor', image:'assets/cards/level1-flower.png' }] },
      { id:'key', faces:[{ label:'Llave', image:'assets/cards/level1-key.png' }, { label:'Llave', image:'assets/cards/level1-key.png' }] },
      { id:'radio', faces:[{ label:'Radio', image:'assets/cards/level1-radio.png' }, { label:'Radio', image:'assets/cards/level1-radio.png' }] }
    ]
  },
  {
    id:'semantic',
    tag:'Actividad 2',
    title:'Relaciona objetos',
    prompt:'Une objetos que se relacionan.',
    explanation:'Busca dos cartas que tengan relación entre sí, como objeto y uso, lugar o complemento. No son iguales: están asociadas por significado.',
    type:'pairs',
    pairs:[
      { id:'bread', faces:[{ label:'Pan', image:'assets/cards/level2-bread.png' }, { label:'Mantequilla', image:'assets/cards/level2-butter.png' }] },
      { id:'rain', faces:[{ label:'Paraguas', image:'assets/cards/level2-umbrella.png' }, { label:'Lluvia', image:'assets/cards/level2-rain.png' }] },
      { id:'door', faces:[{ label:'Llave', image:'assets/cards/level2-key.png' }, { label:'Puerta', image:'assets/cards/level2-door.png' }] },
      { id:'mate', faces:[{ label:'Mate', image:'assets/cards/level2-mate.png' }, { label:'Termo', image:'assets/cards/level2-thermos.png' }] },
      { id:'bus', faces:[{ label:'Micro', image:'assets/cards/level2-bus.png' }, { label:'Paradero', image:'assets/cards/level2-bus-stop.png' }] },
      { id:'hammer', faces:[{ label:'Martillo', image:'assets/cards/level2-hammer.png' }, { label:'Clavo', image:'assets/cards/level2-nail.png' }] }
    ]
  },
  {
    id:'temporal',
    tag:'Actividad 3',
    title:'Recuerda dónde estaba',
    prompt:'Observa las 9 cartas durante 10 segundos. Luego responde dónde estaba la carta que se pide.',
    explanation:'Observa la ubicación de 9 cartas. Después se ocultarán y tendrás que marcar dónde estaba la carta que se muestra en la pregunta.',
    type:'temporal',
    items:[
      { label:'Manzana', image:'assets/cards/level1-apple.png' },
      { label:'Llave', image:'assets/cards/level1-key.png' },
      { label:'Radio', image:'assets/cards/level1-radio.png' },
      { label:'Flor', image:'assets/cards/level1-flower.png' },
      { label:'Pan', image:'assets/cards/level2-bread.png' },
      { label:'Paraguas', image:'assets/cards/level2-umbrella.png' },
      { label:'Puerta', image:'assets/cards/level2-door.png' },
      { label:'Mate', image:'assets/cards/level2-mate.png' },
      { label:'Micro', image:'assets/cards/level2-bus.png' }
    ]
  },
  {
    id:'sequence',
    tag:'Actividad 4',
    title:'Repite la secuencia',
    prompt:'Mira el orden y reprodúcelo.',
    explanation:'Mira una secuencia de colores, memoriza el orden y luego presiona los colores en la misma secuencia.',
    type:'sequence',
    sequence:['red', 'green', 'blue', 'yellow', 'green'],
    swatches:{
      red:{ label:'Rojo, círculo', color:'#f43f5e', symbol:'●' },
      green:{ label:'Verde, triángulo', color:'#22c55e', symbol:'▲' },
      blue:{ label:'Azul, estrella', color:'#3b82f6', symbol:'★' },
      yellow:{ label:'Amarillo, cuadrado', color:'#facc15', symbol:'■' }
    }
  },
  {
    id:'daily',
    tag:'Actividad 5',
    title:'Recuerdos cotidianos',
    prompt:'Asocia elementos familiares de la vida diaria.',
    explanation:'Une cartas relacionadas con objetos y situaciones cotidianas. Trabaja reconocimiento, memoria y asociación con elementos familiares.',
    type:'pairs',
    pairs:[
      { id:'marraqueta', faces:['🥖 Marraqueta', '🏪 Panadería'] },
      { id:'micro', faces:['🚌 Micro', '🎫 Tarjeta'] },
      { id:'feria', faces:['🧺 Feria', '🥬 Verduras'] },
      { id:'mate', faces:['🧉 Mate', '🫖 Termo'] },
      { id:'radio', faces:['📻 Radio', '📰 Noticias'] },
      { id:'field', faces:['🌾 Campo', '🚜 Cosecha'] },
      { id:'train', faces:['🚂 Tren', '🚉 Estación'] },
      { id:'tools', faces:['🧰 Herramientas', '🔧 Taller'] }
    ]
  }
];

const dailyLevel = LEVELS.find(item => item.id === 'daily');
if(dailyLevel){
  dailyLevel.pairs = [
    { id:'marraqueta', faces:[{ label:'Marraqueta', image:'assets/cards/level5-marraqueta.png' }, { label:'Panaderia', image:'assets/cards/level5-bakery.png' }] },
    { id:'train', faces:[{ label:'Tren', image:'assets/cards/level5-train.png' }, { label:'Estacion', image:'assets/cards/level5-station.png' }] },
    { id:'feria', faces:[{ label:'Feria', image:'assets/cards/level5-market.png' }, { label:'Verduras', image:'assets/cards/level5-vegetables.png' }] },
    { id:'field', faces:[{ label:'Campo', image:'assets/cards/level5-field.png' }, { label:'Cosecha', image:'assets/cards/level5-harvest.png' }] },
    { id:'radio', faces:[{ label:'Radio', image:'assets/cards/level1-radio.png' }, { label:'Noticias', image:'assets/cards/level5-news.png' }] },
    { id:'micro', faces:[{ label:'Micro', image:'assets/cards/level2-bus.png' }, { label:'Tarjeta', image:'assets/cards/level5-card.png' }] },
    { id:'mate', faces:[{ label:'Mate', image:'assets/cards/level2-mate.png' }, { label:'Termo', image:'assets/cards/level2-thermos.png' }] },
    { id:'tools', faces:[{ label:'Martillo', image:'assets/cards/level2-hammer.png' }, { label:'Clavo', image:'assets/cards/level2-nail.png' }] }
  ];
}

const state = {
  appMode:'welcome',
  levelIndex:0,
  cards:[],
  flipped:[],
  matched:0,
  hits:0,
  misses:0,
  locked:false,
  phase:'idle',
  temporalQueue:[],
  temporalTarget:null,
  sequenceInput:[],
  generatedSequence:[],
  sequenceTimer:null,
  flipInIds:[],
  flipOutIds:[],
  animateGameEntry:false,
  summaryRecorded:false,
  practiceMode:false,
  difficulty:'normal',
  paused:false,
  streak:0,
  guidedResults:[],
  progress:loadProgress()
};

function loadProgress(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      sessions:Number(saved.sessions || 0),
      hits:Number(saved.hits || 0),
      misses:Number(saved.misses || 0),
      bestStreak:Number(saved.bestStreak || 0),
      lastLevel:saved.lastLevel || ''
    };
  }catch{
    return { sessions:0, hits:0, misses:0, bestStreak:0, lastLevel:'' };
  }
}

function saveProgress(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  const session = getCurrentSession();
  if(session?.source === 'firebase'){
    saveFirebaseProgress(session, state.progress).catch(() => {});
  }
}

function historyStorageKey(){
  const session = getCurrentSession();
  return `${HISTORY_KEY}:${session?.id || 'local'}`;
}

function loadHistory(){
  if(getCurrentSession()?.provider === 'guest') return [];
  try{
    const history = JSON.parse(localStorage.getItem(historyStorageKey()) || '[]');
    return normalizeHistory(history);
  }catch{
    return [];
  }
}

function saveHistory(history){
  const session = getCurrentSession();
  if(session?.provider === 'guest') return;
  const cleanHistory = normalizeHistory(history);
  localStorage.setItem(historyStorageKey(), JSON.stringify(cleanHistory));
  if(session?.source === 'firebase'){
    saveFirebaseHistory(session, cleanHistory).catch(() => {});
  }
}

function numberOrZero(value){
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeLevelResult(item = {}){
  return {
    hits:numberOrZero(item.hits ?? item.h),
    misses:numberOrZero(item.misses ?? item.m),
    accuracy:numberOrZero(item.accuracy ?? item.a)
  };
}

function normalizeSessionEntry(entry = {}){
  const levels = Array.isArray(entry.levels)
    ? entry.levels.slice(0, LEVELS.length).map(normalizeLevelResult)
    : [];
  const fallbackTotals = totalsFromResults(levels);
  const rawTotals = entry.totals || fallbackTotals;
  const hits = numberOrZero(rawTotals.hits ?? fallbackTotals.hits);
  const misses = numberOrZero(rawTotals.misses ?? fallbackTotals.misses);
  const attempts = numberOrZero(rawTotals.attempts) || hits + misses;
  const accuracy = numberOrZero(rawTotals.accuracy) || (attempts ? Math.round((hits / attempts) * 100) : 0);

  return {
    id:entry.id || `session-${entry.completedAt || Date.now()}`,
    completedAt:numberOrZero(entry.completedAt) || Date.now(),
    totals:{ hits, misses, attempts, accuracy },
    levels
  };
}

function normalizeHistory(history){
  if(!Array.isArray(history)) return [];
  return history
    .map(normalizeSessionEntry)
    .filter(item => item.levels.length)
    .slice(0, HISTORY_LIMIT);
}

function totalsFromResults(results){
  const totals = results.reduce((acc, item) => ({
    hits:acc.hits + numberOrZero(item.h ?? item.hits),
    misses:acc.misses + numberOrZero(item.m ?? item.misses)
  }), { hits:0, misses:0 });
  const attempts = totals.hits + totals.misses;
  return {
    ...totals,
    attempts,
    accuracy:attempts ? Math.round((totals.hits / attempts) * 100) : 0
  };
}

function recordCompletedJourney(){
  if(state.summaryRecorded || state.guidedResults.length < LEVELS.length) return;
  state.summaryRecorded = true;
  const totals = totalsFromResults(state.guidedResults);
  const entry = {
    id:`session-${Date.now()}`,
    completedAt:Date.now(),
    totals,
    levels:state.guidedResults.map(normalizeLevelResult)
  };
  saveHistory([entry, ...loadHistory()]);
}

function formatHistoryDate(value){
  return new Date(value).toLocaleString('es-CL', {
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
    hour:'2-digit',
    minute:'2-digit'
  });
}

async function renderHistoryContent(){
  const content = document.getElementById('memora-history-content');
  if(!content) return;
  const session = getCurrentSession();
  let history = loadHistory();

  content.innerHTML = `
    <div class="memora-history-empty">
      <strong>Cargando historial...</strong>
      <p>Estamos buscando tus partidas guardadas.</p>
    </div>
  `;

  if(session?.source === 'firebase'){
    try{
      const firebaseHistory = await loadFirebaseHistory(session);
      if(firebaseHistory.length){
        history = normalizeHistory(firebaseHistory);
        localStorage.setItem(historyStorageKey(), JSON.stringify(history));
        saveFirebaseHistory(session, history).catch(() => {});
      }else if(history.length){
        saveFirebaseHistory(session, history).catch(() => {});
      }
    }catch{
      if(!history.length){
        content.innerHTML = `
          <div class="memora-history-empty">
            <strong>No pudimos cargar tu historial</strong>
            <p>Revisa tu conexion e intenta abrir el historial nuevamente.</p>
          </div>
        `;
        return;
      }
    }
  }

  history = normalizeHistory(history);
  if(!history.length){
    content.innerHTML = `
      <div class="memora-history-empty">
        <strong>Sin historial todavia</strong>
        <p>Completa una sesión de actividades para guardar tu primer registro.</p>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <section class="memora-history-stats compact" aria-label="Partidas guardadas">
      <div><span>Partidas registradas</span><strong>${history.length}</strong></div>
    </section>

    <section class="memora-history-section">
      <h3>Sesiones de actividades</h3>
      <div class="memora-history-sessions detailed">
        ${history.map((item, index) => `
          <article class="memora-history-session-card">
            <div class="memora-history-session-head"><div><strong>Sesión ${history.length - index}</strong><span>${formatHistoryDate(item.completedAt)}</span></div><p>${item.totals.hits} logros · ${item.totals.misses} intentos adicionales</p></div>
            <div class="memora-history-session-levels">${LEVELS.map((levelItem, levelIndex) => { const result = item.levels[levelIndex] || normalizeLevelResult(); return `<div><span>${escapeHTML(levelItem.tag)}</span><strong>${escapeHTML(levelItem.title)}</strong><p>${result.hits} logros · ${result.misses} intentos adicionales</p></div>`; }).join('')}</div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="memora-history-section" hidden>
      <h3>Ultimas partidas</h3>
      <div class="memora-history-sessions">
        ${history.slice(0, 8).map(item => `
          <article>
            <div>
              <strong>${formatHistoryDate(item.completedAt)}</strong>
              <span>${escapeHTML(item.userName || 'Usuario')}</span>
            </div>
            <p>${item.totals?.hits || 0} logros · ${item.totals?.misses || 0} intentos adicionales</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function openHistoryModal(){
  const modal = document.getElementById('memora-history-modal');
  if(!modal) return;
  modal.hidden = false;
  document.body.classList.add('history-open');
  renderHistoryContent();
  document.getElementById('memora-history-close')?.focus();
}

function closeHistoryModal(){
  const modal = document.getElementById('memora-history-modal');
  if(!modal) return;
  modal.hidden = true;
  document.body.classList.remove('history-open');
}

function openSettingsModal(){
  const modal = document.getElementById('memora-settings-modal');
  if(!modal) return;
  modal.hidden = false;
  document.body.classList.add('settings-open');
  document.getElementById('memora-settings-close')?.focus();
}

function closeSettingsModal(){
  const modal = document.getElementById('memora-settings-modal');
  if(!modal) return;
  modal.hidden = true;
  document.body.classList.remove('settings-open');
}

function shuffle(items){
  const copy = [...items];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function level(){
  const base = LEVELS[state.levelIndex] || LEVELS[0];
  const mode = state.difficulty || 'normal';
  const counts = {
    gentle:{ pairs:3, temporal:4, sequence:2 },
    normal:{ pairs:base.id === 'daily' ? 6 : 5, temporal:6, sequence:4 },
    challenge:{ pairs:base.pairs?.length || 0, temporal:9, sequence:6 }
  }[mode];
  if(base.type === 'pairs') return { ...base, pairs:base.pairs.slice(0, counts.pairs) };
  if(base.type === 'temporal') return { ...base, items:base.items.slice(0, counts.temporal) };
  if(base.type === 'sequence'){
    const sequence = state.generatedSequence.length
      ? state.generatedSequence
      : Array.from({ length:counts.sequence }, (_, index) => base.sequence[index % base.sequence.length]);
    return { ...base, sequence };
  }
  return base;
}

function timing(){
  const key = document.getElementById('memora-animation-speed')?.value || 'normal';
  const animation = ANIMATION_SPEEDS[key] || ANIMATION_SPEEDS.normal;
  const preview = Number(document.getElementById('memora-observe-time')?.value || 10000);
  return { ...animation, preview };
}

function updateSummary(){
  const total = state.progress.hits + state.progress.misses;
  const sessionTotal = state.hits + state.misses;
  const totalAccuracy = total ? Math.round((state.progress.hits / total) * 100) : 0;
  const sessionAccuracy = sessionTotal ? Math.round((state.hits / sessionTotal) * 100) : 0;
  setText('memora-total-sessions', state.progress.sessions);
  setText('memora-total-accuracy', `${totalAccuracy}%`);
  setText('memora-last-level', state.progress.lastLevel || 'Sin registro');
  setText('memora-best-streak', state.progress.bestStreak);
  setText('memora-session-score', `${sessionAccuracy}%`);
}

function updateStats(){
  const current = level();
  const total = exerciseTotal(current);
  setText('memora-hits', state.hits);
  setText('memora-misses', state.misses);
  setText('memora-progress', `${state.matched}/${total}`);
  updateSummary();
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = String(value);
}

function setTemporalQuestion(value = '', visible = false){
  const el = document.getElementById('memora-temporal-question');
  if(!el) return;
  el.hidden = !visible;
  el.innerHTML = value;
}

function exerciseTotal(current){
  if(current.type === 'sequence') return current.sequence.length;
  if(current.type === 'temporal') return current.items.length;
  return current.pairs.length;
}

function setAppChromeVisible(visible){
  const header = document.getElementById('memora-app-header');
  const layout = document.getElementById('memora-app-layout');
  const guide = document.getElementById('memora-guide');
  const lobbyBar = document.getElementById('lobby-bar');
  if(header) header.hidden = true;
  if(layout) layout.hidden = !visible;
  if(guide) guide.hidden = visible;
  if(lobbyBar) lobbyBar.hidden = !visible;
  if(visible && layout && state.animateGameEntry){
    layout.classList.remove('memora-game-enter');
    requestAnimationFrame(() => layout.classList.add('memora-game-enter'));
  }
  if(visible) state.animateGameEntry = false;
}

function speak(message){
  if(!('speechSynthesis' in window) || !message) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'es-CL';
  utterance.rate = .88;
  utterance.volume = .9;
  window.speechSynthesis.speak(utterance);
}

function announce(message){
  if(document.getElementById('memora-voice-mode')?.checked) speak(message);
}

function instructionFor(current = level()){
  if(current.type === 'pairs') return current.id === 'semantic'
    ? 'Busca dos objetos que se relacionan. Da vuelta dos cartas por intento y recuerda su ubicación.'
    : 'Da vuelta dos cartas. Si son iguales, encontraste una pareja. Continúa hasta completar el tablero.';
  if(current.type === 'temporal') return 'Observa las cartas. Cuando se oculten, elige la posición donde estaba el objeto solicitado.';
  return 'Observa la secuencia de colores y símbolos. Luego presiónalos en el mismo orden.';
}

function rulesFor(current = level()){
  if(current.id === 'visual') return [
    'Da vuelta solo dos cartas por turno.',
    'Si las cartas son iguales, quedan descubiertas.',
    `Completa los ${exerciseTotal(current)} pares para terminar la actividad.`
  ];
  if(current.id === 'semantic') return [
    'Busca objetos que se relacionen entre sí, aunque no sean iguales.',
    'Da vuelta dos cartas por intento y observa bien sus posiciones.',
    `Completa las ${exerciseTotal(current)} asociaciones para avanzar.`
  ];
  if(current.id === 'temporal') return [
    'Primero mira las 9 cartas durante 10 segundos.',
    'Luego las cartas se ocultarán.',
    'Lee la palabra pedida y toca el lugar donde estaba esa carta.'
  ];
  if(current.id === 'sequence') return [
    'Observa con calma el orden de colores y símbolos.',
    'Espera a que termine la muestra antes de responder.',
    'Repite la secuencia tocando los colores en el mismo orden.'
  ];
  return [
    'Busca relaciones de la vida cotidiana.',
    'Une cada objeto con su complemento, lugar o situación.',
    `Completa las ${exerciseTotal(current)} relaciones para cerrar el recorrido.`
  ];
}

function guideSpeechFor(current = level()){
  if(current.id === 'visual') return 'Primero observa bien. En esta actividad debes encontrar cartas iguales, de a dos por turno.';
  if(current.id === 'semantic') return 'Aquí no buscas cartas iguales: buscas objetos que tengan una relación clara entre ellos.';
  if(current.id === 'temporal') return 'En esta actividad mira las ubicaciones con atención. Después te pediré una carta usando solo su palabra.';
  if(current.id === 'sequence') return 'Mira la secuencia completa antes de tocar. La clave es repetir el mismo orden.';
  return 'Esta actividad usa objetos cotidianos. Busca que dos cartas van juntas por costumbre, uso o situación.';
}

function tutorialVideoFor(current = level()){
  const videos = {
    visual:'assets/tutorials/activity-1.mp4',
    semantic:'assets/tutorials/activity-2.mp4',
    temporal:'assets/tutorials/activity-3.mp4',
    sequence:'assets/tutorials/activity-4.mp4',
    daily:'assets/tutorials/activity-5.mp4'
  };
  return videos[current.id] || '';
}

function pauseGuideMedia(){
  document.querySelectorAll('#memora-guide video').forEach(video => {
    video.pause();
  });
}

function difficultyOptions(){
  return [
    { id:'gentle', title:'Suave', description:'Menos cartas y ritmo tranquilo.' },
    { id:'normal', title:'Normal', description:'Equilibrado para entrenar.' },
    { id:'challenge', title:'Desafío', description:'Más elementos para recordar.' }
  ];
}

function setDifficulty(mode){
  state.difficulty = mode || 'normal';
  document.querySelectorAll('[data-memora-difficulty]').forEach(button => {
    const active = button.dataset.memoraDifficulty === state.difficulty;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderGuide(){
  const guide = document.getElementById('memora-guide');
  if(!guide) return;
  guide.classList.remove('memora-guide-screen-enter', 'memora-guide-screen-exit');
  requestAnimationFrame(() => guide.classList.add('memora-guide-screen-enter'));

  if(state.appMode === 'welcome'){
    guide.className = 'memora-guide memora-guide-welcome';
    guide.innerHTML = `
      <img class="memora-guide-logo" src="assets/logo-memora-plus.png" alt="Memora+" />
      <div class="memora-guide-copy">
        <span>Programa de ejercicios</span>
        <h1>Comienza tu recorrido Memora+</h1>
        <p>Elige actividades de memoria, asociación, ubicación, secuencias y vida cotidiana. Puedes detenerte cuando quieras.</p>
      </div>
      <section class="memora-difficulty-panel" aria-label="Dificultad">
        <span>Dificultad</span>
        <div class="memora-difficulty-tabs" role="group" aria-label="Seleccionar dificultad">
          ${difficultyOptions().map(option => `
            <button class="memora-difficulty-tab ${option.id === state.difficulty ? 'active' : ''}" type="button" data-memora-difficulty="${escapeHTML(option.id)}" aria-pressed="${option.id === state.difficulty}">
              <strong>${escapeHTML(option.title)}</strong>
              <small>${escapeHTML(option.description)}</small>
            </button>
          `).join('')}
        </div>
      </section>
      <div class="memora-welcome-actions">
        <button class="memora-guide-primary" id="memora-guide-start" type="button">Empezar ejercicios</button>
        <button class="memora-guide-secondary" id="memora-welcome-practice" type="button">Practicar primero</button>
      </div>
    `;
    document.querySelectorAll('[data-memora-difficulty]').forEach(button => {
      button.addEventListener('click', () => setDifficulty(button.dataset.memoraDifficulty));
    });
    document.getElementById('memora-guide-start')?.addEventListener('click', () => {
      state.practiceMode = false;
      state.guidedResults = [];
      state.levelIndex = 0;
      state.summaryRecorded = false;
      resetSession();
      transitionToMode('intro');
    });
    document.getElementById('memora-welcome-practice')?.addEventListener('click', () => {
      state.guidedResults = [];
      state.levelIndex = 0;
      state.summaryRecorded = false;
      resetSession();
      startPractice();
    });
    return;
  }

  if(state.appMode === 'summary'){
    const totals = state.guidedResults.reduce((acc, item) => ({
      hits:acc.hits + item.hits,
      misses:acc.misses + item.misses
    }), { hits:0, misses:0 });
    const attempts = totals.hits + totals.misses;
    const accuracy = attempts ? Math.round((totals.hits / attempts) * 100) : 0;
    guide.className = 'memora-guide memora-guide-summary';
    guide.innerHTML = `
      <div class="memora-guide-copy">
        <span>Resumen final</span>
        <h1>Recorrido completado</h1>
        <p>Terminaste los 5 ejercicios. Estos son los resultados de esta sesión.</p>
      </div>
      <div class="memora-final-stats">
        <div><span>Actividades</span><strong>${state.guidedResults.length}</strong></div>
        <div><span>Logros</span><strong>${totals.hits}</strong></div>
        <div><span>Intentos adicionales</span><strong>${totals.misses}</strong></div>
      </div>
      <div class="memora-result-list">
        ${state.guidedResults.map(item => `
          <article>
            <span>${escapeHTML(item.tag)}</span>
            <strong>${escapeHTML(item.title)}</strong>
            <p>${item.hits} logros · ${item.misses} intentos adicionales</p>
          </article>
        `).join('')}
      </div>
      <div class="memora-summary-actions">
        <button class="memora-guide-primary" id="memora-guide-restart" type="button">Hacer los ejercicios otra vez</button>
        <button class="memora-guide-secondary memora-summary-exit" id="memora-summary-lobby" type="button">Salir</button>
      </div>
    `;
    document.getElementById('memora-guide-restart')?.addEventListener('click', () => {
      state.guidedResults = [];
      state.levelIndex = 0;
      state.summaryRecorded = false;
      resetSession();
      transitionToMode('intro');
    });
    document.getElementById('memora-summary-lobby')?.addEventListener('click', returnToLobbyDirect);
    return;
  }

  const current = level();
  const tutorialVideo = tutorialVideoFor(current);
  const exerciseLabel = `Ejercicio ${state.levelIndex + 1}`;
  guide.className = 'memora-guide memora-guide-level memora-guide-lesson';
  guide.innerHTML = `
    <div class="memora-lesson-header">
      <span>${escapeHTML(exerciseLabel)}</span>
      <h1>${escapeHTML(current.title)}</h1>
    </div>
    <div class="memora-lesson-window">
      <section class="memora-video-panel" aria-label="Animación del ejercicio">
        <span>Animación explicativa</span>
        <video class="memora-activity-video" src="${escapeHTML(tutorialVideo)}" controls autoplay muted playsinline preload="metadata"></video>
      </section>
      <aside class="memora-dialog-panel" aria-label="Explicación del ejercicio">
        <span>${escapeHTML(exerciseLabel)}: ${escapeHTML(current.title)}</span>
        <p class="memora-dialog-quote">&ldquo;${escapeHTML(current.explanation)}&rdquo;</p>
        <div class="memora-dialog-rules">
          <strong>Reglas</strong>
          <ol>
            ${rulesFor(current).map(rule => `<li>${escapeHTML(rule)}</li>`).join('')}
          </ol>
        </div>
        <div class="memora-level-preview">
          <span>Objetivo</span>
          <strong>${exerciseTotal(current)} respuestas</strong>
        </div>
      </aside>
    </div>
    <div class="memora-summary-actions memora-lesson-actions">
      <button class="memora-guide-primary" id="memora-guide-begin" type="button">Comenzar ejercicio</button>
    </div>
  `;
  document.getElementById('memora-guide-begin')?.addEventListener('click', () => transitionToExercise());
  announce(`${exerciseLabel}. ${current.title}. ${current.explanation} ${rulesFor(current).join(' ')}`);
}

function currentExerciseResult(current){
  const attempts = state.hits + state.misses;
  return {
    tag:current.tag,
    title:current.title,
    hits:state.hits,
    misses:state.misses,
    accuracy:attempts ? Math.round((state.hits / attempts) * 100) : 0
  };
}

function transitionToMode(mode){
  const guide = document.getElementById('memora-guide');
  if(!guide){
    state.appMode = mode;
    render();
    return;
  }
  pauseGuideMedia();
  guide.classList.remove('memora-guide-screen-enter');
  guide.classList.add('memora-guide-screen-exit');
  window.setTimeout(() => {
    state.appMode = mode;
    render();
  }, 280);
}

function transitionToExercise(){
  const guide = document.getElementById('memora-guide');
  state.animateGameEntry = true;
  if(!guide){
    startExercise();
    return;
  }
  pauseGuideMedia();
  guide.classList.remove('memora-guide-screen-enter');
  guide.classList.add('memora-guide-screen-exit');
  window.setTimeout(startExercise, 280);
}

function startPractice(){
  state.practiceMode = true;
  state.difficulty = 'gentle';
  startExercise();
  setText('memora-prompt', `Práctica: ${instructionFor(level())}`);
  announce(`Comencemos una práctica. ${instructionFor(level())}`);
}

function returnToLobby(){
  const wantsReturn = window.confirm('¿Seguro que quieres regresar al inicio? Se cerrará la actividad actual.');
  if(!wantsReturn) return;
  returnToLobbyDirect();
}

function returnToLobbyDirect(){
  clearTimeout(state.sequenceTimer);
  state.guidedResults = [];
  state.levelIndex = 0;
  state.summaryRecorded = false;
  resetSession();
  state.appMode = 'welcome';
  render();
}

function renderLevelList(){
  const list = document.getElementById('memora-level-list');
  if(!list) return;
  list.innerHTML = LEVELS.map((item, index) => `
    <button class="memora-level-button ${index === state.levelIndex ? 'active' : ''}" type="button" data-memora-level="${index}">
      <span>${escapeHTML(item.tag)}</span>
      <strong>${escapeHTML(item.title)}</strong>
    </button>
  `).join('');
  list.querySelectorAll('[data-memora-level]').forEach(button => {
    button.addEventListener('click', () => {
      state.levelIndex = Number(button.dataset.memoraLevel || 0);
      resetSession();
      render();
    });
  });
}

function resetSession(){
  clearTimeout(state.sequenceTimer);
  state.cards = [];
  state.flipped = [];
  state.matched = 0;
  state.hits = 0;
  state.misses = 0;
  state.locked = false;
  state.phase = 'idle';
  state.temporalQueue = [];
  state.temporalTarget = null;
  state.sequenceInput = [];
  state.flipInIds = [];
  state.flipOutIds = [];
  state.generatedSequence = [];
  state.paused = false;
}

function buildPairCards(current){
  return shuffle(current.pairs.flatMap(pair => pair.faces.map((face, side) => ({
    id:`${pair.id}-${side}`,
    pairId:pair.id,
    face,
    flipped:false,
    matched:false
  }))));
}

function faceLabel(face){
  return typeof face === 'object' ? face.label : face;
}

function faceImage(face){
  return typeof face === 'object' ? face.image : '';
}

function renderCardFace(face){
  const label = faceLabel(face);
  const image = faceImage(face);
  if(image){
    return `<img class="memora-card-image" src="${escapeHTML(image)}" alt="${escapeHTML(label)}" />`;
  }
  return `<span class="memora-card-label text-only">${escapeHTML(label)}</span>`;
}

function cardAccessibleLabel(card, index, visible, current){
  if(card.matched) return `Pareja encontrada: ${faceLabel(card.face)}`;
  if(visible) return `Carta ${faceLabel(card.face)}, seleccionada`;
  const columns = current.type === 'temporal' && state.cards.length === 4 ? 2 : current.type === 'temporal' ? 3 : 4;
  const row = Math.floor(index / columns) + 1;
  const column = (index % columns) + 1;
  return `Carta oculta, fila ${row}, columna ${column}`;
}

function renderPairGuideFace(face){
  const label = faceLabel(face);
  const image = faceImage(face);
  if(image){
    return `
      <span class="memora-pair-face">
        <img src="${escapeHTML(image)}" alt="" />
        <span>${escapeHTML(label)}</span>
      </span>
    `;
  }
  return `<span class="memora-pair-face text-only">${escapeHTML(label)}</span>`;
}

function renderPairGuide(current){
  const guide = document.getElementById('memora-pair-guide');
  const playArea = document.getElementById('memora-play-area');
  if(!guide || !playArea) return;
  const showGuide = current.type === 'pairs' && state.phase !== 'idle';
  guide.hidden = !showGuide;
  playArea.classList.toggle('has-pair-guide', showGuide);
  if(!showGuide){
    guide.innerHTML = '';
    return;
  }

  const matchedPairIds = new Set(state.cards.filter(card => card.matched).map(card => card.pairId));
  guide.innerHTML = `
    <div class="memora-pair-guide-title">
      <span>Pares a encontrar</span>
      <strong>${state.matched}/${current.pairs.length}</strong>
    </div>
    <div class="memora-pair-guide-list">
      ${current.pairs.map(pair => `
        <article class="${matchedPairIds.has(pair.id) ? 'matched' : ''}">
          ${pair.faces.map(renderPairGuideFace).join('')}
        </article>
      `).join('')}
    </div>
  `;
}

function promptForState(current){
  if(state.paused) return 'Actividad pausada. Puedes continuar cuando quieras.';
  if(state.phase === 'complete') return 'Ejercicio completado. Presiona el boton verde para continuar.';
  if(current.type === 'pairs' && state.phase === 'preview') return 'Observa las cartas. En unos segundos se ocultaran para comenzar.';
  if(current.type === 'temporal'){
    if(state.phase === 'preview') return 'Observa bien la ubicación de las 9 cartas.';
    if(state.phase === 'play' && state.temporalTarget) return 'Haz clic en el lugar donde estaba la carta indicada.';
  }
  if(current.type === 'sequence'){
    if(state.phase === 'preview') return 'Memoriza el orden de los colores.';
    if(state.phase === 'input') return 'Reproduce la secuencia.';
  }
  return current.prompt;
}

function render(){
  const current = level();
  if(state.appMode !== 'exercise'){
    setAppChromeVisible(false);
    renderGuide();
    updateSummary();
    return;
  }

  setAppChromeVisible(true);
  const app = document.getElementById('memora-plus-app');
  const interfaceSize = document.getElementById('memora-interface-size')?.value || 'large';
  app?.classList.toggle('large-cards', interfaceSize !== 'normal');
  app?.classList.toggle('interface-large', interfaceSize === 'large');
  app?.classList.toggle('interface-xlarge', interfaceSize === 'xlarge');
  app?.classList.toggle('reduced-animations', document.getElementById('memora-animation-speed')?.value === 'reduced');
  app?.classList.toggle('companion-mode', document.getElementById('memora-companion-mode')?.checked === true);
  setText('memora-level-tag', current.tag);
  setText('memora-level-title', current.title);
  setText('memora-prompt', promptForState(current));
  if(current.type !== 'temporal' || state.phase !== 'play' || !state.temporalTarget){
    setTemporalQuestion();
  }
  renderPairGuide(current);
  renderBoard();
  updateStats();
  updateActionButtons();
}

function updateActionButtons(){
  const nextButton = document.getElementById('memora-next-level');
  const repeatButton = document.getElementById('memora-repeat');
  const readyButton = document.getElementById('memora-ready');
  const pauseButton = document.getElementById('memora-pause');
  if(nextButton){
    nextButton.hidden = state.phase !== 'complete';
    nextButton.textContent = state.practiceMode ? 'Terminar práctica' : state.levelIndex >= LEVELS.length - 1 ? 'Ver resumen' : 'Siguiente actividad';
  }
  if(repeatButton){
    repeatButton.hidden = state.phase === 'complete';
  }
  if(readyButton){
    const manualFeedback = state.phase === 'feedback';
    readyButton.hidden = !(manualFeedback || (state.phase === 'preview' && document.getElementById('memora-ready-mode')?.checked));
    readyButton.textContent = manualFeedback ? 'Entendí, continuar' : 'Ya estoy listo';
  }
  if(pauseButton){
    pauseButton.hidden = !['play','input'].includes(state.phase);
    pauseButton.textContent = state.paused ? 'Continuar actividad' : 'Pausar';
    pauseButton.disabled = state.locked && !state.paused;
  }
}

function togglePause(){
  if(!['play','input'].includes(state.phase)) return;
  if(state.locked && !state.paused) return;
  state.paused = !state.paused;
  state.locked = state.paused;
  render();
}

function renderBoard(){
  const board = document.getElementById('memora-board');
  const sequenceControls = document.getElementById('memora-sequence-controls');
  if(!board || !sequenceControls) return;
  const current = level();
  board.className = `memora-board memora-board-${current.type} cards-${state.cards.length}`;
  sequenceControls.hidden = current.type !== 'sequence';
  sequenceControls.innerHTML = '';

  if(state.phase === 'idle'){
    board.innerHTML = `<div class="memora-empty-state">Selecciona un ejercicio y presiona iniciar.</div>`;
    return;
  }

  if(current.type === 'sequence'){
    renderSequence(board, sequenceControls, current);
    return;
  }

  board.innerHTML = state.cards.map((card, cardIndex) => {
    const visible = card.flipped || card.matched || state.phase === 'preview';
    const status = card.matched ? 'matched' : visible ? 'visible' : '';
    const flipIn = state.flipInIds.includes(card.id);
    const flipOut = state.flipOutIds.includes(card.id);
    return `
      <button class="memora-card ${status} ${flipIn ? 'flip-in' : ''} ${flipOut ? 'flip-out' : ''}" type="button" data-card-id="${escapeHTML(card.id)}" aria-label="${escapeHTML(cardAccessibleLabel(card, cardIndex, visible, current))}" ${card.matched || state.locked ? 'disabled' : ''}>
        <span class="memora-card-inner">
          <span class="memora-card-side memora-card-back" aria-hidden="${visible ? 'true' : 'false'}">
            <span>?</span>
          </span>
          <span class="memora-card-side memora-card-front" aria-hidden="${visible ? 'false' : 'true'}">
            ${renderCardFace(card.face)}
          </span>
        </span>
      </button>
    `;
  }).join('');

  board.querySelectorAll('[data-card-id]').forEach(button => {
    button.addEventListener('click', () => handleCardClick(button.dataset.cardId));
  });
  state.flipInIds = [];
  state.flipOutIds = [];
}

function renderSequence(board, controls, current){
  const showing = state.phase === 'preview';
  const sequence = showing ? current.sequence : state.sequenceInput;
  board.innerHTML = `
    <div class="memora-sequence-display">
      ${sequence.map(key => {
        const swatch = current.swatches[key];
        return `<span class="memora-sequence-dot" style="--dot:${swatch.color}" aria-label="${escapeHTML(swatch.label)}"><b>${swatch.symbol}</b></span>`;
      }).join('')}
    </div>
  `;

  controls.innerHTML = Object.entries(current.swatches).map(([key, swatch]) => `
    <button class="memora-color-button" type="button" data-sequence-key="${escapeHTML(key)}" style="--dot:${swatch.color}">
      <span>${swatch.symbol}</span>${escapeHTML(swatch.label)}
    </button>
  `).join('');

  controls.querySelectorAll('[data-sequence-key]').forEach(button => {
    button.disabled = state.phase !== 'input' || state.locked;
    button.addEventListener('click', () => handleSequenceClick(button.dataset.sequenceKey));
  });
}

function unlockAfterFlip(levelId){
  setTimeout(() => {
    if(level().id !== levelId || state.phase !== 'play') return;
    state.locked = false;
    render();
  }, 620);
}

function startExercise(){
  resetSession();
  const base = LEVELS[state.levelIndex] || LEVELS[0];
  if(base.type === 'sequence'){
    const mode = state.difficulty || 'normal';
    const length = mode === 'gentle' ? 2 : mode === 'challenge' ? 6 : 4;
    const keys = Object.keys(base.swatches);
    state.generatedSequence = Array.from({ length }, () => keys[Math.floor(Math.random() * keys.length)]);
  }
  const current = level();
  state.appMode = 'exercise';
  state.phase = 'preview';
  state.cards = current.type === 'temporal'
    ? shuffle(current.items).map((face, index) => ({ id:`temporal-${index}`, pairId:`temporal-${index}`, face, flipped:true, matched:false }))
    : current.type === 'pairs'
      ? buildPairCards(current)
      : [];
  state.temporalQueue = current.type === 'temporal' ? shuffle(state.cards.map(card => card.id)) : [];
  if(!state.practiceMode) state.progress.sessions++;
  state.progress.lastLevel = current.title;
  saveProgress();

  if(current.type === 'pairs'){
    const observeFirst = document.getElementById('memora-ready-mode')?.checked;
    if(!observeFirst){
      state.phase = 'play';
      setText('memora-prompt', current.prompt);
      render();
      return;
    }
    setText('memora-prompt', 'Observa las cartas. Cuando estés listo, ocúltalas para comenzar.');
    if(observeFirst){
      updateActionButtons();
      render();
      return;
    }
    state.sequenceTimer = setTimeout(() => {
      if(level().id !== current.id || state.phase !== 'preview') return;
      state.flipOutIds = state.cards.map(card => card.id);
      state.phase = 'play';
      state.locked = true;
      render();
      unlockAfterFlip(current.id);
    }, Math.max(3600, Math.round(timing().preview * .55)));
  }else if(current.type === 'temporal'){
    setTemporalQuestion();
    setText('memora-prompt', 'Observa bien la ubicación de las 9 cartas.');
    if(document.getElementById('memora-ready-mode')?.checked){
      render();
      return;
    }
    state.sequenceTimer = setTimeout(() => {
      if(level().id !== current.id || state.phase !== 'preview') return;
      state.cards.forEach(card => card.flipped = false);
      state.flipOutIds = state.cards.map(card => card.id);
      state.phase = 'play';
      state.locked = true;
      nextTemporalQuestion();
      render();
      unlockAfterFlip(current.id);
    }, timing().preview);
  }else if(current.type === 'sequence'){
    setText('memora-prompt', 'Memoriza el orden de los colores.');
    if(document.getElementById('memora-ready-mode')?.checked){
      render();
      return;
    }
    state.sequenceTimer = setTimeout(() => {
      if(level().id !== current.id || state.phase !== 'preview') return;
      state.phase = 'input';
      setText('memora-prompt', 'Reproduce la secuencia.');
      render();
    }, timing().sequence);
  }

  render();
}

function repeatSample(){
  const current = level();
  if(current.type === 'pairs'){
    state.flipInIds = state.cards.filter(card => !card.matched).map(card => card.id);
    state.cards.forEach(card => {
      if(!card.matched) card.flipped = true;
    });
    state.locked = true;
    render();
    setTimeout(() => {
      state.flipOutIds = state.cards.filter(card => !card.matched).map(card => card.id);
      state.cards.forEach(card => {
        if(!card.matched) card.flipped = false;
      });
      render();
      unlockAfterFlip(current.id);
    }, timing().feedback + 600);
    return;
  }
  startExercise();
}

function handleCardClick(cardId){
  const current = level();
  if(state.locked || state.phase !== 'play') return;
  if(current.type === 'temporal'){
    handleTemporalClick(cardId);
    return;
  }
  const card = state.cards.find(item => item.id === cardId);
  if(!card || card.flipped || card.matched) return;
  card.flipped = true;
  state.flipInIds = [card.id];
  state.flipped.push(card.id);
  if(state.flipped.length === 2) resolvePair();
  render();
}

function resolvePair(){
  const [firstId, secondId] = state.flipped;
  const first = state.cards.find(card => card.id === firstId);
  const second = state.cards.find(card => card.id === secondId);
  if(!first || !second) return;
  state.locked = true;
  if(first.pairId === second.pairId){
    first.matched = true;
    second.matched = true;
    state.matched++;
    recordHit();
    state.flipped = [];
    state.locked = false;
    announce('Muy bien, encontraste una pareja.');
    if(state.matched === level().pairs.length) completeExercise();
  }else{
    recordMiss();
    announce('No son pareja. Puedes intentarlo nuevamente.');
    setTimeout(() => {
      state.flipOutIds = [first.id, second.id];
      first.flipped = false;
      second.flipped = false;
      state.flipped = [];
      render();
      unlockAfterFlip(level().id);
    }, timing().feedback);
  }
}

function nextTemporalQuestion(){
  state.temporalTarget = state.temporalQueue.shift() || null;
  const target = state.cards.find(card => card.id === state.temporalTarget);
  setText('memora-prompt', target ? 'Haz clic en el lugar donde estaba la carta indicada.' : 'Ejercicio terminado.');
  setTemporalQuestion(
    target ? `<span>Busca esta carta</span><strong>${escapeHTML(faceLabel(target.face))}</strong>` : '',
    !!target
  );
}

function handleTemporalClick(cardId){
  if(!state.temporalTarget) return;
  const selected = state.cards.find(card => card.id === cardId);
  if(!selected || selected.matched) return;
  selected.flipped = true;
  state.flipInIds = [selected.id];
  state.locked = true;
  if(cardId === state.temporalTarget){
    selected.matched = true;
    state.matched++;
    recordHit();
    announce('Muy bien, encontraste la posición.');
  }else{
    recordMiss();
    announce('Esa no era la posición. Observa la respuesta correcta.');
    const target = state.cards.find(card => card.id === state.temporalTarget);
    if(target){
      target.flipped = true;
      state.flipInIds = target.id === selected.id ? [selected.id] : [selected.id, target.id];
    }
  }
  if(document.getElementById('memora-ready-mode')?.checked){
    state.phase = 'feedback';
    render();
    return;
  }
  setTimeout(() => {
    finishTemporalFeedback();
  }, timing().feedback);
  render();
}

function finishTemporalFeedback(){
  state.flipOutIds = state.cards.filter(card => !card.matched && card.flipped).map(card => card.id);
  state.cards.forEach(card => {
    if(!card.matched) card.flipped = false;
  });
  state.locked = false;
  if(state.matched >= level().items.length || !state.temporalQueue.length){
    completeExercise();
  }else{
    state.phase = 'play';
    nextTemporalQuestion();
    render();
  }
}

function handleSequenceClick(key){
  const current = level();
  if(state.phase !== 'input' || state.locked) return;
  const expected = current.sequence[state.sequenceInput.length];
  state.sequenceInput.push(key);
  if(key === expected){
    state.matched++;
    recordHit();
    if(state.sequenceInput.length === current.sequence.length) completeExercise();
  }else{
    recordMiss();
    state.locked = true;
    announce('La secuencia fue distinta. Vamos a observarla nuevamente.');
    setText('memora-prompt', 'No fue igual. Observa la secuencia nuevamente.');
    setTimeout(() => {
      state.sequenceInput = [];
      state.matched = 0;
      state.locked = false;
      state.phase = 'preview';
      render();
      state.sequenceTimer = setTimeout(() => {
        if(state.phase !== 'preview') return;
        state.phase = 'input';
        render();
      }, timing().sequence);
    }, timing().feedback);
  }
  render();
}

function recordHit(){
  state.hits++;
  if(state.practiceMode) return updateStats();
  state.progress.hits++;
  state.streak++;
  state.progress.bestStreak = Math.max(state.progress.bestStreak, state.streak);
  saveProgress();
  updateStats();
}

function recordMiss(){
  state.misses++;
  if(state.practiceMode) return updateStats();
  state.progress.misses++;
  state.streak = 0;
  saveProgress();
  updateStats();
}

function completeExercise(){
  const current = level();
  const result = currentExerciseResult(current);
  if(!state.practiceMode) state.guidedResults.push(result);
  state.phase = 'complete';
  state.locked = false;
  setTemporalQuestion();
  setText('memora-prompt', 'Ejercicio completado. Presiona el botón verde para continuar.');
  announce(state.practiceMode ? 'Práctica completada.' : 'Actividad completada. Muy bien.');
  saveProgress();
  render();
}

function continueWhenReady(){
  if(state.phase === 'feedback'){
    finishTemporalFeedback();
    return;
  }
  if(state.phase !== 'preview') return;
  const current = level();
  if(current.type === 'pairs' || current.type === 'temporal'){
    state.cards.forEach(card => card.flipped = false);
    state.flipOutIds = state.cards.map(card => card.id);
    state.phase = 'play';
    state.locked = true;
    if(current.type === 'temporal') nextTemporalQuestion();
    render();
    unlockAfterFlip(current.id);
  }else if(current.type === 'sequence'){
    state.phase = 'input';
    state.sequenceInput = [];
    render();
  }
}

function goToNextLevel(){
  if(state.phase !== 'complete') return;
  if(state.practiceMode){
    state.practiceMode = false;
    resetSession();
    transitionToMode('intro');
    return;
  }
  if(state.levelIndex >= LEVELS.length - 1){
    recordCompletedJourney();
    transitionToMode('summary');
    return;
  }

  state.levelIndex++;
  resetSession();
  transitionToMode('intro');
}

export function initMemoraPlus(){
  if(!document.getElementById('memora-plus-app')) return;
  document.addEventListener('click', event => {
    if(event.target.closest('#account-history-button')){
      openHistoryModal();
      return;
    }
    if(event.target.closest('#account-settings')){
      openSettingsModal();
      return;
    }
    if(event.target.closest('#memora-history-close') || event.target.id === 'memora-history-modal'){
      closeHistoryModal();
    }
    if(event.target.closest('#memora-settings-close') || event.target.id === 'memora-settings-modal'){
      closeSettingsModal();
    }
  });
  document.addEventListener('memora-open-settings', openSettingsModal);
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape'){
      closeHistoryModal();
      closeSettingsModal();
    }
  });
  document.getElementById('memora-start')?.addEventListener('click', startExercise);
  document.getElementById('memora-back-lobby')?.addEventListener('click', returnToLobby);
  document.getElementById('memora-repeat')?.addEventListener('click', repeatSample);
  document.getElementById('memora-next-level')?.addEventListener('click', goToNextLevel);
  document.getElementById('memora-ready')?.addEventListener('click', continueWhenReady);
  document.getElementById('memora-listen')?.addEventListener('click', () => speak(instructionFor()));
  document.getElementById('memora-help')?.addEventListener('click', () => {
    const companion = document.getElementById('memora-companion-mode')?.checked
      ? 'Acompañante: lea la instrucción con calma, permita que la persona responda sin apuro y evite indicar la respuesta.'
      : '';
    const message = `${instructionFor()} Puedes usar “Practicar primero” para ensayar con menos elementos. También puedes regresar a Inicio sin perder el progreso ya guardado. ${companion}`;
    window.alert(message);
  });
  document.getElementById('memora-practice')?.addEventListener('click', startPractice);
  document.getElementById('memora-pause')?.addEventListener('click', togglePause);
  document.getElementById('memora-interface-size')?.addEventListener('change', render);
  document.getElementById('memora-animation-speed')?.addEventListener('change', render);
  document.getElementById('memora-companion-mode')?.addEventListener('change', render);
  document.getElementById('memora-observe-time')?.addEventListener('change', () => {
    if(state.phase === 'idle' || state.phase === 'complete') render();
  });
  document.getElementById('memora-reset-progress')?.addEventListener('click', () => {
    state.progress = { sessions:0, hits:0, misses:0, bestStreak:0, lastLevel:'' };
    state.streak = 0;
    saveProgress();
    updateSummary();
  });
  render();
}
