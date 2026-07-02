import { EvuKbClient } from '@evu/kb-sdk';

import { appConfig } from '../config.js';

export const kbClient = new EvuKbClient({
  baseUrl: appConfig.apiBaseUrl,
});
