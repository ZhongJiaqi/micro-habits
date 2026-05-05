import { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, List, Clock } from 'lucide-react';
import TodayView from './components/TodayView';
import PracticeView from './components/PracticeView';
// HistoryView is heaviest tab (date-fns date math + calendar grid + Hall of Fame).
// Lazy-load so Today/Practice tabs don't pay the cost up-front.
const HistoryView = lazy(() => import('./components/HistoryView'));
import NotificationPrompt from './components/NotificationPrompt';
import { useStore } from './useStore';
import { useDemoStore, isDemoMode } from './useDemoStore';
import LoginPage from './components/LoginPage';
import { auth, db } from './firebase';
import { requestPermissionAndSubscribe, isPushSupported } from './lib/messaging';
import { signInWithGoogle, consumeRedirectResult } from './lib/auth';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User, AuthError } from 'firebase/auth';

/**
 * 主区域加载占位：登录后 Firestore 数据还没回来时显示。
 * 复刻 TodayView 的视觉骨架（区段标签 + 任务行）但不暴露任何真实/空态文案，
 * 避免出现"No practices yet…"误导。
 */
function TodaySkeleton() {
  return (
    <div className="pt-2 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-24 bg-[#E8E5DE] rounded mt-6 mb-4" />
      <div className="space-y-2">
        <div className="h-14 bg-[#EDEAE3] rounded-xl" />
        <div className="h-14 bg-[#EDEAE3] rounded-xl" />
      </div>
      <div className="h-3 w-20 bg-[#E8E5DE] rounded mt-8 mb-4" />
      <div className="space-y-2">
        <div className="h-14 bg-[#EDEAE3] rounded-xl" />
        <div className="h-14 bg-[#EDEAE3] rounded-xl" />
        <div className="h-14 bg-[#EDEAE3] rounded-xl" />
      </div>
    </div>
  );
}

// localStorage 标记"过去登录成功过"。
// 用于在启动瞬间（onAuthStateChanged 还没回调）乐观渲染主框架，
// 避免老用户每次打开都看到全屏 splash。
// session 真过期时（极少数）会有"主框架闪一下→LoginPage"的反向闪烁，
// 但 99% 场景下零等待，明显比"全员都看 splash"好。
const HAD_SESSION_KEY = 'becoming.hadSession';

