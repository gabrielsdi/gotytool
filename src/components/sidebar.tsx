"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { User } from "@supabase/supabase-js";
import {
  Scissors,
  Grid3x3,
  ZoomIn,
  Palette,
  Volume2,
  Gamepad2,
  Hammer,
  Wrench,
  Bone,
  FolderOpen,
  LogOut,
  Settings,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TOOLS = [
  {
    id: "bg-removal",
    name: "Background Removal",
    icon: Scissors,
    description: "Remove image backgrounds",
  },
  {
    id: "rig-tools",
    name: "Rig Tools",
    icon: Bone,
    description: "Mixamo to Unreal retarget",
  },
  {
    id: "coming-1",
    name: "Sprite Sheet Cutter",
    icon: Grid3x3,
    description: "Coming soon",
    disabled: true,
  },
  {
    id: "coming-2",
    name: "Pixel Art Scaler",
    icon: ZoomIn,
    description: "Coming soon",
    disabled: true,
  },
  {
    id: "coming-3",
    name: "Color Palette Extractor",
    icon: Palette,
    description: "Coming soon",
    disabled: true,
  },
  {
    id: "coming-4",
    name: "Audio Converter",
    icon: Volume2,
    description: "Coming soon",
    disabled: true,
  },
];

interface SidebarProps {
  assetCount: number;
  activeTool: string;
  onToolChange: (tool: string) => void;
  user: User | null;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export function Sidebar({ assetCount, activeTool, onToolChange, user, onLoginClick, onRegisterClick }: SidebarProps) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const isSettings = pathname === "/user/settings";
  const displayName = user?.user_metadata?.full_name || user?.email || "User";

  const handleToolClick = (toolId: string) => {
    if (isSettings) {
      router.push("/");
      return;
    }
    onToolChange(toolId);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-[#16162a] border-r border-zinc-800 flex flex-col shrink-0 z-50">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
            <Gamepad2 className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="font-bold text-white leading-tight">
              GameDev Tools
            </h1>
            <p className="text-xs text-zinc-500">Free utilities</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
          Tools
        </p>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              disabled={tool.disabled && !isSettings}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                !isSettings && activeTool === tool.id
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : tool.disabled
                    ? "text-zinc-600 cursor-not-allowed"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  !isSettings && activeTool === tool.id
                    ? "text-amber-400"
                    : tool.disabled
                      ? "text-zinc-600"
                      : "text-zinc-500"
                }`}
              />
              <div className="text-left">
                <div className="font-medium">{tool.name}</div>
                {tool.disabled && (
                  <div className="text-[10px] text-zinc-600">
                    {tool.description}
                  </div>
                )}
              </div>
              {tool.disabled && (
                <span className="ml-auto text-[10px] bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded">
                  SOON
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
            Library
          </p>
          <button
            onClick={() => handleToolClick("assets")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              !isSettings && activeTool === "assets"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : isSettings
                  ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent"
            }`}
          >
            <FolderOpen
              className={`w-5 h-5 shrink-0 ${
                !isSettings && activeTool === "assets" ? "text-amber-400" : "text-zinc-500"
              }`}
            />
            <div className="text-left font-medium">Assets</div>
            {assetCount > 0 && (
              <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                {assetCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <div className="p-4 border-t border-zinc-800 space-y-3">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div className={`w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black ${user.user_metadata?.avatar_url ? "hidden" : ""}`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-zinc-300 truncate">
                    {displayName}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-56 bg-zinc-800 border-zinc-700">
              <DropdownMenuItem
                onClick={() => router.push("/user/settings")}
                className="text-zinc-300 focus:bg-zinc-700 focus:text-white cursor-pointer"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem className="focus:bg-zinc-700 focus:text-white cursor-pointer p-0">
                <form action={signOut} className="w-full">
                  <button type="submit" className="w-full flex items-center gap-2 px-1.5 py-1 text-sm text-zinc-300">
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="space-y-2">
            <button
              onClick={onRegisterClick}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium py-2 px-3 rounded-lg text-sm transition-colors"
            >
              Register
            </button>
            <button
              onClick={onLoginClick}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 px-3 rounded-lg text-sm transition-colors border border-zinc-700"
            >
              Log in
            </button>
          </div>
        )}
        <div className="flex items-center justify-center gap-2 text-zinc-600">
          <Hammer className="w-3.5 h-3.5" />
          <p className="text-[10px]">Built for game developers</p>
          <Wrench className="w-3.5 h-3.5" />
        </div>
      </div>
    </aside>
  );
}
