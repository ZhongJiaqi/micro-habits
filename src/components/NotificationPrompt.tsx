import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X } from 'lucide-react';
import { requestPermissionAndSubscribe, isPushSupported, isIOSNonStandalone } from '../lib/messaging';

const DISMISSED_KEY = 'notificationPromptDismissed';

export default function NotificationPrompt({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return;

    if (isIOSNonStandalone()) {
      setIosHint(true);
      setVisible(true);
      return;
    }
    if (!isPushSupported()) return;

    if (Notification.permission === 'granted') {
      requestPermissionAndSubscribe(userId).catch(() => {});
      return;
    }
    if (Notification.permission === 'default') {
      setVisible(true);
    }
  }, [userId]);

  const handleEnable = async () => {
    setRequesting(true);
    setError(null);
    try {
      await requestPermissionAndSubscribe(userId);
      setVisible(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setRequesting(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden"
        >
          <div className="bg-[#F0EFEA] rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
            <Bell className="w-4 h-4 text-[#8A9A86] flex-shrink-0 mt-0.5 stroke-[1.5]" />
            <div className="flex-1 min-w-0">
              {iosHint ? (
                <>
                  <p className="text-[13px] font-serif text-[#2C2C2C] leading-relaxed">
                    添加到主屏幕以开启推送提醒
                  </p>
                  <p className="text-[10px] text-[#A09E9A] tracking-wide mt-1 leading-relaxed">
                    点击浏览器底部的分享按钮，选择"添加到主屏幕"，然后从主屏幕打开即可开启每晚 10 点的任务提醒。
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-serif text-[#2C2C2C] leading-relaxed">
                    开启提醒，每晚 10 点检查未完成任务
                  </p>
                  <p className="text-[10px] text-[#A09E9A] tracking-wide mt-1">
                    提醒需要浏览器通知权限
                  </p>
                  {error && (
                    <p className="text-[10px] text-red-500 mt-2 break-all">{error}</p>
                  )}
                  <button
                    onClick={handleEnable}
                    disabled={requesting}
                    className="mt-3 text-[11px] font-medium tracking-widest uppercase bg-[#1A1A1A] text-[#F9F8F6] px-4 py-1.5 rounded-full hover:bg-[#2C2C2C] transition-colors disabled:opacity-50"
                  >
                    {requesting ? '请求中...' : error ? '重试' : '开启'}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="text-[#A09E9A] hover:text-[#2C2C2C] transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
