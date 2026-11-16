import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createReviewSchema } from '@/shared/src';
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: bookingId } = await params;
    const body = await request.json();
    const data = createReviewSchema.parse(body);

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: true,
        reviews: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new AppError('Reviews can only be submitted after the booking is confirmed', 400, 'NOT_CONFIRMED');
    }

    const isDriver = booking.driverId === user.id;
    const isHost = booking.charger.hostId === user.id;

    if (!isDriver && !isHost) {
      throw new ForbiddenError('Only the driver or host of this booking can leave a review');
    }

    // Determine reviewee
    const revieweeId = isDriver ? booking.charger.hostId : booking.driverId;

    // Check if user already reviewed this booking
    const alreadyReviewed = booking.reviews.some((r) => r.reviewerId === user.id);
    if (alreadyReviewed) {
      throw new AppError('You have already reviewed this booking', 409, 'ALREADY_REVIEWED');
    }

    const review = await db.review.create({
      data: {
        bookingId: booking.id,
        reviewerId: user.id,
        revieweeId,
        rating: data.rating,
        comment: data.comment || null,
      },
    });

    return apiSuccess(
      {
        id: review.id,
        bookingId: review.bookingId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        message: 'Review submitted successfully',
      },
      201
    );
  } catch (err) {
    return apiError(err);
  }
}
