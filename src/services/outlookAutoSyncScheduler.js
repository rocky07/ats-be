import { getUserIdsWithOutlookAutoSync } from './settingsService.js';
import { syncOutlookInbox } from './outlookIngestionService.js';

const DEFAULT_INTERVAL_MINUTES = 5;

// Polls connected Outlook mailboxes that opted into auto-sync and ingests any
// new resume attachments. Not real-time push (that needs a public HTTPS
// endpoint for Graph webhooks) — this just runs syncOutlookInbox on a timer.
export function startOutlookAutoSync(intervalMinutes = DEFAULT_INTERVAL_MINUTES) {
  const intervalMs = intervalMinutes * 60 * 1000;

  const run = async () => {
    let userIds = [];
    try {
      userIds = await getUserIdsWithOutlookAutoSync();
    } catch (e) {
      console.error('[outlookAutoSync] failed to list users:', e.message);
      return;
    }

    for (const userId of userIds) {
      try {
        const result = await syncOutlookInbox(userId);
        if (result.imported > 0) {
          console.log(`[outlookAutoSync] user ${userId}: imported ${result.imported}, skipped ${result.skipped}`);
        }
      } catch (e) {
        console.error(`[outlookAutoSync] user ${userId} sync failed:`, e.message);
      }
    }
  };

  const timer = setInterval(run, intervalMs);
  run(); // kick off an initial pass at startup instead of waiting a full interval
  return () => clearInterval(timer);
}
