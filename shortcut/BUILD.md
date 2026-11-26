# Building the "Toe to Toe Sync" Shortcut (v1.0)

This is the hand-build guide for the Apple Shortcut that sends Health samples to the server. It
follows `docs/PLAN.md` §12.2 and Appendix A10, and the body it sends is the A5 contract that
`supabase/functions/sync` accepts. The version lives in `shortcut/VERSION`.

Build it once on your iPhone (about 30 minutes), test it with `shortcut/VERIFY.md`, then share it
with the crew as an iCloud link. Friends never build it; they import it, paste their key and set up
the automations in `shortcut/AUTOMATIONS.md`.

> Shortcuts labels move a little between iOS versions. If a label below doesn't match your phone,
> use the closest one and write the real label in [First-build notes](#first-build-notes) so the
> next build is exact.

## What the Shortcut does (A10)

1. Import question: the sync key (Text).
2. Start = start of yesterday, phone time.
3. For Steps, Flights Climbed and Walking + Running Distance: find Health samples whose Start Date
   is after Start, sorted by Start Date, dropping samples whose Source is Health (manual entries).
4. For each sample, build `{s, e, n, src}` with ISO 8601 dates that include the offset.
5. Build the A5 body and POST it to `/functions/v1/sync` with the key in the `Authorization` header.
6. If the sync failed, show a notification with the server's message. Otherwise stay silent.

## What the server accepts

Checked against `packages/engine/src/schemas/sync.ts` and `supabase/functions/sync/handler.ts`.

| Field                                      | Rule                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Authorization`                            | `Bearer <sync key>`, one space, no spaces inside the key (keys are 43 characters).                                                            |
| `v`                                        | The number `1`.                                                                                                                               |
| `kind`                                     | The text `samples` (v1.0). `hours` is the v1.1 fallback, not built here.                                                                      |
| `sent_at`                                  | ISO 8601 date-time ending in an offset (`-05:00`) or `Z`.                                                                                     |
| `device_tz`                                | Text, 1 to 64 characters. Informational only; scoring uses your season home zone.                                                             |
| `shortcut_version`                         | **Text** like `1.0` (digits and dots). Must be at least `MIN_SHORTCUT_VERSION` = `1.0`, or the server answers 426.                            |
| `metrics.steps`, `.flights`, `.distance_m` | Each optional. A list of at most 5,000 items `{s, e, n, src}`. Leave a key out when it has no samples (never send it empty-as-text or null).  |
| `s`, `e`                                   | ISO 8601 with offset. `e` must not be before `s`.                                                                                             |
| `n`                                        | A JSON number. Steps and flights: whole numbers 0 to 1,000,000. Distance: **metres**, may have decimals, 0 to 1,000,000.                      |
| `src`                                      | Text, 1 to 200 characters (the device or app name). Samples with `src` exactly `Health` are manual entries and are dropped by the server too. |
| Whole body                                 | At most 1 MB.                                                                                                                                 |

Samples that ended more than 48 hours ago, or that fall on a day that is already locked, are dropped
and counted in `ignored`. That's normal and not an error.

## Before you start

- **iOS setting:** Settings → Apps → Shortcuts → Advanced → turn on **Allow Sharing Large Amounts of
  Data** (on older iOS: Settings → Shortcuts → Advanced). Without it, iOS stops and asks before every
  large sync, which breaks automations.
- **Server address** for the copy you're building (see [Staging, production and local](#staging-production-and-local)).
- **Your sync key:** from the app (Profile → Sync setup) or, before the app exists, the local seed key
  `local-dev-sync-key-jay` (local server only).

### Building tips

- Add an action: tap **Add Action** (or the search bar at the bottom), type its name, tap it.
- An action's output appears as a blue "magic variable" token. When this guide says **rename to X**,
  tap the token anywhere it's used → **Rename**, and type X. Renaming makes the later steps much
  easier to wire up correctly.
- To pick a variable for a field, tap the field → **Select Variable** (or tap the token in the bar
  above the keyboard).
- Indentation in this guide matches the Shortcuts editor: actions inside **Repeat** or **If** are
  between the start and the **End Repeat** / **End If** lines that Shortcuts adds for you.

## Create the Shortcut

Shortcuts app → **Shortcuts** tab → **+**. Tap the name at the top → **Rename** → `Toe to Toe Sync`
(staging copy: `Toe to Toe Sync (Staging)`). Choose an icon: a walking figure on any colour.

### Part 1: settings values (actions 1 to 6)

1. **Text** → type `PASTE-YOUR-SYNC-KEY`. (On your own copy you may paste your real key instead; the
   sharing copy must keep the placeholder. See [Share it as an iCloud link](#share-it-as-an-icloud-link).)
2. **Set Variable** → Variable Name `Sync Key`, Input: the **Text** from action 1.
3. **Text** → the server address with no trailing slash, for example
   `https://<project-ref>.supabase.co`.
4. **Set Variable** → `Server`, Input: the **Text** from action 3.
5. **Text** → `1.0` (must equal `shortcut/VERSION`).
6. **Set Variable** → `Version`, Input: the **Text** from action 5.

### Part 2: the start time (actions 7 to 10)

7. **Date** → leave it on **Current Date**.
8. **Adjust Date** → operation **Subtract**, value `1`, unit **days**, date: **Date** from action 7.
9. **Adjust Date** → operation **Get Start of Day**, date: **Adjusted Date** from action 8.
10. **Set Variable** → `Start`, Input: **Adjusted Date** from action 9.

Subtracting a day first and then taking the start of day gives 12:00 AM yesterday in the phone's
zone, even across a clock change.

### Part 3: steps (actions 11 to 22)

11. **Find Health Samples** (shows as "Find All Health Samples where…"):
    - Filter 1: **Type** **is** **Steps**.
    - **Add Filter** → **Start Date** **is after** → select variable **Start**.
    - **Add Filter** → **Source** **is not** → type `Health`.
      (If **Source** / **is not** isn't offered, skip this filter and record it in
      [First-build notes](#first-build-notes). The server drops `Health` samples anyway.)
    - Make sure the filter mode at the top reads **all** of the following are true.
    - **Sort by** **Start Date**, **Order** **Oldest First**.
    - **Limit** off.
    - Rename the output to `Step Samples`.
12. **Repeat with Each** → item in **Step Samples**.
13. &nbsp;&nbsp;**Get Details of Health Sample** → **Start Date** of **Repeat Item**.
14. &nbsp;&nbsp;**Format Date** → Date: the output of 13. **Date Format** **ISO 8601**, turn on
    **Include ISO 8601 Time**. Rename to `S`.
15. &nbsp;&nbsp;**Get Details of Health Sample** → **End Date** of **Repeat Item**.
16. &nbsp;&nbsp;**Format Date** → output of 15, same settings as 14. Rename to `E`.
17. &nbsp;&nbsp;**Get Details of Health Sample** → **Value** of **Repeat Item**.
18. &nbsp;&nbsp;**Round Number** → the Value from 17, **Ones Place**, mode **Normal**. Rename to
    `N`. (The server needs whole steps; almost every step sample already is one.)
19. &nbsp;&nbsp;**Get Details of Health Sample** → **Source** of **Repeat Item**. Rename to `Src`.
20. &nbsp;&nbsp;**Dictionary** → **Add new item** four times:
    - **Text** key `s`, value variable `S`
    - **Text** key `e`, value variable `E`
    - **Number** key `n`, value variable `N`
    - **Text** key `src`, value variable `Src`
21. **End Repeat** (added automatically).
22. **Set Variable** → `Steps List`, Input: **Repeat Results** (the output of End Repeat).

The **n** item must be a **Number** item, not Text, or the server answers 422
`metrics.steps[0].n: …`.

### Part 4: flights (actions 23 to 34)

Same as Part 3. The quickest way: long-press action 11 → **Duplicate**, and the same for 12 to 22,
then change the copies. Check every token in the copies: each must point at the copy, not at the
step version.

23. **Find Health Samples** → **Type** **is** **Flights Climbed**, plus the same three settings as
    action 11 (Start Date is after **Start**, Source is not `Health`, Sort by Start Date, Oldest
    First, Limit off). Rename to `Flight Samples`.
24. **Repeat with Each** → item in **Flight Samples**.
25. &nbsp;&nbsp;**Get Details of Health Sample** → **Start Date** of **Repeat Item**.
26. &nbsp;&nbsp;**Format Date** → output of 25, **ISO 8601**, **Include ISO 8601 Time** on. Rename
    to `S`.
27. &nbsp;&nbsp;**Get Details of Health Sample** → **End Date** of **Repeat Item**.
28. &nbsp;&nbsp;**Format Date** → output of 27, same settings. Rename to `E`.
29. &nbsp;&nbsp;**Get Details of Health Sample** → **Value** of **Repeat Item**.
30. &nbsp;&nbsp;**Round Number** → the Value from 29, **Ones Place**, **Normal**. Rename to `N`.
31. &nbsp;&nbsp;**Get Details of Health Sample** → **Source** of **Repeat Item**. Rename to `Src`.
32. &nbsp;&nbsp;**Dictionary** → **Text** `s` = `S`, **Text** `e` = `E`, **Number** `n` = `N`,
    **Text** `src` = `Src`.
33. **End Repeat**.
34. **Set Variable** → `Flights List`, Input: **Repeat Results**.

### Part 5: walking + running distance in metres (actions 35 to 57)

Health returns distance in your preferred unit (miles or kilometres). The server wants metres, so
this loop converts.

35. **Find Health Samples** → **Type** **is** **Walking + Running Distance**, plus the same three
    settings as action 11. Rename to `Distance Samples`.
36. **Repeat with Each** → item in **Distance Samples**.
37. &nbsp;&nbsp;**Get Details of Health Sample** → **Start Date** of **Repeat Item**.
38. &nbsp;&nbsp;**Format Date** → output of 37, **ISO 8601**, **Include ISO 8601 Time** on. Rename
    to `S`.
39. &nbsp;&nbsp;**Get Details of Health Sample** → **End Date** of **Repeat Item**.
40. &nbsp;&nbsp;**Format Date** → output of 39, same settings. Rename to `E`.
41. &nbsp;&nbsp;**Get Details of Health Sample** → **Value** of **Repeat Item**. Rename to `Raw`.
42. &nbsp;&nbsp;**Get Details of Health Sample** → **Unit** of **Repeat Item**. Rename to `Unit`.
43. &nbsp;&nbsp;**If** **Unit** **is** `mi`
44. &nbsp;&nbsp;&nbsp;&nbsp;**Calculate** → **Raw** **×** `1609.344`.
45. &nbsp;&nbsp;&nbsp;&nbsp;**Set Variable** → `Metres`, Input: **Calculation Result**.
46. &nbsp;&nbsp;**Otherwise**
47. &nbsp;&nbsp;&nbsp;&nbsp;**If** **Unit** **is** `km`
48. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Calculate** → **Raw** **×** `1000`.
49. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Set Variable** → `Metres`, Input: **Calculation Result**.
50. &nbsp;&nbsp;&nbsp;&nbsp;**Otherwise**
51. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Set Variable** → `Metres`, Input: **Raw** (already metres).
52. &nbsp;&nbsp;&nbsp;&nbsp;**End If**
53. &nbsp;&nbsp;**End If**
54. &nbsp;&nbsp;**Get Details of Health Sample** → **Source** of **Repeat Item**. Rename to `Src`.
55. &nbsp;&nbsp;**Dictionary** → **Text** `s` = `S`, **Text** `e` = `E`, **Number** `n` = `Metres`,
    **Text** `src` = `Src`. (No rounding: distance may have decimals.)
56. **End Repeat**.
57. **Set Variable** → `Distance List`, Input: **Repeat Results**.

If your phone shows a unit other than `mi`, `km` or `m` (for example `ft` or `yd`), note it in
[First-build notes](#first-build-notes); it needs another **If** branch.

### Part 6: the body (actions 58 to 75)

Metrics with no samples (no flights today, say) are left out instead of being sent empty.

58. **Dictionary** → leave it empty.
59. **Set Variable** → `Metrics`, Input: the **Dictionary** from 58.
60. **If** **Steps List** **has any value**
61. &nbsp;&nbsp;**Set Dictionary Value** → set `steps` to **Steps List** in **Metrics**.
62. &nbsp;&nbsp;**Set Variable** → `Metrics`, Input: **Dictionary** (the output of 61).
63. **End If**
64. **If** **Flights List** **has any value**
65. &nbsp;&nbsp;**Set Dictionary Value** → set `flights` to **Flights List** in **Metrics**.
66. &nbsp;&nbsp;**Set Variable** → `Metrics`, Input: **Dictionary** (the output of 65).
67. **End If**
68. **If** **Distance List** **has any value**
69. &nbsp;&nbsp;**Set Dictionary Value** → set `distance_m` to **Distance List** in **Metrics**.
70. &nbsp;&nbsp;**Set Variable** → `Metrics`, Input: **Dictionary** (the output of 69).
71. **End If**
72. **Format Date** → **Current Date**, **ISO 8601**, **Include ISO 8601 Time** on. Rename to
    `Sent At`.
73. **Format Date** → **Current Date**, **Date Format** **Custom**, format string `VV`. Rename to
    `Device TZ`. (`VV` prints the zone name, for example `America/New_York`.)
74. **Dictionary** → add:
    - **Number** `v` = `1`
    - **Text** `kind` = `samples`
    - **Text** `sent_at` = `Sent At`
    - **Text** `device_tz` = `Device TZ`
    - **Text** `shortcut_version` = `Version` (Text, never Number: a Number turns `1.0` into `1`)
75. **Set Dictionary Value** → set `metrics` to **Metrics** in the **Dictionary** from 74. Rename the
    output to `Body`.

### Part 7: send (actions 76 to 77)

76. **Text** → **Server** variable followed directly by `/functions/v1/sync` (no space). Rename to
    `Sync URL`.
77. **Get Contents of URL** → URL: **Sync URL**. Tap **Show More** (the arrow):
    - **Method** **POST**
    - **Headers** → **Add new header** twice:
      - `Authorization` = `Bearer ` (with one space) followed by the **Sync Key** variable
      - `Content-Type` = `application/json`
    - **Request Body** **File**, File: **Body**.

    Shortcuts sends a Dictionary as JSON. If the server answers `body: not valid JSON`, add a
    **Text** action containing only the **Body** variable just before action 77 and use that Text as
    the File instead.

### Part 8: report failures only (actions 78 to 86)

A successful response always has `home_tz`; error responses have `ok: false`, `error` and
`message`. A dead network or a gateway error page may have neither.

78. **Get Dictionary Value** → **Value** for key `home_tz` in **Contents of URL**. Rename to
    `Home Zone`.
79. **If** **Home Zone** **does not have any value**
80. &nbsp;&nbsp;**Get Dictionary Value** → **Value** for key `message` in **Contents of URL**.
    Rename to `Error Message`.
81. &nbsp;&nbsp;**If** **Error Message** **has any value**
82. &nbsp;&nbsp;&nbsp;&nbsp;**Show Notification** → title `Toe to Toe Sync`, body **Error Message**.
83. &nbsp;&nbsp;**Otherwise**
84. &nbsp;&nbsp;&nbsp;&nbsp;**Show Notification** → title `Toe to Toe Sync`, body
    `Couldn't reach Toe to Toe. It will try again next time you open a trigger app.`
85. &nbsp;&nbsp;**End If**
86. **End If**

Nothing after that: a good sync is silent.

## The import question (sync key)

This is what makes each friend paste their own key when they add the Shortcut.

1. In the editor, open the Shortcut's details: tap the **ⓘ** button at the bottom (on newer iOS: tap
   the name at the top → **Details** / **Shortcut Details**).
2. Open the **Setup** tab → **Add Question** (older iOS: **Import Questions** → **Add Question**).
3. Pick the **Text** in action 1.
4. Question: `Paste your sync key from Toe to Toe (Profile → Sync setup).`
5. Default Answer: leave it empty.
6. Tap **Done**.

When someone imports the Shortcut, iOS asks this question and puts the answer into action 1.

## Other Shortcut settings

In the same details screen:

- **Details** tab: **Show in Share Sheet** off. **Show on Apple Watch** off (the Watch can't run
  this).
- **Privacy** tab (appears after the first run): Health access for Steps, Flights Climbed and
  Walking + Running Distance; the server's host set to **Always Allow**.

## First run

1. Tap the Shortcut once by hand with the phone unlocked.
2. Allow Health access to **Steps**, **Flights Climbed** and **Walking + Running Distance** (Turn On
   All → Allow).
3. When asked "Allow Toe to Toe Sync to send … to <host>?", tap **Always Allow**.
4. Silent means 200. To see the response during testing, temporarily add **Quick Look** with
   **Contents of URL** after action 77 (remove it before sharing). A good answer looks like:

   ```json
   {
     "ok": true,
     "home_tz": "America/New_York",
     "ignored": { "locked_days": 0, "outside_window": 0, "manual": 0 },
     "days": [{ "date": "2027-01-10", "steps": 10431, "points": 104.31, "status": "live" }]
   }
   ```

   (`points` comes from a placeholder formula until real scoring lands in P2.1.)

## Responses and what to do

From `supabase/functions/sync/handler.ts`. Every error body is
`{ "ok": false, "error": "<code>", "message": "<text>" }`, and the notification shows `message`.

| Status | `error`              | Message (shown in the notification)                                        | What to do                                                                                                                     |
| ------ | -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 200    | (none)               | silent                                                                     | Nothing.                                                                                                                       |
| 401    | `unauthorized`       | "Missing sync key…" or "Unknown or rotated sync key. Copy your key again…" | Re-paste the key into action 1 (keys stop working when rotated).                                                               |
| 405    | `method_not_allowed` | "Use POST."                                                                | Action 77 Method must be POST.                                                                                                 |
| 413    | `payload_too_large`  | "Body is over 1 MB." or "metrics.steps: more than 5000 samples."           | Very Watch-heavy two days. Tell Jay: this is the trigger for v1.1 (`kind: "hours"`).                                           |
| 422    | `invalid_payload`    | Names the field, e.g. `metrics.steps[3].n: …` or `sent_at: must be…`       | A build mistake in the named field (wrong item type, missing offset). Fix that action.                                         |
| 426    | `shortcut_outdated`  | "Your Toe to Toe Sync Shortcut is too old. Get the new version: <link>"    | Import the new version from the link and paste the key again.                                                                  |
| 429    | `rate_limited`       | "One sync per 30 seconds. Try again shortly."                              | Harmless but it does show a notification: two syncs within 30 s (two trigger apps opened back to back). The first one counted. |

If the Supabase gateway (not our function) answers, for example `Invalid JWT` or a 404 page, the
notification says "Couldn't reach Toe to Toe…" or shows the gateway's message. `Invalid JWT` means
the function was deployed with JWT checking on: `supabase/config.jsonc` sets
`functions.sync.verify_jwt = false`, and the deploy must use it.

## Staging, production and local

Only action 3 (**Server**) changes between environments. Keep one Shortcut per environment on your
phone so you never send test data to production by accident.

| Shortcut name                        | Action 3 (Server)                       | Key from                              |
| ------------------------------------ | --------------------------------------- | ------------------------------------- |
| `Toe to Toe Sync (Local)` (optional) | `http://<your PC's LAN IP>:54321`       | seed key `local-dev-sync-key-jay`     |
| `Toe to Toe Sync (Staging)`          | `https://<t2t-staging ref>.supabase.co` | staging app → Profile → Sync setup    |
| `Toe to Toe Sync`                    | `https://<t2t-prod ref>.supabase.co`    | production app → Profile → Sync setup |

The project ref is in the Supabase dashboard → Project Settings → General (or in the project URL).

To make another environment's copy: long-press the Shortcut → **Duplicate**, rename it, change
action 3, paste that environment's key into action 1, and run it once by hand to allow the new host.

Local notes: the iPhone can't reach `localhost`, so use the PC's Wi-Fi address (`ipconfig` →
IPv4 Address) on the same network, run `pnpm dev` (or `supabase functions serve`), and allow port
54321 through Windows Firewall. If the local database has the fake test clock on (`app_config` test
mode), real samples can fall outside the 48-hour window or onto "locked" days. Turn test mode off for
phone tests.

## Share it as an iCloud link

Friends get the production Shortcut only.

1. Duplicate your production Shortcut and name the copy exactly `Toe to Toe Sync`. In the copy:
   action 1 is the placeholder `PASTE-YOUR-SYNC-KEY` (**never share a copy holding your real key**),
   action 3 is the production server, action 5 equals `shortcut/VERSION`, and there's no **Quick
   Look** left in it.
2. Check the import question is still on action 1 (details → **Setup**).
3. Long-press the Shortcut → **Share** → **Copy iCloud Link** (on some iOS versions: **Share** →
   **Options** → **Copy iCloud Link**).
4. Put the link where the 426 message and the app can find it:
   `supabase secrets set SHORTCUT_URL=<link> --project-ref <t2t-prod ref>` (and the same for staging
   with the staging copy's link). The app's "Get the Shortcut" button uses this link too once that
   screen exists.
5. Open the link on another iPhone (or after deleting your copy) and confirm it asks the sync-key
   question on **Add Shortcut**.

The link points at that exact copy. Editing the Shortcut later doesn't change what the link
delivers; share again to get a new link.

## Releasing a new version

1. Change action 5 and `shortcut/VERSION` together (for example `1.1`) and update this guide.
2. Re-share (above) and update `SHORTCUT_URL` with the new link.
3. Only if old copies must stop working: raise `MIN_SHORTCUT_VERSION` in
   `packages/engine/src/schemas/sync.ts` (a code change with a test). Old copies then get 426 with the
   link.

## First-build notes

Fill these in on the first build (P0.6 manual step) and commit the changes.

- [ ] **Source is not Health** filter available in **Find Health Samples**? (yes / no; real label: ___)
      If not, the Shortcut sends manual entries and the server drops them (`ignored.manual` counts them).
- [ ] **Format Date** ISO 8601 output example (should end in an offset like `-05:00`): ___
- [ ] **Format Date** custom `VV` output: ___
- [ ] Distance **Unit** values seen: ___
- [ ] **Request Body File** with a Dictionary accepted (no "not valid JSON")? ___
- [ ] Import-question menu path on this iOS version: ___
- [ ] iOS version: ___. Time for one run on a Watch-heavy day: ___ s.
- [ ] First sync returned 200 against: local / staging.
