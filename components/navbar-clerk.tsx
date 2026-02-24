"use client";

import { UserButton, SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function ClerkDesktopUser() {
  return (
    <>
      <SignedIn>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
              userButtonTrigger: "focus:shadow-none focus:ring-2 focus:ring-yellow-400 rounded-full",
            },
          }}
        />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <Button size="sm" className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl text-sm">
            Sign In
          </Button>
        </SignInButton>
      </SignedOut>
    </>
  );
}

export function ClerkMobileUser() {
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

export function ClerkMobileSignIn() {
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
