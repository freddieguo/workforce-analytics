"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("密码错误，请重试 Wrong password, try again.");
      }
    } catch {
      setError("连接失败，请重试 Connection failed, try again.");
    }
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1226] px-4">
      <style>{`
        @keyframes drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -40px) scale(1.15); }
          66% { transform: translate(-40px, 50px) scale(0.95); }
        }
        @keyframes drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-70px, -50px) scale(1.2); }
        }
        @keyframes drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, 60px) scale(1.1); }
        }
        @keyframes floaty {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.35); }
          50% { box-shadow: 0 0 70px rgba(139, 92, 246, 0.55); }
        }
        .anim-drift-a { animation: drift-a 18s ease-in-out infinite; }
        .anim-drift-b { animation: drift-b 22s ease-in-out infinite; }
        .anim-drift-c { animation: drift-c 26s ease-in-out infinite; }
        .anim-floaty { animation: floaty 6s ease-in-out infinite; }
        .anim-fade-up { animation: fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .anim-shake { animation: shake 0.4s ease-in-out; }
        .anim-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
        .btn-shine { position: relative; overflow: hidden; }
        .btn-shine::after {
          content: "";
          position: absolute;
          top: 0; left: -80%;
          width: 50%; height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-20deg);
          transition: left 0.6s ease;
        }
        .btn-shine:hover::after { left: 130%; }
        @property --ring-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes ring-spin {
          to { --ring-angle: 360deg; }
        }
        .rotating-border {
          padding: 2px;
          background: conic-gradient(
            from var(--ring-angle),
            rgba(99, 102, 241, 0) 0%,
            rgba(99, 102, 241, 0.9) 8%,
            rgba(168, 85, 247, 0.9) 16%,
            rgba(99, 102, 241, 0) 26%,
            rgba(99, 102, 241, 0) 50%,
            rgba(34, 211, 238, 0.7) 58%,
            rgba(34, 211, 238, 0) 68%,
            rgba(99, 102, 241, 0) 100%
          );
          animation: ring-spin 8s linear infinite;
        }
      `}</style>

      {/* 背景光斑 */}
      <div className="anim-drift-a pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-indigo-600/30 blur-[120px]" />
      <div className="anim-drift-b pointer-events-none absolute -bottom-40 -right-24 h-[520px] w-[520px] rounded-full bg-violet-600/25 blur-[120px]" />
      <div className="anim-drift-c pointer-events-none absolute left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px]" />
      {/* 网格纹理 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)",
        }}
      />

      {/* 卡片 */}
      <div className="anim-floaty relative w-full max-w-md">
        <div className="rotating-border anim-fade-up relative rounded-[30px] shadow-2xl">
          <div className="relative overflow-hidden rounded-[28px] bg-[#0c142e]/95 p-10 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-indigo-500/25 blur-3xl" />

          <div
            className="anim-fade-up relative flex flex-col items-center text-center"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="anim-pulse-glow relative rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-[2px]">
              <img
                src="/logo.jpeg"
                alt="HR 看板"
                className="h-16 w-16 rounded-[22px] bg-white object-contain p-2"
              />
            </div>
            <h1 className="mt-6 bg-gradient-to-r from-white via-indigo-100 to-white bg-clip-text text-3xl font-extrabold tracking-wide text-transparent">
              HR 看板
            </h1>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              HR Dashboard
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="anim-fade-up relative mt-8"
            style={{ animationDelay: "0.2s" }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入访问密码 Enter password"
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-sm text-white placeholder-slate-500 outline-none backdrop-blur transition-all duration-300 focus:border-indigo-400/70 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]"
            />

            {error && (
              <p
                key={error}
                className="anim-shake mt-3 text-center text-xs font-medium text-rose-400"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-shine mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-sm font-bold tracking-wide text-white shadow-[0_8px_30px_rgba(99,102,241,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(99,102,241,0.55)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  验证中 Verifying…
                </span>
              ) : (
                "进入看板 Enter Dashboard →"
              )}
            </button>
          </form>

          <p
            className="anim-fade-up relative mt-6 text-center text-[11px] text-slate-500"
            style={{ animationDelay: "0.3s" }}
          >
            内部使用 · Internal use only
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}
