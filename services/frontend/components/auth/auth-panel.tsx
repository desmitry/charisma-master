"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { LogIn, LogOut, RefreshCw, UserPlus, UserRound, X } from "lucide-react";
import {
  authLogin,
  authLogout,
  authRefresh,
  authRegister,
} from "@/lib/api";

type AuthMode = "login" | "register";

interface AuthSession {
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

const ACCESS_TOKEN_STORAGE_KEY = "token";
const REFRESH_TOKEN_STORAGE_KEY = "refresh_token";
const EMAIL_STORAGE_KEY = "charisma.auth.email";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Запрос не выполнен";
}

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: "easeIn" } },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.18, ease: "easeIn" } },
};

export function AuthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (!accessToken || !refreshToken) return;
    setSession({
      email: window.localStorage.getItem(EMAIL_STORAGE_KEY) || "Аккаунт",
      accessToken,
      refreshToken,
      tokenType: "Bearer",
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new Event("lenis:stop"));
      document.body.setAttribute("data-modal-open", "1");
    } else {
      window.dispatchEvent(new Event("lenis:start"));
      document.body.removeAttribute("data-modal-open");
    }
    return () => {
      window.dispatchEvent(new Event("lenis:start"));
      document.body.removeAttribute("data-modal-open");
      document.documentElement.style.removeProperty("--animations-paused");
    };
  }, [isOpen]);

  const submitLabel = useMemo(() => {
    if (isSubmitting) return mode === "login" ? "Входим…" : "Регистрируем…";
    return mode === "login" ? "Войти" : "Создать аккаунт";
  }, [isSubmitting, mode]);

  const persistSession = (nextSession: AuthSession) => {
    setSession(nextSession);
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, nextSession.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, nextSession.refreshToken);
    window.localStorage.setItem(EMAIL_STORAGE_KEY, nextSession.email);
  };

  const clearSession = () => {
    setSession(null);
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  };

  const resetFeedback = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setConfirmPassword("");
    resetFeedback();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const response = await authLogin({ email, password });
        persistSession({
          email,
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          tokenType: response.token_type,
        });
        setStatusMessage("Вход выполнен");
      } else {
        if (password !== confirmPassword) {
          setErrorMessage("Пароли не совпадают");
          setIsSubmitting(false);
          return;
        }
        const response = await authRegister({ email, password });
        setStatusMessage(`Регистрация выполнена. ID: ${response.user_id}`);
      }
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    resetFeedback();
    setIsSubmitting(true);
    try {
      if (!session?.refreshToken) throw new Error("Refresh token отсутствует");
      const response = await authRefresh(session.refreshToken);
      persistSession({ ...session, accessToken: response.access_token, tokenType: response.token_type });
      setStatusMessage("Токен обновлён");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    resetFeedback();
    setIsSubmitting(true);
    try {
      await authLogout({ accessToken: session?.accessToken, refreshToken: session?.refreshToken });
      clearSession();
      setStatusMessage("Выход выполнен");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <div className="pointer-events-auto fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <motion.button
          type="button"
          onClick={() => { resetFeedback(); setIsOpen(true); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="group inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 text-sm font-medium text-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus:outline-none"
        >
          <motion.span
            className="flex items-center"
            initial={false}
            animate={{ rotate: 0 }}
          >
            {session
              ? <UserRound className="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors duration-200" />
              : <LogIn className="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors duration-200" />
            }
          </motion.span>
          <span className="max-w-[10rem] truncate">{session?.email || "Войти"}</span>
        </motion.button>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              ref={overlayRef}
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Panel */}
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0a0a0a]/95 shadow-[0_32px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Subtle top glow line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="p-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <motion.h2
                    key={session ? "account" : mode}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="text-base font-semibold tracking-tight text-white"
                  >
                    {session ? "Аккаунт" : (mode === "login" ? "Вход" : "Регистрация")}
                  </motion.h2>

                  <motion.button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/40 transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.08] hover:text-white/70 focus:outline-none"
                  >
                    <X className="h-3.5 w-3.5" />
                  </motion.button>
                </div>

                <AnimatePresence mode="wait">
                  {session ? (
                    <motion.div
                      key="session"
                      variants={contentVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-4"
                    >
                      {/* User card */}
                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
                          Текущий пользователь
                        </p>
                        <p className="mt-1.5 truncate text-sm font-medium text-white">{session.email}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {[
                            { label: "Access", value: !!session.accessToken },
                            { label: "Refresh", value: !!session.refreshToken },
                          ].map(({ label, value }) => (
                            <span
                              key={label}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                value
                                  ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400"
                                  : "border-white/10 bg-white/[0.04] text-white/40"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${value ? "bg-emerald-400" : "bg-white/30"}`} />
                              {label}: {value ? "есть" : "нет"}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <GhostButton
                          onClick={handleRefresh}
                          disabled={isSubmitting || !session.refreshToken}
                          icon={<RefreshCw className={`h-3.5 w-3.5 ${isSubmitting ? "animate-spin" : ""}`} />}
                        >
                          Обновить
                        </GhostButton>
                        <PrimaryButton
                          onClick={handleLogout}
                          disabled={isSubmitting}
                          icon={<LogOut className="h-3.5 w-3.5" />}
                        >
                          Выйти
                        </PrimaryButton>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="auth"
                      variants={contentVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {/* Mode toggle */}
                      <div className="relative mb-5 flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
                        <motion.div
                          className="absolute inset-y-1 left-1 right-[calc(50%+2px)] rounded-[9px] bg-white"
                          animate={{ x: mode === "login" ? 0 : "calc(100% + 4px)" }}
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                        {(["login", "register"] as AuthMode[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleModeChange(m)}
                            className={`relative z-10 flex-1 rounded-[9px] py-2 text-xs font-semibold transition-colors duration-200 ${
                              mode === m ? "text-black" : "text-white/45 hover:text-white/70"
                            }`}
                          >
                            {m === "login" ? "Вход" : "Регистрация"}
                          </button>
                        ))}
                      </div>

                      <form className="space-y-3.5" onSubmit={handleSubmit}>
                        <AuthInput
                          label="Email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          required
                        />
                        <AuthInput
                          label="Пароль"
                          type="password"
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Минимум 8 символов"
                          required
                          minLength={8}
                          maxLength={128}
                        />

                        <AnimatePresence initial={false}>
                          {mode === "register" && (
                            <motion.div
                              key="confirm"
                              initial={{ opacity: 0, height: 0, y: -6 }}
                              animate={{ opacity: 1, height: "auto", y: 0 }}
                              exit={{ opacity: 0, height: 0, y: -4 }}
                              transition={{ duration: 0.28, ease: "easeOut" }}
                              style={{ overflow: "hidden" }}
                            >
                              <AuthInput
                                label="Повторите пароль"
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Повторите пароль"
                                required
                                minLength={8}
                                maxLength={128}
                                hasError={confirmPassword.length > 0 && confirmPassword !== password}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="pt-1">
                          <PrimaryButton
                            type="submit"
                            disabled={isSubmitting}
                            icon={
                              isSubmitting
                                ? <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                    className="inline-block"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </motion.span>
                                : mode === "login"
                                  ? <LogIn className="h-3.5 w-3.5" />
                                  : <UserPlus className="h-3.5 w-3.5" />
                            }
                            fullWidth
                          >
                            {submitLabel}
                          </PrimaryButton>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Feedback */}
                <AnimatePresence>
                  {(statusMessage || errorMessage) && (
                    <motion.p
                      initial={{ opacity: 0, y: 6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className={`mt-4 overflow-hidden rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                        errorMessage
                          ? "border-red-500/20 bg-red-500/[0.08] text-red-300"
                          : "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300"
                      }`}
                    >
                      {errorMessage || statusMessage}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hasError?: boolean;
}

function AuthInput({ label, hasError, ...props }: AuthInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block">
      <span className={`mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] transition-colors duration-150 ${hasError ? "text-red-400/70" : "text-white/35"}`}>
        {label}
      </span>
      <motion.div
        animate={{
          boxShadow: hasError
            ? "0 0 0 2px rgba(239,68,68,0.25)"
            : focused
            ? "0 0 0 2px rgba(255,255,255,0.12)"
            : "0 0 0 0px rgba(255,255,255,0)",
        }}
        transition={{ duration: 0.18 }}
        className="rounded-xl"
      >
        <input
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          className={`h-10 w-full rounded-xl border px-3.5 text-sm text-white outline-none transition-colors duration-150 placeholder:text-white/20 ${
            hasError
              ? "border-red-500/40 bg-red-500/[0.05] hover:border-red-500/50"
              : "border-white/[0.09] bg-white/[0.03] hover:border-white/15 focus:border-white/20"
          }`}
        />
      </motion.div>
    </label>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

function PrimaryButton({ icon, fullWidth, children, disabled, type = "button", className = "", ...props }: ButtonProps) {
  return (
    <motion.button
      type={type}
      {...(props as object)}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.015 }}
      whileTap={disabled ? {} : { scale: 0.975 }}
      transition={{ type: "spring", stiffness: 450, damping: 28 }}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-black shadow-[0_4px_20px_rgba(255,255,255,0.12)] transition-opacity duration-200 disabled:pointer-events-none disabled:opacity-40 ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {icon}
      {children}
    </motion.button>
  );
}

function GhostButton({ icon, children, disabled, className = "", ...props }: ButtonProps) {
  return (
    <motion.button
      type="button"
      {...(props as object)}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 450, damping: 28 }}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] text-xs font-medium text-white/60 transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {icon}
      {children}
    </motion.button>
  );
}
