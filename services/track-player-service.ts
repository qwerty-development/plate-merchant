/**
 * Track Player Playback Service
 * This service runs in the background and handles playback events
 * Required by react-native-track-player for background operation
 */

import TrackPlayer, { Event } from 'react-native-track-player';

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('[TrackPlayerService] Remote play');
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('[TrackPlayerService] Remote pause');
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('[TrackPlayerService] Remote stop');
    TrackPlayer.stop();
  });

  // Handle playback state changes
  TrackPlayer.addEventListener(Event.PlaybackState, (state) => {
    console.log('[TrackPlayerService] Playback state changed:', state);
  });

  // Handle playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    console.error('[TrackPlayerService] Playback error:', error);
  });
}
