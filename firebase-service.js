import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js?v=3';

let firebaseApp = null;
let firebaseAuth = null;
let firebaseRealtimeDb = null;
let firebaseFirestoreDb = null;
let firebaseCoreModules = null;
let firebaseDataModules = null;

export function hasFirebaseConfig(){
  return isFirebaseConfigured();
}

async function loadFirebaseCoreModules(){
  if(firebaseCoreModules) return firebaseCoreModules;
  const [appModule, authModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js')
  ]);
  firebaseCoreModules = { appModule, authModule };
  return firebaseCoreModules;
}

async function loadFirebaseDataModules(){
  if(firebaseDataModules) return firebaseDataModules;
  const [databaseModule, firestoreModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
  ]);
  firebaseDataModules = { databaseModule, firestoreModule };
  return firebaseDataModules;
}

async function initFirebase(){
  if(!isFirebaseConfigured()) return null;
  if(firebaseApp && firebaseAuth){
    return {
      app:firebaseApp,
      auth:firebaseAuth
    };
  }

  const { appModule, authModule } = await loadFirebaseCoreModules();
  firebaseApp = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
  firebaseAuth = authModule.getAuth(firebaseApp);
  return {
    app:firebaseApp,
    auth:firebaseAuth
  };
}

async function initFirebaseData(){
  const { app } = await initFirebase();
  if(firebaseRealtimeDb || firebaseFirestoreDb){
    return {
      realtimeDb:firebaseRealtimeDb,
      firestoreDb:firebaseFirestoreDb
    };
  }
  const { databaseModule, firestoreModule } = await loadFirebaseDataModules();
  firebaseRealtimeDb = firebaseConfig.databaseURL ? databaseModule.getDatabase(app) : null;
  firebaseFirestoreDb = firestoreModule.getFirestore(app);
  return {
    realtimeDb:firebaseRealtimeDb,
    firestoreDb:firebaseFirestoreDb
  };
}

function withTimeout(promise, milliseconds = 12000){
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Firebase está tardando demasiado en responder. Revisa tu conexión e inténtalo otra vez.'));
    }, milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function mapFirebaseError(error){
  const messages = {
    'auth/email-already-in-use':'Ese correo ya tiene una cuenta.',
    'auth/invalid-email':'Ingresa un correo válido.',
    'auth/invalid-credential':'Correo o contraseña incorrectos. Si es tu primera vez, usa Crear cuenta o Continuar con Google.',
    'auth/wrong-password':'Contraseña incorrecta.',
    'auth/user-not-found':'No existe una cuenta con ese correo. Primero crea la cuenta o entra con Google.',
    'auth/popup-closed-by-user':'Se cerró la ventana de Google antes de terminar.',
    'auth/popup-blocked':'El navegador bloqueó la ventana de Google.',
    'auth/operation-not-allowed':'Activa este proveedor en Firebase Authentication.',
    'auth/unauthorized-domain':'Autoriza este dominio en Firebase Authentication. Agrega este sitio en Authorized domains.',
    'auth/network-request-failed':'No se pudo conectar con Firebase. Revisa internet o la configuración.',
    'permission-denied':'Revisa las reglas de Firestore para permitir usuarios autenticados.',
    'failed-precondition':'Firestore necesita un índice o configuración adicional para esta operación.'
  };
  return new Error(messages[error?.code] || error?.message || 'No se pudo completar la acción.');
}

function providerName(user){
  const providerId = user?.providerData?.[0]?.providerId || '';
  return providerId.includes('google') ? 'google' : 'email';
}

function sessionFromUser(user, profile = {}){
  const name = profile.name || user.displayName || (user.email || 'Usuario').split('@')[0];
  return {
    id:user.uid,
    email:user.email || profile.email || '',
    name,
    provider:profile.provider || providerName(user),
    idToken:profile.idToken || '',
    refreshToken:profile.refreshToken || '',
    tokenExpiresAt:profile.tokenExpiresAt || 0,
    signedAt:Date.now(),
    source:'firebase'
  };
}

function sessionFromAuthPayload(payload, profile = {}){
  const email = payload.email || profile.email || '';
  const name = profile.name || payload.displayName || email.split('@')[0] || 'Usuario';
  return {
    id:payload.localId,
    email,
    name,
    provider:profile.provider || 'email',
    idToken:payload.idToken || '',
    refreshToken:payload.refreshToken || '',
    tokenExpiresAt:Date.now() + (Number(payload.expiresIn || 3600) * 1000),
    signedAt:Date.now(),
    source:'firebase'
  };
}

