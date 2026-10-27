import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

interface ReqPayload {
  action?: string;
  month?: number;
  year?: number;
  user_id?: string;
  target_location?: string;
  // The exact people selected by the administrator for this location.
  // When supplied, no other employee is allowed into the generated plan.
  selected_employee_ids?: string[];
}

interface Employee {
  id: string;
  name: string;
}

interface Preference {
  user_id: string;
  max_monthly_hours?: number;
  preferred_locations?: string[] | string | null;
  preferred_shifts?: string[] | string | null;
  blocked_days?: string[] | string | null;
  disliked_days?: string[] | string | null;
  notes?: string | null;
}

interface ShiftSlot {
  ort: string;
  shift_type: "TD" | "ND";
  hours: number;
  shift_time: string;
  is_night: boolean;
  date: string;
}

interface Assignment {
  user_id: string;
  date: string;
  ort: string;
  shift_time: string;
  shift_type: "TD" | "ND";
  hours: number;
  is_night: boolean;
  vacation: boolean;
}

console.info("generate-schedule server started");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export default {
  fetch: withSupabase(
    {
      auth: ["publishable", "secret"],
      cors: {
        headers: corsHeaders,
      },
    },
    async (req, ctx) => {
      try {
        // ------------------------------------------------------------
        // CORS
        // ------------------------------------------------------------
        if (req.method === "OPTIONS") {
          return new Response("ok", {
            status: 200,
            headers: corsHeaders,
          });
        }

        if (req.method !== "POST") {
          return jsonResponse(
            {
              success: false,
              error: "Only POST requests are allowed.",
            },
            405,
          );
        }

        // ------------------------------------------------------------
        // REQUEST
        // ------------------------------------------------------------
        const payload: ReqPayload = await req.json();

        const supabaseAdmin =
          ctx.supabaseAdmin || ctx.supabase || ctx.client;

        if (!supabaseAdmin) {
          throw new Error(
            "Supabase client is not available in execution context.",
          );
        }

        const month = Number(payload.month);
        const year = Number(payload.year);
        const user_id = payload.user_id;
        const target_location = payload.target_location;
        const selectedEmployeeIds = Array.isArray(
          payload.selected_employee_ids,
        )
          ? [...new Set(
            payload.selected_employee_ids
              .filter((id): id is string =>
                typeof id === "string" && id.trim().length > 0
              )
              .map((id) => id.trim()),
          )]
          : [];

        // list_employees is used before generation by the admin screen.
        // The current month/year are optional for that read-only action.
        if (payload.action !== "list_employees" && (!month || !year)) {
          return jsonResponse(
            {
              success: false,
              error: "Month and year are required.",
            },
            400,
          );
        }

        if (
          payload.action !== "list_employees" &&
          (month < 1 || month > 12)
        ) {
          return jsonResponse(
            {
              success: false,
              error: "Month must be between 1 and 12.",
            },
            400,
          );
        }

        // ------------------------------------------------------------
        // DATE HELPERS
        // ------------------------------------------------------------
        const totalDays = new Date(year, month, 0).getDate();

        const mStr = month < 10
          ? `0${month}`
          : `${month}`;

        const startDate = `${year}-${mStr}-01`;

        const endDate =
          `${year}-${mStr}-${String(totalDays).padStart(2, "0")}`;

        const dayNames = [
          "Sonntag",
          "Montag",
          "Dienstag",
          "Mittwoch",
          "Donnerstag",
          "Freitag",
          "Samstag",
        ];

        function dateKey(day: number): string {
          return `${year}-${mStr}-${String(day).padStart(2, "0")}`;
        }

        function parseDate(date: string): Date {
          const [y, m, d] = date.split("-").map(Number);

          return new Date(
            Date.UTC(
              y,
              m - 1,
              d,
              0,
              0,
              0,
              0,
            ),
          );
        }

        function getDayName(date: string): string {
          return dayNames[parseDate(date).getUTCDay()];
        }

        // ISO calendar week
        function getWeekKey(dateString: string): string {
          const date = parseDate(dateString);

          const day = date.getUTCDay() || 7;

          date.setUTCDate(
            date.getUTCDate() + 4 - day,
          );

          const yearStart = new Date(
            Date.UTC(
              date.getUTCFullYear(),
              0,
              1,
            ),
          );

          const weekNo = Math.ceil(
            (
              (
                (date.getTime() - yearStart.getTime()) /
                86400000
              ) + 1
            ) / 7,
          );

          return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
        }

        // ------------------------------------------------------------
        // ARRAY / PREFERENCE HELPERS
        // ------------------------------------------------------------
        function parseArrayField(field: unknown): string[] {
          if (!field) return [];

          let parsed: unknown = field;

          for (let i = 0; i < 3; i++) {
            if (typeof parsed !== "string") break;

            try {
              parsed = JSON.parse(parsed);
            } catch {
              break;
            }
          }

          if (Array.isArray(parsed)) {
            return parsed
              .flat(Infinity)
              .map((item) =>
                String(item)
                  .replace(/["']/g, "")
                  .trim()
              )
              .filter(Boolean);
          }

          if (typeof parsed === "string") {
            return parsed
              .split(",")
              .map((item) =>
                item
                  .replace(/["'[\]]/g, "")
                  .trim()
              )
              .filter(Boolean);
          }

          return [];
        }

        function normalizeText(value: unknown): string {
          return String(value || "")
            .toLowerCase()
            .trim();
        }

        // ------------------------------------------------------------
        // LOAD EMPLOYEES
        // ------------------------------------------------------------
        let employeeQuery = supabaseAdmin
          .from("app_users")
          .select("id, name")
          .eq("role", "employee");

        // If a single employee was requested
        if (user_id && user_id !== "all") {
          employeeQuery = employeeQuery.eq("id", user_id);
        }

        // A manually selected team is an exclusive planning pool. This is
        // deliberately applied at database level, before the solver starts.
        if (selectedEmployeeIds.length > 0) {
          employeeQuery = employeeQuery.in(
            "id",
            selectedEmployeeIds,
          );
        }

        const {
          data: employees,
          error: employeeError,
        } = await employeeQuery;

        if (employeeError) {
          throw employeeError;
        }

        if (!employees || employees.length === 0) {
          return jsonResponse(
            {
              success: false,
              error: "No employees found.",
            },
            400,
          );
        }

        console.info(
          `Loaded ${employees.length} employees.`,
        );

        // ------------------------------------------------------------
        // LOAD PREFERENCES
        // ------------------------------------------------------------
        const {
          data: preferences,
          error: preferenceError,
        } = await supabaseAdmin
          .from("employee_preferences")
          .select("*");

        if (preferenceError) {
          throw preferenceError;
        }

        const preferenceMap: Record<string, Preference> = {};

        for (const pref of (preferences || [])) {
          preferenceMap[pref.user_id] = {
            ...pref,

            preferred_locations:
              parseArrayField(pref.preferred_locations),

            preferred_shifts:
              parseArrayField(pref.preferred_shifts),

            blocked_days:
              parseArrayField(pref.blocked_days),

            disliked_days:
              parseArrayField(pref.disliked_days),
          };
        }

        // The admin page first loads this compact list so that the person
        // creating the plan can choose a separate team for every location.
        if (payload.action === "list_employees") {
          return jsonResponse({
            success: true,
            employees: employees.map((employee) => ({
              id: employee.id,
              name: employee.name,
              preferred_locations: (
                preferenceMap[employee.id]
                  ?.preferred_locations || []
              ).map((location) => normalizeText(location)),
            })),
          });
        }

        // ------------------------------------------------------------
        // TRACKERS
        // ------------------------------------------------------------
        const monthlyHours: Record<string, number> = {};
        const weeklyShifts: Record<string, number> = {};
        const assignmentsByEmployee: Record<string, Assignment[]> = {};

        for (const employee of employees) {
          monthlyHours[employee.id] = 0;
          assignmentsByEmployee[employee.id] = [];
        }

        // ------------------------------------------------------------
        // SHIFT INTERVAL
        // ------------------------------------------------------------
        function getShiftInterval(
          date: string,
          shiftTime: string,
        ) {
          const parts = shiftTime
            .split("-")
            .map((value) => value.trim());

          if (parts.length !== 2) {
            throw new Error(
              `Invalid shift_time: ${shiftTime}`,
            );
          }

          const [startHour, startMinute] =
            parts[0].split(":").map(Number);

          const [endHour, endMinute] =
            parts[1].split(":").map(Number);

          const start = parseDate(date);
          start.setUTCHours(
            startHour,
            startMinute,
            0,
            0,
          );

          const end = parseDate(date);
          end.setUTCHours(
            endHour,
            endMinute,
            0,
            0,
          );

          // Night shift:
          // 19:00-07:00 => next day
          if (end <= start) {
            end.setUTCDate(
              end.getUTCDate() + 1,
            );
          }

          return {
            start,
            end,
          };
        }

        // ------------------------------------------------------------
        // OVERLAP
        // ------------------------------------------------------------
        function hasOverlap(
          employeeId: string,
          newDate: string,
          newShiftTime: string,
        ): boolean {
          const newInterval = getShiftInterval(
            newDate,
            newShiftTime,
          );

          const existing =
            assignmentsByEmployee[employeeId] || [];

          for (const assignment of existing) {
            const existingInterval =
              getShiftInterval(
                assignment.date,
                assignment.shift_time,
              );

            if (
              newInterval.start < existingInterval.end &&
              newInterval.end > existingInterval.start
            ) {
              return true;
            }
          }

          return false;
        }

        // ------------------------------------------------------------
        // REST TIME
        // ------------------------------------------------------------
        function violatesRestTime(
          employeeId: string,
          newDate: string,
          newShiftTime: string,
        ): boolean {
          const newInterval = getShiftInterval(
            newDate,
            newShiftTime,
          );

          const existing =
            assignmentsByEmployee[employeeId] || [];

          for (const assignment of existing) {
            const existingInterval =
              getShiftInterval(
                assignment.date,
                assignment.shift_time,
              );

            // Real overlap
            const overlaps =
              newInterval.start < existingInterval.end &&
              newInterval.end > existingInterval.start;

            if (overlaps) {
              return true;
            }

            // Calculate the actual chronological gap.
            let restHours = Infinity;

            if (
              existingInterval.end <=
              newInterval.start
            ) {
              restHours =
                (
                  newInterval.start.getTime() -
                  existingInterval.end.getTime()
                ) / 3600000;
            } else if (
              newInterval.end <=
              existingInterval.start
            ) {
              restHours =
                (
                  existingInterval.start.getTime() -
                  newInterval.end.getTime()
                ) / 3600000;
            }

            // Minimum 11 hours rest
            if (restHours < 11) {
              return true;
            }
          }

          return false;
        }
        // ------------------------------------------------------------
        // SAME DAY
        // ------------------------------------------------------------
        function alreadyWorkingSameDay(
          employeeId: string,
          date: string,
        ): boolean {
          return (
            assignmentsByEmployee[employeeId] || []
          ).some(
            (assignment) =>
              assignment.date === date,
          );
        }

        // ------------------------------------------------------------
        // MAX 3 CONSECUTIVE DAYS
        // ------------------------------------------------------------
        function getConsecutiveDaysBefore(
          employeeId: string,
          date: string,
        ): number {
          let count = 0;

          const current = parseDate(date);

          for (let i = 1; i <= 10; i++) {
            const check = new Date(current);

            check.setUTCDate(
              check.getUTCDate() - i,
            );

            const checkDate =
              `${check.getUTCFullYear()}-${String(
                check.getUTCMonth() + 1,
              ).padStart(2, "0")}-${String(
                check.getUTCDate(),
              ).padStart(2, "0")}`;

            const worked =
              (
                assignmentsByEmployee[employeeId] ||
                []
              ).some(
                (assignment) =>
                  assignment.date === checkDate,
              );

            if (!worked) {
              break;
            }

            count++;
          }

          return count;
        }

        // ------------------------------------------------------------
        // MAX 3 CONSECUTIVE DAYS - BIDIRECTIONAL CHECK
        // ------------------------------------------------------------
        function wouldExceedThreeConsecutiveDays(
          employeeId: string,
          newDate: string,
        ): boolean {
          const assignments =
            assignmentsByEmployee[employeeId] || [];

          const workedDates = new Set(
            assignments.map((assignment) => assignment.date),
          );

          workedDates.add(newDate);

          const current = parseDate(newDate);

          // Count consecutive days containing the proposed date:
          // previous side + proposed day + next side.
          let consecutive = 1;

          for (let i = 1; i <= 3; i++) {
            const check = new Date(current);
            check.setUTCDate(check.getUTCDate() - i);

            const checkDate =
              `${check.getUTCFullYear()}-${String(check.getUTCMonth() + 1).padStart(2, "0")}-${String(check.getUTCDate()).padStart(2, "0")}`;

            if (!workedDates.has(checkDate)) break;
            consecutive++;
          }

          for (let i = 1; i <= 3; i++) {
            const check = new Date(current);
            check.setUTCDate(check.getUTCDate() + i);

            const checkDate =
              `${check.getUTCFullYear()}-${String(check.getUTCMonth() + 1).padStart(2, "0")}-${String(check.getUTCDate()).padStart(2, "0")}`;

            if (!workedDates.has(checkDate)) break;
            consecutive++;
          }

          return consecutive > 3;
        }

        // ------------------------------------------------------------
        // NIGHT -> DAY
        // ------------------------------------------------------------
        function hasRecentNightShift(
          employeeId: string,
          date: string,
        ): boolean {
          const current = parseDate(date);

          for (let i = 1; i <= 2; i++) {
            const check = new Date(current);

            check.setUTCDate(
              check.getUTCDate() - i,
            );

            const checkDate =
              `${check.getUTCFullYear()}-${String(
                check.getUTCMonth() + 1,
              ).padStart(2, "0")}-${String(
                check.getUTCDate(),
              ).padStart(2, "0")}`;

            const hadNight =
              (
                assignmentsByEmployee[employeeId] ||
                []
              ).some(
                (assignment) =>
                  assignment.date === checkDate &&
                  assignment.shift_type === "ND",
              );

            if (hadNight) {
              return true;
            }
          }

          return false;
        }

        // ------------------------------------------------------------
        // MONTHLY LIMIT
        // ------------------------------------------------------------
        function getMaxMonthlyHours(
          employeeId: string,
        ): number {
          const pref =
            preferenceMap[employeeId];

          const configured =
            Number(
              pref?.max_monthly_hours,
            );

          if (
            Number.isFinite(configured) &&
            configured > 0
          ) {
            // Do NOT force 192 anymore.
            return configured;
          }

          return 192;
        }

        // ------------------------------------------------------------
        // CREATE DAILY SLOTS
        // ------------------------------------------------------------
        function createDailySlots(
          date: string,
        ): ShiftSlot[] {
          const slots: ShiftSlot[] = [];

          function add(
            ort: string,
            shift_type: "TD" | "ND",
            hours: number,
            shift_time: string,
            is_night: boolean,
          ) {
            slots.push({
              ort,
              shift_type,
              hours,
              shift_time,
              is_night,
              date,
            });
          }

          // ----------------------------------------------------------
          // SINGLE OBJECT GENERATION
          // ----------------------------------------------------------
          if (target_location) {
            const normalizedTargetLocation =
              normalizeText(target_location);

            if (
              normalizedTargetLocation === "austria wien"
            ) {
              add(
                "Austria Wien",
                "TD",
                6,
                "07:00-13:00",
                false,
              );
            } else if (
              normalizedTargetLocation === "wirtschaftskammer"
            ) {
              add(
                "Wirtschaftskammer",
                "TD",
                8,
                "07:00-15:00",
                false,
              );

              add(
                "Wirtschaftskammer",
                "ND",
                8,
                "15:00-23:00",
                true,
              );
            } else if (
              normalizedTargetLocation === "pav20"
            ) {
              // pav20: 4 tag and 2 night positions each day. With the
              // selected default pool of 18 people this is ~10 shifts per
              // person in a 30-day month, before preferences and absences.
              for (let i = 0; i < 4; i++) {
                add(
                  target_location,
                  "TD",
                  12,
                  "07:00-19:00",
                  false,
                );
              }

              for (let i = 0; i < 2; i++) {
                add(
                  target_location,
                  "ND",
                  12,
                  "19:00-07:00",
                  true,
                );
              }
            } else if (
              normalizedTargetLocation === "pav90" ||
              normalizedTargetLocation === "ows"
            ) {
              // pav90 and ows each need 2 tag and 2 night positions.
              for (let i = 0; i < 2; i++) {
                add(
                  target_location,
                  "TD",
                  12,
                  "07:00-19:00",
                  false,
                );
              }

              for (let i = 0; i < 2; i++) {
                add(
                  target_location,
                  "ND",
                  12,
                  "19:00-07:00",
                  true,
                );
              }
            } else {
              add(
                target_location,
                "TD",
                12,
                "07:00-19:00",
                false,
              );

              add(
                target_location,
                "TD",
                12,
                "07:00-19:00",
                false,
              );

              add(
                target_location,
                "ND",
                12,
                "19:00-07:00",
                true,
              );

              add(
                target_location,
                "ND",
                12,
                "19:00-07:00",
                true,
              );
            }

            return slots;
          }

          // ----------------------------------------------------------
          // FULL MONTH GENERATION
          // ----------------------------------------------------------

          // Pav20
          for (let i = 0; i < 4; i++) {
            add(
              "Pav20",
              "TD",
              12,
              "07:00-19:00",
              false,
            );
          }

          for (let i = 0; i < 2; i++) {
            add(
              "Pav20",
              "ND",
              12,
              "19:00-07:00",
              true,
            );
          }

          // Pav90
          for (let i = 0; i < 2; i++) {
            add(
              "Pav90",
              "TD",
              12,
              "07:00-19:00",
              false,
            );
          }

          for (let i = 0; i < 2; i++) {
            add(
              "Pav90",
              "ND",
              12,
              "19:00-07:00",
              true,
            );
          }

          // OWS
          for (let i = 0; i < 2; i++) {
            add(
              "OWS",
              "TD",
              12,
              "07:00-19:00",
              false,
            );
          }

          for (let i = 0; i < 2; i++) {
            add(
              "OWS",
              "ND",
              12,
              "19:00-07:00",
              true,
            );
          }

          return slots;
        }

        // ------------------------------------------------------------
        // SCORE EMPLOYEE
        // ------------------------------------------------------------
        function calculateScore(
          employee: Employee,
          slot: ShiftSlot,
        ): number {
          const pref =
            preferenceMap[employee.id];

          if (!pref) {
            return 0;
          }

          let score = 0;

          const locations =
            (pref.preferred_locations || [])
              .map((location) => normalizeText(location));

          const shifts =
            (pref.preferred_shifts || [])
              .map((shift) => normalizeText(shift));

          const dislikedDays =
            pref.disliked_days || [];

          const notes =
            normalizeText(pref.notes);

          // ----------------------------------------------------------
          // LOCATION PREFERENCE
          // ----------------------------------------------------------
          if (
            locations.includes(normalizeText(slot.ort))
          ) {
            score += 100;

            // If employee has only this preferred location,
            // make the preference stronger.
            if (
              locations.length === 1
            ) {
              score += 40;
            }
          }

          // ----------------------------------------------------------
          // SHIFT PREFERENCE
          // Soft only!
          // ----------------------------------------------------------
          if (
            shifts.includes(
              normalizeText(slot.shift_type),
            )
          ) {
            score += 35;
          } else if (
            shifts.length > 0
          ) {
            score -= 10;
          }

          // ----------------------------------------------------------
          // DISLIKED DAY
          // Soft only!
          // ----------------------------------------------------------
          const dayName =
            getDayName(slot.date);

          if (
            dislikedDays.includes(dayName)
          ) {
            score -= 30;
          }

          // ----------------------------------------------------------
          // NOTES
          // ----------------------------------------------------------
          if (
            notes.includes("mehr nachtdienste") ||
            notes.includes("mehr nacht") ||
            notes.includes("mehr nd")
          ) {
            if (slot.shift_type === "ND") {
              score += 60;
            } else {
              score -= 20;
            }
          }

          if (
            notes.includes("mehr tagdienste") ||
            notes.includes("mehr tag") ||
            notes.includes("mehr td")
          ) {
            if (slot.shift_type === "TD") {
              score += 50;
            } else {
              score -= 20;
            }
          }

          // ----------------------------------------------------------
          // BALANCE
          // Employees with fewer hours get a bonus.
          // ----------------------------------------------------------
          const maxHours =
            getMaxMonthlyHours(
              employee.id,
            );

          const currentHours =
            monthlyHours[employee.id] || 0;

          const utilization =
            currentHours /
            Math.max(maxHours, 1);

          score +=
            Math.max(
              0,
              50 - utilization * 50,
            );

          // Slight preference for employees
          // who currently have fewer shifts.
          const weekKey =
            getWeekKey(slot.date);

          const weekCount =
            weeklyShifts[
              `${employee.id}_${weekKey}`
            ] || 0;

          score +=
            Math.max(
              0,
              15 - weekCount * 3,
            );

          // Prefer coherent 2–3 day blocks of the same kind of service.
          // The hard consecutive-day rule below still prevents a fourth day.
          const previousDate = parseDate(slot.date);
          previousDate.setUTCDate(
            previousDate.getUTCDate() - 1,
          );
          const previousDateKey =
            `${previousDate.getUTCFullYear()}-${String(
              previousDate.getUTCMonth() + 1,
            ).padStart(2, "0")}-${String(
              previousDate.getUTCDate(),
            ).padStart(2, "0")}`;

          const followsSameShift =
            (assignmentsByEmployee[employee.id] || [])
              .some((assignment) =>
                assignment.date === previousDateKey &&
                assignment.shift_type === slot.shift_type &&
                normalizeText(assignment.ort) ===
                  normalizeText(slot.ort)
              );

          if (followsSameShift) {
            score += 40;
          }

          return score;
        }

        // ------------------------------------------------------------
        // REJECTION STATS
        // ------------------------------------------------------------
        const rejectionStats = {
          blockedDay: 0,
          sameDay: 0,
          monthlyHours: 0,
          weeklyLimit: 0,
          overlap: 0,
          restTime: 0,
          consecutiveDays: 0,
          nightToDay: 0,
        };

        // ------------------------------------------------------------
        // ALL SLOTS
        // ------------------------------------------------------------
        const allSlots: ShiftSlot[] = [];

        for (
          let day = 1;
          day <= totalDays;
          day++
        ) {
          const currentDate =
            dateKey(day);

          allSlots.push(
            ...createDailySlots(
              currentDate,
            ),
          );
        }

        // ------------------------------------------------------------
        // IMPORTANT:
        // Keep night shifts before day shifts on each date.
        // The actual 11-hour rest calculation is authoritative.
        // ------------------------------------------------------------
        allSlots.sort((a, b) => {
          if (
            a.date !== b.date
          ) {
            return a.date.localeCompare(
              b.date,
            );
          }

          if (
            a.is_night !== b.is_night
          ) {
            return a.is_night ? -1 : 1;
          }

          return 0;
        });

        console.info(
          `Total required slots: ${allSlots.length}`,
        );

        // ------------------------------------------------------------
        // GENERATE
        // ------------------------------------------------------------
        //
        // Performance-optimized scheduler:
        // - Avoids repeatedly scanning every remaining slot.
        // - Orders slots by static difficulty.
        // - Uses dynamic hard-constraint checks only once per slot.
        // - Retries a few times with different tie-breaking so a bad
        //   early choice does not make the end of the month impossible.
        //
        // This is intentionally much cheaper than the previous
        // "recalculate every slot after every assignment" algorithm.
        // ------------------------------------------------------------

        const generatedAssignments: Assignment[] = [];
        const unassignedSlots: ShiftSlot[] = [];

        type Candidate = {
          employee: Employee;
          score: number;
          tie: number;
        };

        function resetSchedulerState() {
          generatedAssignments.length = 0;

          for (const employee of employees) {
            monthlyHours[employee.id] = 0;
            assignmentsByEmployee[employee.id] = [];
          }

          for (const key of Object.keys(weeklyShifts)) {
            delete weeklyShifts[key];
          }
        }

        function getEligibleCandidates(slot: ShiftSlot): Candidate[] {
          const candidates: Candidate[] = [];

          for (const employee of employees) {
            const pref = preferenceMap[employee.id];

            // HARD: blocked day
            if ((pref?.blocked_days || []).includes(slot.date)) continue;

            // HARD: one shift per calendar day
            if (alreadyWorkingSameDay(employee.id, slot.date)) continue;

            // HARD: monthly hours
            const maxHours = getMaxMonthlyHours(employee.id);
            if ((monthlyHours[employee.id] || 0) + slot.hours > maxHours) continue;

            // HARD: maximum 5 shifts per ISO week
            const weekKey = getWeekKey(slot.date);
            const weekCount = weeklyShifts[`${employee.id}_${weekKey}`] || 0;
            if (weekCount >= 5) continue;

            // HARD: actual overlap
            if (hasOverlap(employee.id, slot.date, slot.shift_time)) continue;

            // HARD: minimum 11h actual rest
            if (violatesRestTime(employee.id, slot.date, slot.shift_time)) continue;

            // HARD: after a night shift, the following two calendar days
            // must stay free of day shifts. Example: ND on the 1st means TD
            // is only possible again on the 4th.
            if (
              slot.shift_type === "TD" &&
              hasRecentNightShift(employee.id, slot.date)
            ) {
              rejectionStats.nightToDay++;
              continue;
            }

            // HARD: maximum 3 consecutive worked days.
            // IMPORTANT: the slot order is not chronological, so checking
            // only the previous days is insufficient. Check the resulting
            // date set in BOTH directions before accepting the assignment.
            if (wouldExceedThreeConsecutiveDays(employee.id, slot.date)) continue;

            candidates.push({
              employee,
              score: calculateScore(employee, slot),
              tie: Math.random(),
            });
          }

          return candidates;
        }

        function assignSlot(slot: ShiftSlot, employee: Employee) {
          const assignment: Assignment = {
            user_id: employee.id,
            date: slot.date,
            ort: slot.ort,
            shift_time: slot.shift_time,
            shift_type: slot.shift_type,
            hours: slot.hours,
            is_night: slot.is_night,
            vacation: false,
          };

          generatedAssignments.push(assignment);
          assignmentsByEmployee[employee.id].push(assignment);
          monthlyHours[employee.id] = (monthlyHours[employee.id] || 0) + slot.hours;

          const weekKey = getWeekKey(slot.date);
          const weekTrackerKey = `${employee.id}_${weekKey}`;
          weeklyShifts[weekTrackerKey] = (weeklyShifts[weekTrackerKey] || 0) + 1;
        }

        function removeLastAssignment(employeeId: string) {
          const list = assignmentsByEmployee[employeeId] || [];
          const removed = list.pop();
          if (!removed) return;

          const index = generatedAssignments.lastIndexOf(removed);
          if (index >= 0) generatedAssignments.splice(index, 1);

          monthlyHours[employeeId] = Math.max(
            0,
            (monthlyHours[employeeId] || 0) - removed.hours,
          );

          const weekKey = getWeekKey(removed.date);
          const weekTrackerKey = `${employeeId}_${weekKey}`;
          weeklyShifts[weekTrackerKey] = Math.max(
            0,
            (weeklyShifts[weekTrackerKey] || 0) - 1,
          );
        }

        // ------------------------------------------------------------
        // V5 FAST SOLVER
        // ------------------------------------------------------------
        // Designed for Supabase Edge Runtime:
        // - no recursive search
        // - no repeated scan of dozens of remaining slots
        // - each slot is evaluated once per pass
        // - scarce slots are prioritized using a cheap candidate count
        // - up to 4 repair passes
        // ------------------------------------------------------------

        const MAX_PASSES = 4;
        const MAX_REPAIR_ROUNDS = 3;

        let bestAssignments: Assignment[] = [];
        let bestCount = -1;
        let bestUnassigned: ShiftSlot[] = [];

        function shuffle<T>(items: T[]): T[] {
          const result = [...items];
          for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
          }
          return result;
        }

        function slotKey(slot: ShiftSlot): string {
          return `${slot.date}|${slot.ort}|${slot.shift_type}|${slot.shift_time}|${slot.hours}`;
        }

        function candidateSort(a: Candidate, b: Candidate) {
          const scoreDifference = b.score - a.score;
          if (Math.abs(scoreDifference) > 0.001) return scoreDifference;

          const loadA = monthlyHours[a.employee.id] || 0;
          const loadB = monthlyHours[b.employee.id] || 0;
          if (loadA !== loadB) return loadA - loadB;

          return a.tie - b.tie;
        }

        function getCandidates(slot: ShiftSlot): Candidate[] {
          return getEligibleCandidates(slot).sort(candidateSort);
        }

        function calculateUnassigned(assignments: Assignment[]): ShiftSlot[] {
          const assignedKeys = new Set(assignments.map((a) => slotKey(a)));
          return allSlots.filter((slot) => !assignedKeys.has(slotKey(slot)));
        }

        // A cheap scarcity estimate. We only inspect every slot once at the
        // beginning of a pass, then assign in that order.
        function buildPriorityOrder(slots: ShiftSlot[]): ShiftSlot[] {
          const scored = slots.map((slot) => {
            const candidates = getCandidates(slot);
            const scarcity = candidates.length;
            const preferenceStrength =
              candidates.length > 0
                ? Math.max(...candidates.map((c) => c.score))
                : -9999;

            return {
              slot,
              scarcity,
              preferenceStrength,
              random: Math.random(),
            };
          });

          scored.sort((a, b) => {
            if (a.scarcity !== b.scarcity) {
              if (a.scarcity === 0) return -1;
              if (b.scarcity === 0) return 1;
              return a.scarcity - b.scarcity;
            }

            if (Math.abs(a.preferenceStrength - b.preferenceStrength) > 0.001) {
              return b.preferenceStrength - a.preferenceStrength;
            }

            if (a.slot.date !== b.slot.date) {
              return a.slot.date.localeCompare(b.slot.date);
            }

            if (a.slot.is_night !== b.slot.is_night) {
              return a.slot.is_night ? -1 : 1;
            }

            return a.random - b.random;
          });

          return scored.map((item) => item.slot);
        }

        for (let pass = 1; pass <= MAX_PASSES; pass++) {
          resetSchedulerState();

          const orderedSlots = buildPriorityOrder(shuffle(allSlots));
          const unassigned: ShiftSlot[] = [];
          let assignedThisPass = 0;

          for (const slot of orderedSlots) {
            const candidates = getCandidates(slot);

            if (candidates.length === 0) {
              unassigned.push(slot);
              continue;
            }

            // Normally choose the highest-scoring candidate. On later passes,
            // occasionally choose among the top 2–3 to create a different
            // distribution without expensive search.
            let chosen = candidates[0];

            if (candidates.length > 1 && Math.random() < 0.10) {
              const top = candidates.slice(0, Math.min(3, candidates.length));
              chosen = top[Math.floor(Math.random() * top.length)];
            }

            assignSlot(slot, chosen.employee);
            assignedThisPass++;

            if (assignedThisPass % 50 === 0) {
              console.info(
                `V5 progress pass ${pass}/${MAX_PASSES}: ${assignedThisPass}/${allSlots.length} assigned; unassigned=${unassigned.length}`,
              );
            }
          }

          // Small repair phase: try currently-unassigned slots again after
          // the complete first pass. This is deliberately bounded.
          for (let repair = 1; repair <= MAX_REPAIR_ROUNDS; repair++) {
            if (unassigned.length === 0) break;

            const stillUnassigned: ShiftSlot[] = [];

            for (const slot of shuffle(unassigned)) {
              const candidates = getCandidates(slot);

              if (candidates.length === 0) {
                stillUnassigned.push(slot);
                continue;
              }

              assignSlot(slot, candidates[0].employee);
            }

            unassigned.length = 0;
            unassigned.push(...stillUnassigned);

            console.info(
              `V5 repair pass ${pass}/${MAX_PASSES}, round ${repair}/${MAX_REPAIR_ROUNDS}: ${generatedAssignments.length}/${allSlots.length} assigned; remaining=${unassigned.length}`,
            );
          }

          const assignedCount = generatedAssignments.length;

          if (assignedCount > bestCount) {
            bestCount = assignedCount;
            bestAssignments = generatedAssignments.map((a) => ({ ...a }));
            bestUnassigned = [...unassigned];
          }

          console.info(
            `V5 pass ${pass}/${MAX_PASSES}: ${assignedCount}/${allSlots.length} assigned; remaining=${unassigned.length}`,
          );

          if (assignedCount === allSlots.length) break;
        }

        // Restore the best result.
        resetSchedulerState();

        for (const assignment of bestAssignments) {
          const employee = employees.find(
            (item) => item.id === assignment.user_id,
          );

          if (!employee) continue;

          assignSlot(
            {
              date: assignment.date,
              ort: assignment.ort,
              shift_time: assignment.shift_time,
              shift_type: assignment.shift_type,
              hours: assignment.hours,
              is_night: assignment.is_night,
            },
            employee,
          );
        }

        if (bestCount < allSlots.length) {
          unassignedSlots.push(...bestUnassigned);

          console.warn(
            `V5 schedule incomplete: ${bestCount}/${allSlots.length} slots assigned after ${MAX_PASSES} passes.`,
          );
        }

        console.info(
          `V5 final generated assignments: ${generatedAssignments.length}/${allSlots.length}`,
        );

        // ------------------------------------------------------------
        // VALIDATION
        // ------------------------------------------------------------
        const validationErrors: string[] = [];

        // ------------------------------------------------------------
        // Check every generated assignment
        // ------------------------------------------------------------
        for (
          const employee of employees
        ) {
          const assignments =
            assignmentsByEmployee[
              employee.id
            ] || [];

          // Monthly hours
          const totalHours =
            assignments.reduce(
              (sum, assignment) =>
                sum + assignment.hours,
              0,
            );

          const maxHours =
            getMaxMonthlyHours(
              employee.id,
            );

          if (
            totalHours >
            maxHours
          ) {
            validationErrors.push(
              `${employee.name}: ${totalHours}h exceeds maximum ${maxHours}h`,
            );
          }

          // Same day
          const dates = new Set<string>();

          for (
            const assignment of assignments
          ) {
            if (
              dates.has(
                assignment.date,
              )
            ) {
              validationErrors.push(
                `${employee.name}: multiple shifts on ${assignment.date}`,
              );
            }

            dates.add(
              assignment.date,
            );
          }

          // Weekly limit
          const weeklyCounts: Record<string, number> = {};

          for (const assignment of assignments) {
            const weekKey =
              getWeekKey(assignment.date);

            weeklyCounts[weekKey] =
              (weeklyCounts[weekKey] || 0) + 1;
          }

          for (
            const [weekKey, count]
            of Object.entries(weeklyCounts)
          ) {
            if (count > 5) {
              validationErrors.push(
                `${employee.name}: ${count} shifts in ${weekKey} (maximum 5)`,
              );
            }
          }

          // Consecutive days and minimum rest
          const sortedAssignments =
            [...assignments].sort(
              (a, b) =>
                `${a.date} ${a.shift_time}`
                  .localeCompare(
                    `${b.date} ${b.shift_time}`,
                  ),
            );

          for (
            let i = 0;
            i < sortedAssignments.length;
            i++
          ) {
            const current =
              sortedAssignments[i];

            const previous =
              sortedAssignments[i - 1];

            if (previous) {
              const previousInterval =
                getShiftInterval(
                  previous.date,
                  previous.shift_time,
                );

              const currentInterval =
                getShiftInterval(
                  current.date,
                  current.shift_time,
                );

              if (
                previousInterval.start <
                  currentInterval.end &&
                previousInterval.end >
                  currentInterval.start
              ) {
                validationErrors.push(
                  `${employee.name}: overlapping shifts around ${current.date}`,
                );
              }

              let restHours =
                Infinity;

              if (
                previousInterval.end <=
                currentInterval.start
              ) {
                restHours =
                  (
                    currentInterval.start.getTime() -
                    previousInterval.end.getTime()
                  ) / 3600000;
              }

              if (
                restHours < 11
              ) {
                validationErrors.push(
                  `${employee.name}: less than 11h rest before ${current.date}`,
                );
              }
            }
          }

          // Maximum 3 consecutive calendar days
          const workedDates =
            new Set(
              assignments.map(
                (a) => a.date,
              ),
            );

          for (
            const assignment of assignments
          ) {
            const date =
              parseDate(
                assignment.date,
              );

            let consecutive =
              1;

            for (
              let offset = 1;
              offset <= 3;
              offset++
            ) {
              const previousDate =
                new Date(date);

              previousDate.setUTCDate(
                previousDate.getUTCDate() -
                  offset,
              );

              const key =
                `${previousDate.getUTCFullYear()}-${String(
                  previousDate.getUTCMonth() + 1,
                ).padStart(2, "0")}-${String(
                  previousDate.getUTCDate(),
                ).padStart(2, "0")}`;

              if (
                workedDates.has(key)
              ) {
                consecutive++;
              } else {
                break;
              }
            }

            if (
              consecutive > 3
            ) {
              validationErrors.push(
                `${employee.name}: more than 3 consecutive working days around ${assignment.date}`,
              );
              break;
            }
          }

          // Overlaps
          for (
            let i = 0;
            i < assignments.length;
            i++
          ) {
            for (
              let j = i + 1;
              j < assignments.length;
              j++
            ) {
              const first =
                getShiftInterval(
                  assignments[i].date,
                  assignments[i].shift_time,
                );

              const second =
                getShiftInterval(
                  assignments[j].date,
                  assignments[j].shift_time,
                );

              if (
                first.start <
                  second.end &&
                first.end >
                  second.start
              ) {
                validationErrors.push(
                  `${employee.name}: overlapping shifts ${assignments[i].date} and ${assignments[j].date}`,
                );
              }
            }
          }
        }

        // ------------------------------------------------------------
        // DAILY COVERAGE
        // ------------------------------------------------------------
        const requiredByDate: Record<
          string,
          number
        > = {};

        const assignedByDate: Record<
          string,
          number
        > = {};

        for (
          const slot of allSlots
        ) {
          requiredByDate[slot.date] =
            (
              requiredByDate[
                slot.date
              ] || 0
            ) + 1;
        }

        for (
          const assignment of generatedAssignments
        ) {
          assignedByDate[
            assignment.date
          ] =
            (
              assignedByDate[
                assignment.date
              ] || 0
            ) + 1;
        }

        // ------------------------------------------------------------
        // LOG STATISTICS
        // ------------------------------------------------------------
        console.info(
          "Schedule generation statistics",
          {
            employees: employees.length,
            totalSlots: allSlots.length,
            generated: generatedAssignments.length,
            unassigned: unassignedSlots.length,
            validationErrors:
              validationErrors.length,
            rejectionStats,
          },
        );

        // ------------------------------------------------------------
        // IF GENERATION FAILED:
        //
        // DO NOT DELETE EXISTING PLAN.
        // ------------------------------------------------------------
        if (
          unassignedSlots.length > 0 ||
          validationErrors.length > 0
        ) {
          console.error(
            "Schedule validation failed",
            {
              unassigned:
                unassignedSlots.length,
              validationErrors:
                validationErrors.length,
              validationDetails:
                validationErrors.slice(0, 20),
              rejectionStats,
            },
          );

          return jsonResponse(
            {
              success: false,
              error:
                `Schedule could not be generated completely. ${unassignedSlots.length} shift(s) could not be assigned.`,

              statistics: {
                employees:
                  employees.length,
                total_slots:
                  allSlots.length,
                generated:
                  generatedAssignments.length,
                unassigned:
                  unassignedSlots.length,
                validation_errors:
                  validationErrors.length,
              },

              rejection_stats:
                rejectionStats,

              unassigned_slots:
                unassignedSlots
                  .slice(0, 50)
                  .map((slot) => ({
                    date: slot.date,
                    ort: slot.ort,
                    shift_type:
                      slot.shift_type,
                    shift_time:
                      slot.shift_time,
                    hours: slot.hours,
                  })),

              validation_errors:
                validationErrors.slice(
                  0,
                  100,
                ),
            },
            422,
          );
        }

        // ------------------------------------------------------------
        // DATABASE TRANSACTION-LIKE BEHAVIOR
        //
        // Only now delete the old month's schedule.
        // ------------------------------------------------------------
        let deleteScheduleQuery = supabaseAdmin
          .from("schedules")
          .delete()
          .gte("date", startDate)
          .lte("date", endDate);

        // A location plan must never remove rows belonging to another
        // location in the same month.
        if (target_location) {
          deleteScheduleQuery = deleteScheduleQuery.ilike(
            "ort",
            target_location,
          );
        }

        const {
          error: deleteError,
        } = await deleteScheduleQuery;

        if (deleteError) {
          throw deleteError;
        }

        // ------------------------------------------------------------
        // INSERT NEW SCHEDULE
        //
        // IMPORTANT:
        // We use INSERT, not upsert(user_id,date),
        // because multiple employees can work on the same date.
        // ------------------------------------------------------------
        if (
          generatedAssignments.length > 0
        ) {
          const rows =
            generatedAssignments.map(
              (assignment) => ({
                user_id:
                  assignment.user_id,

                date:
                  assignment.date,

                ort:
                  assignment.ort,

                shift_time:
                  assignment.shift_time,

                shift_type:
                  assignment.shift_type,

                hours:
                  assignment.hours,

                is_night:
                  assignment.is_night,

                vacation:
                  assignment.vacation,
              }),
            );

          const {
            error: insertError,
          } = await supabaseAdmin
            .from("schedules")
            .insert(rows);

          if (insertError) {
            throw insertError;
          }
        }

        // ------------------------------------------------------------
        // EMPLOYEE SUMMARY
        // ------------------------------------------------------------
        const employeeSummary =
          employees.map(
            (employee) => ({
              id: employee.id,
              name: employee.name,
              hours:
                monthlyHours[
                  employee.id
                ] || 0,
              max_hours:
                getMaxMonthlyHours(
                  employee.id,
                ),
              shifts:
                (
                  assignmentsByEmployee[
                    employee.id
                  ] || []
                ).length,
            }),
          );

        // ------------------------------------------------------------
        // SUCCESS
        // ------------------------------------------------------------
        return jsonResponse(
          {
            success: true,

            message:
              `Schichtplan erfolgreich für ${month}/${year} generiert.`,

            statistics: {
              employees:
                employees.length,

              total_slots:
                allSlots.length,

              generated:
                generatedAssignments.length,

              unassigned: 0,

              validation_errors: 0,
            },

            coverage: {
              required:
                Object.values(
                  requiredByDate,
                ).reduce(
                  (sum, value) =>
                    sum + value,
                  0,
                ),

              assigned:
                Object.values(
                  assignedByDate,
                ).reduce(
                  (sum, value) =>
                    sum + value,
                  0,
                ),
            },

            employees_summary:
              employeeSummary,
          },
          200,
        );
      } catch (err: any) {
        console.error(
          "FEHLER in generate-schedule:",
          err,
        );

        return jsonResponse(
          {
            success: false,
            error:
              err?.message ||
              String(err),

            details:
              err?.stack ||
              String(err),
          },
          500,
        );
      }
    },
  ),
};
