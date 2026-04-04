import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAdcFM8rGR5Ag6EkokHJLa8PskNOZMW_l8',
  authDomain: 'labor-tracker-bookkon.firebaseapp.com',
  projectId: 'labor-tracker-bookkon',
  storageBucket: 'labor-tracker-bookkon.firebasestorage.app',
  messagingSenderId: '1039364666505',
  appId: '1:1039364666505:web:c04ea152d78fad289c4258',
};

// HMR時の重複初期化を防ぐ
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
