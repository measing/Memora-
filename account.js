import {
  createFirebaseAccount,
  loginFirebase,
  continueWithGoogleFirebase,
  hasFirebaseConfig,
  saveFirebaseUserSession,
  signOutFirebase
} from './firebase-service.js?v=10';

const USERS_KEY = 'memoraPlusUsers';
const SESSION_KEY = 'memoraPlusSession';
const ENTRY_ANIMATION_KEY = 'memoraPlusEntryAnimation';
const GUEST_ACCESS_KEY = 'memoraPlusGuestAccess';
const GUEST_SESSION = { id:'guest', email:'', name:'Invitado', provider:'guest', source:'local' };

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

function storeSession(session){
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function markEntryAnimation(){
  sessionStorage.setItem(ENTRY_ANIMATION_KEY, '1');
}

export function getCurrentSession(){
  try{
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if(session?.provider === 'guest' && sessionStorage.getItem(GUEST_ACCESS_KEY) !== '1'){
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session && session.id ? session : null;
  }catch{
    return null;
  }
}

export function startGuestSession(){
  sessionStorage.setItem(GUEST_ACCESS_KEY, '1');
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...GUEST_SESSION, signedAt:Date.now() }));
  return getCurrentSession();
}

export async function signOut(){
  await signOutFirebase().catch(() => {});
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(GUEST_ACCESS_KEY);
}

