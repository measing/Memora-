export function normalizeNickname(name){
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9_]/g,'');
}

export function formatMoney(n){
  return '$' + Number(n || 0).toLocaleString('es-CL');
}

export function wait(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function shuffle(arr){
  const copy = [...arr];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function escapeHTML(str){
  return String(str ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));
}
