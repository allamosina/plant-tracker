# Plantwise — Test Plan

## How to Use

Run `npm run dev`, open `http://localhost:3000` in a mobile-viewport browser window (DevTools → iPhone 15 frame). Work through each section in order; blocked items are marked as dependencies.

Legend: `[ ]` not tested · `[x]` pass · `[!]` bug found

---

## 1. Auth

### 1.1 Registration
- [ ] Navigate to `/register`
- [ ] Submit with empty fields → validation messages shown for email and password
- [ ] Submit with invalid email → "Enter a valid email" shown
- [ ] Submit with password < 8 chars → "Password must be at least 8 characters"
- [ ] Submit with mismatched passwords → "Passwords do not match"
- [ ] Submit valid data → toast "Account created! You can now sign in." → redirect to `/login`
- [ ] Attempt to register with already-used email → Supabase error toast shown

### 1.2 Login
- [ ] Navigate to `/login`
- [ ] Submit with empty fields → validation shown
- [ ] Submit wrong credentials → Supabase error toast shown
- [ ] Submit valid credentials → redirect to `/` (Tasks view)
- [ ] "Forgot password?" link navigates to `/forgot-password`

### 1.3 Session persistence
- [ ] After login, refresh page → stays logged in (not redirected to `/login`)
- [ ] Navigate directly to `/plants` without login → redirected to `/login`
- [ ] Navigate directly to `/sites` without login → redirected to `/login`
- [ ] After sign-out (user menu) → redirected to `/login`

---

## 2. Navigation

### 2.1 Bottom nav
- [ ] Tasks icon → navigates to `/`, icon highlighted
- [ ] Plants icon → navigates to `/plants`, icon highlighted
- [ ] `+` FAB → navigates to `/plants/new`, Plants icon highlighted (correct — adding IS a plants action)
- [ ] Sites icon → navigates to `/sites`, icon highlighted
- [ ] Nav is visible on: `/`, `/plants`, `/sites`, `/archive`
- [ ] Nav is hidden on: `/plants/[id]`, `/plants/new`, `/plants/[id]/edit` (detail/form pages have their own back button)

### 2.2 Back navigation
- [ ] Plant detail page → back button returns to previous screen
- [ ] Add/edit plant → cancel (back) without saving returns without persisting data

---

## 3. Task Management View (`/`)

### 3.1 Empty states
- [ ] No plants at all → "Welcome to Plantwise" empty state with "Add your first plant" CTA
- [ ] Plants exist but none have scheduled care (no `next_*_at` dates) → "All caught up!" state

### 3.2 Task display
- [ ] Plants with `next_watered_at` in the past → appear in "Overdue" bucket with clay-colored header
- [ ] Plants with `next_watered_at` = today → appear in "Today" bucket
- [ ] Plants with `next_watered_at` = tomorrow → appear in "Tomorrow" bucket
- [ ] Plants with `next_watered_at` = 5 days out → appear in "In 5 days" bucket
- [ ] Multiple care types for one plant appear as separate task rows (watering + misting = 2 rows)
- [ ] Task row shows: plant thumbnail, plant name, location pill, action badge (Water/Mist/Fertilize)
- [ ] Task row without location shows no location pill
- [ ] Bucket header shows correct task count
- [ ] Header shows today's date formatted as "Tuesday, April 15"
- [ ] Header shows "N pending" count

### 3.3 Task completion
- [ ] Tap ✓ on a Water task → toast "Watering logged for [plant name]"
- [ ] After completion, plant's `last_watered_at` updates to today
- [ ] After completion with interval set, `next_watered_at` advances by `watering_interval_days`
- [ ] Completed task disappears from list (query invalidation works)
- [ ] Tap ✓ on Mist task → same flow, `last_misted_at` / `next_misted_at` update
- [ ] Tap ✓ on Fertilize task → same flow, `last_fertilized_at` / `next_fertilized_at` update
- [ ] Tap plant thumbnail/name → navigates to that plant's detail page

---

## 4. Plant Inventory (`/plants`)

### 4.1 Empty state
- [ ] No plants → empty state with emoji and "Add your first plant" CTA

