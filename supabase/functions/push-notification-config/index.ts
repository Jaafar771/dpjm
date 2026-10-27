import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export default {
  fetch: (request: Request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!publicKey) return Response.json({ error: "Push ist noch nicht eingerichtet." }, { status: 503, headers: corsHeaders });
    return Response.json({ publicKey }, { headers: corsHeaders });
  },
};
