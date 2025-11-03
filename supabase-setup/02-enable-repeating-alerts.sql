-- ============================================================================
-- ENABLE REPEATING ALERTS - Server-Side Sound Repetition
-- ============================================================================
-- This modification makes the server send MULTIPLE push notifications
-- every 30 seconds until the booking is accepted or declined.
-- This ensures "ring ring ring" behavior even if tablet is in deep sleep.
-- ============================================================================

-- Add columns for repeating notifications
ALTER TABLE public.restaurant_notification_outbox
ADD COLUMN IF NOT EXISTS repeat_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS repeat_interval integer DEFAULT 30, -- seconds
ADD COLUMN IF NOT EXISTS repeat_until timestamptz, -- When to stop repeating
ADD COLUMN IF NOT EXISTS last_repeat_at timestamptz, -- Last time we repeated
ADD COLUMN IF NOT EXISTS repeat_count integer DEFAULT 0; -- How many times we've repeated

-- Index for finding notifications that need repeating
CREATE INDEX IF NOT EXISTS idx_restaurant_notification_outbox_repeating
ON public.restaurant_notification_outbox(restaurant_id, repeat_until)
WHERE repeat_enabled = true AND status = 'sent';

-- ============================================================================
-- MODIFIED FUNCTION: Enqueue with Repeating
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_restaurant_notification(
    p_restaurant_id uuid,
    p_type text,
    p_title text,
    p_body text,
    p_data jsonb DEFAULT NULL,
    p_booking_id uuid DEFAULT NULL,
    p_priority text DEFAULT 'high',
    p_repeat_enabled boolean DEFAULT true,  -- NEW: Enable repeating by default
    p_repeat_interval integer DEFAULT 30,   -- NEW: Repeat every 30 seconds
    p_repeat_duration integer DEFAULT 300   -- NEW: Repeat for 5 minutes (300 seconds)
)
RETURNS uuid AS $$
DECLARE
    v_outbox_id uuid;
    v_repeat_until timestamptz;
BEGIN
    -- Calculate when to stop repeating
    IF p_repeat_enabled THEN
        v_repeat_until := NOW() + (p_repeat_duration || ' seconds')::interval;
    ELSE
        v_repeat_until := NULL;
    END IF;

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
        status,
        repeat_enabled,
        repeat_interval,
        repeat_until
    )
    VALUES (
        p_restaurant_id,
        p_booking_id,
        p_type,
        p_title,
        p_body,
        COALESCE(p_data, '{}'::jsonb),
        p_priority,
        'default',
        'queued',
        p_repeat_enabled,
        p_repeat_interval,
        v_repeat_until
    )
    RETURNING id INTO v_outbox_id;

    RETURN v_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- NEW FUNCTION: Stop Repeating Notification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.stop_repeating_notification(
    p_booking_id uuid
)
RETURNS void AS $$
BEGIN
    -- Stop all repeating notifications for this booking
    UPDATE public.restaurant_notification_outbox
    SET
        repeat_enabled = false,
        repeat_until = NOW() -- Mark as stopped
    WHERE booking_id = p_booking_id
    AND repeat_enabled = true;

    RAISE LOG 'Stopped repeating notifications for booking %', p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MODIFIED TRIGGER: Enable Repeating for New Bookings
-- ============================================================================
DROP TRIGGER IF EXISTS trg_notify_restaurant_booking ON public.bookings;

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
    v_repeat_enabled boolean;
BEGIN
    -- Get restaurant name
    SELECT name INTO v_restaurant_name
    FROM public.restaurants
    WHERE id = NEW.restaurant_id;

    -- Get booking details
    v_guest_name := COALESCE(NEW.guest_name, 'Guest');
    v_party_size := NEW.party_size;
    v_booking_time := NEW.booking_time;

    -- Determine notification type and content
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        -- New booking request - ENABLE REPEATING
        v_type := 'new_booking';
        v_title := '🎉 New Booking Request!';
        v_body := format(
            '%s • %s %s • %s',
            v_guest_name,
            v_party_size,
            CASE WHEN v_party_size = 1 THEN 'guest' ELSE 'guests' END,
            to_char(v_booking_time, 'Mon DD at HH:MI AM')
        );
        v_repeat_enabled := true; -- RING RING RING until handled!

    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'cancelled_by_user') THEN
        -- User cancelled - no repeating needed
        v_type := 'booking_cancelled';
        v_title := '❌ Booking Cancelled';
        v_body := format('%s cancelled their booking', v_guest_name);
        v_repeat_enabled := false;

        -- Stop any existing repeating notifications
        PERFORM public.stop_repeating_notification(NEW.id);

    ELSIF (TG_OP = 'UPDATE' AND
           (OLD.booking_time != NEW.booking_time OR OLD.party_size != NEW.party_size)) THEN
        -- Booking modified
        v_type := 'booking_modified';
        v_title := '📝 Booking Modified';
        v_body := format('%s updated their booking', v_guest_name);
        v_repeat_enabled := false;

    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND
           (NEW.status = 'confirmed' OR NEW.status = 'declined_by_restaurant')) THEN
        -- Booking accepted or declined - STOP REPEATING
        RAISE LOG 'Booking % status changed to %, stopping repeating notifications', NEW.id, NEW.status;
        PERFORM public.stop_repeating_notification(NEW.id);
        RETURN NEW;

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
        -- Enqueue notification with repeating enabled
        PERFORM public.enqueue_restaurant_notification(
            NEW.restaurant_id,
            v_type,
            v_title,
            v_body,
            v_data,
            NEW.id,
            'high',
            v_repeat_enabled,  -- Enable repeating for new bookings
            30,                -- Repeat every 30 seconds
            300                -- Repeat for 5 minutes (10 notifications)
        );

        RAISE LOG 'Enqueued restaurant notification: % for booking % (repeat: %)', v_type, NEW.id, v_repeat_enabled;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_restaurant_booking
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.tg_notify_restaurant_booking();

-- ============================================================================
-- NEW FUNCTION: Find Notifications That Need Repeating
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_notifications_to_repeat()
RETURNS TABLE(
    outbox_id uuid,
    restaurant_id uuid,
    booking_id uuid,
    type text,
    title text,
    body text,
    data jsonb,
    repeat_count integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id as outbox_id,
        o.restaurant_id,
        o.booking_id,
        o.type,
        o.title,
        o.body,
        o.data,
        o.repeat_count
    FROM public.restaurant_notification_outbox o
    WHERE
        o.repeat_enabled = true
        AND o.status = 'sent'
        AND o.repeat_until > NOW()
        AND (
            o.last_repeat_at IS NULL
            OR o.last_repeat_at < NOW() - (o.repeat_interval || ' seconds')::interval
        )
    ORDER BY o.created_at ASC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.stop_repeating_notification TO service_role;
GRANT EXECUTE ON FUNCTION public.get_notifications_to_repeat TO service_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Repeating alerts enabled!';
    RAISE NOTICE '🔔 New bookings will now trigger notifications every 30 seconds for 5 minutes';
    RAISE NOTICE '🛑 Notifications automatically stop when booking is accepted/declined';
    RAISE NOTICE '📝 Next: Deploy updated edge function to handle repeating';
END $$;
