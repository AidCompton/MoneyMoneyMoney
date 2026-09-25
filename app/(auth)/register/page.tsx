"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createHousehold, joinHousehold, type ActionState } from "@/lib/actions/auth";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-full px-3 py-2.5 text-sm font-semibold transition-all duration-500 ${
        active
          ? "bg-gradient-to-r from-gold to-sunrise text-night shadow-[0_6px_20px_-6px_rgb(247_195_92/0.8)]"
          : "text-ivory/60 hover:text-ivory"
      }`}
    >
      {children}
    </button>
  );
}

function CreateHouseholdForm() {
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

function JoinHouseholdForm() {
  const [state, formAction] = useActionState(joinHousehold, initialState);
  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="joinCode">Join code</Label>
        <Input
          id="joinCode"
          name="joinCode"
          placeholder="e.g. AB12CD"
          className="font-semibold uppercase tracking-[0.2em]"
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
      <SubmitButton className="w-full" size="lg" pendingText="Joining…">
        Join household
      </SubmitButton>
    </form>
  );
}

export default function RegisterPage() {
  const [tab, setTab] = useState<"create" | "join">("create");

  return (
    <Card className="p-8 sm:p-10">
      <h2 className="text-2xl font-semibold tracking-tight">Get started</h2>
      <p className="mt-1 mb-6 text-sm text-ivory/55">
        One of you creates the household; the other joins with its code.
      </p>
      <div className="mb-8 flex rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/10">
        <TabButton active={tab === "create"} onClick={() => setTab("create")}>
          New household
        </TabButton>
        <TabButton active={tab === "join"} onClick={() => setTab("join")}>
          Join a household
        </TabButton>
      </div>
      {tab === "create" ? <CreateHouseholdForm /> : <JoinHouseholdForm />}
      <p className="mt-6 text-center text-sm text-ivory/55">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
