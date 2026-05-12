"use client";

import { SignInButton } from "@/components/auth/sign-in-button";

export function SignedOutHero() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Rabbit.mx</h1>
        <p className="mt-3 text-balance text-muted-foreground">
          Spawn coding agents that run infinitely in the cloud.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3">
          <SignInButton
            provider="vercel"
            callbackUrl="/sessions"
            className="w-full"
            size="lg"
          />
          <SignInButton
            provider="github"
            callbackUrl="/sessions"
            className="w-full"
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}
