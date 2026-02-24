/**
 * Human-in-the-loop review API for title search reports.
 *
 * Endpoints:
 *   GET    /api/reviews?searchId=N        — Get review for a search
 *   GET    /api/reviews?pending=true       — List pending reviews
 *   POST   /api/reviews                    — Create a review / add comment / finalize
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  createReview,
  getReview,
  addReviewComment,
  finalizeReview,
  getPendingReviews,
  getSearch,
} from '@/lib/turso';
import { notifyReviewRequested, notifyReviewCompleted } from '@/lib/notifications';
import type { ReviewComment } from '@/lib/agents/title-search/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const { searchParams } = new URL(req.url);

  try {
    const searchId = searchParams.get('searchId');
    const pending = searchParams.get('pending');

    if (pending === 'true') {
      const reviews = await getPendingReviews();
      return NextResponse.json({ success: true, data: reviews });
    }

    if (searchId) {
      const review = await getReview(parseInt(searchId, 10));
      if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: review });
    }

    return NextResponse.json({ error: 'Provide searchId or pending=true' }, { status: 400 });
  } catch (err: any) {
    console.error('[/api/reviews GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        // Create a new review for a search
        const { searchId, assignedTo } = body;
        if (!searchId) return NextResponse.json({ error: 'searchId required' }, { status: 400 });

        const search = await getSearch(searchId);
        if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });

        const reviewId = await createReview(searchId, assignedTo);

        // Notify the assigned reviewer
        await notifyReviewRequested(assignedTo || userId, searchId, search.address);

        return NextResponse.json({ success: true, reviewId });
      }

      case 'comment': {
        // Add a review comment
        const { searchId, section, itemIndex, comment: commentText, commentAction } = body;
        if (!searchId || !section || !commentText) {
          return NextResponse.json({ error: 'searchId, section, and comment required' }, { status: 400 });
        }

        const reviewComment: ReviewComment = {
          id: `rc-${Date.now().toString(36)}`,
          reviewerId: userId,
          reviewerName: body.reviewerName || userId,
          section,
          itemIndex: itemIndex !== undefined ? itemIndex : undefined,
          comment: commentText,
          action: commentAction || 'note',
          createdAt: new Date().toISOString(),
        };

        await addReviewComment(searchId, reviewComment);
        return NextResponse.json({ success: true, commentId: reviewComment.id });
      }

      case 'finalize': {
        // Approve or reject a report
        const { searchId, decision } = body;
        if (!searchId || !decision) {
          return NextResponse.json({ error: 'searchId and decision required' }, { status: 400 });
        }
        if (decision !== 'approved' && decision !== 'rejected') {
          return NextResponse.json({ error: 'decision must be "approved" or "rejected"' }, { status: 400 });
        }

        const search = await getSearch(searchId);
        if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });

        await finalizeReview(searchId, decision, userId);

        // Notify the search owner
        await notifyReviewCompleted(userId, searchId, search.address, decision);

        return NextResponse.json({ success: true, decision });
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use create, comment, or finalize.' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[/api/reviews POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