### 4.2 Plant cards
- [ ] Plant with photo → photo shown
- [ ] Plant without photo → 🪴 emoji shown
- [ ] Plant with `next_watered_at` overdue → red dot on photo + "💧 Overdue" chip in clay color
- [ ] Plant with `next_watered_at` today → "💧 Today" chip in leaf color
- [ ] Plant with `next_watered_at` in 3 days → "💧 in 3d" chip in stone color
- [ ] Plant with no `next_watered_at` → no water chip
- [ ] Status badge shown for each plant
- [ ] Tapping a card → navigates to `/plants/[id]`

### 4.3 Search
- [ ] Search by plant name → filters correctly
- [ ] Search by species → filters correctly
- [ ] Search by location → filters correctly
- [ ] Clear search → all plants reappear
- [ ] Search with no matches → "No plants match…" message

---

## 5. Add Plant (`/plants/new`)

### 5.1 Validation
- [ ] Submit with empty name → "Plant name is required" shown
- [ ] All other fields optional → form submits without them

### 5.2 Photo upload
- [ ] Tap photo circle → file picker opens
- [ ] Select image → preview shown in circle
- [ ] "Remove Photo" button → clears preview
- [ ] Submit with photo → photo stored in Supabase Storage, URL saved on plant

### 5.3 Species knowledge lookup
- [ ] Enter species name + save → "Detecting care schedule…" shown on button during lookup
- [ ] After save, `watering_interval_days` populated on plant
- [ ] After save, `next_watered_at` computed if `last_watered_at` provided
- [ ] After save, `light_requirement`, `humidity_preference`, `soil_type` populated in Care Info tab
- [ ] Species hint badge shown in form when species is typed: "Care schedule will be auto-detected on save"

### 5.4 Misting
- [ ] Enter `last_misted_at` date → saved to plant
- [ ] If species has `misting_interval_days`, `next_misted_at` computed from `last_misted_at + interval`
- [ ] `misting_source` correctly shows 'claude' (not 'perenual')

### 5.5 Save
- [ ] Successful create → toast "Plant added!" → redirect to `/plants/[id]`
- [ ] New plant appears in `/plants` list
- [ ] New plant appears in `/sites` under correct location

---

## 6. Plant Detail (`/plants/[id]`)

### 6.1 Hero
- [ ] Plant with photo → full-width video-aspect hero with photo
- [ ] Plant without photo → 🪴 emoji on stone background
- [ ] Gradient overlay visible on hero
- [ ] Plant name shown in overlay (nickname if set, else name)
- [ ] Species shown in italic below name
- [ ] Status badge shown in hero

### 6.2 Care stat carousel
- [ ] Watering card always shown; shows "Last: X ago" and "Next: in Nd"
- [ ] Misting card shown only if `misting_interval_days` is set
- [ ] Fertilizing card always shown
- [ ] Overdue cards show red border and "Overdue" label
- [ ] Cards are horizontally scrollable when more than 2

### 6.3 Tab: Tasks
- [ ] Shows upcoming tasks for this plant (watering, misting if set, fertilizing)
- [ ] Overdue tasks highlighted in clay
- [ ] "Done" button creates log + updates next date + task updates immediately
- [ ] No scheduled tasks → "No scheduled care tasks" message with hint
- [ ] "+ Log other care" link opens AddLogSheet

### 6.4 Tab: Care Info
- [ ] Plant with species data → shows light, humidity, soil, temp, watering/misting/fertilizing intervals
- [ ] Source label at bottom: "Perenual plant database" or "AI estimate"
- [ ] Plant without species data → "No care profile detected yet" message

### 6.5 Tab: History
- [ ] Shows all logs in reverse chronological order
- [ ] "No care logged yet" state with "Log first care" CTA
- [ ] Each log shows type icon, date, note if any
- [ ] Misting logs display with Wind icon and sky color

### 6.6 FAB + log sheet
- [ ] `+` FAB opens AddLogSheet (bottom sheet)
- [ ] Sheet shows 6 action types including Misting
- [ ] Watering log → closes sheet, watering dates update, task disappears from Tasks tab
- [ ] Misting log → misting dates update
- [ ] Fertilizing log → fertilizing dates update
- [ ] Log with photo → photo stored and shown in History

