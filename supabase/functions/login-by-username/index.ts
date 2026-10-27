import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"], cors: { headers: corsHeaders } },
    async (req, ctx) => {
      if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
      if (req.method !== "POST") return response({ error: "Only POST requests are allowed." }, 405);

      try {
        const { username, password } = await req.json();
        const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : "";

        if (!/^[a-z0-9._-]{3,64}$/.test(normalizedUsername) || typeof password !== "string" || !password) {
          return response({ error: "Invalid credentials." }, 401);
        }

        const admin = ctx.supabaseAdmin || ctx.supabase || ctx.client;
        if (!admin) throw new Error("Supabase client is unavailable.");

        const { data: employee, error: employeeError } = await admin
          .from("app_users")
          .select("id")
          .ilike("username", normalizedUsername)
          .maybeSingle();

        if (employeeError || !employee?.id) return response({ error: "Invalid credentials." }, 401);

        const { data: userData, error: userError } = await admin.auth.admin.getUserById(employee.id);
        const email = userData?.user?.email;
        if (userError || !email) return response({ error: "Invalid credentials." }, 401);

        const authClient = ctx.supabase || ctx.client || admin;
        const { data, error } = await authClient.auth.signInWithPassword({ email, password });
        if (error || !data.session) return response({ error: "Invalid credentials." }, 401);

        return response({ session: data.session });
      } catch (error) {
        console.error("Username login failed:", error);
        return response({ error: "Login could not be completed." }, 500);
      }
    },
  ),
};
