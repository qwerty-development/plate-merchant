import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseRealtimeConnectionOptions {
  restaurantId: string | undefined;
  onBookingChange: (payload: any) => void;
  enabled?: boolean;
}

export function useRealtimeConnection({
  restaurantId,
  onBookingChange,
  enabled = true,
}: UseRealtimeConnectionOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date>(new Date());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('🔌 Cleaning up channel...');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
  }, []);

  const connect = useCallback(() => {
    if (!restaurantId || !enabled) {
      console.log('⏭️ Skipping connection (no restaurant or disabled)');
      return;
    }

    // Clean up existing connection
    cleanup();

    console.log('🔌 Establishing realtime connection...');

    const channel = supabase
      .channel(`bookings-${restaurantId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: restaurantId },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          console.log('📨 Booking change received:', payload.eventType);
          setLastHeartbeat(new Date());
          onBookingChange(payload);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Connection status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully connected to realtime');
          setIsConnected(true);
          setLastHeartbeat(new Date());
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.log('❌ Connection closed or error');
          setIsConnected(false);
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connect();
          }, 5000);
        } else if (status === 'TIMED_OUT') {
          console.log('⏱️ Connection timed out');
          setIsConnected(false);
          
          // Attempt to reconnect immediately
          setTimeout(() => {
            console.log('🔄 Reconnecting after timeout...');
            connect();
          }, 1000);
        }
        
        if (err) {
          console.error('❌ Subscription error:', err);
        }
      });

    channelRef.current = channel;
  }, [restaurantId, enabled, onBookingChange, cleanup]);

  // Set up heartbeat monitoring
  useEffect(() => {
    if (!enabled || !restaurantId) return;

    // Check connection health every 30 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      const now = new Date();
      const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.getTime();
      const fiveMinutes = 5 * 60 * 1000;

      console.log('💓 Heartbeat check:', {
        isConnected,
        minutesSinceLastActivity: Math.floor(timeSinceLastHeartbeat / 60000),
      });

      // If no activity for 5 minutes and connected, send a ping
      if (timeSinceLastHeartbeat > fiveMinutes && isConnected && channelRef.current) {
        console.log('📤 Sending keep-alive ping...');
        
        // Send a presence update as keep-alive
        channelRef.current.track({ 
          online_at: new Date().toISOString(),
          restaurant_id: restaurantId,
        });
      }

      // If connection seems dead (no activity for 10 minutes), reconnect
      if (timeSinceLastHeartbeat > fiveMinutes * 2) {
        console.log('⚠️ Connection appears dead, forcing reconnect...');
        connect();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [enabled, restaurantId, lastHeartbeat, isConnected, connect]);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      cleanup();
    };
  }, [connect, cleanup]);

  // Force reconnect function
  const forceReconnect = useCallback(() => {
    console.log('🔄 Manual reconnect triggered');
    connect();
  }, [connect]);

  return {
    isConnected,
    lastHeartbeat,
    forceReconnect,
  };
}




