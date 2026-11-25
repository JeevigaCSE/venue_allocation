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

// ---------------------------------------------------------------------------
// Replaced-booking notices: when the admin approves an emergency override, the
// original staff member's earlier approved request row is re-marked with this
// reason (no database change) so their app can tell them what happened.
// ---------------------------------------------------------------------------
export const OVERRIDDEN_REASON = 'Booking replaced by emergency override'

export const isOverriddenNotice = (req) => req?.priority_reason === OVERRIDDEN_REASON

// Call BEFORE the approve RPC deletes the old bookings. Never blocks the approval.
export const markDisplacedBookings = async (displacedBookings) => {
  for (const b of displacedBookings) {
    try {
      const { data: rows } = await supabase
        .from('override_requests')
        .select('id, start_time, end_time')
        .eq('room_id', b.room_id)
        .eq('requester_id', b.user_id)
        .eq('status', 'approved')
        .eq('priority_reason', STANDARD_REQUEST_REASON)
      const match = (rows || []).find(
        (r) =>
          new Date(r.start_time).getTime() === new Date(b.start_time).getTime() &&
          new Date(r.end_time).getTime() === new Date(b.end_time).getTime()
      )
      if (match) {
        await supabase
          .from('override_requests')
          .update({ priority_reason: OVERRIDDEN_REASON, status: 'rejected' })
          .eq('id', match.id)
      }
    } catch (e) {
      console.warn('Could not notify displaced booking owner:', e)
    }
  }
}
