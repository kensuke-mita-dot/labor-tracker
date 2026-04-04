import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { AppState } from '../types';

const STATE_DOC = 'app/state';

const DEFAULT_STATE: AppState = {
  members: [],
  categories: [],
  weekEntries: [],
  monthlyData: {},
};

/** Firestore からアプリ状態を1回取得 */
export async function fetchState(): Promise<AppState> {
  const snap = await getDoc(doc(db, STATE_DOC));
  if (!snap.exists()) return DEFAULT_STATE;
  return { ...DEFAULT_STATE, ...snap.data() } as AppState;
}

/** Firestore にアプリ状態を保存 */
export async function saveState(state: AppState): Promise<void> {
  await setDoc(doc(db, STATE_DOC), state);
}

/** Firestore の変更をリアルタイムで購読 */
export function subscribeState(
  callback: (state: AppState) => void,
): () => void {
  return onSnapshot(doc(db, STATE_DOC), (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_STATE, ...snap.data() } as AppState);
    } else {
      callback(DEFAULT_STATE);
    }
  });
}
