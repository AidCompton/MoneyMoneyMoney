"use client";

import { useActionState, useRef, useTransition, useState, useEffect } from "react";
import { changePassword, signOutOtherDevices, type ActionState } from "@/lib/actions/auth";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";

const initial: ActionState = {};

/** Change your password, or sign out every other phone and computer. */
export function AccountSecurity() {
  const [state, formAction] = useActionState(changePassword, initial);
  const form = useRef<HTMLFormElement>(null);
  const [signingOut, startSigningOut] = useTransition();
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    if (state.saved) form.current?.reset();
  }, [state]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form ref={form} action={formAction} className="space-y-4">
        <h3 className="text-sm font-semibold text-ivory">Change your password</h3>
        <div>
          <Label htmlFor="currentPassword">Current password</Label>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        </div>
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <div>
          <Label htmlFor="confirmPassword">New password again</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <FormError message={state.error} />
        {state.saved && (
          <p role="status" className="text-sm font-semibold text-mint">
            ✓ Password changed. Every other device has been signed out.
          </p>
        )}
        <SubmitButton pendingText="Changing…">Change password</SubmitButton>
      </form>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-ivory">Signed in somewhere you shouldn&apos;t be?</h3>
        <p className="text-sm text-ivory/55">
          Signs you out on every other phone and computer, such as a lost phone. You stay signed in here.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={signingOut}
          onClick={() =>
            startSigningOut(async () => {
              await signOutOtherDevices();
              setSignedOut(true);
            })
          }
        >
          {signingOut ? "Signing out…" : "Sign out other devices"}
        </Button>
        {signedOut && (
          <p role="status" className="text-sm font-semibold text-mint">
            ✓ Every other device has been signed out.
          </p>
        )}
      </div>
    </div>
  );
}
