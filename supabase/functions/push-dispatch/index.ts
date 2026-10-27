import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webPush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NotificationRecord = { id?: string; user_id?: string; title?: string; message?: string; link?: string | null; kind?: string };
type WebhookPayload = { type?: string; record?: NotificationRecord };
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default {
  fetch: async (request: Request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return Response.json({ error: "Nur POST ist erlaubt." }, { status: 405, headers: corsHeaders });
    try {
      const payload = await request.json() as WebhookPayload;
      const notificationId = payload.record?.id;
      // Only a database-generated, freshly stored notification can be sent.
      // A random public request therefore cannot choose a recipient or content.
      if (!isUuid(notificationId)) return Response.json({ ignored: true }, { headers: corsHeaders });
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!serviceRoleKey || !supabaseUrl) throw new Error("Supabase service configuration is unavailable.");
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: notification, error: notificationError } = await admin
        .from("notifications")
        .select("id, user_id, title, message, link, kind, created_at")
        .eq("id", notificationId)
        .maybeSingle();
      if (notificationError) throw notificationError;
      if (!notification || Date.now() - new Date(notification.created_at).getTime() > 10 * 60 * 1000) return Response.json({ ignored: true }, { headers: corsHeaders });
      const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      const subject = Deno.env.get("VAPID_SUBJECT") || "https://dpjm.vercel.app";
      if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured.");
      const { data: subscriptions, error } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", notification.user_id);
      if (error) throw error;
      const message = JSON.stringify({ id: notification.id, title: notification.title, message: notification.message, link: notification.link || "/", kind: notification.kind || "info" });
      const results = await Promise.allSettled((subscriptions || []).map((subscription) => webPush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, message, {
        vapidDetails: { subject, publicKey, privateKey },
        TTL: 60 * 60 * 24,
        urgency: "high",
        topic: String(notification.id || "dienstplan").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32),
      })));
      const expired = results.flatMap((result, index) => result.status === "rejected" && [404, 410].includes(Number((result.reason as { statusCode?: number })?.statusCode)) ? [(subscriptions || [])[index].id] : []);
      if (expired.length) await admin.from("push_subscriptions").delete().in("id", expired);
      return Response.json({ success: true, sent: results.filter((result) => result.status === "fulfilled").length }, { headers: corsHeaders });
    } catch (error) {
      console.error("push-dispatch failed", error);
      return Response.json({ error: "Push-Zustellung fehlgeschlagen." }, { status: 500, headers: corsHeaders });
    }
  },
};
