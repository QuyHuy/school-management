"use client";

import { useRef, useState } from "react";
import { Upload, ArrowLeft, CheckCircle, XCircle, Download } from "lucide-react";
import {
  confirmStudentImportApi,
  downloadStudentTemplateApi,
  previewStudentImportApi,
} from "../api/students.api";
import type { ImportPreviewResponse, ImportPreviewRow } from "../model/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "upload" | "preview";

export function ImportCSVModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function handleClose() {
    setStep("upload");
    setPreview(null);
    setError(null);
    setToast(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Vui lòng chọn file CSV"); return; }
    if (!file.name.endsWith(".csv")) { setError("Chỉ chấp nhận file .csv"); return; }
    if (file.size > 500 * 1024) { setError("File quá lớn (tối đa 500KB)"); return; }
    setError(null);
    setLoading(true);
    try {
      const result = await previewStudentImportApi(file);
      setPreview(result);
      setStep("preview");
    } catch {
      setError("Không thể đọc file. Vui lòng kiểm tra lại định dạng.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview || preview.valid.length === 0) return;
    setLoading(true);
    try {
      const result = await confirmStudentImportApi(preview.valid);
      setToast(`Đã tạo ${result.created} học sinh`);
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1500);
    } catch {
      setError("Có lỗi xảy ra khi tạo học sinh. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-2xl rounded-md border border-border bg-canvas shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold text-ink">
            {step === "upload" ? "Import học sinh từ CSV" : `Preview — ${preview?.valid.length ?? 0} hợp lệ / ${preview?.invalid.length ?? 0} lỗi`}
          </h2>
          <button onClick={handleClose} className="text-ash hover:text-ink text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {toast && (
            <div className="mb-4 rounded-sm bg-success/10 border border-success/20 px-4 py-2.5 text-sm text-success font-medium">
              {toast}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-sm bg-error/10 border border-error/20 px-4 py-2.5 text-sm text-error">
              {error}
            </div>
          )}

          {step === "upload" && (
            <div className="flex flex-col gap-4">
              <button
                onClick={downloadStudentTemplateApi}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline w-fit"
              >
                <Download className="w-4 h-4" />
                Tải template CSV
              </button>
              <div className="rounded-sm border-2 border-dashed border-border bg-surface px-6 py-8 text-center">
                <Upload className="w-8 h-8 text-ash mx-auto mb-3" />
                <p className="text-sm text-ash mb-3">Chọn file CSV để import</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="block w-full text-sm text-ash file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-canvas hover:file:opacity-90"
                />
              </div>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="overflow-auto max-h-72">
              {preview.total_rows === 0 ? (
                <p className="text-sm text-ash text-center py-6">Không có dữ liệu trong file</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-ash">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Tên</th>
                      <th className="py-2 pr-3 font-medium">Khối</th>
                      <th className="py-2 pr-3 font-medium">Ngày sinh</th>
                      <th className="py-2 pr-3 font-medium">Ghi chú</th>
                      <th className="py-2 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.valid, ...preview.invalid]
                      .sort((a, b) => a.row - b.row)
                      .map((r) => {
                        const isValid = r.errors.length === 0;
                        return (
                          <tr key={r.row} className="border-b border-border/50 hover:bg-surface">
                            <td className="py-2 pr-3 text-ash">{r.row}</td>
                            <td className="py-2 pr-3 text-ink">{r.name || "—"}</td>
                            <td className="py-2 pr-3 text-ink">{r.grade ?? "—"}</td>
                            <td className="py-2 pr-3 text-ash">{r.date_of_birth ?? "—"}</td>
                            <td className="py-2 pr-3 text-ash truncate max-w-[100px]">{r.note ?? "—"}</td>
                            <td className="py-2">
                              {isValid ? (
                                <CheckCircle className="w-4 h-4 text-success" />
                              ) : (
                                <span className="flex items-start gap-1">
                                  <XCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                                  <span className="text-xs text-error">{r.errors.join(", ")}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
              {preview.valid.length === 0 && preview.total_rows > 0 && (
                <p className="text-sm text-ash text-center py-3">Không có dòng hợp lệ</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {step === "upload" ? (
            <>
              <button onClick={handleClose} className="text-sm text-ash hover:text-ink">Huỷ</button>
              <button
                onClick={handlePreview}
                disabled={loading}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {loading ? "Đang xử lý..." : "Xem preview →"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep("upload"); setError(null); }}
                className="flex items-center gap-1.5 text-sm text-ash hover:text-ink"
              >
                <ArrowLeft className="w-4 h-4" /> Quay lại
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || (preview?.valid.length ?? 0) === 0}
                className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {loading ? "Đang tạo..." : `Tạo ${preview?.valid.length ?? 0} học sinh`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
