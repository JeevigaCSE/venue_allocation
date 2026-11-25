# College Venue Booking (UI/UX upgrade)

Frontend only. **No Supabase / SQL changes were made.**

## Run
    pnpm install
    pnpm dev          # or: pnpm build

## Where to change things
- `src/lib/config.js`      college name, and `STAFF_NEEDS_APPROVAL` (true = staff send requests, false = staff book instantly)
- `src/lib/schedule.js`    8-period logic, slot states, time-based expiry
- `src/components/RoomSlots.jsx`   the 8-period grid, booking, booked-slot details, override request
- `src/components/admin/`          Period timings settings, override comparison view
- `tailwind.config.js` / `src/index.css`   blue theme, bordered + dark-shadow "tile" style (`.elev`)

## How period timings are stored (no DB change)
Saved as one hidden row in the existing `departments` table (`code = '__SCHEDULE__'`).
It is hidden from every department list. Staff can read it, only admins can write it (existing RLS).

## Mobile app (Capacitor)
Bottom tab bar on phones, safe-area padding for notches, 44px+ touch targets, 16px inputs.
