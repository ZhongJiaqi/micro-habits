import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import webpush from 'web-push';
import {
  getIncompleteTaskNames,
  formatNotificationBody,
  type Task,
} from './incomplete-tasks';

const vapidPrivateKey = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = 'BCYEvXlbLR9ZFMeUf18Ts2Wvq3ewbifFUokiDlFCBZUCEuBoQz5v1wba_qTwgdFCdjyn0InZbCdRRMV9j8rSSqY';

initializeApp();

const db = getFirestore('ai-studio-ab924c4d-55bb-42f4-beb5-a1fb1f58cb4f');

/**
 * Daily task reminder — runs at 22:00 Asia/Shanghai.
 * Checks each user's tasks for the day and sends Web Push
 * to users with incomplete tasks.
 */
export const dailyTaskReminder = onSchedule(
  {
    schedule: '0 22 * * *',
    timeZone: 'Asia/Shanghai',
    retryCount: 1,
    secrets: [vapidPrivateKey],
  },
  async () => {
    webpush.setVapidDetails(
      'mailto:jiaqii.zhong@gmail.com',
      VAPID_PUBLIC_KEY,
      vapidPrivateKey.value(),
    );

    const now = new Date();
    const shanghaiTime = toZonedTime(now, 'Asia/Shanghai');
    const today = format(shanghaiTime, 'yyyy-MM-dd');

    console.log(`[dailyTaskReminder] started — date=${today}, utc=${now.toISOString()}`);

    const usersSnapshot = await db.collection('users').get();
    console.log(`[dailyTaskReminder] found ${usersSnapshot.size} users`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Get user's push subscriptions
      const subsSnapshot = await db.collection(`users/${userId}/pushSubscriptions`).get();
      if (subsSnapshot.empty) {
        console.log(`[dailyTaskReminder] user=${userId} — no subscriptions, skipping`);
        continue;
      }

      console.log(`[dailyTaskReminder] user=${userId} — ${subsSnapshot.size} subscription(s)`);

      // Get user's tasks for today
      const tasksSnapshot = await db.collection(`users/${userId}/tasks`)
        .where('date', '==', today)
        .get();

      const tasks = tasksSnapshot.docs.map(d => d.data() as Task);
      console.log(`[dailyTaskReminder] user=${userId} — ${tasks.length} task(s) for ${today}`);

      const incompleteNames = getIncompleteTaskNames(tasks, today);

      if (incompleteNames.length === 0) {
        console.log(`[dailyTaskReminder] user=${userId} — all tasks complete, skipping`);
        continue;
      }

      const body = formatNotificationBody(incompleteNames);
      const payload = JSON.stringify({
        title: '你还有未完成的任务',
        body,
        tag: `daily-reminder-${today}`,
      });

      console.log(`[dailyTaskReminder] user=${userId} — sending: "${body}" to ${subsSnapshot.size} device(s)`);

      for (const subDoc of subsSnapshot.docs) {
        const subData = subDoc.data();
        const pushSubscription = {
          endpoint: subData.endpoint,
          keys: {
            p256dh: subData.keys.p256dh,
            auth: subData.keys.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          console.log(`[dailyTaskReminder] user=${userId} sub=${subDoc.id} — sent OK`);
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          const errBody = (err as { body?: string }).body;
          console.error(`[dailyTaskReminder] user=${userId} sub=${subDoc.id} — error: ${statusCode} ${errBody}`);
          // Clean up expired/invalid subscriptions
          if (statusCode === 410 || statusCode === 404) {
            console.log(`[dailyTaskReminder] removing expired subscription ${subDoc.id}`);
            await subDoc.ref.delete().catch(() => {});
          }
        }
      }
    }

    console.log('[dailyTaskReminder] done');
  }
);
