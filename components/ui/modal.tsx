"use client";
import { Button } from "./primitives";

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fade-in fixed inset-0 z-[90] overflow-y-auto bg-ink/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className={`modal-in max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-card sm:p-6 ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title, body, confirmLabel = "Confirm", danger, busy, onCancel, onConfirm
}: {
  title: string; body: string; confirmLabel?: string; danger?: boolean; busy?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-ink-soft">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
