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
import { Pencil } from "lucide-react";

interface ConfirmEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the user has typed EDIT and clicked Continue. */
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  entityName?: string;
}

/**
 * Edit-gate dialog. Mirror of ConfirmDeleteDialog but for edits.
 * User must type "EDIT" to enable the continue button — prevents
 * accidental opens of edit forms that could overwrite production data.
 */
export function ConfirmEditDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  entityName,
}: ConfirmEditDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const isMatch = confirmText.trim().toUpperCase() === "EDIT";

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

  const resolvedTitle = title ?? (entityName ? `Edit ${entityName}?` : "Confirm Edit");
  const resolvedDescription =
    description ??
    (entityName
      ? `You're about to edit this ${entityName}. Please type EDIT to confirm.`
      : "You're about to open the edit form. Please type EDIT to confirm.");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Pencil className="h-5 w-5" />
            {resolvedTitle}
          </DialogTitle>
          <DialogDescription className="pt-2">{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Type <span className="font-bold text-amber-600 tracking-wider">EDIT</span> to confirm
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type EDIT here"
            autoFocus
            className={isMatch ? "border-amber-500 focus-visible:ring-amber-500" : ""}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isMatch) handleConfirm();
            }}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleConfirm}
            disabled={!isMatch || loading}
          >
            {loading ? "Opening…" : "Continue to Edit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmEditDialog;
