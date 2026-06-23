# Maintenance Page

## Purpose

A dedicated workspace for the maintenance and housekeeping team to track villa turnovers and control villa availability status — without needing access to bookings or financial data.

---

## Tabs

### 1. Turnover Board

Shows every managed villa that has had a guest check out in the last 3 days **or** has an upcoming check-in within the next 7 days.

Each card displays:

| Field | Description |
|---|---|
| Guest who left | Name + check-out date + confirmed departure indicator |
| Gap | Hours available between check-out and next check-in |
| Guest arriving | Name + check-in date + time + number of guests |
| Quick action | Toggle the villa between `Available` and `Maintenance` |

**Urgency levels:**

| Gap | Color | Meaning |
|---|---|---|
| < 24 hours | 🔴 Red | Urgent — prioritize immediately |
| 24 – 48 hours | 🟠 Orange | Plan ahead |
| > 48 hours | 🟢 Green | Comfortable window |

Urgent villas are always shown at the top in a separate section.

The board auto-refreshes every 60 seconds.

---

### 2. Villa Status

A full table of all managed villas showing their current status with an inline selector to switch between `Available` and `Maintenance`.

- **Available** → villa is ready for guests
- **Maintenance** → villa is blocked from being considered available; shown with a red tag across the system
- **Occupied** → read-only, driven automatically by active bookings

---

## Who uses this page

The maintenance and housekeeping team. They only need this page to do their daily work — they do not need access to the Bookings, Guests, or Reports sections.

---

## Data sources

| Data | Source |
|---|---|
| Turnover schedule | `GET /api/v1/maintenance/turnover` |
| Villa list & status | `GET /api/v1/villas?is_managed=1` |
| Status update | `PUT /api/v1/villas/{id}` |
