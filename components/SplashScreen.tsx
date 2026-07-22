"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  isVisible: boolean;
}

export default function SplashScreen({ isVisible }: SplashScreenProps) {
  const [shouldRender, setShouldRender] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      // เริ่ม fade out animation
      setFadeOut(true);
      // ลบ element ออกหลัง animation จบ (700ms)
      const timer = setTimeout(() => setShouldRender(false), 700);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${
        fadeOut ? "opacity-0 scale-105" : "opacity-100 scale-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at 20% 20%, rgba(237, 214, 200, 0.7) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(198, 124, 78, 0.25) 0%, transparent 55%), #F9F2ED",
      }}
    >
      {/* ลูกแก้วตกแต่ง */}
      <div
        className="absolute top-[-10%] left-[-10%] w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(237,214,200,0.8), transparent 70%)",
          filter: "blur(40px)",
          animation: "splashPulse 3s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(198,124,78,0.3), transparent 70%)",
          filter: "blur(50px)",
          animation: "splashPulse 3s ease-in-out infinite 1.5s",
        }}
      />

      {/* Card กลาง */}
      <div
        className="relative flex flex-col items-center gap-6 px-10 py-12 rounded-3xl"
        style={{
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(237,214,200,0.6)",
          boxShadow:
            "0 8px 48px rgba(198,124,78,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
          animation: "splashCard 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {/* โลโก้ */}
        <div
          className="relative flex items-center justify-center"
          style={{ animation: "splashLogo 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both" }}
        >
          {/* วงกลมเรืองแสงด้านหลัง */}
          <div
            className="absolute rounded-full"
            style={{
              width: 96,
              height: 96,
              background:
                "radial-gradient(circle, rgba(198,124,78,0.2), transparent 70%)",
              filter: "blur(8px)",
              animation: "splashGlow 2s ease-in-out infinite",
            }}
          />
          <div
            className="relative w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{
              background: "white",
              boxShadow:
                "0 4px 24px rgba(198,124,78,0.2), 0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <img
              src="/logo.png"
              alt="Yayee Dormitory"
              className="w-16 h-16 object-contain"
            />
          </div>
        </div>

        {/* ชื่อแอป */}
        <div
          className="flex flex-col items-center gap-1 text-center"
          style={{ animation: "splashText 0.6s ease-out 0.3s both" }}
        >
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#313131" }}
          >
            หอพักหยาหยี๋
          </h1>
          <p
            className="text-sm font-medium tracking-widest uppercase"
            style={{ color: "#C67C4E" }}
          >
            Yayee Dormitory
          </p>
        </div>

        {/* Loading indicator */}
        <div
          className="flex flex-col items-center gap-3 w-full"
          style={{ animation: "splashText 0.6s ease-out 0.5s both" }}
        >
          {/* Progress bar */}
          <div
            className="relative w-48 h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(198,124,78,0.15)" }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #EDD6C8, #C67C4E, #A6653E)",
                animation: "splashBar 1.8s ease-in-out infinite",
              }}
            />
          </div>
          <span
            className="text-xs font-medium"
            style={{ color: "#888888" }}
          >
            กำลังโหลด...
          </span>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes splashCard {
          from { opacity: 0; transform: scale(0.88) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splashLogo {
          from { opacity: 0; transform: scale(0.6) rotate(-10deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes splashText {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashBar {
          0%   { left: -60%; width: 50%; }
          50%  { left: 30%; width: 60%; }
          100% { left: 110%; width: 50%; }
        }
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50%       { transform: scale(1.15); opacity: 1; }
        }
        @keyframes splashGlow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
