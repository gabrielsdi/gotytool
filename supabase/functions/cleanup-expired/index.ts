import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate cutoff date (5 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 5);
    const cutoffISO = cutoffDate.toISOString();

    // 1. Find expired assets
    const { data: expiredAssets, error: queryError } = await supabase
      .from("assets")
      .select("id, storage_path, user_id")
      .lt("created_at", cutoffISO);

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    if (!expiredAssets || expiredAssets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired assets found", deleted: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 2. Delete files from Storage
    const pathsToDelete = expiredAssets.map((a) => a.storage_path);
    const { error: storageError } = await supabase.storage
      .from("assets")
      .remove(pathsToDelete);

    if (storageError) {
      console.error("Storage deletion error:", storageError);
    }

    // 3. Delete rows from database
    const idsToDelete = expiredAssets.map((a) => a.id);
    const { error: deleteError } = await supabase
      .from("assets")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      throw new Error(`Delete error: ${deleteError.message}`);
    }

    // 4. Update storage_used for affected users
    const affectedUserIds = [
      ...new Set(expiredAssets.map((a) => a.user_id)),
    ];

    for (const userId of affectedUserIds) {
      // Calculate remaining storage for this user
      const { data: remainingFiles } = await supabase.storage
        .from("assets")
        .list(userId);

      const newStorageUsed =
        remainingFiles?.reduce(
          (sum, f) => sum + (f.metadata?.size || 0),
          0
        ) || 0;

      await supabase
        .from("user_profiles")
        .update({ storage_used: newStorageUsed })
        .eq("id", userId);
    }

    return new Response(
      JSON.stringify({
        message: "Cleanup completed",
        deleted: expiredAssets.length,
        affectedUsers: affectedUserIds.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
