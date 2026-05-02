import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
}

/**
 * Secure delete confirmation dialog.
 * User must type "DELETE" to enable the delete button.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Confirm Deletion",
  description = "This action cannot be undone. Please type DELETE to confirm.",
}: ConfirmDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const isMatch = confirmText.trim().toUpperCase() === "DELETE";

  // Reset input whenever dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setLoading(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!isMatch) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2">{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Type <span className="font-bold text-red-600 tracking-wider">DELETE</span> to confirm
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE here"
            autoFocus
            className={isMatch ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isMatch || loading}
          >
            {loading ? "Deleting…" : "Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Legacy default-export adapter ─────────────────────────────
// Some pages still use the older API: { isOpen, onClose, entityName }.
// Forward those to the canonical named-export component.
interface LegacyConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  entityName?: string;
  title?: string;
  description?: string;
}

export default function ConfirmDeleteDialogDefault({
  isOpen,
  onClose,
  onConfirm,
  entityName,
  title,
  description,
}: LegacyConfirmDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={isOpen}
      onOpenChange={(v) => { if (!v) onClose(); }}
      onConfirm={onConfirm}
      title={title ?? (entityName ? `Delete ${entityName}?` : undefined)}
      description={
        description ??
        (entityName
          ? `This will permanently delete this ${entityName}. This action cannot be undone. Please type DELETE to confirm.`
          : undefined)
      }
    />
  );
}