### 6.7 Overflow menu
- [ ] "Edit Plant" → navigates to `/plants/[id]/edit`
- [ ] "Archive" → confirm dialog → archives plant → redirect to `/`
- [ ] Archived plant disappears from Tasks, Plants, Sites
- [ ] "Delete" → confirm dialog → deletes plant + all logs → redirect to `/`

---

## 7. Edit Plant (`/plants/[id]/edit`)

- [ ] Form pre-populated with existing plant data
- [ ] Change species → on save, care profile re-detected
- [ ] Same species (unchanged) with existing interval → interval NOT re-fetched (cached)
- [ ] Save changes → toast "Plant updated" → redirect back to detail page
- [ ] Photo change → new photo uploaded, old URL replaced

---

## 8. Sites View (`/sites`)

### 8.1 Empty state
- [ ] No plants → empty state with "No plants yet" message

### 8.2 Site cards
- [ ] Plants grouped by `location` field
- [ ] Sites listed alphabetically, "No location set" last
- [ ] Site card shows 2×2 photo mosaic (or 1×1 if only 1 plant)
- [ ] Plant count shown per site
- [ ] Overdue count shown in clay if any plants overdue in that site
- [ ] Light/humidity env tags shown if plants in site have care data
- [ ] Tap site card → expands to show plant list
- [ ] Expanded plant list: photo, name, species, status badge, "Water now" for overdue
- [ ] Tap plant row → navigates to plant detail

### 8.3 Expand/collapse
- [ ] Tap header again → collapses list
- [ ] Chevron rotates on expand/collapse

---

## 9. Archive (`/archive`)

- [ ] Navigate via plant overflow menu → Archive → plant appears in `/archive`
- [ ] Plant in archive shows grayscale photo
- [ ] Restore → plant back in collection, `archived_at` cleared
- [ ] Delete → confirm → plant permanently deleted (no restore possible)
- [ ] Archive page accessible at `/archive` URL directly

---

## 10. Data Integrity

### 10.1 Care interval chain
- [ ] Add watering log on Day 0 with interval=10 → `next_watered_at` = Day 10
- [ ] Add another watering log on Day 5 → `next_watered_at` = Day 15 (not Day 10)
- [ ] Task view shows updated date

### 10.2 Source accuracy
- [ ] Plant with Perenual match → `watering_source` = 'perenual', `misting_source` = 'claude' (not 'perenual')
- [ ] Plant with no Perenual match → `watering_source` = 'claude', `misting_source` = 'claude'
- [ ] Care Info tab shows "Perenual plant database" vs "AI estimate" correctly

### 10.3 RLS (Row-Level Security)
- [ ] User A's plants not visible to User B (test with 2 accounts)
- [ ] User B cannot edit/delete User A's plants via direct API calls

---

## 11. Edge Cases

- [ ] Plant name with special characters (apostrophe, emoji) → displays correctly everywhere
- [ ] Very long plant name → truncated in cards, shown fully in detail
- [ ] Plant with no photo, no species, no location → no crash anywhere
- [ ] Species lookup with unrecognized species → Claude fallback returns a reasonable interval
- [ ] Species lookup with network error → graceful failure, plant saved without interval
- [ ] Tasks view with 20+ tasks → scrolls smoothly, all buckets render
- [ ] Sites view with all plants in one location → single site card
- [ ] Watering interval of 1 day → next date = tomorrow (not today)

---

## 12. PWA / Mobile

- [ ] App installable on mobile (manifest.json present)
- [ ] No horizontal scroll on mobile viewport (375px wide)
- [ ] Bottom nav doesn't overlap content (24px bottom padding applied)
- [ ] Tap targets ≥ 44px (buttons, nav items)
- [ ] Log care sheet slides up smoothly on mobile
- [ ] Photo capture uses device camera (not file picker) on iOS

---

## Known Limitations (Not Bugs)

- Misting/fertilizing interval lookup is Claude-only (Perenual free tier doesn't provide these)
- Species lookup adds ~2–4s latency to plant save when species changes
- Archive page has no nav link — accessed only via plant overflow menu (intentional)
- No offline support beyond PWA installability
