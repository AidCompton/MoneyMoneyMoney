"use client";

import { useActionState } from "react";
import { createHousehold, joinHousehold, type ActionState } from "@/lib/actions/auth";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function CreateHouseholdForm() {
  const [state, formAction] = useActionState(createHousehold, initialState);
  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="householdName">Household name</Label>
        <Input
          id="householdName"
          name="householdName"
          placeholder="e.g. The Comptons"
          required
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full" size="lg" pendingText="Creating…">
        Create household
      </SubmitButton>
      <p className="text-center text-xs text-ivory/45">
        You&apos;ll get a join code afterwards to share with your partner.
      </p>
    </form>
  );
}

export function JoinHouseholdForm({ code }: { code?: string }) {
  const [state, formAction] = useActionState(joinHousehold, initialState);
  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="joinCode">Join code</Label>
        <Input
          id="joinCode"
          name="joinCode"
          placeholder="e.g. AB12CD"
          defaultValue={code}
          className="font-semibold uppercase tracking-[0.2em]"
          autoCapitalize="characters"
          autoComplete="off"
          required
          autoFocus={!code}
        />
      </div>
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required autoFocus={!!code} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full" size="lg" pendingText="Joining…">
        Join household
      </SubmitButton>
    </form>
  );
}
