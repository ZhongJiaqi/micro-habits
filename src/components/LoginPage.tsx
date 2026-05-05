import { motion } from 'motion/react';

interface LoginPageProps {
  onLogin: () => void;
  loginPending: boolean;
  loginError: string | null;
}

const TAGLINE = 'Every action you take is a vote for the type of person you wish to become.';

export default function LoginPage({ onLogin, loginPending, loginError }: LoginPageProps) {
  return (
    <div
      className="min-h-screen flex flex-col font-sans text-[#2C2C2C] selection:bg-[#E2DFD8]"
      style={{ background: '#F5F2EC' }}
    >
      {/* Timeline — 3 dots horizontal, last filled = "today, the start" */}
      <header className="pt-14 pb-4 flex justify-center">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full border border-[#C4C1B9]" />
          <span className="block h-px bg-[#C4C1B9]" style={{ width: 28 }} />
          <span className="w-1.5 h-1.5 rounded-full border border-[#C4C1B9]" />
          <span className="block h-px bg-[#C4C1B9]" style={{ width: 28 }} />
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
            className="w-2 h-2 rounded-full"
            style={{ background: '#1A1A1A' }}
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-10 w-full max-w-md mx-auto">
        {/* Brand + blinking cursor — cursor visualizes the -ing tense (永远未完成) */}
        <div className="relative inline-block">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif font-medium text-[#1A1A1A] leading-none whitespace-nowrap"
            style={{ fontSize: 'clamp(52px, 14vw, 76px)', letterSpacing: '0.01em' }}
          >
            Becoming
          </motion.h1>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0, 0] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              repeatType: 'loop',
              ease: 'linear',
              delay: 0.9,
            }}
            className="absolute"
            style={{
              right: -10,
              top: '12%',
              width: 3,
              height: '70%',
              background: '#1A1A1A',
            }}
            aria-hidden
          />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.85 }}
          className="text-[#5A5754] text-[14px] leading-relaxed italic font-serif text-center max-w-[20rem] mt-12"
        >
          {TAGLINE}
        </motion.p>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.1 }}
          onClick={onLogin}
          disabled={loginPending}
          className="mt-16 group relative overflow-hidden border border-[#1A1A1A] py-4 px-10 text-[12px] uppercase tracking-[0.25em] text-[#1A1A1A] transition-colors disabled:opacity-50 w-full"
        >
          <span
            className="absolute inset-0 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 bg-[#1A1A1A]"
            aria-hidden
          />
          <span className="relative group-hover:text-[#F5F2EC] transition-colors">
            {loginPending ? 'Signing in…' : 'Continue with Google'}
          </span>
        </motion.button>

        {loginError && (
          <p
            className="mt-6 text-xs text-red-600 break-all leading-relaxed text-center"
            role="alert"
          >
            {loginError}
          </p>
        )}
      </main>
    </div>
  );
}
