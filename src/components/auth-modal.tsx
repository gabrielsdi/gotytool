"use client";

import { createClient } from "@/lib/supabase/client";
import { Gamepad2, Sparkles, HardDrive, Scissors } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-black font-medium py-3 px-4 rounded-lg transition-colors"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      Continue with Google
    </button>
  );
}

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModalLogin({ open, onOpenChange }: AuthModalProps) {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#16162a] border-zinc-800 sm:max-w-sm">
        <DialogHeader className="text-center items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto mb-2">
            <Gamepad2 className="w-8 h-8 text-black" />
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            Welcome back
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            Sign in to access your account
          </DialogDescription>
        </DialogHeader>

        <GoogleButton onClick={handleGoogleLogin} />
      </DialogContent>
    </Dialog>
  );
}

export function AuthModalRegister({ open, onOpenChange }: AuthModalProps) {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#16162a] border-zinc-800 sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto mb-2">
            <Gamepad2 className="w-8 h-8 text-black" />
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            Create your account
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            Unlock all features with a free account
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium text-amber-400">
            What you get:
          </p>
          <ul className="text-xs text-zinc-400 space-y-1.5">
            <li className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Access to remove.bg for best quality results
            </li>
            <li className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              10 MB storage for your processed images
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              More tools and features coming soon
            </li>
          </ul>
        </div>

        <GoogleButton onClick={handleGoogleLogin} />
      </DialogContent>
    </Dialog>
  );
}
