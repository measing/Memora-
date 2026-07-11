export const firebaseConfig = {
  apiKey: 'AIzaSyC8TrkAjLQmV-fya3uHQ1OmEy2LE-zRYmo',
  authDomain: 'memoramas.firebaseapp.com',
  databaseURL: '',
  projectId: 'memoramas',
  storageBucket: 'memoramas.firebasestorage.app',
  messagingSenderId: '221958724650',
  appId: '1:221958724650:web:b0f9342adeb421472b7753',
  measurementId: 'G-EDK02B41HC'
};

export function isFirebaseConfigured(){
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}
