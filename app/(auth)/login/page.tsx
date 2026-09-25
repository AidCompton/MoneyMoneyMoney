"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type ActionState } from "@/lib/actions/auth";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <Card className="p-8 sm:p-10">
      <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
      <p className="mt-1 text-sm text-ivory/55">Sign in to this week&apos;s numbers.</p>
      <form action={formAction} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <FormError message={state.error} />
        <SubmitButton className="w-full" size="lg" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-ivory/55">
        New here?{" "}
        <Link href="/register" className="font-semibold text-gold hover:underline">
          Create or join a household
        </Link>
      </p>
    </Card>
  );
}
