"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Asset {
  id: string;
  originalName: string;
  resultImage: string;
  provider: string;
  size?: string;
  creditsUsed?: number;
  timestamp: number;
}

const EXPIRATION_DAYS = 5;
const GUEST_STORAGE_KEY = "gotytool_guest_assets";

function loadGuestAssets(): Asset[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(GUEST_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveGuestAssets(assets: Asset[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(assets));
  } catch {
    console.error("Failed to save to localStorage");
  }
}

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(0);
  const [isGuest, setIsGuest] = useState(true);
  const supabase = createClient();

  const getSignedUrl = useCallback(async (path: string): Promise<string> => {
    const { data } = await supabase.storage
      .from("assets")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl || "";
  }, [supabase]);

  const refreshStorageUsed = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: files } = await supabase.storage
      .from("assets")
      .list(user.id);

    if (files) {
      const total = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
      setStorageUsed(total);
    }
  }, [supabase]);

  useEffect(() => {
    async function loadAssets() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Guest: load from localStorage
        setIsGuest(true);
        const guestAssets = loadGuestAssets();
        setAssets(guestAssets);
        const totalSize = guestAssets.reduce((sum, a) => {
          // Estimate size from base64 string
          const base64 = a.resultImage.split(",")[1] || "";
          return sum + Math.ceil((base64.length * 3) / 4);
        }, 0);
        setStorageUsed(totalSize);
        setStorageLimit(0);
        setLoaded(true);
        return;
      }

      // Logged in: load from Supabase
      setIsGuest(false);
      const DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024; // 10 MB

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("storage_limit")
        .eq("id", user.id)
        .single();

      if (profile) {
        setStorageLimit(profile.storage_limit);
      } else {
        await supabase.from("user_profiles").upsert(
          { id: user.id, storage_limit: DEFAULT_STORAGE_LIMIT, storage_used: 0 },
          { onConflict: "id" }
        );
        setStorageLimit(DEFAULT_STORAGE_LIMIT);
      }

      // Load assets created in the last 5 days
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - EXPIRATION_DAYS);

      const { data } = await supabase
        .from("assets")
        .select("*")
        .gte("created_at", fiveDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (data) {
        const mapped: Asset[] = await Promise.all(
          data.map(async (row) => ({
            id: row.id,
            originalName: row.original_name,
            resultImage: await getSignedUrl(row.storage_path),
            provider: row.provider,
            size: row.size,
            creditsUsed: row.credits_used,
            timestamp: new Date(row.created_at).getTime(),
          }))
        );
        setAssets(mapped);
      }
      setLoaded(true);
      refreshStorageUsed();
    }

    loadAssets();
  }, [supabase, getSignedUrl, refreshStorageUsed]);

  const addAsset = useCallback(
    async (
      asset: Omit<Asset, "id" | "timestamp"> & { file: Blob }
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const newAsset: Asset = {
        id: crypto.randomUUID(),
        originalName: asset.originalName,
        resultImage: asset.resultImage,
        provider: asset.provider,
        size: asset.size,
        creditsUsed: asset.creditsUsed,
        timestamp: Date.now(),
      };

      if (!user) {
        // Guest: save to localStorage
        const guestAssets = loadGuestAssets();
        const updated = [newAsset, ...guestAssets];
        saveGuestAssets(updated);
        setAssets(updated);

        const base64 = newAsset.resultImage.split(",")[1] || [];
        const estimatedSize = Math.ceil((base64.length * 3) / 4);
        setStorageUsed((prev) => prev + estimatedSize);
        return true;
      }

      // Logged in: save to Supabase
      const fileSize = asset.file.size;
      if (storageUsed + fileSize > storageLimit) {
        console.error("Storage limit exceeded");
        return false;
      }

      const ext = asset.originalName.split(".").pop() || "png";
      const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const contentType =
        asset.file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;
      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(storagePath, asset.file, { contentType });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return false;
      }

      const { data: insertData, error: insertError } = await supabase
        .from("assets")
        .insert({
          user_id: user.id,
          original_name: asset.originalName,
          storage_path: storagePath,
          provider: asset.provider,
          processed: true,
          size: asset.size,
          credits_used: asset.creditsUsed,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return false;
      }

      await supabase
        .from("user_profiles")
        .update({ storage_used: storageUsed + fileSize })
        .eq("id", user.id);

      const signedUrl = await getSignedUrl(storagePath);

      const savedAsset: Asset = {
        id: insertData.id,
        originalName: asset.originalName,
        resultImage: signedUrl,
        provider: asset.provider,
        size: asset.size,
        creditsUsed: asset.creditsUsed,
        timestamp: new Date(insertData.created_at).getTime(),
      };

      setAssets((prev) => [savedAsset, ...prev]);
      setStorageUsed((prev) => prev + fileSize);
      return true;
    },
    [supabase, getSignedUrl, storageUsed, storageLimit]
  );

  const removeAsset = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          // Guest: remove from localStorage
          const guestAssets = loadGuestAssets();
          const asset = guestAssets.find((a) => a.id === id);
          const updated = guestAssets.filter((a) => a.id !== id);
          saveGuestAssets(updated);
          setAssets(updated);

          if (asset) {
            const base64 = asset.resultImage.split(",")[1] || "";
            const estimatedSize = Math.ceil((base64.length * 3) / 4);
            setStorageUsed((prev) => Math.max(0, prev - estimatedSize));
          }
          return;
        }

        // Logged in: remove from Supabase
        const { data: row } = await supabase
          .from("assets")
          .select("storage_path")
          .eq("id", id)
          .single();

        let fileSize = 0;
        if (row) {
          const { data: fileInfo } = await supabase.storage
            .from("assets")
            .list(user.id, { search: row.storage_path.split("/").pop() });
          fileSize = fileInfo?.[0]?.metadata?.size || 0;
          await supabase.storage.from("assets").remove([row.storage_path]);
        }

        await supabase.from("assets").delete().eq("id", id);

        const newStorageUsed = Math.max(0, storageUsed - fileSize);
        await supabase
          .from("user_profiles")
          .update({ storage_used: newStorageUsed })
          .eq("id", user.id);

        setAssets((prev) => prev.filter((a) => a.id !== id));
        setStorageUsed(newStorageUsed);
      } finally {
        setDeleting(false);
      }
    },
    [supabase, storageUsed]
  );

  const removeAssets = useCallback(
    async (ids: string[]) => {
      setDeleting(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          // Guest: remove from localStorage
          const guestAssets = loadGuestAssets();
          const removed = guestAssets.filter((a) => ids.includes(a.id));
          const updated = guestAssets.filter((a) => !ids.includes(a.id));
          saveGuestAssets(updated);
          setAssets(updated);

          const freedSize = removed.reduce((sum, asset) => {
            const base64 = asset.resultImage.split(",")[1] || "";
            return sum + Math.ceil((base64.length * 3) / 4);
          }, 0);
          setStorageUsed((prev) => Math.max(0, prev - freedSize));
          return;
        }

        // Logged in: remove from Supabase
        const { data: rows } = await supabase
          .from("assets")
          .select("storage_path")
          .in("id", ids);

        let totalFreed = 0;
        if (rows && rows.length > 0) {
          for (const row of rows) {
            const fileName = row.storage_path.split("/").pop();
            const { data: fileInfo } = await supabase.storage
              .from("assets")
              .list(user.id, { search: fileName });
            totalFreed += fileInfo?.[0]?.metadata?.size || 0;
          }
          const paths = rows.map((r) => r.storage_path);
          await supabase.storage.from("assets").remove(paths);
        }

        await supabase.from("assets").delete().in("id", ids);

        const newStorageUsed = Math.max(0, storageUsed - totalFreed);
        await supabase
          .from("user_profiles")
          .update({ storage_used: newStorageUsed })
          .eq("id", user.id);

        setAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
        setStorageUsed(newStorageUsed);
      } finally {
        setDeleting(false);
      }
    },
    [supabase, storageUsed]
  );

  return {
    assets,
    loaded,
    deleting,
    storageUsed,
    storageLimit,
    isGuest,
    addAsset,
    removeAsset,
    removeAssets,
  };
}