async function createLocalAccount({ email, password, name, provider = 'email' }){
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

async function loginLocal({ email, password }){
  const cleanEmail = normalizeEmail(email);
  const user = readUsers().find(item => item.email === cleanEmail);
  if(!user) throw new Error('No existe una cuenta con ese correo.');
  if(user.provider === 'email'){
    const passwordHash = await hashPassword(password || '');
    if(passwordHash !== user.passwordHash) throw new Error('Contraseña incorrecta.');
  }
  return setSession(user);
}

async function continueWithGoogleLocal(emailValue){
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

async function createAccount(data){
  if(hasFirebaseConfig()){
    return storeSession(await createFirebaseAccount(data));
  }
  return createLocalAccount(data);
}

async function login(data){
  if(hasFirebaseConfig()){
    return storeSession(await loginFirebase(data));
  }
  return loginLocal(data);
}

async function continueWithGoogle(emailValue){
  if(hasFirebaseConfig()){
    return storeSession(await continueWithGoogleFirebase());
  }
  return continueWithGoogleLocal(emailValue);
}

function setStatus(message, type='info'){
  const status = document.getElementById('auth-status');
  if(!status) return;
  status.textContent = message;
  status.className = `auth-status ${type}`;
}

function setAuthBusy(isBusy, activeButton, busyText){
  const form = document.getElementById('auth-form');
  const controls = document.querySelectorAll('#auth-form button, #auth-form input');
  form?.setAttribute('aria-busy', String(isBusy));
  controls.forEach(control => {
    control.disabled = isBusy;
  });
  if(!activeButton) return;
  if(!activeButton.dataset.idleHtml) activeButton.dataset.idleHtml = activeButton.innerHTML;
  activeButton.textContent = isBusy ? busyText : activeButton.textContent;
  if(!isBusy){
    activeButton.innerHTML = activeButton.dataset.idleHtml;
    delete activeButton.dataset.idleHtml;
  }
}

function authStatusMessage(error, mode){
  const message = error?.message || 'No se pudo completar la acción.';
  if(message.includes('Authorized domains')){
    return `${message} Para esta página publicada agrega ${location.hostname} en Firebase Authentication.`;
  }
  if(mode === 'login' && (message.includes('incorrectos') || message.includes('No existe'))){
    return 'No pudimos ingresar con esos datos. Si aún no creaste una cuenta, toca Crear cuenta; también puedes comenzar sin cuenta.';
  }
  return message;
}

function renderFirebaseHint(){
  const note = document.querySelector('.auth-google-note');
  if(!note) return;
  note.textContent = hasFirebaseConfig()
    ? 'Acceso conectado a Firebase. Tus sesiones se guardarán en la base de datos del proyecto.'
    : 'Aún falta pegar la configuración de Firebase. Mientras tanto, este acceso queda guardado localmente en este navegador.';
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
  const guestButton = document.getElementById('auth-guest');
  if(!panel || !form) return;
  panel.hidden = !session;
  form.hidden = !!session;
  if(guestButton) guestButton.hidden = !!session && session.provider !== 'guest';
  if(!session) return;
  const avatar = document.getElementById('auth-session-avatar');
  const name = document.getElementById('auth-session-name');
  const email = document.getElementById('auth-session-email');
  if(avatar) avatar.textContent = getInitials(session.name);
  if(name) name.textContent = session.name;
  if(email) email.textContent = session.email;
}

function toggleAccountMenu(forceOpen){
  const menu = document.getElementById('account-menu');
  const button = document.getElementById('account-profile-button');
  if(!menu || !button) return;
  const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : menu.hidden;
  menu.hidden = !nextOpen;
  button.setAttribute('aria-expanded', String(nextOpen));
}

export function initLoginPage(){
  if(!document.body.classList.contains('login-page')) return;
  const params = new URLSearchParams(location.search);
  setMode(params.get('mode') === 'register' ? 'register' : 'login');
  renderExistingSession();
  renderFirebaseHint();

  document.getElementById('auth-guest')?.addEventListener('click', () => {
    startGuestSession();
    markEntryAnimation();
  });

  document.getElementById('auth-login-tab')?.addEventListener('click', () => setMode('login'));
  document.getElementById('auth-register-tab')?.addEventListener('click', () => setMode('register'));
  document.getElementById('auth-google')?.addEventListener('click', () => {
    if(hasFirebaseConfig()){
      const googleButton = document.getElementById('auth-google');
      setAuthBusy(true, googleButton, 'Conectando con Google...');
      continueWithGoogle()
        .then(() => {
          markEntryAnimation();
          location.href = 'index.html';
        })
        .catch(error => {
          setStatus(error.message, 'danger');
          setAuthBusy(false, googleButton);
        });
      return;
    }
    const panel = document.getElementById('auth-google-panel');
    if(panel) panel.hidden = false;
    document.getElementById('auth-google-email')?.focus();
    setStatus('');
  });
  document.getElementById('auth-google-submit')?.addEventListener('click', async () => {
    const googleSubmit = document.getElementById('auth-google-submit');
    try{
      setAuthBusy(true, googleSubmit, 'Entrando...');
      await continueWithGoogle(document.getElementById('auth-google-email')?.value);
      markEntryAnimation();
      location.href = 'index.html';
    }catch(error){
      setStatus(error.message, 'danger');
      setAuthBusy(false, googleSubmit);
    }
  });
  document.getElementById('auth-logout')?.addEventListener('click', () => {
    signOut().then(() => {
      renderExistingSession();
      setMode('login');
    });
  });
  document.getElementById('auth-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const mode = document.body.dataset.authMode || 'login';
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
    const name = document.getElementById('auth-name')?.value;
    const submit = document.getElementById('auth-submit');
    try{
      setAuthBusy(true, submit, mode === 'register' ? 'Creando cuenta...' : 'Ingresando...');
      if(mode === 'register') await createAccount({ email, password, name });
      else await login({ email, password });
      markEntryAnimation();
      location.href = 'index.html';
    }catch(error){
      setStatus(authStatusMessage(error, mode), 'danger');
      setAuthBusy(false, submit);
    }
  });
}

export function playEntryAnimation(){
  if(sessionStorage.getItem(ENTRY_ANIMATION_KEY) !== '1') return;
  sessionStorage.removeItem(ENTRY_ANIMATION_KEY);
  document.body.classList.add('memora-entering');
  window.setTimeout(() => {
    document.body.classList.remove('memora-entering');
  }, 1200);
}

export function requireSessionForApp(){
  const appHasAccountGate = !!document.getElementById('account-bar');
  if(!appHasAccountGate) return true;
  if(!getCurrentSession()){
    location.replace('login.html');
    return false;
  }
  return true;
}

export function initAccountBar(){
  const bar = document.getElementById('account-bar');
  if(!bar) return;
  const session = getCurrentSession();
  if(session?.source === 'firebase'){
    saveFirebaseUserSession(session).catch(() => {});
  }
  const historyButton = session && session.provider !== 'guest'
    ? '<button class="account-history-pill" id="account-history-button" type="button">Historial</button>'
    : '';
  bar.innerHTML = session ? `
    ${historyButton}
    <button class="account-pill account-profile-button" id="account-profile-button" type="button" aria-haspopup="menu" aria-expanded="false">
      <span class="account-avatar">${getInitials(session.name)}</span>
      <span>
        <strong>${session.name}</strong>
        <small>${session.provider === 'guest' ? 'Sin cuenta' : session.provider === 'google' ? 'Google' : 'Cuenta Memora+'}</small>
      </span>
    </button>
    <div class="account-menu" id="account-menu" role="menu" hidden>
      <button class="account-settings-action" id="account-settings" type="button" role="menuitem">Configuración</button>
      ${session.provider === 'guest' ? '<a href="login.html?mode=register" role="menuitem">Crear cuenta</a>' : ''}
      <button id="account-logout" type="button" role="menuitem">${session.provider === 'guest' ? 'Salir al acceso' : 'Cerrar sesión'}</button>
    </div>
  ` : `
    <a class="account-link primary" href="login.html">Ingresar</a>
    <a class="account-link" href="login.html?mode=register">Crear cuenta</a>
  `;
  document.getElementById('account-profile-button')?.addEventListener('click', () => toggleAccountMenu());
  document.getElementById('account-settings')?.addEventListener('click', () => {
    toggleAccountMenu(false);
    document.dispatchEvent(new CustomEvent('memora-open-settings'));
  });
  document.addEventListener('click', event => {
    if(!bar.contains(event.target)) toggleAccountMenu(false);
  });
  document.getElementById('account-logout')?.addEventListener('click', () => {
    signOut().finally(() => {
      location.href = 'login.html';
    });
  });
}
