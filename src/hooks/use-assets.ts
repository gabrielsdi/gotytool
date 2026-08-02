"use client";

import { useState, useEffect, useCallback } from "react";

export interface Asset {
  id: string;
  originalName: string;
  resultImage: string;
  provider: string;
  size?: string;
  creditsUsed?: number;
  timestamp: number;
}

const STORAGE_KEY = "gamedev-tools-assets";

function loadAssets(): Asset[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAssets(assets: Asset[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  } catch {
    // Storage full - silently fail
  }
}

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAssets(loadAssets());
    setLoaded(true);
  }, []);

  const addAsset = useCallback(
    (asset: Omit<Asset, "id" | "timestamp">) => {
      const newAsset: Asset = {
        ...asset,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setAssets((prev) => {
        const updated = [newAsset, ...prev];
        saveAssets(updated);
        return updated;
      });
    },
    []
  );

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      saveAssets(updated);
      return updated;
    });
  }, []);

  const clearAssets = useCallback(() => {
    setAssets([]);
    saveAssets([]);
  }, []);

  return { assets, loaded, addAsset, removeAsset, clearAssets };
}
