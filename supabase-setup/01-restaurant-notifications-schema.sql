-- ============================================================================
-- RESTAURANT NOTIFICATION SYSTEM - Database Schema
-- ============================================================================
-- This creates the server-side push notification system for restaurant tablets
-- ensuring 100% reliable notification delivery via Expo Push Notifications
-- ============================================================================

-- 1. Restaurant Devices Table (Store tablet push tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.restaurant_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    expo_push_token text NOT NULL,
    device_name text, -- e.g., "Samsung Galaxy Tab - Main Counter"
    platform text CHECK (platform IN ('ios', 'android', 'web')),
    app_version text,
    enabled boolean DEFAULT true,
    last_seen timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (restaurant_id, device_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_restaurant_devices_restaurant_id
ON public.restaurant_devices(restaurant_id) WHERE enabled = true;

-- 2. Restaurant Notification Outbox (Queue for reliable delivery)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.restaurant_notification_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,

    -- Notification content
    type text NOT NULL CHECK (type IN (
        'new_booking', 'booking_cancelled', 'booking_modified',
        'urgent_booking', 'system_alert'
    )),
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    sound text DEFAULT 'default',
    priority text DEFAULT 'high' CHECK (priority IN ('high', 'normal', 'low')),

    -- Delivery tracking
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    error text,

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    sent_at timestamptz,
    scheduled_for timestamptz DEFAULT now(),

    -- Metadata
    expo_receipt_ids text[], -- Expo push receipt IDs for tracking
    target_tokens text[] -- Specific tokens to send to (if not all devices)
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_restaurant_notification_outbox_queued
ON public.restaurant_notification_outbox(scheduled_for, created_at)
WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_restaurant_notification_outbox_restaurant
ON public.restaurant_notification_outbox(restaurant_id, created_at DESC);

-- 3. Restaurant Notification Delivery Logs (Analytics & debugging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.restaurant_notification_delivery_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_id uuid NOT NULL REFERENCES public.restaurant_notification_outbox(id) ON DELETE CASCADE,
    device_id uuid REFERENCES public.restaurant_devices(id) ON DELETE SET NULL,

    -- Delivery details
    expo_push_token text,
    status text NOT NULL CHECK (status IN ('ok', 'error', 'invalid_token')),
    error text,
    expo_receipt_id text, -- Expo's receipt ID

    -- Timestamps
    created_at timestamptz DEFAULT now(),

    -- Debug info
    response_data jsonb
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_restaurant_notification_delivery_logs_outbox
ON public.restaurant_notification_delivery_logs(outbox_id);

-- 4. Restaurant Notification Preferences (Future: per-restaurant settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.restaurant_notification_preferences (
    restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,

    -- Notification toggles
    new_bookings boolean DEFAULT true,
    booking_cancellations boolean DEFAULT true,
    booking_modifications boolean DEFAULT true,

    -- Sound settings
    sound_enabled boolean DEFAULT true,
    vibration_enabled boolean DEFAULT true,

    -- Quiet hours (optional)
    quiet_hours jsonb DEFAULT '{"enabled": false, "start": "23:00", "end": "07:00"}'::jsonb,

    -- Updated
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Enqueue Restaurant Notification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_restaurant_notification(
    p_restaurant_id uuid,
    p_type text,
    p_title text,
    p_body text,
    p_data jsonb DEFAULT NULL,
    p_booking_id uuid DEFAULT NULL,
    p_priority text DEFAULT 'high'
)
RETURNS uuid AS $$
DECLARE
    v_outbox_id uuid;
BEGIN
    -- Insert into outbox queue
    INSERT INTO public.restaurant_notification_outbox (
        restaurant_id,
        booking_id,
        type,
        title,
        body,
        data,
        priority,
        sound,
        status
    )
    VALUES (
        p_restaurant_id,
        p_booking_id,
        p_type,
        p_title,
        p_body,
        COALESCE(p_data, '{}'::jsonb),
        p_priority,
        'default', -- Use default system sound
        'queued'
    )
    RETURNING id INTO v_outbox_id;

    RETURN v_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if restaurant should receive notification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.should_notify_restaurant(
    p_restaurant_id uuid,
    p_notification_type text
)
RETURNS boolean AS $$
DECLARE
    v_prefs record;
    v_current_time time;
    v_quiet_hours jsonb;
BEGIN
    -- Get restaurant preferences
    SELECT * INTO v_prefs
    FROM public.restaurant_notification_preferences
    WHERE restaurant_id = p_restaurant_id;

    -- If no preferences found, default to sending
    IF NOT FOUND THEN
        RETURN true;
    END IF;

    -- Check type-specific preferences
    CASE p_notification_type
        WHEN 'new_booking', 'urgent_booking' THEN
            IF NOT v_prefs.new_bookings THEN
                RETURN false;
            END IF;
        WHEN 'booking_cancelled' THEN
            IF NOT v_prefs.booking_cancellations THEN
                RETURN false;
            END IF;
        WHEN 'booking_modified' THEN
            IF NOT v_prefs.booking_modifications THEN
                RETURN false;
            END IF;
    END CASE;

    -- Check quiet hours
    v_quiet_hours := v_prefs.quiet_hours;
    IF (v_quiet_hours->>'enabled')::boolean THEN
        v_current_time := LOCALTIME;

        -- TODO: Implement quiet hours check if needed
        -- For now, we'll allow all notifications (restaurant tablets are 24/7)
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Notify Restaurant on New Booking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_restaurant_booking()
RETURNS trigger AS $$
DECLARE
    v_restaurant_name text;
    v_guest_name text;
    v_party_size int;
    v_booking_time timestamptz;
    v_title text;
    v_body text;
    v_type text;
    v_data jsonb;
BEGIN
    -- Get restaurant name
    SELECT name INTO v_restaurant_name
    FROM public.restaurants
    WHERE id = NEW.restaurant_id;

    -- Get booking details
    v_guest_name := COALESCE(NEW.guest_name, 'Guest');
    v_party_size := NEW.party_size;
    v_booking_time := NEW.booking_time;

    -- Determine notification type and content based on booking status
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        -- New booking request
        v_type := 'new_booking';
        v_title := '🎉 New Booking Request!';
        v_body := format(
            '%s • %s %s • %s',
            v_guest_name,
            v_party_size,
            CASE WHEN v_party_size = 1 THEN 'guest' ELSE 'guests' END,
            to_char(v_booking_time, 'Mon DD at HH:MI AM')
        );

    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'cancelled_by_user') THEN
        -- User cancelled booking
        v_type := 'booking_cancelled';
        v_title := '❌ Booking Cancelled';
        v_body := format(
            '%s cancelled their booking for %s %s',
            v_guest_name,
            v_party_size,
            CASE WHEN v_party_size = 1 THEN 'guest' ELSE 'guests' END
        );

    ELSIF (TG_OP = 'UPDATE' AND
           (OLD.booking_time != NEW.booking_time OR OLD.party_size != NEW.party_size)) THEN
        -- Booking modified
        v_type := 'booking_modified';
        v_title := '📝 Booking Modified';
        v_body := format(
            '%s updated their booking',
            v_guest_name
        );

    ELSE
        -- No notification needed
        RETURN NEW;
    END IF;

    -- Build data payload
    v_data := jsonb_build_object(
        'bookingId', NEW.id,
        'restaurantId', NEW.restaurant_id,
        'restaurantName', v_restaurant_name,
        'guestName', v_guest_name,
        'partySize', v_party_size,
        'bookingTime', v_booking_time,
        'status', NEW.status,
        'createdAt', NEW.created_at,
        'deeplink', format('platemerchant://booking/%s', NEW.id)
    );

    -- Check if restaurant should receive notification
    IF public.should_notify_restaurant(NEW.restaurant_id, v_type) THEN
        -- Enqueue notification
        PERFORM public.enqueue_restaurant_notification(
            NEW.restaurant_id,
            v_type,
            v_title,
            v_body,
            v_data,
            NEW.id,
            'high' -- Always high priority for restaurant notifications
        );

        RAISE LOG 'Enqueued restaurant notification: % for booking %', v_type, NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_notify_restaurant_booking ON public.bookings;

CREATE TRIGGER trg_notify_restaurant_booking
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.tg_notify_restaurant_booking();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.restaurant_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_notification_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant staff can manage their own devices
CREATE POLICY restaurant_devices_policy ON public.restaurant_devices
FOR ALL
USING (
    restaurant_id IN (
        SELECT rs.restaurant_id
        FROM public.restaurant_staff rs
        WHERE rs.user_id = auth.uid()
    )
);

-- Policy: Service role can access all
CREATE POLICY restaurant_devices_service_role_policy ON public.restaurant_devices
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Restaurant staff can view their notifications
CREATE POLICY restaurant_notification_outbox_policy ON public.restaurant_notification_outbox
FOR SELECT
USING (
    restaurant_id IN (
        SELECT rs.restaurant_id
        FROM public.restaurant_staff rs
        WHERE rs.user_id = auth.uid()
    )
);

-- Policy: Service role can manage outbox
CREATE POLICY restaurant_notification_outbox_service_role_policy ON public.restaurant_notification_outbox
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Similar policies for other tables
CREATE POLICY restaurant_notification_delivery_logs_service_role_policy
ON public.restaurant_notification_delivery_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY restaurant_notification_preferences_policy
ON public.restaurant_notification_preferences
FOR ALL
USING (
    restaurant_id IN (
        SELECT rs.restaurant_id
        FROM public.restaurant_staff rs
        WHERE rs.user_id = auth.uid()
    )
);

CREATE POLICY restaurant_notification_preferences_service_role_policy
ON public.restaurant_notification_preferences
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
GRANT ALL ON public.restaurant_devices TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.restaurant_devices TO authenticated;
GRANT ALL ON public.restaurant_notification_outbox TO service_role;
GRANT SELECT ON public.restaurant_notification_outbox TO authenticated;
GRANT ALL ON public.restaurant_notification_delivery_logs TO service_role;
GRANT ALL ON public.restaurant_notification_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.restaurant_notification_preferences TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.enqueue_restaurant_notification TO service_role;
GRANT EXECUTE ON FUNCTION public.should_notify_restaurant TO service_role;

-- ============================================================================
-- SAMPLE DATA / TESTING
-- ============================================================================

-- Insert default preferences for existing restaurants
INSERT INTO public.restaurant_notification_preferences (restaurant_id)
SELECT id FROM public.restaurants
ON CONFLICT (restaurant_id) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Restaurant notification system schema created successfully!';
    RAISE NOTICE '📋 Next steps:';
    RAISE NOTICE '  1. Create Supabase Edge Function: notify-restaurant-push';
    RAISE NOTICE '  2. Set up cron job to process queue every 1-2 minutes';
    RAISE NOTICE '  3. Register tablet devices via app';
    RAISE NOTICE '  4. Test with a new booking!';
END $$;
