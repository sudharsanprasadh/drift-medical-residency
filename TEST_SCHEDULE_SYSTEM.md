# Schedule System Testing & Debugging Guide

## Prerequisites Checklist

### 1. Database Verification

Run these queries in Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'schedule%';

-- Expected output: 9 tables
-- schedule_weeks
-- schedule_roles
-- schedule_assignments
-- schedule_assignment_residents
-- schedule_rotation_constraints
-- schedule_rotation_tracking
-- schedule_rotation_templates
-- schedule_generation_jobs
-- shift_swap_requests
```

### 2. Check Roles are Seeded

```sql
-- Check if roles exist for your program
SELECT * FROM schedule_roles WHERE program_id = 'YOUR_PROGRAM_ID';

-- If empty, seed them:
SELECT seed_default_schedule_roles('YOUR_PROGRAM_ID');

-- Verify:
SELECT role_name, is_active FROM schedule_roles WHERE program_id = 'YOUR_PROGRAM_ID';
```

### 3. Check RLS Policies

```sql
-- Check if policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'schedule%';

-- Should show multiple policies per table
```

### 4. Test User Permissions

```sql
-- Check your user's role
SELECT id, email, role, is_approved, program_id FROM profiles WHERE email = 'your-email@example.com';

-- Role must be one of: chief_resident, program_coordinator, program_director, admin
-- is_approved must be TRUE
```

---

## Testing Flow (Chiefs/Coordinators)

### Test 1: Create a Week

**UI Steps:**
1. Login as chief/coordinator
2. Navigate to Schedule tab
3. Tap the + (FAB) button
4. Should see "Create Weekly Schedule" screen

**Expected Behavior:**
- Form with: Week Name, Start Date, End Date, Notes
- "Auto-generate from dates" link works
- "Set to next Mon-Sun" link works

**If it fails:**
```sql
-- Check if you can insert manually
INSERT INTO schedule_weeks (program_id, week_name, start_date, end_date, created_by)
VALUES (
  'YOUR_PROGRAM_ID',
  'Test Week',
  '2024-08-19',
  '2024-08-25',
  'YOUR_USER_ID'
);

-- If this fails, check RLS policies
```

### Test 2: View Schedule List

**UI Steps:**
1. After creating a week, you should see it in the list
2. Tap on the week to view

**Debug Query:**
```sql
-- Check if weeks exist
SELECT * FROM schedule_weeks WHERE program_id = 'YOUR_PROGRAM_ID' ORDER BY created_at DESC;

-- Check what the API should return
SELECT 
  sw.*,
  p.program_name,
  pr.first_name || ' ' || pr.last_name as creator_name
FROM schedule_weeks sw
LEFT JOIN programs p ON p.id = sw.program_id
LEFT JOIN profiles pr ON pr.id = sw.created_by
WHERE sw.program_id = 'YOUR_PROGRAM_ID';
```

### Test 3: Edit Schedule (Assign Residents)

**UI Steps:**
1. From schedule view, tap "Edit Schedule"
2. Should see grid with roles × days
3. Tap any cell
4. Should see modal with resident list

**Expected:**
- Roles appear on left (PICU, NICU, etc.)
- Dates appear across top
- Each cell is tappable

**Debug:**
```sql
-- Check if roles exist and are active
SELECT * FROM schedule_roles 
WHERE program_id = 'YOUR_PROGRAM_ID' 
AND is_active = true 
ORDER BY display_order;

-- Check if residents exist
SELECT id, first_name, last_name, role, is_approved 
FROM profiles 
WHERE program_id = 'YOUR_PROGRAM_ID' 
AND role IN ('resident', 'chief_resident')
AND is_approved = true;
```

### Test 4: Assign Residents to Shifts

**UI Steps:**
1. In edit mode, tap a cell
2. Select residents from modal
3. Tap "Done"
4. Should see resident names in cell

**Debug:**
```sql
-- Manually create an assignment to test
-- Step 1: Create assignment
INSERT INTO schedule_assignments (schedule_week_id, role_id, shift_date, shift_period)
VALUES (
  'YOUR_WEEK_ID',
  'YOUR_ROLE_ID',
  '2024-08-19',
  'day'
) RETURNING id;

-- Step 2: Assign resident
INSERT INTO schedule_assignment_residents (assignment_id, resident_id, is_backup)
VALUES (
  'ASSIGNMENT_ID_FROM_ABOVE',
  'RESIDENT_ID',
  false
);

-- Step 3: Verify
SELECT 
  sa.shift_date,
  sa.shift_period,
  sr.role_name,
  p.first_name || ' ' || p.last_name as resident_name,
  sar.is_backup
FROM schedule_assignments sa
JOIN schedule_roles sr ON sr.id = sa.role_id
JOIN schedule_assignment_residents sar ON sar.assignment_id = sa.id
JOIN profiles p ON p.id = sar.resident_id
WHERE sa.schedule_week_id = 'YOUR_WEEK_ID';
```

### Test 5: View Grid

**UI Steps:**
1. Go back to schedule view
2. Should see grid with assigned residents

**Debug Query:**
```sql
-- Test the grid view function
SELECT * FROM get_schedule_week_grid('YOUR_WEEK_ID');

