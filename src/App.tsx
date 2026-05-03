import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, List, Clock } from 'lucide-react';
import TodayView from './components/TodayView';
import PracticeView from './components/PracticeView';
import HistoryView from './components/HistoryView';
import NotificationPrompt from './components/NotificationPrompt';
import { useStore } from './useStore';
import { auth, db } from './firebase';
import { requestPermissionAndSubscribe, isPushSupported } from './lib/messaging';
import { signInWithGoogle, consumeRedirectResult } from './lib/auth';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User, AuthError } from 'firebase/auth';

export default function App() {
  const [activeTab, setActiveTab] = useState<'today' | 'practice' | 'history'>('today');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const store = useStore(user?.uid);

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
      if (currentUser) setLoginError(null);
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

  if (!authReady) {
    return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] text-[#2C2C2C] font-sans flex flex-col items-center justify-center selection:bg-[#E2DFD8]">
        <div className="w-full max-w-md p-8 text-center">
          <h1 className="text-4xl font-serif font-medium tracking-widest text-[#1A1A1A] mb-4">Micro Habits</h1>
          <p className="text-[#8C8C8C] mb-12">Build better habits, one day at a time.</p>
          <button
            onClick={handleLogin}
            disabled={loginPending}
            className="w-full bg-[#1A1A1A] text-[#F9F8F6] py-4 rounded-2xl font-medium tracking-wide hover:bg-[#2C2C2C] transition-colors disabled:opacity-60"
          >
            {loginPending ? 'Signing in...' : 'Continue with Google'}
          </button>
          {loginError && (
            <p className="mt-6 text-xs text-red-600 break-all leading-relaxed" role="alert">
              {loginError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#2C2C2C] font-sans flex flex-col items-center selection:bg-[#E2DFD8]">
      <div className="w-full max-w-md bg-[#F9F8F6] min-h-screen flex flex-col relative overflow-hidden shadow-2xl shadow-black/5">
        
        {/* Header */}
        <header className="px-8 pt-12 pb-6 flex items-end justify-between sticky top-0 bg-gradient-to-b from-[#F9F8F6] via-[#F9F8F6] to-transparent z-10">
          <h1 className="text-2xl font-serif font-medium tracking-widest text-[#1A1A1A]">Micro Habits</h1>
          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] font-medium tracking-[0.2em] text-[#8C8C8C] uppercase">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="text-[10px] font-medium tracking-wider text-[#8C8C8C] uppercase hover:text-[#1A1A1A] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Notification Permission Prompt */}
        <div className="px-8">
          <NotificationPrompt userId={user.uid} />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-28 relative px-8">
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
                <HistoryView store={store} />
              </motion.div>
            )}
          </AnimatePresence>
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
