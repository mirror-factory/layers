# app/api/calendar/upcoming/route.ts

## Contract

`GET /api/calendar/upcoming?limit=10`

Returns the signed-in user's next calendar events for the recorder home screen.
The route first checks the encrypted `calendar_connections` integration table.
If that table is not present or no stored token is usable, it falls back to the
Supabase Google `session.provider_token` MVP path.

Response shape:

```json
{
  "connected": true,
  "provider": "google",
  "accountEmail": "person@example.com",
  "items": [
    {
      "id": "event_1",
      "title": "Product planning",
      "startsAt": "2026-05-01T15:00:00.000Z",
      "endsAt": "2026-05-01T15:45:00.000Z",
      "location": "Zoom",
      "attendeesCount": 2
    }
  ],
  "limit": 10,
  "setupRequired": false,
  "providerSetupRequired": false,
  "reauthRequired": false,
  "calendarFetchFailed": false,
  "calendarRateLimited": false
}
```

## Failure Modes

- Unauthenticated users receive a disconnected empty overview, not a 500.
- Missing `calendar_connections` table still works when Supabase Google
  `provider_token` exists.
- Missing or expired provider token sets `reauthRequired`.
- Google/Graph `429` sets `calendarRateLimited`.
- Other provider failures set `calendarFetchFailed`.
