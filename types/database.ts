// Database types
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_restaurant'
  | 'declined_by_restaurant'
  | 'no_show';

export type BookingPolicy = 'instant' | 'request';

export type CuisineType =
  | 'Lebanese'
  | 'Mediterranean'
  | 'Italian'
  | 'French'
  | 'Japanese'
  | 'Chinese'
  | 'Indian'
  | 'Mexican'
  | 'American'
  | 'Seafood'
  | 'Steakhouse'
  | 'Fusion'
  | 'Vegetarian'
  | 'Cafe';

export type DietaryOption =
  | 'Vegetarian'
  | 'Vegan'
  | 'Gluten-free'
  | 'Halal'
  | 'Kosher'
  | 'Dairy-free'
  | 'Nut-free';

export interface Profile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  user_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface SpecialOffer {
  id: string;
  title: string;
  description: string | null;
  discount_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  restaurant_id: string;
  user_id: string;
  booking_time: string;
  party_size: number;
  status: BookingStatus;
  special_requests: string | null;
  preferred_section: string | null;
  occasion: string | null;
  dietary_notes: string[] | null;
  guest_name: string;
  guest_email: string | null;
  confirmation_code: string;
  table_preferences: string | null;
  applied_offer_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  profiles?: Profile;
  special_offers?: SpecialOffer;
}

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address: string;
  phone_number: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  booking_window: number; // days
  cancellation_window: number; // hours
  table_turnover_time: number; // minutes
  booking_policy: BookingPolicy;
  minimum_age: number | null;
  price_range: number; // 1-4
  cuisine_type: CuisineType | null;
  dietary_options: DietaryOption[] | null;
  parking_available: boolean;
  valet_parking: boolean;
  outdoor_seating: boolean;
  shisha_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingUpdatePayload {
  bookingId: string;
  status: 'confirmed' | 'declined_by_restaurant' | 'cancelled_by_restaurant' | 'completed' | 'no_show';
  note?: string;
}



