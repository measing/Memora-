import { escapeHTML } from './utils.js?v=71';
import { getCurrentSession } from './account.js?v=20';
import { loadFirebaseHistory, saveFirebaseHistory, saveFirebaseProgress } from './firebase-service.js?v=10';

const STORAGE_KEY = 'memoraplusProgress';
const HISTORY_KEY = 'memoraplusHistory';
const HISTORY_LIMIT = 50;
const SPEEDS = {
  slow:{ preview:12000, sequence:6200, feedback:1400 },
  normal:{ preview:10000, sequence:4700, feedback:1000 },
  fast:{ preview:7000, sequence:3400, feedback:760 }
};

const LEVELS = [
  {
    id:'visual',
    tag:'Nivel 1',
    title:'Memoria visual simple',
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
    tag:'Nivel 2',
    title:'Asociación semántica',
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
    tag:'Nivel 3',
    title:'Memoria temporal',
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
    tag:'Nivel 4',
    title:'Secuencias',
    prompt:'Mira el orden y reprodúcelo.',
    explanation:'Mira una secuencia de colores, memoriza el orden y luego presiona los colores en la misma secuencia.',
    type:'sequence',
    sequence:['red', 'green', 'blue', 'yellow', 'green'],
    swatches:{
      red:{ label:'Rojo', color:'#f43f5e' },
      green:{ label:'Verde', color:'#22c55e' },
      blue:{ label:'Azul', color:'#3b82f6' },
      yellow:{ label:'Amarillo', color:'#facc15' }
    }
  },
  {
    id:'daily',
    tag:'Nivel 5',
    title:'Memoria cotidiana chilena',
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
  sequenceTimer:null,
  flipInIds:[],
  flipOutIds:[],
  animateGameEntry:false,
  summaryRecorded:false,
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
  try{
    const history = JSON.parse(localStorage.getItem(historyStorageKey()) || '[]');
    return normalizeHistory(history);
  }catch{
    return [];
  }
}

function saveHistory(history){
  const cleanHistory = normalizeHistory(history);
  localStorage.setItem(historyStorageKey(), JSON.stringify(cleanHistory));
  const session = getCurrentSession();
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
    h:numberOrZero(item.h ?? item.hits),
    m:numberOrZero(item.m ?? item.misses),
    a:numberOrZero(item.a ?? item.accuracy)
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
        <p>Completa los 5 ejercicios para que se guarde tu primera partida.</p>
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <section class="memora-history-stats compact" aria-label="Partidas guardadas">
      <div><span>Partidas registradas</span><strong>${history.length}</strong></div>
    </section>

    <section class="memora-history-section">
      <h3>Partidas de los 5 ejercicios</h3>
      <div class="memora-history-sessions detailed">
        ${history.map((item, index) => `
          <article class="memora-history-session-card">
            <div class="memora-history-session-head"><div><strong>Partida ${history.length - index}</strong><span>${formatHistoryDate(item.completedAt)}</span></div><p>${item.totals.hits} aciertos - ${item.totals.misses} errores - ${item.totals.accuracy}% precision</p></div>
            <div class="memora-history-session-levels">${LEVELS.map((levelItem, levelIndex) => { const result = item.levels[levelIndex] || normalizeLevelResult(); return `<div><span>${escapeHTML(levelItem.tag)}</span><strong>${escapeHTML(levelItem.title)}</strong><p>${result.h} aciertos - ${result.m} errores - ${result.a}% precision</p></div>`; }).join('')}</div>
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
            <p>${item.totals?.hits || 0} aciertos · ${item.totals?.misses || 0} errores · ${item.totals?.accuracy || 0}% precision</p>
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

function shuffle(items){
  const copy = [...items];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function level(){
  return LEVELS[state.levelIndex] || LEVELS[0];
}

function speed(){
  const key = document.getElementById('memora-speed')?.value || 'normal';
  return SPEEDS[key] || SPEEDS.normal;
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
        <p>Realiza 5 niveles de memoria, asociación, memoria temporal, secuencias y vida cotidiana. Al terminar recibirás un resumen de tu sesión.</p>
      </div>
      <button class="memora-guide-primary" id="memora-guide-start" type="button">Empezar ejercicios</button>
    `;
    document.getElementById('memora-guide-start')?.addEventListener('click', () => {
      state.guidedResults = [];
      state.levelIndex = 0;
      state.summaryRecorded = false;
      resetSession();
      transitionToMode('intro');
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
        <div><span>Aciertos</span><strong>${totals.hits}</strong></div>
        <div><span>Errores</span><strong>${totals.misses}</strong></div>
        <div><span>Precisión</span><strong>${accuracy}%</strong></div>
      </div>
      <div class="memora-result-list">
        ${state.guidedResults.map(item => `
          <article>
            <span>${escapeHTML(item.tag)}</span>
            <strong>${escapeHTML(item.title)}</strong>
            <p>${item.hits} aciertos · ${item.misses} errores · ${item.accuracy}% precisión</p>
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
  guide.className = 'memora-guide memora-guide-level';
  guide.innerHTML = `
    <div class="memora-guide-copy">
      <span>${escapeHTML(current.tag)}</span>
      <h1>${escapeHTML(current.title)}</h1>
      <p>${escapeHTML(current.explanation)}</p>
    </div>
    <div class="memora-level-preview">
      <span>Objetivo</span>
      <strong>${exerciseTotal(current)} respuestas</strong>
    </div>
    <button class="memora-guide-primary" id="memora-guide-begin" type="button">Comenzar ejercicio</button>
  `;
  document.getElementById('memora-guide-begin')?.addEventListener('click', () => transitionToExercise());
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
  guide.classList.remove('memora-guide-screen-enter');
  guide.classList.add('memora-guide-screen-exit');
  window.setTimeout(startExercise, 280);
}

function returnToLobby(){
  const wantsReturn = window.confirm('¿Seguro que quieres regresar al lobby? Se borrará todo el avance de este recorrido.');
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
  document.getElementById('memora-plus-app')?.classList.toggle('large-cards', document.getElementById('memora-large-mode')?.checked !== false);
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
  if(nextButton){
    nextButton.hidden = state.phase !== 'complete';
    nextButton.textContent = state.levelIndex >= LEVELS.length - 1 ? 'Ver resumen' : 'Siguiente nivel';
  }
  if(repeatButton){
    repeatButton.hidden = state.phase === 'complete';
  }
}

function renderBoard(){
  const board = document.getElementById('memora-board');
  const sequenceControls = document.getElementById('memora-sequence-controls');
  if(!board || !sequenceControls) return;
  const current = level();
  board.className = `memora-board memora-board-${current.type}`;
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

  board.innerHTML = state.cards.map(card => {
    const visible = card.flipped || card.matched || state.phase === 'preview';
    const status = card.matched ? 'matched' : visible ? 'visible' : '';
    const flipIn = state.flipInIds.includes(card.id);
    const flipOut = state.flipOutIds.includes(card.id);
    return `
      <button class="memora-card ${status} ${flipIn ? 'flip-in' : ''} ${flipOut ? 'flip-out' : ''}" type="button" data-card-id="${escapeHTML(card.id)}" ${card.matched || state.locked ? 'disabled' : ''}>
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
        return `<span class="memora-sequence-dot" style="--dot:${swatch.color}" aria-label="${escapeHTML(swatch.label)}"></span>`;
      }).join('')}
    </div>
  `;

  controls.innerHTML = Object.entries(current.swatches).map(([key, swatch]) => `
    <button class="memora-color-button" type="button" data-sequence-key="${escapeHTML(key)}" style="--dot:${swatch.color}">
      <span></span>${escapeHTML(swatch.label)}
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
  const current = level();
  state.appMode = 'exercise';
  state.phase = 'preview';
  state.cards = current.type === 'temporal'
    ? shuffle(current.items).map((face, index) => ({ id:`temporal-${index}`, pairId:`temporal-${index}`, face, flipped:true, matched:false }))
    : current.type === 'pairs'
      ? buildPairCards(current)
      : [];
  state.temporalQueue = current.type === 'temporal' ? shuffle(state.cards.map(card => card.id)) : [];
  state.progress.sessions++;
  state.progress.lastLevel = current.title;
  saveProgress();

  if(current.type === 'pairs'){
    setText('memora-prompt', 'Observa las cartas. En unos segundos se ocultaran para comenzar.');
    state.sequenceTimer = setTimeout(() => {
      if(level().id !== current.id || state.phase !== 'preview') return;
      state.flipOutIds = state.cards.map(card => card.id);
      state.phase = 'play';
      state.locked = true;
      render();
      unlockAfterFlip(current.id);
    }, Math.max(3600, Math.round(speed().preview * .55)));
  }else if(current.type === 'temporal'){
    setTemporalQuestion();
    setText('memora-prompt', 'Observa bien la ubicación de las 9 cartas.');
    setTimeout(() => {
      if(level().id !== current.id || state.phase !== 'preview') return;
      state.cards.forEach(card => card.flipped = false);
      state.flipOutIds = state.cards.map(card => card.id);
      state.phase = 'play';
      state.locked = true;
      nextTemporalQuestion();
      render();
      unlockAfterFlip(current.id);
    }, speed().preview);
  }else if(current.type === 'sequence'){
    setText('memora-prompt', 'Memoriza el orden de los colores.');
    state.sequenceTimer = setTimeout(() => {
      if(level().id !== current.id || state.phase !== 'preview') return;
      state.phase = 'input';
      setText('memora-prompt', 'Reproduce la secuencia.');
      render();
    }, speed().sequence);
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
    }, speed().feedback + 600);
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
    if(state.matched === level().pairs.length) completeExercise();
  }else{
    recordMiss();
    setTimeout(() => {
      state.flipOutIds = [first.id, second.id];
      first.flipped = false;
      second.flipped = false;
      state.flipped = [];
      render();
      unlockAfterFlip(level().id);
    }, speed().feedback);
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
  }else{
    recordMiss();
    const target = state.cards.find(card => card.id === state.temporalTarget);
    if(target){
      target.flipped = true;
      state.flipInIds = target.id === selected.id ? [selected.id] : [selected.id, target.id];
    }
  }
  setTimeout(() => {
    state.flipOutIds = state.cards.filter(card => !card.matched && card.flipped).map(card => card.id);
    state.cards.forEach(card => {
      if(!card.matched) card.flipped = false;
    });
    state.locked = false;
    if(state.matched >= level().items.length || !state.temporalQueue.length){
      completeExercise();
    }else{
      nextTemporalQuestion();
      render();
    }
  }, speed().feedback);
  render();
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
    setText('memora-prompt', 'Secuencia distinta. Puedes repetir la muestra.');
    setTimeout(() => {
      state.sequenceInput = [];
      state.matched = 0;
      state.locked = false;
      render();
    }, speed().feedback);
  }
  render();
}

function recordHit(){
  state.hits++;
  state.progress.hits++;
  state.streak++;
  state.progress.bestStreak = Math.max(state.progress.bestStreak, state.streak);
  saveProgress();
  updateStats();
}

function recordMiss(){
  state.misses++;
  state.progress.misses++;
  state.streak = 0;
  saveProgress();
  updateStats();
}

function completeExercise(){
  const current = level();
  const result = currentExerciseResult(current);
  state.guidedResults.push(result);
  state.phase = 'complete';
  state.locked = false;
  setTemporalQuestion();
  setText('memora-prompt', 'Ejercicio completado. Presiona el botón verde para continuar.');
  saveProgress();
  render();
}

function goToNextLevel(){
  if(state.phase !== 'complete') return;
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
    if(event.target.closest('#memora-history-close') || event.target.id === 'memora-history-modal'){
      closeHistoryModal();
    }
  });
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape') closeHistoryModal();
  });
  document.getElementById('memora-start')?.addEventListener('click', startExercise);
  document.getElementById('memora-back-lobby')?.addEventListener('click', returnToLobby);
  document.getElementById('memora-repeat')?.addEventListener('click', repeatSample);
  document.getElementById('memora-next-level')?.addEventListener('click', goToNextLevel);
  document.getElementById('memora-large-mode')?.addEventListener('change', render);
  document.getElementById('memora-speed')?.addEventListener('change', () => {
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
