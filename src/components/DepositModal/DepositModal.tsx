"use client";
import { Dialog } from "@/components/terminal/Dialog";
import { useUIStore } from "@/store/useUIStore";
import { CLIENT_PORTAL } from "@/lib/market";
export function DepositModal() {
  const open = useUIStore((s) => s.depositModalOpen),
    close = useUIStore((s) => s.setDepositModalOpen);
  return open ? (
    <Dialog title="Fund your trading account" onClose={() => close(false)}>
      <p className="muted">
        Manage deposits, withdrawals, and transfers in your Movement Markets
        client portal.
      </p>
      <a
        className="button button-primary full-width"
        href={`${CLIENT_PORTAL}/deposit`}
      >
        Continue to deposits
      </a>
    </Dialog>
  ) : null;
}
