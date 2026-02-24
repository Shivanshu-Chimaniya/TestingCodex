import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { createSocketServer } from './sockets/index.js';

const app = createApp();
const server = createServer(app);

createSocketServer(server);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PopSauce backend listening on ${env.PORT}`);
});
