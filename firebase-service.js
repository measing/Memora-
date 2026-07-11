import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js?v=2';

let firebaseApp = null;
let firebaseAuth = null;
let firebaseRealtimeDb = null;
let firebaseFirestoreDb = null;
let firebaseModules = null;

export function hasFirebaseConfig(){
  return isFirebaseConfigured();
}

async function loadFirebaseModules(){
  if(firebaseModules) return firebaseModules;
  const [appModule, authModule, databaseModule, firestoreModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
  ]);
  firebaseModules = { appModule, authModule, databaseModule, firestoreModule };
  return firebaseModules;
}

async function initFirebase(){
  if(!isFirebaseConfigured()) return null;
  if(firebaseApp && firebaseAuth){
    return {
      app:firebaseApp,
      auth:firebaseAuth,
      realtimeDb:firebaseRealtimeDb,
      firestoreDb:firebaseFirestoreDb
    };
  }

  const { appModule, authModule, databaseModule, firestoreModule } = await loadFirebaseModules();
  firebaseApp = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
  firebaseAuth = authModule.getAuth(firebaseApp);
  firebaseRealtimeDb = firebaseConfig.databaseURL ? databaseModule.getDatabase(firebaseApp) : null;
  firebaseFirestoreDb = firestoreModule.getFirestore(firebaseApp);
  return {
    app:firebaseApp,
    auth:firebaseAuth,
    realtimeDb:firebaseRealtimeDb,
    firestoreDb:firebaseFirestoreDb
  };
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
    signedAt:Date.now(),
    source:'firebase'
  };
}

async function getProfile(uid){
  const { realtimeDb, firestoreDb } = await initFirebase();
  const { databaseModule, firestoreModule } = await loadFirebaseModules();
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
  const { realtimeDb, firestoreDb } = await initFirebase();
  const profile = {
    uid:user.uid,
    email:user.email || extra.email || '',
    name:extra.name || user.displayName || (user.email || 'Usuario').split('@')[0],
    provider:extra.provider || providerName(user),
    updatedAt:Date.now(),
    createdAt:extra.createdAt || Date.now()
  };

  const { databaseModule, firestoreModule } = await loadFirebaseModules();
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
    const { auth } = await initFirebase();
    const { authModule } = await loadFirebaseModules();
    const credential = await authModule.createUserWithEmailAndPassword(auth, email, password);
    await authModule.updateProfile(credential.user, { displayName:name });
    const profile = await saveProfile(credential.user, { name, provider:'email' }).catch(() => ({
      name,
      provider:'email'
    }));
    return sessionFromUser(credential.user, profile);
  }catch(error){
    throw mapFirebaseError(error);
  }
}

export async function loginFirebase({ email, password }){
  try{
    const { auth } = await initFirebase();
    const { authModule } = await loadFirebaseModules();
    const credential = await authModule.signInWithEmailAndPassword(auth, email, password);
    const profile = await getProfile(credential.user.uid).catch(() => null);
    return sessionFromUser(credential.user, profile || {});
  }catch(error){
    throw mapFirebaseError(error);
  }
}

export async function continueWithGoogleFirebase(){
  try{
    const { auth } = await initFirebase();
    const { authModule } = await loadFirebaseModules();
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt:'select_account' });
    const result = await authModule.signInWithPopup(auth, provider);
    const profile = await saveProfile(result.user, { provider:'google' }).catch(() => ({ provider:'google' }));
    return sessionFromUser(result.user, profile);
  }catch(error){
    throw mapFirebaseError(error);
  }
}

export async function signOutFirebase(){
  if(!isFirebaseConfigured()) return;
  const { auth } = await initFirebase();
  const { authModule } = await loadFirebaseModules();
  await authModule.signOut(auth);
}

export async function saveFirebaseProgress(session, progress){
  if(!isFirebaseConfigured() || !session?.id) return;
  const { realtimeDb, firestoreDb } = await initFirebase();
  const { databaseModule, firestoreModule } = await loadFirebaseModules();
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
