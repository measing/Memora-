import { escapeHTML } from './utils.js?v=71';

const STORAGE_KEY = 'memoraplusProgress';
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
    type:'pairs',
    pairs:[
      { id:'apple', faces:['🍎 Manzana', '🍎 Manzana'] },
      { id:'cup', faces:['☕ Taza', '☕ Taza'] },
      { id:'house', faces:['🏠 Casa', '🏠 Casa'] },
      { id:'flower', faces:['🌼 Flor', '🌼 Flor'] },
      { id:'key', faces:['🔑 Llave', '🔑 Llave'] },
      { id:'radio', faces:['📻 Radio', '📻 Radio'] }
    ]
  },
  {
    id:'semantic',
    tag:'Nivel 2',
    title:'Asociación semántica',
    prompt:'Une objetos que se relacionan.',
    type:'pairs',
    pairs:[
      { id:'bread', faces:['🥖 Pan', '🧈 Mantequilla'] },
      { id:'rain', faces:['☂️ Paraguas', '🌧️ Lluvia'] },
      { id:'door', faces:['🔑 Llave', '🚪 Puerta'] },
      { id:'mate', faces:['🧉 Mate', '🫖 Termo'] },
      { id:'bus', faces:['🚌 Micro', '🚏 Paradero'] },
      { id:'hammer', faces:['🔨 Martillo', '📌 Clavo'] }
    ]
  },
  {
    id:'temporal',
    tag:'Nivel 3',
    title:'Memoria temporal',
    prompt:'Observa la muestra durante 10 segundos. Luego marca donde estaba cada elemento.',
    type:'temporal',
    items:['🍎 Manzana', '🔑 Llave', '📻 Radio', '🧉 Mate', '🚂 Tren', '🧰 Caja']
  },
  {
    id:'sequence',
    tag:'Nivel 4',
    title:'Secuencias',
    prompt:'Mira el orden y reprodúcelo.',
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

const state = {
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
  streak:0,
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
  const total = current.type === 'sequence'
    ? current.sequence.length
    : current.type === 'temporal'
      ? current.items.length
      : current.pairs.length;
  setText('memora-hits', state.hits);
  setText('memora-misses', state.misses);
  setText('memora-progress', `${state.matched}/${total}`);
  updateSummary();
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = String(value);
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

function render(){
  const current = level();
  document.getElementById('memora-plus-app')?.classList.toggle('large-cards', document.getElementById('memora-large-mode')?.checked !== false);
  setText('memora-level-tag', current.tag);
  setText('memora-level-title', current.title);
  setText('memora-prompt', current.prompt);
  renderLevelList();
  renderBoard();
  updateStats();
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
    return `
      <button class="memora-card ${status}" type="button" data-card-id="${escapeHTML(card.id)}" ${card.matched || state.locked ? 'disabled' : ''}>
        <span>${visible ? escapeHTML(card.face) : '?'}</span>
      </button>
    `;
  }).join('');

  board.querySelectorAll('[data-card-id]').forEach(button => {
    button.addEventListener('click', () => handleCardClick(button.dataset.cardId));
  });
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

function startExercise(){
  resetSession();
  const current = level();
  state.phase = current.type === 'pairs' ? 'play' : 'preview';
  state.cards = current.type === 'temporal'
    ? shuffle(current.items).map((face, index) => ({ id:`temporal-${index}`, pairId:`temporal-${index}`, face, flipped:true, matched:false }))
    : current.type === 'pairs'
      ? buildPairCards(current)
      : [];
  state.temporalQueue = current.type === 'temporal' ? shuffle(state.cards.map(card => card.id)) : [];
  state.progress.sessions++;
  state.progress.lastLevel = current.title;
  saveProgress();

  if(current.type === 'temporal'){
    setText('memora-prompt', 'Observa la ubicación de cada elemento.');
    setTimeout(() => {
      if(level().id !== current.id || state.phase !== 'preview') return;
      state.cards.forEach(card => card.flipped = false);
      state.phase = 'play';
      nextTemporalQuestion();
      render();
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
    state.cards.forEach(card => {
      if(!card.matched) card.flipped = true;
    });
    state.locked = true;
    render();
    setTimeout(() => {
      state.cards.forEach(card => {
        if(!card.matched) card.flipped = false;
      });
      state.locked = false;
      render();
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
      first.flipped = false;
      second.flipped = false;
      state.flipped = [];
      state.locked = false;
      render();
    }, speed().feedback);
  }
}

function nextTemporalQuestion(){
  state.temporalTarget = state.temporalQueue.shift() || null;
  const target = state.cards.find(card => card.id === state.temporalTarget);
  setText('memora-prompt', target ? `¿Dónde estaba: ${target.face}?` : 'Ejercicio terminado.');
}

function handleTemporalClick(cardId){
  if(!state.temporalTarget) return;
  const selected = state.cards.find(card => card.id === cardId);
  if(!selected || selected.matched) return;
  selected.flipped = true;
  state.locked = true;
  if(cardId === state.temporalTarget){
    selected.matched = true;
    state.matched++;
    recordHit();
  }else{
    recordMiss();
    const target = state.cards.find(card => card.id === state.temporalTarget);
    if(target) target.flipped = true;
  }
  setTimeout(() => {
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
  state.phase = 'complete';
  state.locked = false;
  setText('memora-prompt', 'Ejercicio completado. Los datos quedaron en el panel profesional.');
  saveProgress();
  render();
}

export function initMemoraPlus(){
  if(!document.getElementById('memora-plus-app')) return;
  document.getElementById('memora-start')?.addEventListener('click', startExercise);
  document.getElementById('memora-repeat')?.addEventListener('click', repeatSample);
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
