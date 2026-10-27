import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type ShiftKind = "TD" | "ND";

type PlannerRequest = {
  action?: "list_employees" | "generate";
  year?: number;
  month?: number;
  location?: string;
  selected_employee_ids?: string[];
};

type Employee = { id: string; name: string; username: string | null };
type Preference = {
  user_id: string;
  preferred_locations: string[];
  preferred_shifts: string[];
  avoid_weekdays: number[];
  unavailable_dates: string[];
  max_monthly_hours: number;
  notes: string | null;
};
type Location = {
  id: string;
  name: string;
  code: string;
  day_start: string;
  day_end: string;
  night_start: string;
  night_end: string;
  day_staff: number;
  weekend_day_staff: number;
  night_staff: number;
};
type Assignment = {
  user_id: string;
  date: string;
  ort: string;
  shift_type: ShiftKind;
  shift_time: string;
  hours: number;
  is_night: boolean;
};
type Slot = Omit<Assignment, "user_id"> & { id: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const dayKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
const parseDay = (value: string) => new Date(`${value}T00:00:00.000Z`);
const plusDays = (value: string, offset: number) => {
  const date = parseDay(value);
  date.setUTCDate(date.getUTCDate() + offset);
  return dayKey(date);
};
const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const timeText = (value: string) => value.slice(0, 5);
const isoWeek = (value: string) => {
  const date = parseDay(value);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

function daysOfMonth(year: number, month: number) {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
}

function hasFourConsecutiveDays(assignments: Assignment[], nextDate: string) {
  const dates = new Set(assignments.map((assignment) => assignment.date));
  dates.add(nextDate);
  let chain = 1;
  for (let offset = 1; offset <= 3; offset += 1) {
    if (!dates.has(plusDays(nextDate, -offset))) break;
    chain += 1;
  }
  for (let offset = 1; offset <= 3; offset += 1) {
    if (!dates.has(plusDays(nextDate, offset))) break;
    chain += 1;
  }
  return chain > 3;
}

function buildSlots(days: string[], locations: Location[]): Slot[] {
  const slots: Slot[] = [];
  for (const date of days) {
    for (const location of locations) {
      const isWeekend = [0, 6].includes(parseDay(date).getUTCDay());
      const dayStaff = isWeekend ? location.weekend_day_staff : location.day_staff;
      for (let index = 0; index < location.night_staff; index += 1) {
        slots.push({
          id: `${date}|${location.id}|ND|${index}`,
          date,
          ort: location.name,
          shift_type: "ND",
          shift_time: `${timeText(location.night_start)}-${timeText(location.night_end)}`,
          hours: 12,
          is_night: true,
        });
      }
      for (let index = 0; index < dayStaff; index += 1) {
        slots.push({
          id: `${date}|${location.id}|TD|${index}`,
          date,
          ort: location.name,
          shift_type: "TD",
          shift_time: `${timeText(location.day_start)}-${timeText(location.day_end)}`,
          hours: 12,
          is_night: false,
        });
      }
    }
  }
  return slots;
}

export default {
  fetch: withSupabase(
    // A schedule can only be generated from an authenticated administrator
    // session. Do not accept a bare publishable key here.
    { auth: "user", cors: { headers: corsHeaders } },
    async (request, ctx) => {
      if (request.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
      if (request.method !== "POST") return respond({ success: false, error: "Nur POST ist erlaubt." }, 405);

      try {
        const client = ctx.supabase || ctx.client;
        const admin = ctx.supabaseAdmin || client;
        if (!client || !admin) throw new Error("Supabase client unavailable.");

        const { data: authData, error: authError } = await client.auth.getUser();
        const user = authData?.user;
        if (authError || !user) return respond({ success: false, error: "Nicht angemeldet." }, 401);

        const { data: caller, error: callerError } = await admin
          .from("app_users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (callerError || caller?.role !== "admin") return respond({ success: false, error: "Nur die Verwaltung darf Dienstpläne erstellen." }, 403);

        const payload = await request.json() as PlannerRequest;
        const action = payload.action || "generate";

        const [{ data: employeeRows, error: employeesError }, { data: preferenceRows, error: preferencesError }] = await Promise.all([
          admin.from("app_users").select("id, name, username").eq("role", "employee").order("name"),
          admin.from("employee_preferences").select("user_id, preferred_locations, preferred_shifts, avoid_weekdays, unavailable_dates, max_monthly_hours, notes"),
        ]);
        if (employeesError || preferencesError) throw employeesError || preferencesError;

        const employees = (employeeRows || []) as Employee[];
        const preferenceByUser = new Map<string, Preference>();
        for (const row of preferenceRows || []) {
          preferenceByUser.set(row.user_id, {
            user_id: row.user_id,
            preferred_locations: asArray<string>(row.preferred_locations),
            preferred_shifts: asArray<string>(row.preferred_shifts),
            avoid_weekdays: asArray<number>(row.avoid_weekdays).map(Number),
            unavailable_dates: asArray<string>(row.unavailable_dates),
            max_monthly_hours: Math.min(204, Math.max(12, Number(row.max_monthly_hours) || 204)),
            notes: row.notes,
          });
        }

        if (action === "list_employees") {
          return respond({
            success: true,
            employees: employees.map((employee) => ({
              ...employee,
              preferences: preferenceByUser.get(employee.id) || null,
            })),
          });
        }

        const year = Number(payload.year);
        const month = Number(payload.month);
        if (!Number.isInteger(year) || year < 2025 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
          return respond({ success: false, error: "Bitte einen gültigen Monat wählen." }, 400);
        }

        const selectedIds = [...new Set(asArray<string>(payload.selected_employee_ids).filter(Boolean))];
        const pool = selectedIds.length ? employees.filter((employee) => selectedIds.includes(employee.id)) : employees;
        if (!pool.length) return respond({ success: false, error: "Bitte mindestens einen Mitarbeiter auswählen." }, 400);

        let locationQuery = admin.from("work_locations").select("*").eq("active", true).order("name");
        if (payload.location && payload.location !== "all") locationQuery = locationQuery.ilike("name", payload.location);
        const { data: locationRows, error: locationsError } = await locationQuery;
        if (locationsError) throw locationsError;
        const locations = (locationRows || []) as Location[];
        if (!locations.length) return respond({ success: false, error: "Für diesen Ort ist keine aktive Konfiguration vorhanden." }, 400);

        const dateList = daysOfMonth(year, month);
        const startDate = dateList[0];
        const endDate = dateList.at(-1)!;
        const locationNames = locations.map((location) => location.name);

        // Existing shifts at other locations are hard constraints during a single-location run.
        let existing: Assignment[] = [];
        if (payload.location && payload.location !== "all") {
          const { data: scheduleRows, error: schedulesError } = await admin
            .from("schedules")
            .select("user_id, date, ort, shift_type, shift_time, hours, is_night")
            .gte("date", startDate)
            .lte("date", endDate);
          if (schedulesError) throw schedulesError;
          existing = ((scheduleRows || []) as Assignment[]).filter((assignment) => !locationNames.includes(assignment.ort));
        }

        const { data: absenceRows, error: absenceError } = await admin
          .from("employee_requests")
          .select("user_id, start_date, end_date, status, request_type")
          .eq("status", "approved")
          .lte("start_date", endDate)
          .gte("end_date", startDate);
        if (absenceError) throw absenceError;

        const unavailable = new Map<string, Set<string>>();
        for (const employee of pool) unavailable.set(employee.id, new Set(preferenceByUser.get(employee.id)?.unavailable_dates || []));
        for (const absence of absenceRows || []) {
          if (!unavailable.has(absence.user_id)) continue;
          for (let date = absence.start_date; date <= absence.end_date; date = plusDays(date, 1)) unavailable.get(absence.user_id)!.add(date);
        }

        const assignmentsByEmployee = new Map<string, Assignment[]>();
        const hoursByEmployee = new Map<string, number>();
        const weeklyByEmployee = new Map<string, number>();
        for (const employee of pool) {
          const rows = existing.filter((assignment) => assignment.user_id === employee.id);
          assignmentsByEmployee.set(employee.id, [...rows]);
          hoursByEmployee.set(employee.id, rows.reduce((total, assignment) => total + Number(assignment.hours || 0), 0));
          for (const assignment of rows) {
            const key = `${employee.id}|${isoWeek(assignment.date)}`;
            weeklyByEmployee.set(key, (weeklyByEmployee.get(key) || 0) + 1);
          }
        }

        const slots = buildSlots(dateList, locations);
        const generated: Assignment[] = [];
        const unassigned: Slot[] = [];

        for (const slot of slots) {
          const weekday = parseDay(slot.date).getUTCDay();
          const candidates = pool.flatMap((employee) => {
            const assignments = assignmentsByEmployee.get(employee.id) || [];
            const preference = preferenceByUser.get(employee.id);
            const maxHours = preference?.max_monthly_hours || 204;
            const currentHours = hoursByEmployee.get(employee.id) || 0;
            const currentWeek = weeklyByEmployee.get(`${employee.id}|${isoWeek(slot.date)}`) || 0;
            const hadNightRecently = slot.shift_type === "TD" && assignments.some((assignment) =>
              assignment.shift_type === "ND" && (assignment.date === plusDays(slot.date, -1) || assignment.date === plusDays(slot.date, -2))
            );

            if (unavailable.get(employee.id)?.has(slot.date)) return [];
            if (assignments.some((assignment) => assignment.date === slot.date)) return [];
            if (currentHours + slot.hours > maxHours) return [];
            if (currentWeek >= 4) return [];
            if (hadNightRecently) return [];
            let score = 0;
            const preferredLocations = (preference?.preferred_locations || []).map(normalize);
            const preferredShifts = (preference?.preferred_shifts || []).map(normalize);
            if (preferredLocations.includes(normalize(slot.ort))) score += 80;
            if (preferredShifts.includes(normalize(slot.shift_type))) score += 36;
            if ((preference?.avoid_weekdays || []).includes(weekday)) score -= 52;
            score -= (currentHours / maxHours) * 90;
            score -= currentWeek * 18;
            score -= assignments.length * 2;
            score += Math.random() * 4;
            return [{ employee, score }];
          }).sort((a, b) => b.score - a.score);

          const candidate = candidates[0];
          if (!candidate) {
            unassigned.push(slot);
            continue;
          }

          const { id: _slotId, ...assignmentFields } = slot;
          const assignment: Assignment = { ...assignmentFields, user_id: candidate.employee.id };
          generated.push(assignment);
          assignmentsByEmployee.get(candidate.employee.id)!.push(assignment);
          hoursByEmployee.set(candidate.employee.id, (hoursByEmployee.get(candidate.employee.id) || 0) + slot.hours);
          const weekKey = `${candidate.employee.id}|${isoWeek(slot.date)}`;
          weeklyByEmployee.set(weekKey, (weeklyByEmployee.get(weekKey) || 0) + 1);
        }

        if (unassigned.length) {
          return respond({
            success: false,
            error: "Der Plan konnte mit den harten Regeln nicht vollständig besetzt werden. Passe das Team oder die Präferenzen an.",
            coverage: { required: slots.length, assigned: generated.length, unassigned: unassigned.length },
            unassigned: unassigned.slice(0, 30).map((slot) => ({ date: slot.date, ort: slot.ort, shift_type: slot.shift_type })),
          }, 422);
        }

        let deleteQuery = admin.from("schedules").delete().gte("date", startDate).lte("date", endDate);
        if (payload.location && payload.location !== "all") deleteQuery = deleteQuery.in("ort", locationNames);
        const { error: deleteError } = await deleteQuery;
        if (deleteError) throw deleteError;

        const { error: insertError } = await admin.from("schedules").insert(generated.map((assignment) => ({ ...assignment, vacation: false, is_published: true })));
        if (insertError) throw insertError;

        const summary = pool.map((employee) => ({
          id: employee.id,
          name: employee.name,
          hours: hoursByEmployee.get(employee.id) || 0,
          shifts: (assignmentsByEmployee.get(employee.id) || []).filter((assignment) => generated.includes(assignment)).length,
        }));

        return respond({
          success: true,
          message: `Dienstplan für ${month}/${year} erstellt.`,
          coverage: { required: slots.length, assigned: generated.length, unassigned: 0 },
          employees: summary,
        });
      } catch (error) {
        console.error("schedule-planner failed", error);
        return respond({ success: false, error: "Der Dienstplan konnte nicht erstellt werden." }, 500);
      }
    },
  ),
};
