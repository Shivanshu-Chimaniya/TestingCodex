import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectMongo } from './config/mongo.js';
import { logger } from './config/logger.js';
import { roomCleanupJob } from './jobs/roomCleanup.job.js';
import { flushSubmissionQueue, queuedSubmissionCount } from './modules/performance/submission.queue.js';
import { createSocketServer } from './sockets/index.js';

const app = createApp();
const server = createServer(app);

await createSocketServer(server);

if (env.MONGO_URI) {
  connectMongo(env.MONGO_URI).then(() => {
    logger.info('MongoDB connection established');
  });
}

setInterval(() => {
  roomCleanupJob().catch((error: unknown) => logger.error('roomCleanup.job failed', error));
}, 60_000);

setInterval(() => {
  flushSubmissionQueue().catch((error: unknown) => logger.error('submission.queue flush failed', error));
  const queued = queuedSubmissionCount();
  if (queued > 200) {
    logger.warn('submission.queue backlog is growing', { queued });
  }
}, 5_000);

server.listen(env.PORT, () => {
  logger.info(`PopSauce backend listening on ${env.PORT}`);
  logger.info('Sticky sessions must be enabled at the load balancer for websocket affinity');
});
