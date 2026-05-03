import { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, differenceInDays, parseISO } from 'date-fns';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task, HabitPoolItem } from '../types';
import { cn } from '../lib/utils';

export default function HistoryView({ store }: { store: any }) {
  const { tasks, habitPool, microHabits } = store.data;
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Calculate stats

  const activeHabitsCount = microHabits.filter((h: any) => h.active).length;

  // Calculate Best Streak
  const tasksByDate = tasks.reduce((acc: any, task: Task) => {
    if (!acc[task.date]) acc[task.date] = { total: 0, completed: 0 };
    acc[task.date].total++;
    if (task.completed) acc[task.date].completed++;
    return acc;
  }, {});

  const perfectDates = Object.keys(tasksByDate)
    .filter(date => tasksByDate[date].total > 0 && tasksByDate[date].completed === tasksByDate[date].total)
    .sort();

  let bestStreak = 0;
  let currentStreak = 0;
  let previousDate: Date | null = null;

  for (const dateStr of perfectDates) {
    const dateObj = parseISO(dateStr);
    if (!previousDate) {
      currentStreak = 1;
    } else {
      const diffDays = differenceInDays(dateObj, previousDate);
      if (diffDays === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
    }
    previousDate = dateObj;
  }

  // Calculate Weekly Data
  const today = new Date();
  const weekStartThisWeek = startOfWeek(today);
  const weekEndThisWeek = endOfWeek(today);
  const thisWeekDays = eachDayOfInterval({ start: weekStartThisWeek, end: weekEndThisWeek });

  const weeklyData = thisWeekDays.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayTasks = tasks.filter((t: Task) => t.date === dateStr);
    const total = dayTasks.length;
    const completed = dayTasks.filter((t: Task) => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      dayLabel: format(day, 'EEE'),
      percentage,
      total,
      completed
    };
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="pb-12 pt-4">
      {/* Calendar View */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em]">
            History
          </h2>
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="text-[#A09E9A] hover:text-[#1A1A1A] transition-colors">
              <ChevronLeft className="w-4 h-4 stroke-[1.5]" />
            </button>
            <span className="text-xs font-serif tracking-widest text-[#1A1A1A] uppercase w-24 text-center">
              {format(currentMonth, 'MMM yyyy')}
            </span>
            <button onClick={nextMonth} className="text-[#A09E9A] hover:text-[#1A1A1A] transition-colors">
              <ChevronRight className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-y-4 mb-4">
          {weekDays.map(day => (
            <div key={day} className="text-center text-[9px] font-medium text-[#C4C1B9] uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-4">
          {calendarDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayTasks = tasks.filter((t: Task) => t.date === dateStr);
            const totalCount = dayTasks.length;
            const completedCount = dayTasks.filter((t: Task) => t.completed).length;
            const allDone = totalCount > 0 && completedCount === totalCount;
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isToday(day);

            return (
              <div key={dateStr} className="flex flex-col items-center justify-center h-10">
                <div className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full text-xs font-serif transition-all duration-300",
                  !isCurrentMonth ? "text-[#EAE8E3]" :
                  allDone ? "bg-[#8A9A86] text-white" :
                  isTodayDate ? "border border-[#8A9A86] text-[#1A1A1A]" :
                  "text-[#2C2C2C] hover:bg-[#F0EFEA]"
                )}>
                  {format(day, 'd')}
                </div>
                {isCurrentMonth && totalCount > 0 && !allDone && (
                  <div className="w-1 h-1 rounded-full bg-[#D1CEC7] mt-1"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 mb-16">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-serif font-light text-[#1A1A1A] mb-3">{bestStreak}</span>
          <span className="text-[9px] font-medium text-[#A09E9A] uppercase tracking-[0.2em]">Best<br/>Streak</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-serif font-light text-[#1A1A1A] mb-3">{activeHabitsCount}</span>
          <span className="text-[9px] font-medium text-[#A09E9A] uppercase tracking-[0.2em]">Active<br/>Habits</span>
        </div>
      </div>

      {/* Weekly Progress */}
      <div className="mb-16">
        <h2 className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em] mb-6 text-center">
          This Week's Progress
        </h2>
        <div className="flex items-end justify-between h-32 px-2 gap-2">
          {weeklyData.map(data => (
            <div key={data.dayLabel} className="flex flex-col items-center gap-3 flex-1 h-full">
              <div className="w-full max-w-[28px] flex-1 bg-[#F0EFEA] rounded-t-md relative flex items-end justify-center overflow-hidden">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${data.percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="w-full bg-[#8A9A86] rounded-t-md"
                />
              </div>
              <span className="text-[9px] font-medium text-[#A09E9A] uppercase tracking-widest">
                {data.dayLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Habit Pool */}
      <div>
        <h2 className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em] mb-6 text-center">
          The 21-Day Hall
        </h2>
        
        {habitPool.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-serif italic text-sm text-[#B0ADA5]">Consistency builds character.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {habitPool.map((item: HabitPoolItem) => {
              const completedDays = tasks.filter((t: Task) => t.type === 'habit' && t.habitId === item.habitId && t.completed).length;
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={item.id}
                  className="flex items-center justify-between py-4 border-b border-[#EAE8E3]"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-serif text-[#2C2C2C]">{item.title}</span>
                    <span className="text-[10px] text-[#A09E9A] tracking-widest uppercase">{completedDays} Days Completed</span>
                  </div>
                  <span className="text-[10px] text-[#A09E9A] tracking-widest uppercase text-right">Achieved<br/>{item.achievedDate}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
