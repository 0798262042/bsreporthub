import { toast } from "sonner";

/**
 * Show a rejection toast plus a follow-up toast explaining how to fix it.
 * Used for every upload/import rejection so users always get guidance.
 */
export function rejectWithFix(message: string, fix: string) {
  toast.error(message);
  setTimeout(() => {
    toast.info("How to fix this", { description: fix, duration: 9000 });
  }, 350);
}