function mapAuthRestError(code){
  const messages = {
    EMAIL_EXISTS:'Ese correo ya tiene una cuenta.',
    EMAIL_NOT_FOUND:'No existe una cuenta con ese correo. Primero crea la cuenta o entra con Google.',
    INVALID_PASSWORD:'Contraseña incorrecta.',
    INVALID_LOGIN_CREDENTIALS:'Correo o contraseña incorrectos. Si es tu primera vez, usa Crear cuenta o Continuar con Google.',
    INVALID_EMAIL:'Ingresa un correo válido.',
    WEAK_PASSWORD:'La contraseña debe tener al menos 6 caracteres.',
    TOO_MANY_ATTEMPTS_TRY_LATER:'Firebase bloqueó temporalmente este acceso por muchos intentos. Espera un momento e inténtalo otra vez.'
  };
  return new Error(messages[code] || 'No se pudo completar la acción.');
}

async function authRequest(action, payload){
  const endpoint = `https://identitytoolkit.googleapis.com/v1/${action}?key=${firebaseConfig.apiKey}`;
  const response = await withTimeout(fetch(endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(payload)
  }), 10000);
  const data = await response.json().catch(() => ({}));
  if(!response.ok){
    throw mapAuthRestError(data?.error?.message);
  }
  return data;
}

async function refreshIdToken(session){
  if(!session?.refreshToken) return session?.idToken || '';
  if(session.idToken && Number(session.tokenExpiresAt || 0) > Date.now() + 60000){
    return session.idToken;
  }
  const response = await withTimeout(fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body:new URLSearchParams({
      grant_type:'refresh_token',
      refresh_token:session.refreshToken
    })
  }), 10000);
  const data = await response.json().catch(() => ({}));
  if(!response.ok) return session.idToken || '';
  return data.id_token || session.idToken || '';
}

function firestoreValue(value){
  if(value === null || value === undefined) return { nullValue:null };
  if(typeof value === 'boolean') return { booleanValue:value };
  if(typeof value === 'number'){
    return Number.isInteger(value) ? { integerValue:String(value) } : { doubleValue:value };
  }
  if(typeof value === 'string') return { stringValue:value };
  if(Array.isArray(value)){
    return { arrayValue:{ values:value.map(item => firestoreValue(item)) } };
  }
  if(typeof value === 'object'){
    return {
      mapValue:{
        fields:Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]))
      }
    };
  }
  return { stringValue:String(value) };
}

function firestorePlainValue(value){
  if(!value || typeof value !== 'object') return null;
  if('nullValue' in value) return null;
  if('booleanValue' in value) return Boolean(value.booleanValue);
  if('integerValue' in value) return Number(value.integerValue);
  if('doubleValue' in value) return Number(value.doubleValue);
  if('stringValue' in value) return value.stringValue;
  if('timestampValue' in value) return value.timestampValue;
  if('arrayValue' in value){
    return (value.arrayValue.values || []).map(item => firestorePlainValue(item));
  }
  if('mapValue' in value){
    return firestorePlainFields(value.mapValue.fields || {});
  }
  return null;
}

function firestorePlainFields(fields = {}){
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestorePlainValue(value)]));
}

function firestoreFields(data){
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]));
}

async function saveFirestoreDocument(collection, id, data, idToken){
  if(!idToken || !firebaseConfig.projectId) return;
  const documentPath = `${collection}/${encodeURIComponent(id)}`;
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${documentPath}`;
  await fetch(url, {
    method:'PATCH',
    headers:{
      'Authorization':`Bearer ${idToken}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({ fields:firestoreFields(data) })
  });
}

async function saveRealtimeDocument(collection, id, data, idToken = ''){
  if(!firebaseConfig.databaseURL) return;
  const baseUrl = firebaseConfig.databaseURL.replace(/\/$/, '');
  const authQuery = idToken ? `?auth=${encodeURIComponent(idToken)}` : '';
  const response = await fetch(`${baseUrl}/${collection}/${encodeURIComponent(id)}.json${authQuery}`, {
    method:'PATCH',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(data)
  });
  if(!response.ok) throw new Error('No se pudo guardar en Realtime Database.');
}

async function getProfile(uid){
  const { realtimeDb, firestoreDb } = await initFirebaseData();
  const { databaseModule, firestoreModule } = await loadFirebaseDataModules();
  if(firestoreDb){
    const snapshot = await firestoreModule.getDoc(firestoreModule.doc(firestoreDb, 'users', uid));
    return snapshot.exists() ? snapshot.data() : null;
  }
  if(realtimeDb){
    const snapshot = await databaseModule.get(databaseModule.ref(realtimeDb, `users/${uid}`));
    return snapshot.exists() ? snapshot.val() : null;
  }
  return null;
}

