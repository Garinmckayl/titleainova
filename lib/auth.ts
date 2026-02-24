import { auth as clerkAuth } from '@clerk/nextjs/server';

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Get current user ID from Clerk.
 * Returns null if Clerk is not configured (open access mode).
 */
export async function getUserId(): Promise<string | null> {
  if (!clerkEnabled) return null;
  try {
    const { userId } = await clerkAuth();
    return userId;
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns userId or throws 401-style error.
 * When Clerk is not configured, returns null (open access).
 */
export async function requireAuth(): Promise<string | null> {
  if (!clerkEnabled) return null;
  const { userId } = await clerkAuth();
  if (!userId) throw new Error('UNAUTHORIZED');
  return userId;
}
