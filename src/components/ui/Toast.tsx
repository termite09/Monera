"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface ToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onUndo, onDismiss, duration = 5000 }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [duration, onDismiss]);

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onUndo();
    onDismiss();
  };

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed bottom-24 left-4 right-4 md:left-[calc(14rem+1rem)] z-50 mx-auto max-w-md"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-900 dark:bg-gray-700 px-4 py-3 text-white shadow-lg">
        <p className="text-sm flex-1 min-w-0 truncate">{message}</p>
        <button
          onClick={handleUndo}
          className="text-sm font-medium text-blue-300 underline-offset-2 underline shrink-0"
        >
          Undo
        </button>
      </div>
    </motion.div>
  );
}
