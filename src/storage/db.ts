// src/storage/db.ts
// All AsyncStorage read/write operations.
// Every function is async and returns a typed value.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from '../utils/types';

const KEYS = {
  STATE: 'mdms_state',
  TODAY_DATE: 'mdms_today_date',
};

/** Load full app state from AsyncStorage. Returns null if not set. */
export async function loadState(): Promise<AppState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STATE);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

/** Persist full app state to AsyncStorage */
export async function saveState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.STATE, JSON.stringify(state));
  } catch (e) {
    console.error('saveState error', e);
  }
}

/** Get the stored "today" date string (YYYY-MM-DD) */
export async function getTodayDate(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.TODAY_DATE);
  } catch {
    return null;
  }
}

/** Set the "today" date string */
export async function setTodayDate(dateStr: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.TODAY_DATE, dateStr);
  } catch {}
}

/** Wipe ALL app data from AsyncStorage */
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEYS.STATE, KEYS.TODAY_DATE]);
  } catch {}
}
