import { z } from 'zod';

// General Information Schema
export const generalInfoSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  description: z.string().optional(),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  phone_number: z.string().optional(),
  whatsapp_number: z.string().optional(),
  website_url: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^https?:\/\/.+/.test(val),
      'Website URL must be a valid URL starting with http:// or https://'
    ),
  instagram_handle: z.string().optional(),
});

export type GeneralInfoFormData = z.infer<typeof generalInfoSchema>;

// Operational Settings Schema
export const operationalSettingsSchema = z.object({
  booking_window: z
    .number()
    .min(1, 'Booking window must be at least 1 day')
    .max(90, 'Booking window cannot exceed 90 days'),
  cancellation_window: z
    .number()
    .min(1, 'Cancellation window must be at least 1 hour')
    .max(48, 'Cancellation window cannot exceed 48 hours'),
  table_turnover_time: z
    .number()
    .min(30, 'Table turnover time must be at least 30 minutes')
    .max(240, 'Table turnover time cannot exceed 240 minutes'),
  booking_policy: z.enum(['instant', 'request']),
  minimum_age: z
    .number()
    .min(0, 'Minimum age cannot be negative')
    .max(99, 'Minimum age cannot exceed 99')
    .optional()
    .nullable(),
});

export type OperationalSettingsFormData = z.infer<typeof operationalSettingsSchema>;

// Features & Amenities Schema
export const featuresAmenitiesSchema = z.object({
  price_range: z.number().min(1).max(4),
  cuisine_type: z.enum([
    'Lebanese',
    'Mediterranean',
    'Italian',
    'French',
    'Japanese',
    'Chinese',
    'Indian',
    'Mexican',
    'American',
    'Seafood',
    'Steakhouse',
    'Fusion',
    'Vegetarian',
    'Cafe',
  ]).nullable().optional(),
  dietary_options: z.array(
    z.enum([
      'Vegetarian',
      'Vegan',
      'Gluten-free',
      'Halal',
      'Kosher',
      'Dairy-free',
      'Nut-free',
    ])
  ).optional(),
  parking_available: z.boolean(),
  valet_parking: z.boolean(),
  outdoor_seating: z.boolean(),
  shisha_available: z.boolean(),
});

export type FeaturesAmenitiesFormData = z.infer<typeof featuresAmenitiesSchema>;




