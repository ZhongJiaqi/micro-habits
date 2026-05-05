import { useEffect, type ReactNode } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { Task, MicroHabit } from "../types";

interface TodayViewProps {
  store: any;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em] mt-8 mb-3">
      {children}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  isAffirmation: boolean;
  onToggle: () => void;
}

function TaskRow({ task, isAffirmation, onToggle }: TaskRowProps) {
  const isAffirmationDone = isAffirmation && task.completed;
  const isHabitDone = !isAffirmation && task.completed;

  // Habit completion: line-through + muted gray (任务被勾掉的视觉)
  // Affirmation completion: 保留深色 + 不划线 + 末尾 ✨ ("被点亮"的视觉)
  const titleClass = isHabitDone
    ? "text-[#B0ADA5] line-through decoration-[#C4C1B9]"
    : "text-[#2C2C2C]";

  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#EAE8E3] relative overflow-visible">
      {/* 行背景暖光：肯定语点亮瞬间，一道金色微光从左到右扫过 */}
      <AnimatePresence>
        {isAffirmationDone && (
          <motion.div
            key="row-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 1.2,
              times: [0, 0.3, 1],
              ease: "easeOut",
            }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.06) 40%, transparent 80%)",
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div className="relative flex-shrink-0">
        <button
          onClick={onToggle}
          className={`w-4 h-4 rounded-full border-[1.5px] transition-all relative z-10 ${
            task.completed
              ? isAffirmation
                ? "bg-[#C9A961] border-[#C9A961]"
                : "bg-[#8A9A86] border-[#8A9A86]"
              : "border-[#C4C1B9]"
          }`}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        />
        {/* ✨ bloom：从 checkbox 中心一颗 ✨ 由小到大扩散开 */}
        <AnimatePresence>
          {isAffirmationDone && (
            <motion.span
              key="bloom"
              initial={{ scale: 0, opacity: 0.95 }}
              animate={{ scale: 3.5, opacity: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inline-block text-[14px] leading-none not-italic pointer-events-none"
              style={{
                left: "50%",
                top: "50%",
                marginLeft: "-7px",
                marginTop: "-8px",
                filter: "drop-shadow(0 0 6px rgba(212,175,55,0.8))",
                transformOrigin: "center",
              }}
              aria-hidden="true"
            >
              ✨
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <span
        className={`flex-1 text-[15px] font-serif transition-colors relative ${titleClass} ${
          isAffirmation ? "italic" : ""
        }`}
      >
        {isAffirmation && <span className="text-[#A09E9A]">&ldquo;</span>}
        {/* 文字暖辉：被点亮瞬间，标题短暂金色辉光脉冲 */}
        {isAffirmationDone ? (
          <motion.span
            initial={{ textShadow: "0 0 0px rgba(212,175,55,0)" }}
            animate={{
              textShadow: [
                "0 0 0px rgba(212,175,55,0)",
                "0 0 14px rgba(212,175,55,0.7)",
                "0 0 0px rgba(212,175,55,0)",
              ],
            }}
            transition={{
              duration: 1.4,
              times: [0, 0.3, 1],
              ease: "easeOut",
            }}
          >
            {task.title}
          </motion.span>
        ) : (
          task.title
        )}
        {isAffirmation && <span className="text-[#A09E9A]">&rdquo;</span>}
        <AnimatePresence>
          {isAffirmationDone && (
            <motion.span
              key="sparkle"
              initial={{ opacity: 0, scale: 0.3, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{
                duration: 0.6,
                ease: [0.34, 1.56, 0.64, 1], // back.out — overshoot
              }}
              className="ml-2 inline-block not-italic"
              style={{
                filter: "drop-shadow(0 0 6px rgba(212,175,55,0.65))",
              }}
              aria-hidden="true"
            >
              ✨
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}

export default function TodayView({ store }: TodayViewProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const tasksToday = store.data.tasks.filter((t: Task) => t.date === today);

  const habitCategoryMap = new Map<string, "habit" | "affirmation">();
  store.data.microHabits.forEach((h: MicroHabit) => {
    habitCategoryMap.set(h.id, h.category ?? "habit");
  });

  const affirmations = tasksToday.filter(
    (t: Task) => habitCategoryMap.get(t.habitId) === "affirmation",
  );
  const habits = tasksToday.filter(
    (t: Task) => habitCategoryMap.get(t.habitId) !== "affirmation",
  );

  const allCompleted =
    tasksToday.length > 0 && tasksToday.every((t: Task) => t.completed);

  // Celebrate when the user completes everything for the day.
  // Honors prefers-reduced-motion via `disableForReducedMotion`.
  useEffect(() => {
    if (!allCompleted) return;
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.4 },
      colors: ["#D4AF37", "#F3E5AB", "#C5B358", "#E6E6FA"],
      disableForReducedMotion: true,
      gravity: 0.8,
      scalar: 0.8,
    });
  }, [allCompleted]);

  return (
    <div className="pb-12">
      <AnimatePresence>
        {allCompleted && (
          <motion.div
            key="all-completed"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 py-6 text-center relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F0EFEA] to-transparent opacity-50" />
            <p className="font-serif text-lg text-[#8A9A86] italic tracking-widest relative z-10">
              All completed.
            </p>
            <p className="text-[10px] text-[#A09E9A] tracking-[0.2em] uppercase mt-2 relative z-10">
              A day well spent
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {affirmations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SectionLabel>Affirmations</SectionLabel>
            {affirmations.map((task: Task) => (
              <div key={task.id}>
                <TaskRow
                  task={task}
                  isAffirmation
                  onToggle={() => store.toggleTaskCompletion(task.id)}
                />
              </div>
            ))}
          </motion.div>
        )}

        {habits.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SectionLabel>Habits</SectionLabel>
            {habits.map((task: Task) => (
              <div key={task.id}>
                <TaskRow
                  task={task}
                  isAffirmation={false}
                  onToggle={() => store.toggleTaskCompletion(task.id)}
                />
              </div>
            ))}
          </motion.div>
        )}

        {tasksToday.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-serif italic text-sm text-[#B0ADA5]">
              No practices yet. Set up your first in Practice.
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
