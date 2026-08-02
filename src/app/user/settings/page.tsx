"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/sidebar";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function UserSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        setFullName(data.user.user_metadata?.full_name || "");
      } else {
        router.push("/login");
      }
    });
  }, [supabase, router]);

  const handleUpdateProfile = async () => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUser(data.user);
      setMessage({ type: "success", text: "Profile updated successfully" });
    }

    setLoading(false);
  };

  if (!user) {
    return (
      <div className="flex min-h-screen bg-[#0f0f1a] items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      <Sidebar assetCount={0} activeTool="settings" onToolChange={() => {}} />

      {/* Main content */}
      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
            <p className="text-zinc-400 mt-1">
              Update your personal information
            </p>
          </div>

          {/* Avatar display */}
          <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-xl font-bold text-black">
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-medium text-white">{fullName || "No name set"}</p>
              <p className="text-sm text-zinc-500">{user.email}</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                Full Name
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                Email
              </label>
              <Input
                value={user.email || ""}
                disabled
                className="bg-zinc-800 border-zinc-700 text-zinc-500"
              />
              <p className="text-xs text-zinc-600">
                Email cannot be changed from here
              </p>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}>
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {message.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleUpdateProfile}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="secondary"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
