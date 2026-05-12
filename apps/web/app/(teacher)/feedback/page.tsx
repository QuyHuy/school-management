"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import {
  listFeedbackApi,
  replyFeedbackApi,
} from "@/src/features/notifications/api/notifications.api";
import type { Feedback } from "@/src/features/notifications/model/types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TeacherFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
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
    listFeedbackApi()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function handleReply(id: string) {
    const content = replyContent[id]?.trim();
    if (!content || submitting) return;
    setSubmitting(id);
    try {
      const updated = await replyFeedbackApi(id, content);
      setItems((prev) => prev.map((f) => f.id === id ? updated : f));
      setReplyContent((prev) => ({ ...prev, [id]: "" }));
      showToast("Đã gửi trả lời.");
    } catch {
      showToast("Lỗi khi gửi trả lời.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-stone/20 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-ink tracking-tight">Hộp thư phản hồi</h1>
          </div>
          <p className="text-sm text-ash">{items.length} phản hồi từ phụ huynh</p>
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-primary px-4 py-2 text-sm text-canvas shadow-lg">
          {toast}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-border bg-canvas p-8 text-center">
          <p className="text-sm text-ash">Chưa có phản hồi nào từ phụ huynh.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((fb) => (
            <div key={fb.id} className="rounded-md border border-border bg-canvas p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-ink flex-1">{fb.content}</p>
                <span className={`text-xs font-semibold ml-3 ${fb.reply_content ? "text-success" : "text-warning"}`}>
                  {fb.reply_content ? "Đã trả lời" : "Chờ trả lời"}
                </span>
              </div>
              <p className="text-xs text-ash">{formatDateTime(fb.created_at)}</p>

              {fb.reply_content ? (
                <div className="rounded-sm bg-surface px-3 py-2 border-l-2 border-primary">
                  <p className="text-xs text-ash mb-1">Trả lời của bạn:</p>
                  <p className="text-sm text-ink">{fb.reply_content}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <textarea
                    value={replyContent[fb.id] ?? ""}
                    onChange={(e) => setReplyContent((prev) => ({ ...prev, [fb.id]: e.target.value }))}
                    placeholder="Nhập câu trả lời cho phụ huynh..."
                    rows={3}
                    className="w-full resize-none rounded border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={() => handleReply(fb.id)}
                    disabled={submitting === fb.id || !replyContent[fb.id]?.trim()}
                    className="self-end flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-canvas hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    {submitting === fb.id ? "Đang gửi..." : "Gửi trả lời"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
