# Owner Portal — Implementation Plan

## Context

Today an "Owner" (`Owner` model) is just a data record managed by staff from the Owners page — owners have no login and see nothing themselves. Every booking for their villas is created by staff on their behalf. Goal: let an owner log into the platform with their own account, see **only their own villas and bookings**, and book directly for their own villa.

Decisions confirmed by the user:
1. When an owner books their own villa, the booking is created with status **Pending** — a staff member must confirm it afterward (reusing the existing confirm flow).
2. Staff manually create the owner's login credentials (email + password) — no self-service signup.
3. The owner sees the full commission breakdown (total, 5% commission, net) even though their own bookings always carry zero commission.
4. **Payment recording — open decision point**: the plan covers both options (A: staff-only, B: owner can record payments on their own bookings). Recommendation: ship A first, add B as a fast-follow if needed.

---

## 1. Database changes

- **Migration 1**: add a nullable, unique `user_id` column to `owners` → FK to `users.id`, `nullOnDelete()`. Null means "no portal access" — the default state for every existing owner today, so no backfill is needed.
- **Migration 2**: widen the `role` enum on `users` from `admin|manager|staff` to `admin|manager|staff|owner` (raw `ALTER TABLE`, same style as the existing role migration).
- **`User` model**: add `isOwner(): bool` (`role === 'owner'`) and a `owner(): hasOne(Owner::class)` relation.
- **`Owner` model**: add a `user(): belongsTo(User::class)` relation.
- **`Booking.is_owner`**: column already exists, no migration needed. In the new owner-facing `BookingController`, `is_owner = true` is forced server-side (never client-supplied). The existing path that lets staff manually flag a booking as an "owner booking" on someone's behalf stays completely unchanged.

## 2. Backend authorization / scoping

The project currently has no dedicated middleware/policy layer — every check happens inline inside controllers (same pattern as the existing `UserController::store()`). We follow the same style instead of introducing a complex permission framework:

- **A fully separate route group**: `Route::prefix('owner')->middleware(['auth:sanctum', 'ensure.owner'])->group(...)` in `routes/api.php`, backed by one small new middleware `EnsureOwnerRole` (rejects any request whose role isn't `owner`).
- New dedicated controllers under `app/Http/Controllers/Api/OwnerPortal/` (`DashboardController`, `VillaController`, `BookingController`, `GuestController`) — every query in them is scoped from the start to `villa_id IN (ownedVillaIds)` via a new helper `User::ownedVillaIds()`.
- **The existing controllers are left untouched** (`VillaController`, `BookingController`, `GuestController`, `OwnerController`) to avoid any risk of a data leak through their already-complex logic. As cheap defense-in-depth: one line at the top of each of these existing index/show actions rejects the request (403) if the caller's role is `owner` — an extra safety net, not a substitute for the separate route group.
- `villa_id` on booking creation is always validated server-side (`Rule::in($ownedVillaIds)`) — never trusted from whatever list the frontend happens to show.

## 3. Booking creation by an owner — separate endpoint

`POST /owner/bookings` on `OwnerPortal\BookingController::store()`, instead of reusing `POST /bookings` directly. Reason: the existing endpoint accepts sensitive fields from the client (`status`, `is_owner`) — a separate endpoint guarantees those fields are never even read from owner input (always forced: `status=pending`, `is_owner=true`) rather than relying on "ignore them after validation" inside code that's already complex (extensions, advance payments, PDF generation, WhatsApp).

The shared validation logic (contract active, villa status, availability, price > 0...) is extracted from the current `BookingController::store()` into a new `BookingService` method (e.g. `createBooking()`) that both controllers call, so the logic isn't duplicated. After creation, the same existing PDF and WhatsApp services are called unmodified (they already work correctly with `is_owner=true`).

## 4. Guest (tenant) selection for owner bookings

Instead of exposing the full guest list (a privacy leak — it could reveal other owners' tenants), `OwnerPortal\GuestController::index()` only returns guests who have a prior booking at one of this owner's villas, plus the ability to add a new guest (reusing the existing creation form).

## 5. Frontend — a fully separate section

Instead of modifying the existing `Villas`/`Bookings` pages (already complex, full of staff-only buttons/permissions), a completely separate route tree is added:

- `AuthContext`: add `isOwner: user?.role === 'owner'`.
- `App.jsx`: on login, if `role === 'owner'`, route the user into a fully separate `/owner/*` tree (its own simple layout, not the current `AppLayout`) instead of the existing `PageGuard`/`canAccessPage` system — because that system grants "full access by default" to any user without explicit permissions set, which is a real leak risk if an owner ever got routed through it by mistake. Also harden `canAccessPage` itself with one line: always reject `role === 'owner'` (extra safety net).
- New pages under `src/pages/OwnerPortal/`: **Dashboard** (summary of their villas + upcoming bookings), **My Villas** (read-only list), **My Bookings** (list + new-booking form + booking detail with the full commission breakdown as requested — total/commission 0/net, with a note "your own villa, no commission").
- On successful booking submission, no need for the WhatsApp-delivery-status modal used for staff (internal technical detail) — a simple message: "Booking request submitted, awaiting team confirmation."
- No change to the existing staff confirmation flow (`confirmBooking` + its existing WhatsApp status modal) — it works automatically on owner bookings since they're just regular rows in the same table. Optional nice-to-have: an "Owner" tag on rows where `is_owner=true` in the staff bookings table, to make them easy to spot for confirmation.

## 6. Payment recording — the two options

**Option A (recommended to start)**: the owner portal is read-only for financials — they see total/commission/net and payment status (unpaid/partial/paid) with no "add payment" button. No new endpoint needed.

**Option B (fast-follow if wanted)**: add `OwnerPortal\PaymentController::store()`, scoped by the same villa-ownership check, reusing the existing payment-calculation logic in `BookingService`. Owners are never allowed to delete a payment (stays staff-only). Could also allow entering an advance payment at booking-creation time to avoid a two-step flow.

## 7. Risks and edge cases

- **An owner who is also an existing staff member with the same email**: reject linking the login automatically with a clear error, rather than silently converting an existing staff account to the `owner` role.
- **An owner with no villas**: pages show a clear empty state, and attempting to create a booking is rejected with "No villas are linked to your account" instead of a generic validation error.
- Confirm first how middleware is registered in the Laravel version in use (`bootstrap/app.php` vs. `app/Http/Kernel.php`) before starting implementation — a quick first verification step.

## Key files

- `app/Http/Controllers/Api/BookingController.php`, `app/Services/BookingService.php` (extract shared logic)
- `app/Models/User.php`, `app/Models/Owner.php`
- `routes/api.php` (new `/owner/*` route group)
- `app/Http/Controllers/Api/OwnerPortal/*` (all new)
- `src/App.jsx`, `src/store/AuthContext.jsx`, `src/utils/permissions.js`
- `src/pages/OwnerPortal/*` (all new)
- `src/pages/Owners/index.jsx` ("Enable Owner Login" button)

## Verification

1. Log in with a test owner account → should route directly to the `/owner` UI, not the staff UI.
2. Confirm that calling any staff route (`/villas`, `/bookings`, etc.) with an owner token returns 403.
3. Create a booking from the owner UI for their villa → appears as `pending` in the staff table with `is_owner=true`, commission 0.
4. Attempt to create a booking with a `villa_id` the owner doesn't own (via a direct API request) → rejected with 422/403.
5. Confirming the booking from the staff UI works exactly as it does today, with the same notifications.
