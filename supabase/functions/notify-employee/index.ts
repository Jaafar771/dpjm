import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default {
  fetch: withSupabase(
    // Only a server/admin workflow may invoke this function. Regular employee
    // browser sessions create no arbitrary notifications.
    { auth: ["secret"], cors: { headers: corsHeaders } },
    async (req, ctx) => {
      if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
      if (req.method !== "POST") return json({ error: "Only POST requests are allowed." }, 405);

      try {
        const { userId, title, message, kind = "info", link = null } = await req.json();
        if (!isUuid(userId) || typeof title !== "string" || !title.trim() || typeof message !== "string" || !message.trim()) {
          return json({ error: "Invalid notification payload." }, 400);
        }

        const admin = ctx.supabaseAdmin || ctx.supabase || ctx.client;
        if (!admin) throw new Error("Supabase admin client is unavailable.");

        const { error } = await admin.from("notifications").insert({
          user_id: userId,
          kind: String(kind).slice(0, 50),
          title: title.trim().slice(0, 140),
          message: message.trim().slice(0, 500),
          link: typeof link === "string" && link.startsWith("/") ? link : null,
        });
        if (error) throw error;

        return json({ success: true });
      } catch (error) {
        console.error("Employee notification failed:", error);
        return json({ error: "Notification could not be created." }, 500);
      }
    },
  ),
};
