"use client";

import { useEffect, useRef, useState } from "react";
import {
  createFeedbackApi,
  listNotificationsApi,
  markNotificationReadApi,
} from "@/src/features/notifications/api/notifications.api";
import type { Notification } from "@/src/features/notifications/model/types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ParentNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackContent, setFeedbackContent] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    listNotificationsApi()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkRead(id: string) {
    await markNotificationReadApi(id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function handleFeedback(notif: Notification) {
    const content = feedbackContent[notif.id]?.trim();
    if (!content || submitting) return;
    setSubmitting(notif.id);
    try {
      await createFeedbackApi({
        recipient_id: notif.sender_id,
        student_id: notif.student_id ?? undefined,
        notification_id: notif.id,
        content,
      });
      setFeedbackContent((prev) => ({ ...prev, [notif.id]: "" }));
      showToast("Đã gửi phản hồi.");
    } catch {
      showToast("Lỗi khi gửi phản hồi.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="p-5 flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-stone/20 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink">Thông báo từ giáo viên</h1>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-sm bg-ink px-4 py-2 text-sm text-canvas shadow-lg">
          {toast}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-6 text-center">
          <p className="text-sm text-ash">Chưa có thông báo nào.</p>
        </div>
      ) : (
        items.map((notif) => (
          <div
            key={notif.id}
            className={`rounded-md border bg-canvas p-4 flex flex-col gap-3 ${notif.read_at ? "border-border" : "border-primary/40 bg-primary/5"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-ink flex-1">{notif.content}</p>
              {!notif.read_at && (
                <button
                  onClick={() => handleMarkRead(notif.id)}
                  className="text-xs text-primary underline shrink-0"
                >
                  Đánh dấu đọc
                </button>
              )}
            </div>
            <p className="text-xs text-ash">{formatDateTime(notif.created_at)}</p>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <textarea
                value={feedbackContent[notif.id] ?? ""}
                onChange={(e) => setFeedbackContent((prev) => ({ ...prev, [notif.id]: e.target.value }))}
                placeholder="Phản hồi đến giáo viên..."
                rows={2}
                className="w-full resize-none rounded border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => handleFeedback(notif)}
                disabled={submitting === notif.id || !feedbackContent[notif.id]?.trim()}
                className="self-end rounded-sm bg-primary px-4 py-1.5 text-sm font-semibold text-canvas hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {submitting === notif.id ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
