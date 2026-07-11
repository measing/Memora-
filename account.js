const USERS_KEY = 'memoraPlusUsers';
const SESSION_KEY = 'memoraPlusSession';

function readUsers(){
  try{
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return Array.isArray(users) ? users : [];
  }catch{
    return [];
  }
}

function writeUsers(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalizeEmail(email){
  return String(email || '').trim().toLowerCase();
}

function getInitials(name){
  const clean = String(name || 'Memora+').trim();
  return clean.slice(0, 2).toUpperCase();
}

async function hashPassword(password){
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function setSession(user){
  const session = {
    id:user.id,
    email:user.email,
    name:user.name,
    provider:user.provider,
    signedAt:Date.now()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getCurrentSession(){
  try{
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return session && session.id ? session : null;
  }catch{
    return null;
  }
}

export function signOut(){
  localStorage.removeItem(SESSION_KEY);
}

async function createAccount({ email, password, name, provider = 'email' }){
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(name || '').trim();
  if(!cleanEmail || !cleanEmail.includes('@')) throw new Error('Ingresa un correo válido.');
  if(provider === 'email' && String(password || '').length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  if(!cleanName || cleanName.length < 3) throw new Error('Ingresa un nombre de al menos 3 caracteres.');

  const users = readUsers();
  if(users.some(user => user.email === cleanEmail)) throw new Error('Ese correo ya tiene una cuenta.');
  const user = {
    id:`user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    email:cleanEmail,
    name:cleanName,
    provider,
    passwordHash:provider === 'email' ? await hashPassword(password) : '',
    createdAt:Date.now()
  };
  users.push(user);
  writeUsers(users);
  return setSession(user);
}

async function login({ email, password }){
  const cleanEmail = normalizeEmail(email);
  const user = readUsers().find(item => item.email === cleanEmail);
  if(!user) throw new Error('No existe una cuenta con ese correo.');
  if(user.provider === 'email'){
    const passwordHash = await hashPassword(password || '');
    if(passwordHash !== user.passwordHash) throw new Error('Contraseña incorrecta.');
  }
  return setSession(user);
}

async function continueWithGoogle(emailValue){
  const email = normalizeEmail(emailValue);
  if(!email) throw new Error('Ingresa un correo para continuar con Google.');
  const users = readUsers();
  let user = users.find(item => item.email === email);
  if(!user){
    user = {
      id:`google-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      email,
      name:email.split('@')[0] || 'Usuario Google',
      provider:'google',
      passwordHash:'',
      createdAt:Date.now()
    };
    users.push(user);
    writeUsers(users);
  }
  return setSession(user);
}

function setStatus(message, type='info'){
  const status = document.getElementById('auth-status');
  if(!status) return;
  status.textContent = message;
  status.className = `auth-status ${type}`;
}

function setMode(mode){
  const isRegister = mode === 'register';
  const nameRow = document.getElementById('auth-name-row');
  const nameInput = document.getElementById('auth-name');
  const passwordInput = document.getElementById('auth-password');
  const googlePanel = document.getElementById('auth-google-panel');
  document.body.dataset.authMode = mode;
  document.getElementById('auth-login-tab')?.classList.toggle('active', !isRegister);
  document.getElementById('auth-register-tab')?.classList.toggle('active', isRegister);
  if(nameRow){
    nameRow.hidden = !isRegister;
    nameRow.setAttribute('aria-hidden', String(!isRegister));
  }
  if(nameInput){
    nameInput.required = isRegister;
    if(!isRegister) nameInput.value = '';
  }
  if(passwordInput){
    passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
    passwordInput.placeholder = isRegister ? 'Mínimo 6 caracteres' : 'Tu contraseña';
  }
  if(googlePanel) googlePanel.hidden = true;
  const submit = document.getElementById('auth-submit');
  if(submit) submit.textContent = isRegister ? 'Crear cuenta' : 'Ingresar';
  setStatus('');
}

function renderExistingSession(){
  const session = getCurrentSession();
  const panel = document.getElementById('auth-session-panel');
  const form = document.getElementById('auth-form');
  if(!panel || !form) return;
  panel.hidden = !session;
  form.hidden = !!session;
  if(!session) return;
  const avatar = document.getElementById('auth-session-avatar');
  const name = document.getElementById('auth-session-name');
  const email = document.getElementById('auth-session-email');
  if(avatar) avatar.textContent = getInitials(session.name);
  if(name) name.textContent = session.name;
  if(email) email.textContent = session.email;
}

export function initLoginPage(){
  if(!document.body.classList.contains('login-page')) return;
  const params = new URLSearchParams(location.search);
  setMode(params.get('mode') === 'register' ? 'register' : 'login');
  renderExistingSession();

  document.getElementById('auth-login-tab')?.addEventListener('click', () => setMode('login'));
  document.getElementById('auth-register-tab')?.addEventListener('click', () => setMode('register'));
  document.getElementById('auth-google')?.addEventListener('click', () => {
    const panel = document.getElementById('auth-google-panel');
    if(panel) panel.hidden = false;
    document.getElementById('auth-google-email')?.focus();
    setStatus('');
  });
  document.getElementById('auth-google-submit')?.addEventListener('click', async () => {
    try{
      await continueWithGoogle(document.getElementById('auth-google-email')?.value);
      location.href = 'index.html';
    }catch(error){
      setStatus(error.message, 'danger');
    }
  });
  document.getElementById('auth-logout')?.addEventListener('click', () => {
    signOut();
    renderExistingSession();
    setMode('login');
  });
  document.getElementById('auth-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const mode = document.body.dataset.authMode || 'login';
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
    const name = document.getElementById('auth-name')?.value;
    try{
      if(mode === 'register') await createAccount({ email, password, name });
      else await login({ email, password });
      location.href = 'index.html';
    }catch(error){
      setStatus(error.message, 'danger');
    }
  });
}

export function requireSessionForApp(){
  const appHasAccountGate = !!document.getElementById('account-bar');
  if(!appHasAccountGate) return true;
  if(getCurrentSession()) return true;
  location.replace('login.html');
  return false;
}

export function initAccountBar(){
  const bar = document.getElementById('account-bar');
  if(!bar) return;
  const session = getCurrentSession();
  bar.innerHTML = session ? `
    <div class="account-pill">
      <span class="account-avatar">${getInitials(session.name)}</span>
      <span>
        <strong>${session.name}</strong>
        <small>${session.provider === 'google' ? 'Google' : 'Cuenta Memora+'}</small>
      </span>
    </div>
    <button class="account-link" id="account-logout" type="button">Salir</button>
  ` : `
    <a class="account-link primary" href="login.html">Ingresar</a>
    <a class="account-link" href="login.html?mode=register">Crear cuenta</a>
  `;
  document.getElementById('account-logout')?.addEventListener('click', () => {
    signOut();
    location.href = 'login.html';
  });
}
