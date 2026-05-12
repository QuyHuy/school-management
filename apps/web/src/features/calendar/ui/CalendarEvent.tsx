import type { CalendarSession, CalendarSlot } from "../model/types";

function formatTime(t: string) {
  return t.slice(0, 5); // "HH:MM"
}

interface SessionEventProps {
  session: CalendarSession;
  onClick: () => void;
}

export function SessionEvent({ session, onClick }: SessionEventProps) {
  const attended = session.has_attendance;
  const timeStr = session.start_time ? formatTime(session.start_time) : "";

  if (attended) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-sm border-l-2 border-success bg-success/8 px-1.5 py-0.5 mb-0.5"
      >
        <p className="text-[11px] font-semibold text-[#005c04] truncate">{session.class_name} ✓</p>
        {timeStr && <p className="text-[10px] text-success">{timeStr}</p>}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-sm border-l-2 border-error bg-error/8 px-1.5 py-0.5 mb-0.5"
    >
      <p className="text-[11px] font-semibold text-error truncate">{session.class_name} !</p>
      {timeStr && <p className="text-[10px] text-error">Chưa ĐD</p>}
    </button>
  );
}

interface SlotEventProps {
  slot: CalendarSlot;
  onClick: () => void;
  loading?: boolean;
}

export function SlotEvent({ slot, onClick, loading }: SlotEventProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full text-left rounded-sm border-l-2 border-stone bg-surface px-1.5 py-0.5 mb-0.5 disabled:opacity-50"
    >
      <p className="text-[11px] font-semibold text-ash truncate">{slot.class_name}</p>
      <p className="text-[10px] text-mute">{formatTime(slot.start_time)}</p>
    </button>
  );
}