function readHadSession(): boolean {
  try {
    return localStorage.getItem(HAD_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'today' | 'practice' | 'history'>('today');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // 初始值同步从 localStorage 读取，确保首次 render 就能决定要不要跳过 splash。
  const [hadSession, setHadSession] = useState<boolean>(readHadSession);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const demoMode = isDemoMode();
  const realStore = useStore(user?.uid);
  const demoStore = useDemoStore();
  const store = demoMode ? demoStore : realStore;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const redirectError = await consumeRedirectResult(auth);
      if (!cancelled && redirectError) {
        setLoginError(`${redirectError.code ?? 'auth/unknown'} — ${redirectError.message ?? 'Redirect login failed'}`);
      }
    })();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        setLoginError(null);
        try { localStorage.setItem(HAD_SESSION_KEY, 'true'); } catch { /* private mode */ }
        setHadSession(true);
      } else {
        // session 真不存在了，清掉乐观标记，下次启动直接显示 LoginPage
        try { localStorage.removeItem(HAD_SESSION_KEY); } catch { /* private mode */ }
        setHadSession(false);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Auto-recover push subscription: if permission is granted but no subscription in Firestore, re-register
  useEffect(() => {
    if (!user) return;
    if (!isPushSupported() || Notification.permission !== 'granted') return;
    (async () => {
      try {
        const subsSnap = await getDocs(collection(db, `users/${user.uid}/pushSubscriptions`));
        if (subsSnap.empty) {
          await requestPermissionAndSubscribe(user.uid);
        }
      } catch {
        // Push not available in this browser context
      }
    })();
  }, [user]);

  const handleLogin = async () => {
    setLoginError(null);
    setLoginPending(true);
    try {
      await signInWithGoogle(auth);
    } catch (error) {
      const e = error as AuthError;
      const code = e?.code ?? 'auth/unknown';
      const message = e?.message ?? String(error);
      setLoginError(`${code} — ${message}`);
      console.error('Login failed:', error);
    } finally {
      setLoginPending(false);
    }
  };

  // Splash 只对"首次访问 / 没登录过"的新用户显示。
  // 老用户（hadSession=true）跳过 splash，直接走到下方乐观主框架渲染。
  if (!authReady && !demoMode && !hadSession) {
    // Branded splash — matches the inline #root-splash in index.html so
    // the transition from server-rendered HTML to React-rendered UI is seamless.
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#F5F2EC' }}
      >
        <h1
          className="font-serif font-medium text-[#1A1A1A] leading-none animate-pulse"
          style={{ fontSize: 'clamp(52px, 14vw, 76px)', letterSpacing: '0.01em' }}
        >
          Becoming
        </h1>
      </div>
    );
  }

  // LoginPage 必须在 authReady 之后才显示。
  // 老用户启动时 authReady=false 但 hadSession=true，乐观渲染主框架；
  // 此时 user=null 不能进 LoginPage 分支，否则会出现"主框架→LoginPage→主框架"的闪烁。
  if (authReady && !user && !demoMode) {
    return (
      <LoginPage
        onLogin={handleLogin}
        loginPending={loginPending}
        loginError={loginError}
      />
    );
  }

  // 登录后已知用户身份但 Firestore 数据还在路上：直接渲染主框架（header + nav），
  // <main> 区域用 skeleton 占位代替全屏 splash，给用户立刻的"我登上了"反馈。
  // 关键：在主区域不能渲染 TodayView/PracticeView，否则它们的空态文案
  // ("No practices yet…") 会先闪现再被真实数据替换。
  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C2C2C] font-sans flex flex-col items-center selection:bg-[#E2DFD8]">
      <div className="w-full max-w-md bg-[#F9F8F6] min-h-screen flex flex-col relative overflow-hidden shadow-2xl shadow-black/5">
        
        {/* Header */}
        <header className="px-8 pt-12 pb-6 flex items-end justify-between sticky top-0 bg-gradient-to-b from-[#F9F8F6] via-[#F9F8F6] to-transparent z-10">
          <h1 className="text-2xl font-serif font-medium tracking-widest text-[#1A1A1A]">Becoming</h1>
          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] font-medium tracking-[0.2em] text-[#8C8C8C] uppercase">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
            </div>
            <button
              onClick={() => {
                if (demoMode) {
                  window.location.search = '';
                } else {
                  auth.signOut();
                }
              }}
              className="text-[10px] font-medium tracking-wider text-[#8C8C8C] uppercase hover:text-[#1A1A1A] transition-colors"
            >
              {demoMode ? 'Exit Demo' : 'Sign Out'}
            </button>
          </div>
        </header>

        {/* Notification Permission Prompt */}
        {user && (
          <div className="px-8">
            <NotificationPrompt userId={user.uid} />
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-28 relative px-8">
          {user && !store.data.loaded ? (
            <TodaySkeleton />
          ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'today' && (
              <motion.div
                key="today"
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                <TodayView store={store} />
              </motion.div>
            )}
            {activeTab === 'practice' && (
              <motion.div
                key="practice"
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                <PracticeView store={store} />
              </motion.div>
            )}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                <Suspense fallback={null}>
                  <HistoryView store={store} />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-8 w-[calc(100%-4rem)] max-w-[calc(28rem-4rem)] left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-white/40 shadow-sm rounded-full px-6 py-3 flex justify-between items-center z-20">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex flex-col items-center p-2 transition-all duration-500 ${activeTab === 'today' ? 'text-[#1A1A1A]' : 'text-[#A09E9A] hover:text-[#5C5A56]'}`}
          >
            <Calendar className="w-5 h-5 stroke-[1.5]" />
            <span className={`text-[9px] mt-1.5 tracking-widest transition-all duration-500 ${activeTab === 'today' ? 'opacity-100 font-medium' : 'opacity-0 h-0 overflow-hidden'}`}>TODAY</span>
          </button>
          <button
            onClick={() => setActiveTab('practice')}
            className={`flex flex-col items-center p-2 transition-all duration-500 ${activeTab === 'practice' ? 'text-[#1A1A1A]' : 'text-[#A09E9A] hover:text-[#5C5A56]'}`}
          >
            <List className="w-5 h-5 stroke-[1.5]" />
            <span className={`text-[9px] mt-1.5 tracking-widest transition-all duration-500 ${activeTab === 'practice' ? 'opacity-100 font-medium' : 'opacity-0 h-0 overflow-hidden'}`}>PRACTICE</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center p-2 transition-all duration-500 ${activeTab === 'history' ? 'text-[#1A1A1A]' : 'text-[#A09E9A] hover:text-[#5C5A56]'}`}
          >
            <Clock className="w-5 h-5 stroke-[1.5]" />
            <span className={`text-[9px] mt-1.5 tracking-widest transition-all duration-500 ${activeTab === 'history' ? 'opacity-100 font-medium' : 'opacity-0 h-0 overflow-hidden'}`}>HISTORY</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
