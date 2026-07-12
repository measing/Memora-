import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js?v=2';

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
  if(firestoreDb){
    const userRef = firestoreModule.doc(firestoreDb, 'users', user.uid);
    const previous = await firestoreModule.getDoc(userRef);
    const previousData = previous.exists() ? previous.data() : {};
    await firestoreModule.setDoc(userRef, {
      ...previousData,
      ...profile,
      createdAt:previousData.createdAt || profile.createdAt
    }, { merge:true });
    return profile;
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
    saveFirestoreDocument('users', session.id, {
      uid:session.id,
      email:session.email,
      name:session.name,
      provider:'email',
      createdAt:Date.now(),
      updatedAt:Date.now()
    }, session.idToken).catch(() => {});
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

export async function saveFirebaseProgress(session, progress){
  if(!isFirebaseConfigured() || !session?.id) return;
  if(session.idToken){
    await saveFirestoreDocument('progress', session.id, {
      ...progress,
      updatedAt:Date.now()
    }, session.idToken);
    return;
  }
  const { realtimeDb, firestoreDb } = await initFirebaseData();
  const { databaseModule, firestoreModule } = await loadFirebaseDataModules();
  const payload = {
    ...progress,
    updatedAt:Date.now()
  };
  if(firestoreDb){
    await firestoreModule.setDoc(firestoreModule.doc(firestoreDb, 'progress', session.id), payload, { merge:true });
    return;
  }
  if(realtimeDb){
    await databaseModule.set(databaseModule.ref(realtimeDb, `progress/${session.id}`), payload);
  }
}
