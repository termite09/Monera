"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1A1A1A] rounded-t-2xl max-h-[92vh] overflow-y-auto md:max-w-lg md:mx-auto md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-xl md:shadow-xl md:max-h-[80vh]"
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#2D2D2D]">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>
            {/* iOS safe area padding at bottom */}
            <div className="p-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
