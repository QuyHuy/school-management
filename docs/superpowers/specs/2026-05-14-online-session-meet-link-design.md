# Online Session + Google Meet Link — Design Spec

## Goal

Allow teachers to mark a class session as **online**, automatically generate a Google Meet link, and manually send the link to the class channel (Feature 2 dependency) from the session detail page.

## Scope

This spec covers **Feature 1 only**: session mode, Meet link generation, and the notification stub. The class channel (Feature 2) is a declared dependency — the "Gửi vào class channel" button is wired in this feature but the actual send logic ships with Feature 2.

---

## Data Layer

### Migration

Add 3 columns to `class_sessions`:

| Column | Type | Constraint | Default |
|---|---|---|---|
| `mode` | `VARCHAR(10)` | NOT NULL | `'offline'` |
| `start_time` | `TIME` | nullable | — |
| `meet_link` | `VARCHAR(100)` | nullable | — |

Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotency.

All existing sessions inherit `mode = 'offline'`, `start_time = NULL`, `meet_link = NULL` — no data migration needed.

### Domain Entity

`ClassSession` entity (`app/domain/entities/attendance.py`) gains:

```python
mode: str          # "online" | "offline"
start_time: time | None
meet_link: str | None
```

### DB Model

`ClassSessionModel` (`app/infrastructure/db/models/attendance.py`) gains the same 3 columns via SQLAlchemy `Column` definitions.

---

## Meet Link Generator

New utility: `app/infrastructure/utils/meet.py`

```python
import random, string

def generate_meet_link() -> str:
    def seg(n): return "".join(random.choices(string.ascii_lowercase, k=n))
    return f"meet.google.com/{seg(3)}-{seg(4)}-{seg(3)}"
```

No Google credentials required. Google Meet creates the room on demand when the first participant opens the link.

---

## Backend API

### Schemas (`app/interfaces/api/v1/schemas/attendance.py`)

**`CreateSessionRequest`** — add:
```python
mode: Literal["online", "offline"] = "offline"
start_time: time | None = None

@validator("start_time")
def start_time_required_for_online(cls, v, values):
    if values.get("mode") == "online" and v is None:
        raise ValueError("Giờ bắt đầu là bắt buộc khi học online")
    return v
```

**`UpdateSessionRequest`** — add:
```python
mode: Literal["online", "offline"] | None = None
start_time: time | None = None
# notes: str | None already exists
```

**`SessionResponse`** — add:
```python
mode: str
start_time: time | None
meet_link: str | None
```

### Use Cases

**`CreateSessionUseCase`** (`app/application/use_cases/attendance/create_session.py`):
- Accept `mode` and `start_time` in `execute()`
- If `mode == "online"`: call `generate_meet_link()` and assign to `meet_link`
- If `mode == "offline"`: `meet_link = None`

**`UpdateSessionUseCase`** (`app/application/use_cases/attendance/update_session.py`):
- Accept `mode` and `start_time` in `execute()`
- If `mode` changes to `"online"` and current `meet_link` is `None`: generate a new link
- If `mode` changes to `"offline"`: keep existing `meet_link` (do not clear — teacher may want to reference it)
- If `mode` is `None` in the request: leave existing mode unchanged

### New Endpoint — Notify Meet (stub)

```
POST /api/v1/classes/{class_id}/sessions/{session_id}/notify-meet
Auth: teacher or admin
```

Response (stub, HTTP 200):
```json
{ "sent": false, "message": "Class channel chưa được setup" }
```

This endpoint exists so the frontend can wire the button now. Feature 2 replaces the stub body with actual class channel send logic.

### Repository

`IAttendanceRepository` and `SQLAttendanceRepository` — `create_session` and `update_session` accept and persist the 3 new fields.

---

## Frontend

### Types (`apps/web/src/features/attendance/model/types.ts`)

```typescript
interface ClassSession {
  id: string
  class_id: string
  date: string
  notes: string | null
  created_at: string
  // new
  mode: "online" | "offline"
  start_time: string | null   // "HH:MM:SS"
  meet_link: string | null
}
```

### API (`apps/web/src/features/attendance/api/attendance.api.ts`)

`createSessionApi` request body gains `mode` and `start_time`.

`patchSessionNotesApi` → rename to `updateSessionApi`, request body gains `mode` and `start_time`.

New function:
```typescript
notifyMeetApi(classId: string, sessionId: string): Promise<{ sent: boolean; message: string }>
```

### Session Creation Form (`SessionSection.tsx`)

Add below the date picker:

1. **Mode toggle** — two buttons "Offline" / "Online". Default: Offline.
2. **Start time input** (`<input type="time">`) — visible only when Online is selected. Required.

On submit: pass `mode` and `start_time` (or `null`) to `createSessionApi`.

### Session Detail Page (`/classes/[id]/sessions/[sessionId]/page.tsx`)

Add to the session info header area:

**Mode badge:**
- Online → badge with primary color: `Khối học Online`
- Offline → neutral ash badge: `Offline`

**If mode = online**, show a Meet link card below the badge:
```
🔗 meet.google.com/xxx-xxxx-xxx   [Copy]
```
Copy button writes the full URL (`https://` + link) to clipboard and shows "Đã copy!" for 2 seconds.

**"Gửi vào class channel" button** (primary outline style):
- Calls `notifyMeetApi`
- While loading: "Đang gửi..."
- On success (`sent: false`): show inline message "Tính năng đang phát triển — sẽ hoạt động sau khi setup class channel"
- On success (`sent: true`, Feature 2): show "Đã gửi vào class channel ✓"
- On error: show error detail from API

---

## Dependencies

| Dependency | Status |
|---|---|
| Feature 2 — class channel | Not built. `notify-meet` endpoint is a stub. |
| Google credentials | Not required. Link is randomly generated. |

---

## Out of Scope

- Recurring Meet links (same link reused across sessions)
- Cancelling / invalidating Meet links
- Recording attendance via Meet
- Push notifications when app is closed (belongs to Feature 2+)
