"use client";

// "Tập cùng chuyên viên": attaching a movement to copy to one day.
//
// Two files and a switch. The clip is what the customer watches; the track
// is the specialist's own keypoints, produced on a Mac by
// TheraHOME-APP/scripts/pose-track.py, which also writes a QC video with
// the skeleton drawn on it.
//
// NOTHING IS PUBLISHED UNTIL SOMEBODY HAS WATCHED THAT QC VIDEO. A track
// that is quietly wrong for two seconds in the middle will tell a customer
// their perfectly good form is bad, which is worse for them than having no
// feature at all — so "Phát hành" is a separate, deliberate switch rather
// than something that happens on upload.
//
// Self-contained on purpose: its own state and its own loading, so the day
// modal around it (RoutineView, already a thousand lines) does not grow a
// second job.
import { useEffect, useRef, useState } from "react";
import {
  deleteExerciseReference,
  fetchExerciseReferences,
  saveExerciseReference,
  uploadExerciseClip,
  type ExerciseReference,
} from "@/lib/db";
import { FieldLabel, GhostBtn } from "@/components/ui/primitives";
import { pushToast } from "@/components/ui/Toast";

/** Two minutes — see the same constant in
 * scripts/publish-exercise-reference.mjs for why it is not twenty-five any
 * more. The track travels with the row: day 1's 114 seconds is 788 KB of
 * JSON, which gzip sends as 136 KB. */
const MAX_SECONDS = 120;

export function ExerciseReferenceEditor({
  programDayId,
  onChange,
}: {
  programDayId: string;
  /** Lets the day table behind this modal refresh its "Tập cùng CV" column
   * without the operator having to reload the page. */
  onChange?: () => void;
}) {
  const [reference, setReference] = useState<ExerciseReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const clipInput = useRef<HTMLInputElement>(null);
  const trackInput = useRef<HTMLInputElement>(null);

  // Same shape as PhaseContentModal's `reload`: a plain function whose
  // state writes happen inside the promise, not synchronously in the
  // effect.
  function reload() {
    fetchExerciseReferences()
      .then((all) => {
        setReference(all.get(programDayId) ?? null);
        setLoading(false);
      })
      .catch(() => {
        pushToast("Không đọc được bài mẫu");
        setLoading(false);
      });
  }
  useEffect(reload, [programDayId]);

  async function onClip(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const path = await uploadExerciseClip(programDayId, file);
      await saveExerciseReference(programDayId, { clipPath: path });
      pushToast("Đã tải clip mẫu lên");
      reload();
      onChange?.();
    } catch {
      pushToast("Không tải được clip — kiểm tra định dạng mp4 và dung lượng dưới 50 MB");
    } finally {
      setBusy(false);
    }
  }

  async function onTrack(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const track = JSON.parse(await file.text());
      // The same checks the app makes before it will draw anything. Better
      // to refuse the file here, in front of the person who made it, than
      // to store something the app will silently ignore.
      if (!Array.isArray(track?.samples) || track.samples.length < 2) throw new Error("samples");
      if (track.view !== "front" && track.view !== "side") throw new Error("view");
      if (!(track.frameWidth > 0) || !(track.frameHeight > 0)) throw new Error("frame");
      if (!(track.duration > 0) || track.duration > MAX_SECONDS) throw new Error("duration");

      await saveExerciseReference(programDayId, { track });
      pushToast("Đã lưu keypoint của chuyên viên");
      reload();
      onChange?.();
    } catch (error) {
      pushToast(
        (error as Error)?.message === "duration"
          ? `Track dài quá ${MAX_SECONDS} giây — cắt ngắn lại rồi chạy lại pose-track.py`
          : "File track không hợp lệ — phải là JSON do scripts/pose-track.py tạo ra",
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished() {
    if (!reference || busy) return;
    setBusy(true);
    try {
      await saveExerciseReference(programDayId, { published: !reference.published });
      reload();
      onChange?.();
    } catch {
      pushToast("Không đổi được trạng thái phát hành");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!reference || busy) return;
    setBusy(true);
    try {
      await deleteExerciseReference(programDayId);
      pushToast("Đã gỡ bài mẫu khỏi ngày này");
      reload();
      onChange?.();
    } catch {
      pushToast("Không gỡ được bài mẫu");
    } finally {
      setBusy(false);
    }
  }

  const ready = !!reference?.clipPath && !!reference?.samples;

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
      <FieldLabel>Tập cùng chuyên viên (tuỳ chọn)</FieldLabel>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
        Clip ngắn để khách tập theo, kèm file keypoint do <code>scripts/pose-track.py</code> tạo ra. Clip phải quay một
        cảnh liên tục, máy đứng yên, thấy cả người. Xem video QC trước khi phát hành.
      </div>

      {loading ? (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Đang tải…</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <Row
            label="Clip mẫu"
            value={reference?.clipPath ? "Đã có" : "Chưa có"}
            ok={!!reference?.clipPath}
            action={
              <GhostBtn onClick={() => clipInput.current?.click()}>
                {reference?.clipPath ? "Thay clip" : "Tải clip"}
              </GhostBtn>
            }
          />
          <Row
            label="Keypoint chuyên viên"
            value={
              reference?.samples
                ? `${reference.samples} mẫu · ${reference.duration?.toFixed(1)}s · góc quay ${
                    reference.view === "side" ? "nghiêng" : "chính diện"
                  }`
                : "Chưa có"
            }
            ok={!!reference?.samples}
            action={
              <GhostBtn onClick={() => trackInput.current?.click()}>
                {reference?.samples ? "Thay track" : "Tải track"}
              </GhostBtn>
            }
          />
          <Row
            label="Phát hành cho khách"
            value={reference?.published ? "Đang hiển thị" : "Chưa phát hành"}
            ok={!!reference?.published}
            action={
              <GhostBtn onClick={togglePublished} disabled={!ready || busy}>
                {reference?.published ? "Ẩn đi" : "Phát hành"}
              </GhostBtn>
            }
          />
          {reference ? (
            <div style={{ marginTop: 2 }}>
              <GhostBtn onClick={remove} disabled={busy}>Gỡ bài mẫu khỏi ngày này</GhostBtn>
            </div>
          ) : null}
          {!ready && reference ? (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Cần đủ cả clip và keypoint mới phát hành được.
            </div>
          ) : null}
        </div>
      )}

      <input
        ref={clipInput}
        type="file"
        accept="video/mp4,video/quicktime"
        style={{ display: "none" }}
        onChange={(event) => {
          void onClip(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={trackInput}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(event) => {
          void onTrack(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function Row({ label, value, ok, action }: { label: string; value: string; ok: boolean; action: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: 12.5, color: ok ? "var(--success)" : "var(--text-muted)" }}>{value}</div>
      </div>
      {action}
    </div>
  );
}
