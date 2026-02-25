import mongoose from 'mongoose';
import { logger } from '../../config/logger.js';
import { AnswerSubmittedModel } from '../database/models.js';

export type SubmissionEvent = {
  roomCode: string;
  userId: string;
  rawInput: string;
  normalizedInput: string;
  isValid: boolean;
  isDuplicate: boolean;
  pointsAwarded: number;
  serverReceivedAt: Date;
};

const queue: SubmissionEvent[] = [];
const BATCH_SIZE = 50;

export function enqueueSubmission(event: SubmissionEvent) {
  queue.push(event);
}

export async function flushSubmissionQueue() {
  if (!queue.length) return 0;

  const batch = queue.splice(0, BATCH_SIZE);

  if (mongoose.connection.readyState !== 1) {
    logger.warn('submission.queue skipped flush because Mongo is not connected');
    return batch.length;
  }

  await AnswerSubmittedModel.insertMany(
    batch.map((entry) => ({
      roundId: new mongoose.Types.ObjectId(),
      roomId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      rawInput: entry.rawInput,
      normalizedInput: entry.normalizedInput,
      isValid: entry.isValid,
      isDuplicate: entry.isDuplicate,
      serverReceivedAt: entry.serverReceivedAt,
      latencyBucketMs: 0,
      pointsAwarded: entry.pointsAwarded,
    })),
    { ordered: false },
  );

  return batch.length;
}

export function queuedSubmissionCount() {
  return queue.length;
}
