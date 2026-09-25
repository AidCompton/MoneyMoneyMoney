"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createHousehold, joinHousehold, type ActionState } from "@/lib/actions/auth";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function CreateHouseholdForm() {
  const [state, formAction] = useActionState(createHousehold, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="householdName">
          Household name
        </label>
        <Input
          id="householdName"
          name="householdName"
          placeholder="e.g. The Comptons"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
          Your name
        </label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText="Creating…">
        Create household
      </SubmitButton>
      <p className="text-xs text-slate-500">
        You&apos;ll get a join code afterwards to share with your partner.
      </p>
    </form>
  );
}

function JoinHouseholdForm() {
  const [state, formAction] = useActionState(joinHousehold, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="joinCode">
          Join code
        </label>
        <Input
          id="joinCode"
          name="joinCode"
          placeholder="e.g. AB12CD"
          className="uppercase"
          required
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
          Your name
        </label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText="Joining…">
        Join household
      </SubmitButton>
    </form>
  );
}

export default function RegisterPage() {
  const [tab, setTab] = useState<"create" | "join">("create");

  return (
    <Card>
      <div className="mb-4 flex rounded-md bg-slate-100 p-1">
        <TabButton active={tab === "create"} onClick={() => setTab("create")}>
          New household
        </TabButton>
        <TabButton active={tab === "join"} onClick={() => setTab("join")}>
          Join a household
        </TabButton>
      </div>
      {tab === "create" ? <CreateHouseholdForm /> : <JoinHouseholdForm />}
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-emerald-700 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
