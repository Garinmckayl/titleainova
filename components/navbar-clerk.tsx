"use client";

import React from "react";
import { Button } from "@/components/ui/button";

// These components are safe no-ops when Clerk is not configured.
// When NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is absent, ClerkProvider is not
// mounted (see app/layout.tsx), so calling SignedIn/SignedOut would throw.
// We guard with the env var — Next.js inlines NEXT_PUBLIC_ vars at build time.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

class ClerkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { errored: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { errored: false };
  }
  static getDerivedStateFromError() {
    return { errored: true };
  }
  render() {
    if (this.state.errored) return null;
    return this.props.children;
  }
}

function LazyClerkDesktop() {
  // Only attempt to render Clerk components when configured
  if (!CLERK_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignedIn, SignedOut, UserButton, SignInButton } = require("@clerk/nextjs");
  return (
    <>
      <SignedIn>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
              userButtonTrigger:
                "focus:shadow-none focus:ring-2 focus:ring-yellow-400 rounded-full",
            },
          }}
        />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <Button
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl text-sm"
          >
            Sign In
          </Button>
        </SignInButton>
      </SignedOut>
    </>
  );
}

function LazyClerkMobileUser() {
  if (!CLERK_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignedIn, UserButton } = require("@clerk/nextjs");
  return (
    <SignedIn>
      <UserButton
        afterSignOutUrl="/"
        appearance={{
          elements: {
            avatarBox: "w-8 h-8",
            userButtonTrigger: "focus:shadow-none",
          },
        }}
      />
    </SignedIn>
  );
}

function LazyClerkMobileSignIn() {
  if (!CLERK_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignedOut, SignInButton } = require("@clerk/nextjs");
  return (
    <SignedOut>
      <div className="px-4 pt-2">
        <SignInButton mode="modal">
          <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl">
            Sign In
          </Button>
        </SignInButton>
      </div>
    </SignedOut>
  );
}

export function ClerkDesktopUser() {
  return (
    <ClerkErrorBoundary>
      <LazyClerkDesktop />
    </ClerkErrorBoundary>
  );
}

export function ClerkMobileUser() {
  return (
    <ClerkErrorBoundary>
      <LazyClerkMobileUser />
    </ClerkErrorBoundary>
  );
}

export function ClerkMobileSignIn() {
  return (
    <ClerkErrorBoundary>
      <LazyClerkMobileSignIn />
    </ClerkErrorBoundary>
  );
}
