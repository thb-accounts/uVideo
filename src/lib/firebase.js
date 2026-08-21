import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDAoKipu6_NqS9H7HdfAXBK_t8thjJhaPA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mplace-id.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mplace-id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mplace-id.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1057556755250',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1057556755250:web:aa5ce5e9c4ba4d83b61d2b',
}

const app = getApps().length ? getApp() : initializeApp(config)
export const firebaseAuth = getAuth(app)
if (typeof window !== 'undefined') setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {})
