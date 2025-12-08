/**
 * Persistent Audio Manager
 * 
 * REMOVED - Using expo-notifications sound instead.
 * This file exists for compatibility but does nothing.
 */

export async function setupPersistentAudio() {
  // No-op - audio handled by expo-notifications
}

export async function startPersistentAlert(bookingId: string): Promise<void> {
  // No-op - notifications handle sound
}

export async function stopPersistentAlert(bookingId: string): Promise<void> {
  // No-op
}

export async function getAudioStatus() {
  return null;
}

export async function cleanupPersistentAudio(): Promise<void> {
  // No-op
}
