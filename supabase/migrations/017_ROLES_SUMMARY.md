# New Roles Summary - Migration 017

This migration adds two new roles to the system with specific privilege levels.

## New Roles

### 1. Program Director
**Privilege Level:** Same as Chief Resident and Program Coordinator (program-scoped management)

**Capabilities:**
- ✅ View and approve/reject approval requests from their program
- ✅ Create announcements for their program
- ✅ Create, update, and delete events for their program
- ✅ Auto-approved when they are the first leadership role in a program
- ❌ Cannot delete other people's announcements (only admins can)
- ❌ Cannot access other programs' data

### 2. Faculty
**Privilege Level:** Same as Resident (view-only, program-scoped)

**Capabilities:**
- ✅ View their own approval request
- ✅ View announcements in their program
- ✅ View events in their program
- ✅ View profiles of other members in their program
- ❌ Cannot approve/reject other residents
- ❌ Cannot create announcements
- ❌ Cannot manage events

## Role Hierarchy

```
Admin (system-wide access)
├── Program Director (program-scoped management)
├── Program Coordinator (program-scoped management)
├── Chief Resident (program-scoped management)
├── Faculty (program-scoped view-only)
└── Resident (program-scoped view-only)
```

## Migration Notes

- **Part 1:** Adds the enum values to the database (must be committed first)
- **Part 2:** Updates all RLS policies and functions to include the new roles

## Updated Policies

### Approval Requests
- Program Directors can view/update requests from their program (same as Chiefs)
- Faculty inherits resident privileges (view own requests only)

### Announcements
- Program Directors can create announcements (same as Chiefs)
- Faculty inherits resident privileges (view-only)

### Events
- Program Directors can create/update/delete events (same as Chiefs)
- Faculty inherits resident privileges (view-only)

### Auto-Approve Function
- Program Directors are auto-approved if they're the first leadership role in a program
