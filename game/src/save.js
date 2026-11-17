// Save games: Dana's progress in localStorage.
// One job: persist and restore cash, mission progress, position and health
// under one versioned key. A corrupt or missing save loads as nothing.

import { SAVE_KEY } from './config.js';

/** Write the save object; returns true on success. */
export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: 1 }));
    return true;
  } catch {
    return false;
  }
}

/** Read the save object, or null when there is none / it is unreadable. */
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

/** True when a readable save exists (drives the Continue button). */
export function hasSave() {
  return loadGame() !== null;
}

/** Wipe the save (New Game after a finished story). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the game still plays.
  }
}
