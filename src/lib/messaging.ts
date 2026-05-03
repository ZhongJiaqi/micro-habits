import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Check if the browser supports Web Push.
 * Works on iOS Safari 16.4+ when launched from home screen.
 */
export function isPushSupported(): boolean {
  return 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

/**
 * Check if we're on iOS but NOT in standalone (home screen) mode.
 * iOS requires PWA to be added to home screen for push to work.
 */
export function isIOSNonStandalone(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  // @ts-expect-error navigator.standalone is iOS-specific
  return navigator.standalone !== true;
}

/**
 * Request notification permission and subscribe via Web Push API.
 * Stores the PushSubscription in Firestore.
 */
export async function requestPermissionAndSubscribe(userId: string): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('UNSUPPORTED');
  if (isIOSNonStandalone()) throw new Error('IOS_NOT_STANDALONE');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(`permission=${permission}`);

  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID_KEY 未配置');

  // Use the PWA service worker (which includes push-handler.js via importScripts)
  const swReg = await navigator.serviceWorker.ready;

  let subscription = await swReg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Store in Firestore — use endpoint hash as doc ID for idempotency
  const subJson = subscription.toJSON();
  const docId = btoa(subscription.endpoint).replace(/[/+=]/g, '_').slice(-80);

  await setDoc(doc(db, `users/${userId}/pushSubscriptions/${docId}`), {
    endpoint: subJson.endpoint,
    keys: subJson.keys,
    createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
  });

  return subscription;
}

/**
 * Remove all push subscriptions from Firestore and unsubscribe.
 */
export async function removeAllSubscriptions(userId: string): Promise<void> {
  const snap = await getDocs(collection(db, `users/${userId}/pushSubscriptions`));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

  const swReg = await navigator.serviceWorker.ready;
  const sub = await swReg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
