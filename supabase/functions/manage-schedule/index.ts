import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type ScheduleRequest = {
  action: "create" | "update" | "delete" | "delete_month";
  id?: string;
  user_id?: string;
  date?: string;
  ort?: string;
  month?: string;
  shift_type?: "TD" | "ND";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const parseDay = (value: string) => new Date(`${value}T00:00:00.000Z`);
const toDayKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
const plusDays = (value: string, offset: number) => { const date = parseDay(value); date.setUTCDate(date.getUTCDate() + offset); return toDayKey(date); };
const weekKey = (value: string) => {
  const date = parseDay(value); const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - start.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
};

export default {
  fetch: withSupabase({ auth: "user", cors: { headers: corsHeaders } }, async (request, ctx) => {
    if (request.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
    if (request.method !== "POST") return respond({ success: false, error: "Nur POST ist erlaubt." }, 405);
    try {
      const admin = ctx.supabaseAdmin;
      const callerId = ctx.userClaims?.id;
      if (!admin || !callerId) return respond({ success: false, error: "Nicht angemeldet." }, 401);
      const { data: caller } = await admin.from("app_users").select("role").eq("id", callerId).maybeSingle();
      if (caller?.role !== "admin") return respond({ success: false, error: "Nur Admins dürfen Dienste bearbeiten." }, 403);

      const payload = await request.json() as ScheduleRequest;
      if (payload.action === "delete") {
        if (!payload.id) return respond({ success: false, error: "Dienst-ID fehlt." }, 400);
        const { error } = await admin.from("schedules").delete().eq("id", payload.id);
        if (error) throw error;
        return respond({ success: true, message: "Dienst gelöscht." });
      }

      if (payload.action === "delete_month") {
        if (!payload.month || !/^\d{4}-\d{2}$/.test(payload.month)) return respond({ success: false, error: "Ungültiger Monat." }, 400);
        const [year, month] = payload.month.split("-").map(Number);
        if (month < 1 || month > 12) return respond({ success: false, error: "Ungültiger Monat." }, 400);
        const startDate = `${payload.month}-01`;
        const endDate = `${payload.month}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;

        let deletion = admin
          .from("schedules")
          .delete()
          .gte("date", startDate)
          .lte("date", endDate)
          .eq("vacation", false);
        if (payload.user_id) deletion = deletion.eq("user_id", payload.user_id);
        if (payload.ort) deletion = deletion.eq("ort", payload.ort);

        const { data: deletedRows, error } = await deletion.select("id");
        if (error) throw error;
        const scope = payload.user_id ? "für den ausgewählten Mitarbeiter" : "für alle Mitarbeiter";
        return respond({ success: true, message: `${deletedRows?.length || 0} Dienste ${scope} gelöscht. Urlaub und Krankenstände bleiben erhalten.`, deletedCount: deletedRows?.length || 0 });
      }

      const isUpdate = payload.action === "update";
      if (isUpdate && !payload.id) return respond({ success: false, error: "Dienst-ID fehlt." }, 400);

      if (!payload.user_id || !payload.date || !payload.ort || !["TD", "ND"].includes(payload.shift_type || "")) {
        return respond({ success: false, error: "Bitte Mitarbeiter, Datum, Ort und Diensttyp wählen." }, 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return respond({ success: false, error: "Ungültiges Datum." }, 400);

      const [{ data: employee }, { data: location }] = await Promise.all([
        admin.from("app_users").select("id, role").eq("id", payload.user_id).maybeSingle(),
        admin.from("work_locations").select("name, day_start, day_end, night_start, night_end").eq("name", payload.ort).eq("active", true).maybeSingle(),
      ]);
      if (employee?.role !== "employee") return respond({ success: false, error: "Mitarbeiter nicht gefunden." }, 400);
      if (!location) return respond({ success: false, error: "Ort ist nicht aktiv." }, 400);

      const monthStart = `${payload.date.slice(0, 7)}-01`;
      const monthEnd = `${payload.date.slice(0, 7)}-${String(new Date(Date.UTC(Number(payload.date.slice(0, 4)), Number(payload.date.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
      const checkStart = plusDays(payload.date, -2);
      const [{ data: monthSchedules, error: schedulesError }, { data: absenceRows, error: absenceError }, { data: preference }] = await Promise.all([
        admin.from("schedules").select("id, date, hours, shift_type").eq("user_id", payload.user_id).gte("date", checkStart).lte("date", monthEnd),
        admin.from("employee_requests").select("start_date, end_date").eq("user_id", payload.user_id).eq("status", "approved").lte("start_date", payload.date).gte("end_date", payload.date),
        admin.from("employee_preferences").select("max_monthly_hours, unavailable_dates").eq("user_id", payload.user_id).maybeSingle(),
      ]);
      if (schedulesError || absenceError) throw schedulesError || absenceError;
      const scheduleRows = (monthSchedules || []).filter((row) => row.id !== payload.id);
      if (scheduleRows.some((row) => row.date === payload.date)) return respond({ success: false, error: "Dieser Mitarbeiter hat an diesem Tag bereits einen Dienst." }, 422);
      if ((absenceRows || []).length) return respond({ success: false, error: "Der Mitarbeiter ist an diesem Tag genehmigt abwesend." }, 422);
      if ((preference?.unavailable_dates || []).includes(payload.date)) return respond({ success: false, error: "Der Mitarbeiter ist an diesem Tag als nicht verfügbar hinterlegt." }, 422);

      const currentHours = scheduleRows.filter((row) => row.date >= monthStart).reduce((total, row) => total + Number(row.hours || 0), 0);
      const maxHours = Math.min(204, Math.max(12, Number(preference?.max_monthly_hours) || 204));
      if (currentHours + 12 > maxHours) return respond({ success: false, error: `Das Monatslimit von ${maxHours} Stunden würde überschritten.` }, 422);
      if (scheduleRows.filter((row) => weekKey(row.date) === weekKey(payload.date)).length >= 4) return respond({ success: false, error: "Das Limit von vier Diensten in dieser Kalenderwoche ist erreicht." }, 422);
      if (payload.shift_type === "TD" && scheduleRows.some((row) => row.shift_type === "ND" && (row.date === plusDays(payload.date, -1) || row.date === plusDays(payload.date, -2)))) return respond({ success: false, error: "Nach einem Nachtdienst müssen vor dem nächsten Tagdienst zwei Kalendertage frei bleiben." }, 422);

      const isNight = payload.shift_type === "ND";
      const shiftTime = isNight ? `${location.night_start.slice(0, 5)}-${location.night_end.slice(0, 5)}` : `${location.day_start.slice(0, 5)}-${location.day_end.slice(0, 5)}`;
      const values = { user_id: payload.user_id, date: payload.date, ort: location.name, shift_type: payload.shift_type, shift_time: shiftTime, hours: 12, is_night: isNight, vacation: false, is_published: true };
      const query = isUpdate
        ? admin.from("schedules").update(values).eq("id", payload.id).select("id, user_id, date, ort, shift_type, shift_time, hours, is_night").single()
        : admin.from("schedules").insert(values).select("id, user_id, date, ort, shift_type, shift_time, hours, is_night").single();
      const { data: saved, error: saveError } = await query;
      if (saveError) throw saveError;
      return respond({ success: true, message: isUpdate ? "Dienst aktualisiert." : "Dienst gespeichert.", schedule: saved });
    } catch (error) {
      console.error("manage-schedule failed", error);
      return respond({ success: false, error: "Der Dienst konnte nicht bearbeitet werden." }, 500);
    }
  }),
};
