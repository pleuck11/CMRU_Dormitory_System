"use client";

import { usePathname } from "next/navigation";

/**
 * PageTransition — wraps page content with a fade-up animation.
 * Uses pathname as the React key so the animation re-triggers on every navigation.
 */
export default function PageTransition({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={`page-enter w-full ${className}`}>
      {children}
    </div>
  );
}
