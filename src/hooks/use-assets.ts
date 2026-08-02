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

const STORAGE_LIMIT = 1024 * 1024 * 1024; // 1 GB

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
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
        setLoaded(true);
        return;
      }

      const { data } = await supabase
        .from("assets")
        .select("*")
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
      if (!user) return;

      const ext = asset.originalName.split(".").pop() || "png";
      const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const contentType =
        asset.file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;
      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(storagePath, asset.file, { contentType });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return;
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
        return;
      }

      const signedUrl = await getSignedUrl(storagePath);

      const newAsset: Asset = {
        id: insertData.id,
        originalName: asset.originalName,
        resultImage: signedUrl,
        provider: asset.provider,
        size: asset.size,
        creditsUsed: asset.creditsUsed,
        timestamp: new Date(insertData.created_at).getTime(),
      };

      setAssets((prev) => [newAsset, ...prev]);
      refreshStorageUsed();
    },
    [supabase, getSignedUrl, refreshStorageUsed]
  );

  const removeAsset = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: row } = await supabase
          .from("assets")
          .select("storage_path")
          .eq("id", id)
          .single();

        if (row) {
          await supabase.storage.from("assets").remove([row.storage_path]);
        }

        await supabase.from("assets").delete().eq("id", id);

        setAssets((prev) => prev.filter((a) => a.id !== id));
        refreshStorageUsed();
      } finally {
        setDeleting(false);
      }
    },
    [supabase, refreshStorageUsed]
  );

  const removeAssets = useCallback(
    async (ids: string[]) => {
      setDeleting(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: rows } = await supabase
          .from("assets")
          .select("storage_path")
          .in("id", ids);

        if (rows && rows.length > 0) {
          const paths = rows.map((r) => r.storage_path);
          await supabase.storage.from("assets").remove(paths);
        }

        await supabase.from("assets").delete().in("id", ids);

        setAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
        refreshStorageUsed();
      } finally {
        setDeleting(false);
      }
    },
    [supabase, refreshStorageUsed]
  );

  return {
    assets,
    loaded,
    deleting,
    storageUsed,
    storageLimit: STORAGE_LIMIT,
    addAsset,
    removeAsset,
    removeAssets,
  };
}
