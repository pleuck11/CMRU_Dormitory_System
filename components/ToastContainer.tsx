"use client";

import { useEffect, useState } from "react";
import { EVENT_NAME, ToastEvent, ToastType } from "@/lib/toast";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

interface ToastItem extends ToastEvent {
  exiting?: boolean;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500" strokeWidth={2} />,
  error: <XCircle className="w-5 h-5 text-rose-500" strokeWidth={2} />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" strokeWidth={2} />,
  info: <Info className="w-5 h-5 text-blue-500" strokeWidth={2} />,
};

const DURATION = 4000;

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastEvent>).detail;
      setToasts(prev => [...prev, detail]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== detail.id));
      }, DURATION);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 sm:top-8 sm:right-8 z-[99999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            group flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl
            border border-slate-200/50 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.08)]
            animate-in slide-in-from-top-5 sm:slide-in-from-right-5 fade-in duration-300 pointer-events-auto
          `}
        >
          <div className="flex-shrink-0 flex items-center justify-center">
            {ICONS[t.type]}
          </div>
          <p className="text-[13px] sm:text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug flex-1">
            {t.message}
          </p>
          <button
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="flex-shrink-0 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
