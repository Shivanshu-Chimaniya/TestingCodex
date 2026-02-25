import { logger } from '../config/logger.js';

export async function roomCleanupJob() {
  logger.info('roomCleanup.job executed');
}
