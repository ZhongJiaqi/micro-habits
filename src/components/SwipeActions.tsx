import React, { useState, useRef, useCallback, ReactNode } from 'react';

interface SwipeActionsProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  showEdit?: boolean;
}

const ACTION_WIDTH = 120; // total width of action buttons area
const THRESHOLD = 50;

export default function SwipeActions({ children, onEdit, onDelete, showEdit = true }: SwipeActionsProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // If vertical scroll is dominant, don't swipe
    if (!swiping.current && Math.abs(dy) > Math.abs(dx)) return;
    swiping.current = true;

    const base = isOpen ? -ACTION_WIDTH : 0;
    const next = Math.min(0, Math.max(-ACTION_WIDTH, base + dx));
    currentX.current = next;
    setOffsetX(next);
  }, [isOpen]);

  const handleTouchEnd = useCallback(() => {
    if (!swiping.current) return;
    if (currentX.current < -THRESHOLD) {
      setOffsetX(-ACTION_WIDTH);
      setIsOpen(true);
    } else {
      setOffsetX(0);
      setIsOpen(false);
    }
  }, []);

  const close = useCallback(() => {
    setOffsetX(0);
    setIsOpen(false);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons behind */}
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch" style={{ width: ACTION_WIDTH }}>
        {showEdit && onEdit && (
          <button
            onClick={() => { close(); onEdit(); }}
            className="flex-1 flex items-center justify-center bg-[#8A9A86] text-white text-xs font-medium tracking-wide"
          >
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => { close(); onDelete(); }}
            className="flex-1 flex items-center justify-center bg-[#A35D5D] text-white text-xs font-medium tracking-wide"
          >
            Delete
          </button>
        )}
      </div>

      {/* Sliding content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${offsetX}px)`, transition: swiping.current ? 'none' : 'transform 0.25s ease-out' }}
        className="relative bg-[#F9F8F6]"
      >
        {children}
      </div>
    </div>
  );
}