async function saveProfile(user, extra = {}){
  const { realtimeDb, firestoreDb } = await initFirebaseData();
  const profile = {
    uid:user.uid,
    email:user.email || extra.email || '',
    name:extra.name || user.displayName || (user.email || 'Usuario').split('@')[0],
    provider:extra.provider || providerName(user),
    updatedAt:Date.now(),
    createdAt:extra.createdAt || Date.now()
  };

  const { databaseModule, firestoreModule } = await loadFirebaseDataModules();
  let savedProfile = false;
  if(firestoreDb){
    const userRef = firestoreModule.doc(firestoreDb, 'users', user.uid);
    const previous = await firestoreModule.getDoc(userRef);
    const previousData = previous.exists() ? previous.data() : {};
    await firestoreModule.setDoc(userRef, {
      ...previousData,
      ...profile,
      createdAt:previousData.createdAt || profile.createdAt
    }, { merge:true });
    savedProfile = true;
  }
  if(realtimeDb){
    const userRef = databaseModule.ref(realtimeDb, `users/${user.uid}`);
    const previous = await databaseModule.get(userRef);
    const previousData = previous.exists() ? previous.val() : {};
    await databaseModule.set(userRef, {
      ...previousData,
      ...profile,
      createdAt:previousData.createdAt || profile.createdAt
    });
    savedProfile = true;
  }
  if(!savedProfile && user.uid){
    await saveRealtimeDocument('users', user.uid, profile, extra.idToken || '');
  }
  return profile;
}

export async function getFirebaseSession(){
  if(!isFirebaseConfigured()) return null;
  const { auth } = await initFirebase();
  const user = auth.currentUser;
  if(!user) return null;
  const profile = await getProfile(user.uid).catch(() => null);
  return sessionFromUser(user, profile || {});
}

export async function createFirebaseAccount({ email, password, name }){
  try{
    const payload = await authRequest('accounts:signUp', {
      email,
      password,
      returnSecureToken:true
    });
    const session = sessionFromAuthPayload(payload, { name, provider:'email' });
    authRequest('accounts:update', {
      idToken:session.idToken,
      displayName:name,
      returnSecureToken:false
    }).catch(() => {});
    const profile = {
      uid:session.id,
      email:session.email,
      name:session.name,
      provider:'email',
      createdAt:Date.now(),
      updatedAt:Date.now()
    };
    Promise.allSettled([
      saveFirestoreDocument('users', session.id, profile, session.idToken),
      saveRealtimeDocument('users', session.id, profile, session.idToken)
    ]);
    return session;
  }catch(error){
    throw error?.message ? error : mapFirebaseError(error);
  }
}

export async function loginFirebase({ email, password }){
  try{
    const payload = await authRequest('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken:true
    });
    return sessionFromAuthPayload(payload, { provider:'email' });
  }catch(error){
    throw error?.message ? error : mapFirebaseError(error);
  }
}

export async function continueWithGoogleFirebase(){
  try{
    const { auth } = await initFirebase();
    const { authModule } = await loadFirebaseCoreModules();
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt:'select_account' });
    const result = await withTimeout(authModule.signInWithPopup(auth, provider), 20000);
    const idToken = await result.user.getIdToken().catch(() => '');
    saveProfile(result.user, { provider:'google' }).catch(() => {});
    return sessionFromUser(result.user, { provider:'google', idToken });
  }catch(error){
    throw mapFirebaseError(error);
  }
}

export async function signOutFirebase(){
  if(!isFirebaseConfigured()) return;
  const { auth } = await initFirebase();
  const { authModule } = await loadFirebaseCoreModules();
  await authModule.signOut(auth);
}

export async function saveFirebaseUserSession(session){
  if(!isFirebaseConfigured() || !session?.id) return;
  const profile = {
    uid:session.id,
    email:session.email || '',
    name:session.name || 'Usuario',
    provider:session.provider || 'email',
    updatedAt:Date.now(),
    createdAt:session.signedAt || Date.now()
  };
  if(session.idToken){
    await Promise.allSettled([
      saveFirestoreDocument('users', session.id, profile, session.idToken),
      saveRealtimeDocument('users', session.id, profile, session.idToken)
    ]);
    return;
  }
  const { realtimeDb, firestoreDb } = await initFirebaseData();
  const { databaseModule, firestoreModule } = await loadFirebaseDataModules();
  if(firestoreDb){
    await firestoreModule.setDoc(firestoreModule.doc(firestoreDb, 'users', session.id), profile, { merge:true });
  }
  if(realtimeDb){
    await databaseModule.set(databaseModule.ref(realtimeDb, `users/${session.id}`), profile);
  }
}

