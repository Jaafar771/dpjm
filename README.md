# Dienstplan Portal

Vue-3-Anwendung für Dienstpläne, Mitarbeiterprofile und Anträge. Die Anmeldung und der Dienstplan verwenden Supabase.

## Starten

```bash
npm install
npm run dev
```

Für eine produktionsfertige Version:

```bash
npm run build
```

## Einmalige Supabase-Einrichtung

Die Antragseite speichert Anträge in `employee_requests`. Vor dem ersten Einsatz die Migration [202610230001_create_employee_requests.sql](supabase/migrations/202610230001_create_employee_requests.sql) in das verbundene Supabase-Projekt übernehmen. Sie richtet auch Row Level Security ein: Beschäftigte können ausschließlich ihre eigenen Anträge lesen und anlegen.

Für die Anmeldung per Benutzername außerdem [202610250001_add_profile_usernames.sql](supabase/migrations/202610250001_add_profile_usernames.sql) ausführen und die Edge Function `login-by-username` bereitstellen. Anschließend erhält jeder Eintrag in `app_users.username` einen eindeutigen Benutzernamen, zum Beispiel `jaafar.alami`. E-Mail-Anmeldung bleibt weiterhin möglich.

Die Funktion muss ohne vorgeschaltete JWT-Prüfung veröffentlicht werden, da eine Person vor dem Login noch kein JWT besitzt. Die Einstellung ist in [supabase/config.toml](supabase/config.toml) hinterlegt. Nach dem Anmelden in der Supabase CLI im Projektordner ausführen:

```bash
supabase link --project-ref DEIN_PROJEKT_REF
supabase db push
supabase functions deploy login-by-username --no-verify-jwt
```

Ein erfolgreicher Aufruf der Funktion antwortet auf `OPTIONS` mit HTTP 200 und den nötigen CORS-Headern. Erst danach kann die Anmeldung mit einem Benutzernamen funktionieren.

## Kontaktadresse einrichten

Die Büro-Kontaktseite verwendet bewusst keine private, fest einprogrammierte E-Mail-Adresse. Lege im Projektstamm eine Datei `.env.local` an:

```env
VITE_OFFICE_EMAIL=dienstplan@deine-organisation.at
```

Danach den Entwicklungsserver neu starten. Vite stellt diese Variable nur für den Browser-Build bereit; darin dürfen keine geheimen Schlüssel stehen.

## Supabase-Projektadresse

Lege im Projektstamm zusätzlich `.env.local` an bzw. ergänze sie mit den aktuellen Werten aus **Supabase Dashboard → Settings → API**. Die Anwendung verbindet sich ausschließlich mit dieser Konfiguration und verwendet keinen alten Ersatz-Endpunkt:

```env
VITE_SUPABASE_URL=https://dein-projekt-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dein_key
```

Danach den Entwicklungsserver vollständig neu starten. Ohne eine erreichbare Projekt-URL kann weder die E-Mail- noch die Benutzername-Anmeldung funktionieren.

## Vercel-Bereitstellung

`.env.local` wird nicht zu Vercel hochgeladen. Öffne deshalb in Vercel **Project → Settings → Environment Variables** und hinterlege für **Production**, **Preview** und **Development** dieselben Werte wie lokal:

```env
VITE_SUPABASE_URL=https://dein-projekt-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dein_key
VITE_OFFICE_EMAIL=dienstplan@deine-organisation.at
```

Danach die aktuelle Bereitstellung über **Deployments → Redeploy** neu erstellen. Vite übernimmt `VITE_*`-Variablen ausschließlich während des Builds. Die App zeigt deshalb eine konkrete Einrichtungs-Meldung an, statt sich still mit dem alten Supabase-Projekt zu verbinden.
