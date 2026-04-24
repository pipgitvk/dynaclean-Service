"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

const ACCENT_COLOR = "#0E7490";

const LoginPage = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear input fields when the component mounts
  useEffect(() => {
    setUsername("");
    setPassword("");
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Clear old errors
    setIsSubmitting(true); // Start submission

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setIsSubmitting(false);
        return;
      }

      router.push("/user-dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Column - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-12">
            <span className="text-2xl font-bold text-[#171717]">{`{}`}</span>
            <span className="text-xl font-semibold text-[#171717]">DynaClean</span>
          </div>

          <h1 className="text-3xl font-bold text-[#171717] mb-2">Welcome Back!</h1>
          <p className="text-gray-500 mb-8 text-sm">
            Sign in to access your dashboard and continue managing your CRM efficiently.
          </p>

          {error && (
            <p className="text-red-500 text-sm mb-4 p-3 bg-red-50 rounded-lg text-center">
              {error}
            </p>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-[#EEF2F6] border-none rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#0E7490]/40 transition-all outline-none"
                  required
                  disabled={isSubmitting}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-12 py-3 bg-[#EEF2F6] border-none rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#0E7490]/40 transition-all outline-none"
                  required
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <a
                href="/forgot-password"
                className="text-sm font-medium text-gray-600 hover:underline"
              >
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#0E7490] hover:bg-[#155E75] text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-[#0E7490]/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column - Marketing Panel */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 xl:p-16 relative overflow-hidden"
        style={{ backgroundColor: ACCENT_COLOR }}
      >
        <div className="relative z-10 max-w-xl">
          <h2 className="text-3xl xl:text-4xl font-bold text-white mb-8 leading-tight">
            Revolutionize CRM with Smarter Management
          </h2>
          
          <div className="space-y-6">
            <div className="text-6xl text-white/20 font-serif leading-none h-8">&ldquo;</div>
            <p className="text-white/90 text-lg leading-relaxed pl-4">
              DynaClean has completely transformed our customer management process. It&apos;s reliable, efficient, and ensures our operations are always top-notch.
            </p>
            
            <div className="flex items-center gap-4 mt-8 pl-4">
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white font-bold">
                VK
              </div>
              <div>
                <p className="font-semibold text-white">Virendra Kumar</p>
                <p className="text-white/60 text-sm">CEO</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full -ml-48 -mb-48 blur-3xl" />
      </div>
    </div>
  );
};

export default LoginPage;
