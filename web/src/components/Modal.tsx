import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly wide?: boolean;
  readonly children: ReactNode;
}

// Thin wrapper around the native <dialog> element - all four dialogs in the
// old system (letter detail, review, subject-officer settings, add-officer)
// used showModal()/close() directly; this keeps the same element and
// behavior (native focus trap, ESC-to-close, ::backdrop styling from
// styles/main.css) while syncing it to React state.
export function Modal({ open, onClose, wide, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog ref={ref} className={wide ? "dialog-wide" : undefined}>
      {children}
    </dialog>
  );
}
