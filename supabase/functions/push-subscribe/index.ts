import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export default {
  fetch: withSupabase({ auth: "user", cors: { headers: corsHeaders } }, async (request, ctx) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Nur POST ist erlaubt." }, 405);
    const client = ctx.supabase || ctx.client;
    const admin = ctx.supabaseAdmin || client;
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) return json({ error: "Nicht angemeldet." }, 401);
    try {
      const { subscription } = await request.json();
      const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint : "";
      const p256dh = typeof subscription?.keys?.p256dh === "string" ? subscription.keys.p256dh : "";
      const auth = typeof subscription?.keys?.auth === "string" ? subscription.keys.auth : "";
      if (!endpoint.startsWith("https://") || !p256dh || !auth) return json({ error: "Ungültige Push-Anmeldung." }, 400);
      const { error } = await admin.from("push_subscriptions").upsert({
        user_id: authData.user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return json({ success: true });
    } catch (error) {
      console.error("push-subscribe failed", error);
      return json({ error: "Push-Anmeldung konnte nicht gespeichert werden." }, 500);
    }
  }),
};