export async function saveFirebaseProgress(session, progress){
  if(!isFirebaseConfigured() || !session?.id) return;
  const payload = {
    ...progress,
    updatedAt:Date.now()
  };
  if(session.idToken){
    await Promise.allSettled([
      saveFirestoreDocument('progress', session.id, payload, session.idToken),
      saveRealtimeDocument('progress', session.id, payload, session.idToken)
    ]);
    return;
  }
  const { realtimeDb, firestoreDb } = await initFirebaseData();
  const { databaseModule, firestoreModule } = await loadFirebaseDataModules();
  if(firestoreDb){
    await firestoreModule.setDoc(firestoreModule.doc(firestoreDb, 'progress', session.id), payload, { merge:true });
  }
  if(realtimeDb){
    await databaseModule.set(databaseModule.ref(realtimeDb, `progress/${session.id}`), payload);
  }
}

export async function saveFirebaseHistory(session, history){
  if(!isFirebaseConfigured() || !session?.id) return;
  const cleanHistory = Array.isArray(history) ? history : [];
  const payload = {
    totalSessions:cleanHistory.length,
    sessions:cleanHistory,
    updatedAt:Date.now()
  };
  if(session.idToken){
    await Promise.allSettled([
      saveFirestoreDocument('history', session.id, payload, session.idToken),
      saveRealtimeDocument('history', session.id, payload, session.idToken)
    ]);
    return;
  }
  const { realtimeDb, firestoreDb } = await initFirebaseData();
  const { databaseModule, firestoreModule } = await loadFirebaseDataModules();
  if(firestoreDb){
    await firestoreModule.setDoc(firestoreModule.doc(firestoreDb, 'history', session.id), payload, { merge:true });
  }
  if(realtimeDb){
    await databaseModule.set(databaseModule.ref(realtimeDb, `history/${session.id}`), payload);
  }
}

function normalizeHistorySessions(data){
  const sessions = Array.isArray(data) ? data : data?.sessions;
  if(Array.isArray(sessions)) return sessions;
  if(sessions && typeof sessions === 'object'){
    return Object.values(sessions)
      .filter(Boolean)
      .sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0));
  }
  return [];
}

export async function loadFirebaseHistory(session){
  if(!isFirebaseConfigured() || !session?.id) return [];
  const idToken = await refreshIdToken(session).catch(() => session.idToken || '');

  if(firebaseConfig.databaseURL){
    try{
      const baseUrl = firebaseConfig.databaseURL.replace(/\/$/, '');
      const authQuery = idToken ? `?auth=${encodeURIComponent(idToken)}` : '';
      const response = await withTimeout(fetch(`${baseUrl}/history/${encodeURIComponent(session.id)}.json${authQuery}`), 10000);
      if(response.ok){
        const data = await response.json().catch(() => null);
        const history = normalizeHistorySessions(data);
        if(history.length) return history;
      }
    }catch{}
  }

  if(firebaseConfig.projectId && idToken){
    try{
      const documentPath = `history/${encodeURIComponent(session.id)}`;
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${documentPath}`;
      const response = await withTimeout(fetch(url, {
        headers:{ 'Authorization':`Bearer ${idToken}` }
      }), 10000);
      if(response.ok){
        const document = await response.json().catch(() => null);
        return normalizeHistorySessions(firestorePlainFields(document?.fields || {}));
      }
    }catch{}
  }

  try{
    const { realtimeDb, firestoreDb } = await initFirebaseData();
    const { databaseModule, firestoreModule } = await loadFirebaseDataModules();
    if(firestoreDb){
      const snapshot = await firestoreModule.getDoc(firestoreModule.doc(firestoreDb, 'history', session.id));
      if(snapshot.exists()){
        const history = normalizeHistorySessions(snapshot.data());
        if(history.length) return history;
      }
    }
    if(realtimeDb){
      const snapshot = await databaseModule.get(databaseModule.ref(realtimeDb, `history/${session.id}`));
      return snapshot.exists() ? normalizeHistorySessions(snapshot.val()) : [];
    }
  }catch{}

  return [];
}
