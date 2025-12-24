import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export const whatsappConfig = {
  sessionPath: process.env.WA_SESSION_PATH || path.join(process.cwd(), 'baileys_auth'),
  syncFullHistory: process.env.WA_SYNC_FULL_HISTORY === 'true',
  markOnlineOnConnect: process.env.WA_MARK_ONLINE !== 'false',
};
