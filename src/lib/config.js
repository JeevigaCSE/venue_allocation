// ---------------------------------------------------------------------------
// App-wide settings. Change these in ONE place.
// ---------------------------------------------------------------------------
export const APP_CONFIG = {
  collegeName: 'National Engineering College',
  appName: 'Venue Booking',
  tagline: 'Book labs and classrooms by period',
  supportNote: 'Need help? Contact the admin office.',
}

// true  -> staff send a booking REQUEST and the admin approves it (your current workflow)
// false -> staff book green slots instantly (slots turn red immediately)
// Admin accounts always book instantly.
export const STAFF_NEEDS_APPROVAL = true

// How many days ahead the date strip lets people look.
export const BOOKING_WINDOW_DAYS = 30