-- This should return rows with:
-- shift_date, role_id, role_name, day_residents[], night_residents[], etc.
```

---

## Common Issues & Solutions

### Issue 1: "No schedules found"

**Possible Causes:**
1. No weeks created
2. RLS blocking access
3. Wrong program_id

**Debug:**
```sql
-- Check if weeks exist at all
SELECT COUNT(*) FROM schedule_weeks;

-- Check your user's program
SELECT program_id FROM profiles WHERE id = auth.uid();

-- Check if RLS is blocking
SET LOCAL ROLE postgres;  -- Bypass RLS temporarily
SELECT * FROM schedule_weeks;
RESET ROLE;
```

### Issue 2: "No roles appear in grid"

**Solution:**
```sql
-- Seed roles
SELECT seed_default_schedule_roles('YOUR_PROGRAM_ID');

-- Verify
SELECT * FROM schedule_roles WHERE program_id = 'YOUR_PROGRAM_ID';
```

### Issue 3: "Can't assign residents"

**Check:**
```sql
-- Are there residents in your program?
SELECT COUNT(*) FROM profiles 
WHERE program_id = 'YOUR_PROGRAM_ID' 
AND role IN ('resident', 'chief_resident')
AND is_approved = true;

-- If 0, you need to:
-- 1. Create test resident accounts
-- 2. Complete their profiles
-- 3. Approve them
```

### Issue 4: "Grid shows empty cells"

**Debug:**
```sql
-- Check if assignments exist
SELECT 
  sa.id,
  sa.shift_date,
  sa.shift_period,
  sr.role_name,
  COUNT(sar.id) as resident_count
FROM schedule_assignments sa
JOIN schedule_roles sr ON sr.id = sa.role_id
LEFT JOIN schedule_assignment_residents sar ON sar.assignment_id = sa.id
WHERE sa.schedule_week_id = 'YOUR_WEEK_ID'
GROUP BY sa.id, sa.shift_date, sa.shift_period, sr.role_name
ORDER BY sa.shift_date;
```

---

## Testing Residents View

**UI Steps:**
1. Login as a resident (not chief)
2. Navigate to Schedule tab
3. Should only see published weeks

**Expected:**
- No + button (residents can't create)
- No Edit button (residents can't edit)
- Can view grid read-only

**Debug:**
```sql
-- Check resident's role
SELECT role, is_approved FROM profiles WHERE id = 'RESIDENT_USER_ID';

-- Should be: role = 'resident', is_approved = true
```

---

## API Endpoint Testing

You can test the API functions directly in the app:

```typescript
// In a useEffect or button handler
import { getScheduleWeeks, getScheduleRoles } from '../services/api';

useEffect(() => {
  async function test() {
    try {
      const weeks = await getScheduleWeeks('YOUR_PROGRAM_ID');
      console.log('Weeks:', weeks);
      
      const roles = await getScheduleRoles('YOUR_PROGRAM_ID');
      console.log('Roles:', roles);
    } catch (error) {
      console.error('API Error:', error);
    }
  }
  test();
}, []);
```

---

## Network Debugging

### Check Supabase Connection

```typescript
// Add to any screen's useEffect
import { supabase } from '../services/supabase';

useEffect(() => {
  async function testConnection() {
    const { data, error } = await supabase
      .from('schedule_weeks')
      .select('count');
    
    console.log('Supabase test:', { data, error });
  }
  testConnection();
}, []);
```

### Enable Verbose Logging

Add to `src/services/api.ts`:

```typescript
// At the top of any API function
console.log('[API] Function called with:', arguments);

// After Supabase query
console.log('[API] Supabase response:', { data, error });
```

---

## Quick Health Check Script

Run this in Supabase SQL Editor:

```sql
-- SCHEDULE SYSTEM HEALTH CHECK
-- Run this to check overall system health

SELECT 'Total Weeks' as metric, COUNT(*)::text as value FROM schedule_weeks
UNION ALL
SELECT 'Total Roles', COUNT(*)::text FROM schedule_roles WHERE is_active = true
UNION ALL
SELECT 'Total Assignments', COUNT(*)::text FROM schedule_assignments
UNION ALL
SELECT 'Total Resident Assignments', COUNT(*)::text FROM schedule_assignment_residents
UNION ALL
SELECT 'Programs with Roles', COUNT(DISTINCT program_id)::text FROM schedule_roles
UNION ALL
SELECT 'Chiefs/Coordinators', COUNT(*)::text FROM profiles 
  WHERE role IN ('chief_resident', 'program_coordinator', 'program_director') 
  AND is_approved = true
UNION ALL
SELECT 'Approved Residents', COUNT(*)::text FROM profiles 
  WHERE role = 'resident' 
  AND is_approved = true;
```

Expected output:
```
Total Weeks: 1+ (or 0 if just starting)
Total Roles: 11+ per program
Total Assignments: varies
Total Resident Assignments: varies
Programs with Roles: 1+
Chiefs/Coordinators: 1+
Approved Residents: 1+
```

---

## Next Steps

1. Run the health check above
2. Share the results
3. Tell me which specific screen/feature is not working
4. I'll help debug the exact issue
