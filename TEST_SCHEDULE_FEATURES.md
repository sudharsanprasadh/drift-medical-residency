# Schedule System Testing Guide

Complete testing guide for all schedule-related features in the medical residency app.

## Table of Contents
- [Prerequisites](#prerequisites)
- [User Roles](#user-roles)
- [Features Overview](#features-overview)
- [Test Scenarios](#test-scenarios)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Database Setup
1. Run migrations in Supabase SQL Editor (in order):
   ```sql
   -- Core scheduling:
   -- 1. supabase/migrations/019_create_weekly_scheduling_system.sql
   -- 2. supabase/migrations/020_add_rotation_system.sql
   -- 3. supabase/migrations/021_fix_approval_rls_for_all_leadership.sql
   --
   -- Shift configuration & hours tracking:
   -- 4. supabase/migrations/024_add_shift_types_to_roles.sql
   -- 5. supabase/migrations/025_add_shift_timings_to_roles.sql
   --
   -- Cross-program guest residents:
   -- 6. supabase/migrations/026_add_guest_resident_requests.sql
   ```

2. Seed default schedule roles for your program:
   ```sql
   SELECT seed_default_schedule_roles('YOUR_PROGRAM_ID');
   ```

3. Verify roles were created:
   ```sql
   SELECT role_name, display_order FROM schedule_roles 
   WHERE program_id = 'YOUR_PROGRAM_ID' 
   ORDER BY display_order;
   ```

### User Setup
You'll need test accounts for:
- ✅ **Chief Resident** (or Program Coordinator/Director) - Can create/edit schedules
- ✅ **Regular Resident** - Can view schedules and request swaps
- ✅ **Alumni** (optional) - Should NOT appear in on-call selection

All users must:
- Have `is_approved = true`
- Have `is_profile_complete = true`
- Belong to the same program

---

## User Roles

### Chief Resident / Program Coordinator / Director
**Permissions:**
- ✅ Create weekly schedules
- ✅ Edit schedules (draft and published)
- ✅ Publish schedules
- ✅ Delete schedules (draft and published, not archived)
- ✅ Assign residents to shifts
- ✅ Duplicate schedules
- ✅ Configure rotation constraints
- ✅ Generate automated rotations
- ✅ Manage roles (including shift type toggles and timings)
- ✅ Approve swap requests
- ✅ View duty hours (personal and program-wide, with per-role breakdown)
- ✅ Request guest residents from other programs
- ✅ Revoke guest resident access

### Regular Resident
**Permissions:**
- ✅ View published schedules
- ✅ See their shifts highlighted
- ✅ Request shift swaps
- ✅ Accept/reject incoming swap requests
- ✅ View duty hours (personal only)
- ❌ Cannot create/edit schedules
- ❌ Cannot see draft schedules

---

## Features Overview

### 1. Schedule Management
- Create weekly schedules with flexible date ranges
- Calendar date picker for easy date selection
- Assign multiple residents per shift (primary + backup)
- Day/Night shift support
- Edit published schedules
- Delete schedules (with warnings)
- Duplicate schedules to following weeks

### 2. Role Management
- Customize schedule roles per program (PICU, NICU, etc.)
- Set display order
- Enable/disable roles
- Toggle day/night shift per role (hide unused shift rows from grid)
- Configure shift start/end times per role (e.g., 07:00-19:00 day, 19:00-07:00 night)
- Automatic duration calculation (handles midnight crossing for night shifts)
- Delete roles (with cascade warning)

### 3. Smart Rotation Engine
- Automated schedule generation
- ACGME compliance enforcement (80hr/week, days off)
- Hour balancing across residents
- Constraint support (exclusions, pairings, vacation)
- Generate 1-52 weeks at once

### 4. Shift Swap Requests
- 2-step approval workflow (Target → Chief)
- Request swaps with any resident
- Accept/reject with optional messages
- Chief final approval
- View incoming/outgoing/all requests

### 5. Duty Hours Tracking
- Automatic hour calculation based on actual role shift timings (not hardcoded 12h)
- Per-role hours breakdown (Profile tab "Shifts Covered" section)
- Chiefs can filter and expand per-resident per-role hours in Duty Hours screen
- ACGME compliance monitoring
- Weekly and 4-week rolling averages
- Program-wide statistics (chiefs only)
- Violation tracking

### 6. Cross-Program Guest Residents
- Request residents from other programs for scheduling
- Full approval workflow: Program A requests → Program B's chief approves/declines
- Search external residents by name or program
- Two tabs: "Our Guests" (outgoing requests) and "Incoming Requests"
- Approved guests appear in schedule editor resident picker with "Guest" badge
- Revoke guest access at any time

### 7. Visual Enhancements
- Resident's shifts highlighted in blue
- White text on dark night shift cells
- Clear day/night separation
- Status badges (Draft/Published/Archived)
- Empty state guidance

---

## Test Scenarios

### Scenario 1: Create Your First Schedule (Chief)

**Goal:** Create a basic weekly schedule from scratch

**Steps:**
1. **Login** as Chief Resident
2. **Navigate** to Schedule tab
3. **Tap** the **+** (FAB) button
4. **Fill out the form:**
   - Week Name: "Week of Aug 19-25, 2024"
   - Start Date: Tap date field → Select from calendar → 2024-08-19
   - End Date: Tap date field → Select from calendar → 2024-08-25
   - Or use "Set to next Mon-Sun" helper
   - Notes: "First test schedule"
5. **Tap** "Create & Edit Schedule"

**Expected Results:**
- ✅ Redirected to edit screen
- ✅ See grid with roles (rows) and dates (columns)
- ✅ Day and Night rows for each role
- ✅ All cells show "—" (empty)

**Troubleshooting:**
- If no roles appear → Run `seed_default_schedule_roles()` in Supabase
- If can't create → Check user has `role = 'chief_resident'` and `is_approved = true`

---

### Scenario 2: Assign Residents to Shifts (Chief)

**Goal:** Add residents to the schedule

**Steps:**
1. **In edit mode**, tap any empty cell (e.g., PICU - Day - Monday)
2. **Modal appears** with list of residents
3. **Select 1-2 residents** for Primary section
4. **Optionally** select backup residents in Backup section
5. **Tap** "Done"
6. **Repeat** for other cells as needed
7. **Tap** "Save Schedule" when done

**Expected Results:**
- ✅ Resident names appear in the cell
- ✅ Backup residents show with "(Backup)" label
- ✅ Changes persist after saving
- ✅ Alumni do NOT appear in resident list
- ✅ Chief residents DO appear in resident list

**Troubleshooting:**
- If no residents appear → Check residents have `is_approved = true` and `role IN ('resident', 'chief_resident')`
- If alumni appear → This is a bug, they should be filtered out

---

### Scenario 3: Publish Schedule (Chief)

**Goal:** Make schedule visible to all residents

**Steps:**
1. **View** the schedule you created
2. **Tap** "Publish" button
3. **Confirm** the action

**Expected Results:**
- ✅ Status changes to "Published"
- ✅ "Publish" button disappears
- ✅ "📢 Published" badge appears
- ✅ Residents can now see this schedule
- ✅ "Edit Schedule" button still visible
- ✅ "Delete" button still visible (with warning)

---

### Scenario 4: View Schedule as Resident

**Goal:** Verify residents can see their assignments

**Steps:**
1. **Logout** and **login** as a Regular Resident
2. **Navigate** to Schedule tab
3. **Tap** on a published schedule
4. **Look** at the grid

**Expected Results:**
- ✅ Can see the schedule grid
- ✅ YOUR shifts are highlighted with blue border/background
- ✅ Day shifts (yours): Light blue background
- ✅ Night shifts (yours): Dark blue with light blue border
- ✅ Other residents' cells: Normal (no highlight)
- ✅ NO Edit button visible
- ✅ NO Publish/Delete buttons visible

**Test Cases:**
- ✅ Assigned to day shift → Light blue highlight
- ✅ Assigned to night shift → Dark blue highlight
- ✅ Assigned as backup → Still highlighted
- ✅ Not assigned → No highlight

---

### Scenario 5: Duplicate Schedule (Chief)

**Goal:** Copy a schedule to create multiple weeks quickly

**Steps:**
1. **View** any schedule
2. **Tap** "📋 Duplicate to Following Weeks" button
3. **In the modal:**
   - Number of Weeks: Select "4" (or use presets: 1, 4, 8, 12)
   - Start Date: Tap calendar → Select start date
   - Review "What will be copied" info box
4. **Tap** "Create Copies"

**Expected Results:**
- ✅ Success message: "Successfully created 4 schedule copies!"
- ✅ Redirected to schedule list
- ✅ 4 new schedules appear with auto-generated names
- ✅ All schedules created as DRAFTS
- ✅ Each has same role assignments
- ✅ Each has same resident assignments
- ✅ Dates are 7 days apart (weekly increments)

**Use Case:**
Create a perfect 1-week template → Duplicate 52 times → Entire year scheduled in 30 seconds!

---

### Scenario 6: Manage Roles (Chief)

**Goal:** Customize schedule roles for your program

**Steps:**
1. **From Schedule tab**, tap "⚙️ Manage Roles"
2. **View** existing roles (PICU, NICU, etc.)
3. **Add new role:**
   - Tap **+** button
   - Name: "Cardiology Consult"
   - Display Order: 10
   - Tap "Save"
4. **Edit role:**
   - Tap "Edit" on any role
   - Change name or display order
   - Tap "Save"
5. **Toggle active/inactive:**
   - Tap status badge to toggle
6. **Delete role:**
   - Tap "Delete" → Confirm
   - Warning: "This will also delete all assignments for this role"

**Expected Results:**
- ✅ New role appears in list immediately
- ✅ New role appears in schedule grid (next time you edit)
- ✅ Display order controls position in grid (lower = higher up)
- ✅ Inactive roles don't appear in schedule editor
- ✅ Deleted roles remove all related assignments

---

### Scenario 7: Request Shift Swap (Resident)

**Goal:** Request to swap shifts with another resident

**Steps:**
1. **Login** as Regular Resident
2. **Navigate** to **Swaps tab** (bottom navigation)
3. **Tap** the **+** button
4. **Follow the wizard:**
   - **Step 1:** Select week (published schedules only)
   - **Step 2:** Select YOUR shift to swap
   - **Step 3:** Select who you want to swap with (other residents)
   - **Step 4:** Enter reason: "Family emergency - need to travel"
5. **Tap** "Send Swap Request"

**Expected Results:**
- ✅ Success message: "Swap request sent!"
- ✅ Request appears in "Outgoing" tab
- ✅ Status: "Awaiting Response"
- ✅ Target resident sees it in their "Incoming" tab

**Restrictions:**
- ✅ Only published schedules appear
- ✅ Only YOUR assignments appear
- ✅ Alumni do NOT appear in target list
- ✅ You cannot select yourself

---

### Scenario 8: Respond to Swap Request (Target Resident)

**Goal:** Accept or reject an incoming swap request

**Steps:**
1. **Login** as the target resident (from previous scenario)
2. **Navigate** to Swaps tab
3. **Switch** to "Incoming" tab
4. **See** the swap request with:
   - From: [Requester name]
   - Your shift ⇄ Their shift
   - Reason displayed
5. **Option A: Accept**
   - Tap "Accept"
   - Add optional message: "Sure, happy to help!"
   - Tap "Accept"
6. **Option B: Reject**
   - Tap "Reject"
   - Confirm rejection

**Expected Results:**
- ✅ If accepted: Status → "Awaiting Chief"
- ✅ If rejected: Status → "Rejected"
- ✅ Response message saved
- ✅ Requester sees updated status
- ✅ Chief sees request (if accepted)

---

### Scenario 9: Approve Swap Request (Chief)

**Goal:** Final approval of accepted swap

**Steps:**
1. **Login** as Chief Resident
2. **Navigate** to Swaps tab
3. **See** all swap requests with status "Awaiting Chief"
4. **Review** swap details:
   - Who's swapping
   - Which shifts
   - Reason and response
5. **Choose:**
   - **Approve** → Assignments are swapped
   - **Reject** → Request denied

**Expected Results:**
- ✅ If approved: Assignments actually swap in schedule
- ✅ Status → "Approved"
- ✅ Both residents notified
- ✅ Changes visible in schedule grid

**2-Step Workflow:**
```
Resident A requests → Resident B accepts → Chief approves → Done!
```

---

### Scenario 10: View Duty Hours (All Users)

**Goal:** Check ACGME compliance and hour tracking

**Steps:**
1. **Navigate** to Schedule tab → **Duty Hours** (from menu)
2. **Residents see:**
   - Current week total hours
   - Day/Night shift breakdown
   - Days off count
   - Compliance status (✓ COMPLIANT or ⚠ VIOLATIONS)
   - 4-week rolling average
   - Weekly history
3. **Chiefs see additional tab:**
   - Switch to "Program" tab
   - Program compliance rate
   - Total residents / compliant / violations
   - Common violations list
   - Recent resident hours

**Expected Results:**
- ✅ Hours auto-calculated from assignments
- ✅ Compliance checked against ACGME rules:
  - ✅ 80 hours/week max
  - ✅ 1 day off per week min
  - ✅ Every-3rd-night rule
- ✅ Violations highlighted in red
- ✅ Compliant residents in green

---

### Scenario 11: Generate Rotation (Chiefs - Advanced)

**Goal:** Auto-generate weeks using smart algorithm

**Steps:**
1. **Create** a template week with all roles defined
2. **Assign** at least one resident per role
3. **Publish** the template
4. **Configure constraints** (optional):
   - Navigate to Schedule → Configure Rotation
   - Add constraints:
     - Exclude resident from specific role
     - Required pairs (2 residents always together)
     - Vacation blocks
5. **Generate:**
   - View template week
   - Tap "Generate Rotation"
   - Select number of weeks: 12
   - Select start date
   - Tap "Generate"

**Expected Results:**
- ✅ 12 new draft schedules created
- ✅ Residents rotated through roles
- ✅ Hours balanced across residents
- ✅ ACGME compliance enforced
- ✅ Constraints respected
- ✅ Weekends and nights fairly distributed

---

### Scenario 12: Edit Published Schedule (Chiefs)

**Goal:** Make changes to already-published schedule

**Steps:**
1. **View** a published schedule
2. **Notice:** "Edit Schedule" button IS visible
3. **Tap** "Edit Schedule"
4. **Make changes** to assignments
5. **Tap** "Save Schedule"

**Expected Results:**
- ✅ Can edit even though published
- ✅ Changes save immediately
- ✅ Residents see updated schedule
- ✅ Schedule stays published (doesn't revert to draft)

**Use Case:**
Chief needs to make last-minute swaps or cover for sick residents.

---

### Scenario 13: Delete Published Schedule (Chiefs)

**Goal:** Remove an incorrect or outdated published schedule

**Steps:**
1. **View** a published schedule
2. **Tap** "Delete" button
3. **Read warning:**
   - "This schedule is PUBLISHED and visible to all residents."
   - "Deleting it will remove all assignments and duty hour tracking."
   - "Are you sure?"
4. **Confirm** or Cancel

**Expected Results:**
- ✅ Delete button visible for published schedules
- ✅ Strong warning message shown
- ✅ If confirmed: Schedule completely deleted
- ✅ All assignments removed
- ✅ Duty hour tracking data removed

**Note:** Archived schedules CANNOT be deleted (protected as historical records).

---

### Scenario 14: Calendar Date Picker

**Goal:** Test date selection with calendar UI

**Steps:**
1. **Create new schedule**
2. **Tap** "Start Date" field
3. **Calendar picker appears:**
   - **iOS:** Spinner-style with "Done" button
   - **Android:** Calendar dialog
   - **Web:** Browser native date input
4. **Select date** from calendar
5. **On iOS:** Tap "Done"
6. **Repeat** for End Date

**Expected Results:**
- ✅ Calendar shows current month
- ✅ Easy to pick dates visually
- ✅ Auto-formats to YYYY-MM-DD
- ✅ "Set to next Mon-Sun" helper still works
- ✅ No need to type dates manually

---

### Scenario 15: Highlight Verification (Residents)

**Goal:** Verify shift highlighting works correctly

**Test Cases:**

| Scenario | Expected Highlight |
|----------|-------------------|
| Assigned to day shift as primary | Light blue background + blue border |
| Assigned to night shift as primary | Dark blue background + light blue border |
| Assigned as backup (day) | Light blue background + blue border |
| Assigned as backup (night) | Dark blue background + light blue border |
| Not assigned to cell | No highlight (normal) |
| Another resident's shift | No highlight (normal) |

**Steps:**
1. **View schedule** with various assignments
2. **Verify** YOUR cells are highlighted
3. **Verify** OTHER residents' cells are NOT highlighted
4. **Check** both day and night shifts
5. **Check** both primary and backup assignments

---

### Scenario 16: Configure Shift Types on Roles (Chief)

**Goal:** Toggle day/night shifts per role and set custom timings

**Steps:**
1. **Navigate** to Schedule tab → "Manage Roles"
2. **Tap "Edit"** on an existing role (e.g., PICU)
3. **Toggle checkboxes:**
   - Uncheck "Night Shift" → role will only show day row in grid
   - Or uncheck "Day Shift" → role will only show night row
4. **Set shift timings:**
   - Day Shift Start: Tap → Select 07:00 from time picker
   - Day Shift End: Tap → Select 19:00
   - Night Shift Start: Tap → Select 19:00
   - Night Shift End: Tap → Select 07:00
5. **Observe** duration display (e.g., "12.0 hrs" and "Crosses midnight" note for night)
6. **Tap "Save"**

**Expected Results:**
- ✅ Role card shows timing badges (e.g., "Day: 7:00 AM - 7:00 PM (12.0h)")
- ✅ Unchecked shift type hidden from schedule edit grid
- ✅ Unchecked shift type hidden from schedule view grid
- ✅ Duration correctly calculates midnight crossing (19:00→07:00 = 12h)
- ✅ Time picker shows 48 half-hour options (00:00 through 23:30)
- ✅ Disabled shift shows times as null/empty

**Edge Cases:**
- ✅ Both shifts enabled (default) → both rows visible
- ✅ Only day enabled → night row hidden in grid
- ✅ Only night enabled → day row hidden in grid
- ✅ Short shift (e.g., 08:00→12:00 = 4h) calculates correctly

---

### Scenario 17: View Hours by Role (Resident)

**Goal:** See per-role hours breakdown in Profile

**Steps:**
1. **Login** as a resident with schedule assignments
2. **Navigate** to **Profile tab**
3. **Look** for "Shifts Covered" section (between Program Info and Quick Actions)

**Expected Results:**
- ✅ Each role shows on its own row
- ✅ Per-role info: role name, "N day, N night" shift counts, total hours
- ✅ Hours use actual shift timings (not hardcoded 12h)
- ✅ Grand total row at bottom with combined shifts and hours
- ✅ If no assignments, section shows "No shifts recorded yet"

---

### Scenario 18: View Per-Resident Role Hours (Chief)

**Goal:** Chiefs can see detailed hours breakdown per resident per role

**Steps:**
1. **Login** as Chief Resident
2. **Navigate** to Schedule tab → Duty Hours
3. **Switch** to "Program" tab
4. **Use filter** to search by resident name
5. **Tap** on a resident card to expand
6. **View** role-by-role breakdown

**Expected Results:**
- ✅ Filter narrows resident list by name
- ✅ Tapping a resident expands their card
- ✅ Expanded view shows per-role hours (role name, shift counts, hours)
- ✅ Hours reflect actual role timings
- ✅ Tapping again collapses the card

---

### Scenario 19: Request Guest Resident (Chief - Program A)

**Goal:** Request a resident from another program to join your schedule

**Prerequisites:**
- Two programs in the system (Program A and Program B)
- Each with at least one chief resident and one regular resident

**Steps:**
1. **Login** as Chief of Program A
2. **Navigate** to Schedule tab → "Guest Residents"
3. **Verify** you're on the "Our Guests" tab
4. **Tap** the **+** (FAB) button
5. **In the search modal:**
   - Type a name or program name in the search field
   - Tap "Search"
   - Results show residents from OTHER programs only
6. **Tap** a resident to select them (highlighted blue)
7. **Add optional note:** "Need coverage for ICU rotation Sept 1-14"
8. **Tap** "Send Request"

**Expected Results:**
- ✅ Success message: "Guest request sent for [Name]. Their program will review it."
- ✅ Request appears in "Our Guests" tab with status "PENDING"
- ✅ Note displayed on the request card
- ✅ Residents from YOUR program do NOT appear in search
- ✅ Alumni do NOT appear in search
- ✅ If a request already exists for that resident, their status badge shows (can't re-request)
- ✅ Attempting to request same resident twice shows error

---

### Scenario 20: Review Guest Request (Chief - Program B)

**Goal:** Approve or decline an incoming guest request from another program

**Steps:**
1. **Login** as Chief of Program B (the resident's home program)
2. **Navigate** to Schedule tab → "Guest Residents"
3. **Switch** to "Incoming Requests" tab
4. **See** the request from Program A:
   - Resident name, PGY level
   - "Requested by: [Program A name]"
   - Note from requester
5. **Tap** "Review"
6. **In the review modal:**
   - See details: "[Program A] is requesting [Resident Name] to be added to their schedule"
   - Add optional review notes: "Approved for September coverage"
   - Choose: **Approve** or **Decline**

**Expected Results (Approve):**
- ✅ Status changes to "APPROVED" (green badge)
- ✅ Review notes saved and displayed
- ✅ Resident now available in Program A's schedule editor

**Expected Results (Decline):**
- ✅ Status changes to "DECLINED" (red badge)
- ✅ Program A sees declined status on their "Our Guests" tab

---

### Scenario 21: Assign Guest Resident to Schedule (Chief - Program A)

**Goal:** Add an approved guest to the schedule

**Steps:**
1. **Login** as Chief of Program A
2. **Edit** any schedule week
3. **Tap** an empty cell to assign residents
4. **In the resident picker modal:**
   - See your program residents listed normally
   - See approved guest residents listed with:
     - Orange "Guest" badge
     - Last name includes home program: "Smith (Program B)"
5. **Select** a guest resident for the shift
6. **Tap** "Done"

**Expected Results:**
- ✅ Guest appears in picker alongside program residents
- ✅ "Guest" badge clearly distinguishes them
- ✅ Home program name shown in parentheses
- ✅ Guest can be assigned as primary or backup
- ✅ Guest appears in bulk assign modal too
- ✅ Assignment persists after saving

---

### Scenario 22: Revoke Guest Access (Chief - Program A)

**Goal:** Remove a previously approved guest

**Steps:**
1. **Navigate** to Schedule tab → "Guest Residents"
2. **On "Our Guests" tab**, find an approved guest
3. **Tap** "Revoke Access"
4. **Confirm** the revocation

**Expected Results:**
- ✅ Confirmation prompt: "Revoke guest access for [Name]?"
- ✅ Status changes to "REVOKED" (gray badge)
- ✅ Guest no longer appears in schedule editor resident picker
- ✅ Existing assignments NOT retroactively removed (they stay in past schedules)

---

## Troubleshooting

### Problem: No schedules appear

**Check:**
```sql
SELECT * FROM schedule_weeks WHERE program_id = 'YOUR_PROGRAM_ID';
```

**Solutions:**
- If empty → Create a schedule
- If has rows but UI shows empty → Check RLS policies
- Check user's `program_id` matches schedule's `program_id`

---

### Problem: No roles appear in schedule grid

**Check:**
```sql
SELECT * FROM schedule_roles WHERE program_id = 'YOUR_PROGRAM_ID' AND is_active = true;
```

**Solutions:**
- If empty → Run `seed_default_schedule_roles('YOUR_PROGRAM_ID')`
- If inactive → Toggle roles active in Manage Roles screen

---

### Problem: Residents don't appear in assignment modal

**Check:**
```sql
SELECT id, first_name, last_name, role, pgy, is_approved 
FROM profiles 
WHERE program_id = 'YOUR_PROGRAM_ID' 
AND role IN ('resident', 'chief_resident')
AND pgy != 'ALUMNI';
```

**Solutions:**
- No results → Create test resident accounts
- `is_approved = false` → Approve residents first
- `pgy = 'ALUMNI'` → This is correct (alumni excluded)

---

### Problem: Swap requests not showing

**Check:**
```sql
SELECT ar.*, p.first_name, p.last_name
FROM shift_swap_requests ar
JOIN profiles p ON p.id = ar.requester_id
WHERE ar.status = 'pending_target';
```

**Solutions:**
- Check both users in same program
- Check requester/target have proper assignments
- Pull to refresh on Swaps tab

---

### Problem: Duty hours show 0

**Check:**
```sql
SELECT * FROM schedule_rotation_tracking 
WHERE resident_id = 'YOUR_RESIDENT_ID'
ORDER BY created_at DESC;
```

**Solutions:**
- Duty hours only calculate for published schedules
- Check trigger `update_rotation_tracking_on_assignment` exists
- Trigger runs when assignments are created/updated

---

### Problem: Guest residents don't appear in schedule editor

**Check:**
```sql
SELECT * FROM program_guest_requests 
WHERE requesting_program_id = 'YOUR_PROGRAM_ID' 
AND status = 'approved';
```

**Solutions:**
- If no results → Request hasn't been approved yet by the other program's chief
- If approved but not showing → Check `get_approved_guests()` RPC exists (migration 026)
- Check that the approved guest has `is_approved = true` and `is_profile_complete = true` in profiles

---

### Problem: Guest request search returns no results

**Check:**
```sql
SELECT id, first_name, last_name, program_id, is_approved, is_profile_complete, role, pgy
FROM profiles 
WHERE program_id != 'YOUR_PROGRAM_ID'
AND role IN ('resident', 'chief_resident')
AND pgy != 'ALUMNI'
AND is_approved = true;
```

**Solutions:**
- If no results → No eligible residents in other programs
- Check that other programs exist with approved residents
- Search matches name, email, or program name (case-insensitive)

---

### Problem: Shift timings not reflecting in hours

**Check:**
```sql
SELECT role_name, day_shift_start_time, day_shift_end_time, 
       night_shift_start_time, night_shift_end_time
FROM schedule_roles WHERE program_id = 'YOUR_PROGRAM_ID';
```

**Solutions:**
- If times are NULL → Edit the role and set times (defaults: 07:00-19:00 day, 19:00-07:00 night)
- Check `calc_shift_hours()` function exists (migration 025)
- NULL times default to 12.0 hours in calculation

---

### Problem: Build fails on Vercel

**Check:**
- Run `npx expo export --platform web` locally
- Check for TypeScript errors: `npx tsc --noEmit`
- Check vercel.json has correct buildCommand

**Solutions:**
- If TypeScript errors in tests → Safe to ignore (test files)
- If build succeeds locally → Trigger Vercel redeploy
- Check Vercel logs for specific error

---

## Feature Checklist

Use this checklist to verify all features work:

### Schedule Management
- [ ] Create schedule with calendar date picker
- [ ] Edit draft schedule
- [ ] Edit published schedule
- [ ] Publish schedule
- [ ] Delete draft schedule
- [ ] Delete published schedule
- [ ] View schedule as resident
- [ ] Assign residents to shifts (day)
- [ ] Assign residents to shifts (night)
- [ ] Assign backup residents
- [ ] Multiple residents per shift
- [ ] Save and persist assignments

### Role Management
- [ ] View roles list
- [ ] Add new role
- [ ] Edit role name
- [ ] Edit display order
- [ ] Toggle role active/inactive
- [ ] Toggle day shift on/off
- [ ] Toggle night shift on/off
- [ ] Set day shift start/end times
- [ ] Set night shift start/end times
- [ ] Duration calculates correctly (including midnight crossing)
- [ ] Role card shows timing badges
- [ ] Disabled shift rows hidden in edit grid
- [ ] Disabled shift rows hidden in view grid
- [ ] Delete role
- [ ] Roles appear in correct order in grid

### Duplication
- [ ] Duplicate 1 week
- [ ] Duplicate 4 weeks
- [ ] Duplicate 12 weeks
- [ ] Duplicate 52 weeks
- [ ] Auto-generate week names
- [ ] Preserve assignments
- [ ] Preserve backup assignments
- [ ] Created as drafts

### Swap Requests
- [ ] Create swap request
- [ ] View incoming requests
- [ ] View outgoing requests
- [ ] Accept request (target)
- [ ] Reject request (target)
- [ ] Approve request (chief)
- [ ] Reject request (chief)
- [ ] Cancel request (requester)
- [ ] 2-step workflow works

### Duty Hours
- [ ] View personal hours
- [ ] View current week summary
- [ ] View 4-week rolling average
- [ ] View weekly history
- [ ] Compliance status shown
- [ ] Violations highlighted
- [ ] Chiefs see program view
- [ ] Program compliance rate
- [ ] Common violations list
- [ ] Per-role hours in Profile "Shifts Covered" section
- [ ] Chiefs can filter residents in Duty Hours
- [ ] Chiefs can expand residents for per-role breakdown
- [ ] Hours use actual role timings (not hardcoded 12h)

### Guest Residents
- [ ] Navigate to Guest Residents screen from Schedule tab
- [ ] Search external residents by name
- [ ] Search external residents by program name
- [ ] Send guest request with optional note
- [ ] View outgoing request statuses (pending/approved/declined/revoked)
- [ ] Review incoming requests (approve/decline with notes)
- [ ] Revoke approved guest access
- [ ] Approved guests appear in schedule editor picker
- [ ] Guest badge visible in resident picker
- [ ] Home program name shown next to guest name
- [ ] Guest badge in bulk assign modal
- [ ] Duplicate request prevented (unique constraint)
- [ ] Pull to refresh on guest requests list

### Visual/UX
- [ ] Resident's shifts highlighted (day)
- [ ] Resident's shifts highlighted (night)
- [ ] White text on night cells
- [ ] Calendar date picker works
- [ ] Status badges display correctly
- [ ] Empty states show helpful text
- [ ] Pull to refresh works

### Filters/Exclusions
- [ ] Alumni excluded from on-call
- [ ] Chief residents included in on-call
- [ ] Only approved residents appear
- [ ] Only published schedules visible to residents

---

## Success Criteria

✅ **Minimum Viable Test:**
1. Chief creates schedule ✓
2. Chief assigns residents ✓
3. Chief publishes schedule ✓
4. Resident views schedule ✓
5. Resident sees their shifts highlighted ✓

✅ **Full Feature Test:**
- All items in Feature Checklist checked ✓

---

## Support

**If you encounter issues:**
1. Check the troubleshooting section above
2. Review `TEST_SCHEDULE_SYSTEM.md` for database setup
3. Check Supabase logs for RLS policy errors
4. Verify all migrations are applied
5. Ensure test users have correct roles and program_id

**Common SQL checks:**
```sql
-- Check user roles
SELECT id, email, role, program_id, is_approved FROM profiles;

-- Check schedule roles
SELECT * FROM schedule_roles WHERE program_id = 'YOUR_PROGRAM_ID';

-- Check schedules
SELECT * FROM schedule_weeks WHERE program_id = 'YOUR_PROGRAM_ID';

-- Check assignments
SELECT * FROM schedule_assignments WHERE schedule_week_id = 'YOUR_WEEK_ID';

-- Health check
SELECT 'Total Weeks' as metric, COUNT(*)::text FROM schedule_weeks
UNION ALL
SELECT 'Total Roles', COUNT(*)::text FROM schedule_roles WHERE is_active = true
UNION ALL
SELECT 'Total Assignments', COUNT(*)::text FROM schedule_assignments;
```

---

## Version Info

**Last Updated:** September 2, 2026  
**Includes Features:** Schedule management, Role management (with shift types & timings), Duplication, Swap requests, Duty hours (with per-role breakdown), Guest residents (cross-program approval workflow), Visual enhancements  
**Migrations Required:** 019, 020, 021, 024, 025, 026
