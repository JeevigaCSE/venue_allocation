import { supabase } from './supabase'

// Normal staff booking requests reuse the existing `override_requests` table
// (so no database change is needed). They are marked with this fixed reason.
export const STANDARD_REQUEST_REASON = 'Standard booking request'

export const isStandardRequest = (req) =>
  req?.priority_reason === STANDARD_REQUEST_REASON

// The approve RPC appends " [Admin Override: <reason>]" to the booking purpose.
// Hide that suffix for normal requests.
export const cleanPurpose = (purpose) =>
  (purpose || '').replace(` [Admin Override: ${STANDARD_REQUEST_REASON}]`, '')

// ---------------------------------------------------------------------------
// Cancellation notices: when STAFF cancel a booking, a small record is saved
// (in the same table, no database change) so the admin can see it.
// ---------------------------------------------------------------------------
export const CANCELLATION_REASON = 'Booking cancelled by staff'

export const isCancellationNotice = (req) =>
  req?.priority_reason === CANCELLATION_REASON

// Call AFTER the booking was deleted. Never blocks the cancellation itself.
export const notifyAdminOfCancellation = async (booking, userId) => {
  try {
    const { error } = await supabase.from('override_requests').insert([
      {
        room_id: booking.room_id,
        requester_id: userId,
        purpose: cleanPurpose(booking.purpose),
        priority_reason: CANCELLATION_REASON,
        start_time: booking.start_time,
        end_time: booking.end_time,
        status: 'pending'
      }
    ])
    if (error) console.warn('Could not notify admin of cancellation:', error)
  } catch (e) {
    console.warn('Could not notify admin of cancellation:', e)
  }
}
