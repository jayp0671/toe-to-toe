# Toe to Toe — V3 Plan (text copy)

> Auto-extracted from `docs/Toe_to_Toe_Plan.pdf` (v3.0, Nov 24 2026). Tables and mockups lose their layout in text form — when anything here is ambiguous, the PDF is authoritative.

```text
Toe to Toe

V3 App Plan and Official Ruleset

Private crew app · Apple Health · Monthly Fantasy seasons with daily matchups · Crew Game · Challenges ·
Group Journey · $0 to run

Formerly "Fantasy Steps" (working name). Owner: Jay Patel. Version 3.0, November 24, 2026. Replaces
V1.0.
Status: every product rule is decided. Section 19 lists the defaults chosen where you hadn't answered, so
you can change any of them. The only open items are things that must be proven on real phones (Section
18). Appendix A is the engineering spec (repo, scripts, APIs, security, Shortcut, dependencies,
environments, automated tests). Appendix B is the design system, screen layouts and mockups. Appendix C
is the Claude Code playbook: CLAUDE.md plus every build prompt with its checkpoint. Appendix D defines
success: a golden day and season, beta metrics, the launch checklist and the runbook.

What changed from V1

Area                 V1                                      V2
Distribution         Native Swift app, $99/year, TestFlight
                                                             Free web app installed to the Home Screen, plus
Crew size            Up to 20                                an Apple Shortcut that syncs Health. Native app
Clock                Everyone on Eastern Time                becomes an optional $99 upgrade later, on the
Game lock                                                    same backend.
Schedule luck        Noon ET next day
Step scoring                                                 Built for 8–10, supports 4–12
Optional metrics     Head-to-head only
Dropouts                                                     Each player's own home time zone, locked for
Late data            No cap                                  the season
Cheating             Five, mostly Watch-based
Modifiers                                                    Noon next day in each player's home zone. A
                     Remaining games score 0.00              game is final when both players have locked.
                     Could still change leaderboard and
                     Journey after the lock                  Head-to-head plus a daily Crew Game against
                     Visible flag only                       the whole crew

                     Drawn each night                        Only the first 30,000 steps of a day score

Playoffs at 10       Top 6, 9 days                           Flights only. Watch-based metrics moved to
players                                                      Challenges, where people opt in.
Score corrections    Never
Social               None                                    Opponent wins by forfeit
Non-playoff players  Nothing until next month
                                                             One official number per person per day, used
                                                             everywhere

                                                             Flag → 24-hour crew review → majority vote
                                                             can void the day

                                                             Drawn when the schedule is made, kept hidden,
                                                             revealed 8 PM local the night before. Max one
                                                             per day.

                                                             Top 4, 6 days (more regular season)

                                                             Only for a proven server bug, logged publicly

                                                             Reactions, one-line trash talk, nudges

                                                             Automatic Consolation Race during playoffs

1. What we are building

A private social fitness game for one friend group (about 8–10 people, all on iPhone). Apple Health steps
turn into Fantasy points. Friends compete in a monthly Fantasy season with one head-to-head game per
day plus a daily Crew Game, run side challenges at the same time, and push a shared marker across a real-
world map on the group Journey.

Design principles

     Steps are the currency. Every iPhone counts steps, so steps are the only metric that's always on.
     Fair beats fun when they conflict. Equal games, equal byes, same rules for both players, no rule
     changes once a season starts.
     Your day is your day. Every player gets a full midnight-to-midnight day in their own time zone.
     Luck is minimized, not eliminated. The Crew Game means a strong day always counts, even against a
     strong opponent.
     Everything becomes points, to the hundredth. One scoring engine powers Fantasy and challenges.
     Scores always show two decimals.
     Simple rules. If a rule needs a paragraph to explain, it's cut.
     Health data stays mostly on the phone. Only step, flight and distance counts leave it, and only hourly
     totals are stored. Friends never see raw Health records.
     $0 to run. Every piece of the stack is free.
     History is permanent. Every season, game and record is kept forever.

2. Locked decisions

Area               Decision
Platform           Web app installed to the iPhone Home Screen (iOS 17 or later, confirmed for the whole
                   crew) plus the "Toe to Toe Sync" Shortcut. No App Store and no Mac needed.
Users              One private crew, invite-only, max 12 members.
Clock              Each player picks a home time zone when joining a season. It's locked until the season
                   ends. Admin deadlines use the crew clock (the commissioner's zone, default Eastern).
Daily goal         10,000 steps for everyone.
Fantasy season     One per calendar month. Opt-in. 4–12 players.
Regular season     Every day: one head-to-head game (or a bye) plus the Crew Game.
Byes               No head-to-head game that day. You still play the Crew Game. Everyone gets the same
                   number of byes.
Rest               At least one rest day between regular season and playoffs. Leftover days become extra
                   rest.
Playoffs           Best-of-3 series, one game per day. Top 2 for 4–5 players, Top 4 for 6–12.
Standings          Win % (head-to-head and Crew Game combined) first. Points For only breaks ties.
Scoring precision  Exact to 0.01, stored as whole numbers of hundredths. Negative scores allowed.
Modifiers          Whole feature can be turned on or off. Each modifier toggles individually.
Home tab           Today's steps plus the daily leaderboard. Fantasy has its own tab.

Area                       Decision
Other modes                Challenges run alongside Fantasy. Group Journey is always on.
Money                      No buy-ins or prizes inside the app. Trophies and badges only.

3. The fairness system

Every known source of unfairness, and the rule that handles it.

Source of unfairness       Rule                                         Why it works
Schedule luck (facing the                                               Half of every player's results no longer
best player on your best   Daily Crew Game: beat more of the crew       depend on who they drew.
day)                       than beat you and you get a second win.
Uneven games or byes                                                    Proven per crew size and month length in
Time zones                 Scheduler guarantees equal head-to-          Section 6.
Travel                     head games and equal byes for everyone.      Everyone gets the same waking hours. A
                                                                        West Coast player isn't cut off at 9 PM.
Apple Watch vs phone       Each player's day runs midnight to           Flying west can't buy a 27-hour day.
only                       midnight in their own home zone.
                                                                        A phone-only player is never locked out
One freak day (a hike, a   Home zone is locked for the season.          of points. Any step device that writes to
phone in the dryer)        Steps on a trip still count on your home     Health counts, so a cheap band is an
Cheating                   clock.                                       equalizer.
                                                                        Caps how much one day can swing Points
Dropouts                   Fantasy only scores what an iPhone           For and records.
Commissioner bias          measures alone: steps and (optionally)       Peers decide, not one commissioner.
                           flights. Watch-heavy metrics live in         Rules are known before the season.
Rigged modifiers           Challenges.
                                                                        Nobody can lose to an empty seat.
Late syncers               Only the first 30,000 steps of a day score.
                                                                        The server calculates every score from
                           Manual entries never count. Suspicious       Health data.
                           days go to a 24-hour crew review. A
                           majority can void the day.                   Nobody, including the developer, can pick
                                                                        a modifier for a day they already know
                           Games against an Inactive player are         the result of.
                           forfeit wins for the opponent.               A morning phone unlock catches
                                                                        everyone up.
                           After the season starts, the
                           commissioner can only remove a player
                           or cancel the season.

                           All modifier days are drawn when the
                           schedule is published, stored hidden,
                           then revealed the night before.

                           Data counts by when the steps
                           happened, not when they synced. Lock is
                           noon the next day.

4. Time zones

     Home zone. When you join a season, you confirm your home time zone (it defaults to your phone's
     zone). Any zone works, including half-hour zones like India. It's locked until the season ends. You can
     change it before the next season.
     Game day. 12:00:00 AM to 11:59:59 PM in your home zone. You and your opponent each play your
     own local day for the same date.
     Your lock. Your day locks at 12:00 PM the next day in your home zone. Data that syncs after the lock is
     ignored everywhere.
     Game final. A game is final when both players' days have locked (and any review is closed).
     Crew Game and standings for a date are final once the last player's day for that date locks.
     Daylight saving. The spring-forward day has 23 hours and the fall-back day has 25 for anyone in a zone
     that observes it. Everyone in the same zone is affected equally. This happens twice a year and is
     accepted as is.
     Notifications and modifiers follow your home zone (for example, the modifier reveal at 8 PM your
     time).
     Last-mover edge. A player in a later zone can see an opponent's final number before their own day
     ends. This is accepted, the same as late games in real fantasy.

Example: Jan 10  Home zone            Day runs (Eastern clock)     Day locks (Eastern clock)

Player A         New York (ET)        Jan 10, 12:00 AM – 11:59 PM  Jan 11, 12:00 PM

Player B         Los Angeles (PT)     Jan 10, 3:00 AM – Jan 11, 2:59 AM Jan 11, 3:00 PM

Player C         Halifax (AT)         Jan 9, 11:00 PM – Jan 10, 10:59 PM Jan 11, 11:00 AM

Player D         Vancouver            Jan 10, 2:00 AM – Jan 11, 1:59 AM Jan 11, 2:00 PM

Game A vs B is final Jan 11 at 3:00 PM ET, and Game A vs D at 2:00 PM ET: a game goes final at the later of its two
locks. Until then it shows Finalizing. Every player got a full 24-hour local day. Your crew is all Eastern except one
player in Halifax or Vancouver. Either city works the same way: each player's day runs on their own IANA home zone
(America/Halifax or America/Vancouver), so nothing in the rules changes.

Halifax changes clocks on the same dates as Eastern, so it is always 1 hour ahead of Eastern. Vancouver does not.
Under current IANA time zone data (tzdata 2026 and later), British Columbia stopped changing clocks after
March 8, 2026 and stays on the same clock all year. Vancouver no longer shifts with Eastern: it is 2 hours behind
Eastern in winter (as in the table above, 1 hour ahead of Los Angeles) and 3 hours behind in summer. The app never
hard-codes these gaps. It always asks the time zone data, so if British Columbia changes its rules again, an updated
tzdata is the only fix needed.

5. Fantasy rulebook                   What happens

5.1 Season timeline                   Sign-ups open. Each player confirms their home zone. Commissioner sets
                                      scoring values and modifiers.
 When
  20th of prior month (crew clock)    Sign-ups close. Rosters and home zones lock. Minimum 4 players or the
                                      season doesn't start.
  Last day of prior month, 8:00 PM
  (crew clock)                        Schedule published (every matchup and bye). Modifier days drawn and
  Last day of prior month, 9:00 PM    stored hidden.
  (crew clock)
  1st, 12:00 AM (each player's zone)  Game 1 starts.

When                          What happens
Regular season                One head-to-head game (or bye) plus the Crew Game each day.
Rest day(s)                   No Fantasy games. Once the last regular-season day locks for every player,
                              seeds and bracket publish and the Consolation Race starts.
Playoffs                      Best-of-3 series in 3-day blocks.
Last day of month             Championship Game 3 (if needed). Champion crowned when it's final.

5.2 A game day

     Live (your local day): scores update every time either phone syncs, with "updated X min ago".
     Finalizing (midnight to noon your time): late data from inside your day still counts.
     Final: both players locked. Locked forever and added to the record.
     Under review: only if a day was flagged (5.10). Becomes final within 24 hours.
     Higher score wins. Equal to the hundredth = tie (regular season only).

5.3 Scoring                   Points                                                      Default
                              +1.00 per 100 steps (1 step = 0.01). Only the first 30,000  Always on
 Rule                         steps of the day score.
  Steps                       +5.00                                                       On
                              −5.00                                                       On
  Hit 10,000 steps            Additional −5.00                                            On
  Under 5,000 steps           +0.25 per flight, max 10.00 per day. An iPhone measures     Off
  Under 2,500 steps           this without a Watch.
  Flights climbed (optional)

Bonuses and penalties always use the day's real counted steps. Modifiers never move those
thresholds.

The 30,000 cap counts steps in time order. When a modifier multiplies steps, all step points for the day
are added up first, then rounded half up to the hundredth once.

Before the season, the commissioner can change the bonus, both penalties and the flights value. The
10,000 goal, the step rate and the 30,000 cap are fixed.
Not in Fantasy: walking distance (it duplicates steps and favors long strides), workouts, exercise
minutes and active calories (these favor Watch owners). They're available in Challenges.

Steps                         Calculation                                                           Score
2,263                         22.63 − 5.00 − 5.00                                                   12.63
4,300                         43.00 − 5.00                                                          38.00

Steps                                        Calculation                                             Score
8,547                                        85.47                                                   85.47
9,999                                        99.99                                                   99.99
10,000                                       100.00 + 5.00                                           105.00
12,638                                       126.38 + 5.00                                           131.38
34,210                                       300.00 (capped) + 5.00                                  305.00
10,431 on Early Bird day, 3,001 before 9 AM  (7,430 + 1.5 × 3,001) ÷ 100 = 119.315 → 119.32, + 5.00  124.32

Typical range for 5,000–15,000 steps is about 50–155, averaging near 100.

5.4 Modifiers

Master switch on or off. Each modifier toggles individually. Frequency: Low (2 per season), Medium (4,
default), High (8). At most one per day, never two days in a row. Drawn at schedule time, hidden, revealed
at 8:00 PM local the night before. They apply to every regular-season game that day and to the Crew
Game. Off during playoffs unless the commissioner turns them on before the season. A modifier that needs
a disabled metric is never drawn.

Modifier      Effect
Double Steps  Step points ×2. Bonuses and penalties unchanged.
10K Jackpot   10K bonus is +10.00 instead of +5.00.
Pure Steps    No bonuses, no penalties. Steps only.
No Excuses    Penalties doubled.
Final Push    Steps from 8:00 PM to 11:59 PM local are worth 1.5×.
Early Bird    Steps from 12:00 AM to 8:59 AM local are worth 1.5×.
Stairs Day    Flight points ×2, daily flights cap 20.00 (only if flights are on).

5.5 The Crew Game

Every regular-season day, besides your head-to-head game, you play the whole crew. Count how many
players you outscored and how many outscored you. More beaten than beaten-by = win. Fewer = loss.
Equal = tie.

     In an 8-player crew the top 4 win and the bottom 4 lose. In a 9-player crew the exact middle score ties.
     Bye days still count for the Crew Game. Inactive players are left out of it.
     Commissioner can turn it off before a season. Default is on. There's no Crew Game in the playoffs.

   Why: a season has only about 20 head-to-head games, so who you face swings the standings. The
   Crew Game cuts that luck in half and rewards consistent walkers.

5.6 Standings

Columns: Seed, Player, H2H W-L-T, Crew W-L-T, Win %, PF, PA, Streak.
Win % = (all wins + 0.5 × all ties) ÷ (head-to-head games + Crew Games).
PF = the sum of your daily scores on every regular-season day, bye days included (everyone has the same
number of days). PA = the sum of your head-to-head opponents' scores.

  1. Win %
  2. Points For
  3. Total counted steps across regular-season days
  4. Random draw (seeded, logged and visible)

5.7 Playoffs

Crew size                 Bracket          Format                                          Days

4–5                       Top 2            Championship (best of 3)                        3

6–12                      Top 4            Semis 1v4, 2v3 → Final                          6

Every series is a fixed 3-day block. Win 2 to advance. If a series ends 2-0, Game 3 isn't played.
Scores reset each game. Same scoring rules as the regular season.
Playoff tie: more counted steps wins. If still tied, the higher seed wins.
Everyone not in the playoffs is automatically entered in the Consolation Race (most points over the
playoff days, with its own trophy). Leaderboard, challenges and Journey continue for everyone.

5.8 Rosters, dropouts and the commissioner

Situation                            Rule

Joining mid-season                   Not allowed. Join next month.

Leaving or removed mid-season        Becomes Inactive. Completed games stand. Each remaining game is a
Inactive player held a playoff seed  forfeit win for the opponent (their real score still counts toward PF). Left
                                     out of the Crew Game. Not eligible for playoffs.

                                     Next eligible player takes the seed.

Leaving during playoffs              Opponent advances.

Can't walk for a while (injury)      Sit out that month's Fantasy. There's no mid-season injury relief, because
                                     it would break equal games.

Commissioner before start            Invites and removals, scoring values, flights on/off, modifiers, Crew Game
                                     on/off, short-season start.

Commissioner after start             Remove a player or cancel the season. Nothing else.

Commissioner leaves the crew         Role passes to the longest-tenured remaining member.

First season starts mid-month        Allowed if at least 7 regular-season days fit. Otherwise it starts on the 1st.

Situation                   Rule
Cancelled season
Server bug changed a score  Kept in history marked "Cancelled". No champion.

                            The only allowed correction. Re-run from stored data, written to the
                            season's public audit log with before and after, and every player is
                            notified.

5.9 Data that counts

     All step data in Apple Health counts (iPhone, Apple Watch, and other bands whose app writes to
     Health), except manually entered steps.
     When an iPhone and a Watch record the same walk, it counts once (see Section 12).
     Every player's game card shows their step sources and last sync time.

5.10 Flags and crew review

     A day is flagged automatically if it has more than 40,000 steps, more than 2.5× the player's 30-day
     average (after 7 days of history), or any single hour over 12,000 steps.
     Flagged days show to the whole crew. The player can add a note ("hiked Bear Mountain").
     Games involving the day show Under review for 24 hours after the lock. Every other active player can
     vote "Void".
     If more than half of the other active players vote Void, the day is scored as 0 steps with no penalties.
     Otherwise it stands. Either way, it's final after 24 hours.

6. Season format by crew size

Each cell shows head-to-head games / byes per player, then regular-season days and rest days. Every player
in a crew gets identical numbers. The scheduler tests in Phase 2 must reproduce this table exactly. Your
likely crew sizes (8–10) are in bold.

Players  Bracket            28 days          29 days          30 days          31 days
4        Top 2
5        Top 2              24G / 0B         25G / 0B         26G / 0B         27G / 0B
6        Top 4              24 reg · 1 rest  25 reg · 1 rest  26 reg · 1 rest  27 reg · 1 rest
7        Top 4
8        Top 4              18G / 5B         20G / 5B         20G / 5B         20G / 5B
                            23 reg · 2 rest  25 reg · 1 rest  25 reg · 2 rest  25 reg · 3 rest

                            21G / 0B         22G / 0B         23G / 0B         24G / 0B
                            21 reg · 1 rest  22 reg · 1 rest  23 reg · 1 rest  24 reg · 1 rest

                            18G / 3B         18G / 3B         18G / 3B         20G / 4B
                            21 reg · 1 rest  21 reg · 2 rest  21 reg · 3 rest  24 reg · 1 rest

                            21G / 0B         22G / 0B         23G / 0B         24G / 0B
                            21 reg · 1 rest  22 reg · 1 rest  23 reg · 1 rest  24 reg · 1 rest

Players  Bracket  28 days          29 days          30 days                          31 days
9        Top 4
10       Top 4    18G / 3B         18G / 3B         20G / 3B                         20G / 3B
11       Top 4    21 reg · 1 rest  21 reg · 2 rest  23 reg · 1 rest                  23 reg · 2 rest
12       Top 4
                  21G / 0B         22G / 0B         23G / 0B                         24G / 0B
                  21 reg · 1 rest  22 reg · 1 rest  23 reg · 1 rest                  24 reg · 1 rest

                  18G / 2B         20G / 2B         20G / 2B                         20G / 2B
                  20 reg · 2 rest  22 reg · 1 rest  22 reg · 2 rest                  22 reg · 3 rest

                  21G / 0B         22G / 0B         23G / 0B                         24G / 0B
                  21 reg · 1 rest  22 reg · 1 rest  23 reg · 1 rest                  24 reg · 1 rest

Crew Games per player = regular-season days. Example: 9 players in a 31-day month play 20 head-to-head games and 23
Crew Games.

Scheduler rules (in priority order)

  1. Hard: everyone plays the same number of head-to-head games and gets the same number of byes.
  2. Hard: nobody plays twice in one day. Playoffs and at least one rest day fit in the month.
  3. Most head-to-head games possible, then fewest byes, then fewest three-bye days. Leftover days

     become rest days.
  4. Even crews: no byes. Round-robin rotation (circle method).
  5. Odd crews: one bye per day, with a few three-bye days when needed so byes divide evenly. Byes

     spread across the month, never back to back.
  6. Meetings between any two players differ by at most one across the season. Nobody faces someone

     twice before facing everyone once.
  7. No same opponent on back-to-back days.

7. The rest of the app

7.1 Daily leaderboard

Everyone in the crew ranked by today's steps (each person's own local today), with Fantasy points next to
each. Filters: Today, Yesterday, This week, This month. Fantasy participation isn't required.

7.2 Challenges

Anyone can start one and invite any crew members. Challenges run at the same time as Fantasy, use the
same scoring engine with their own settings, have no modifiers and never affect Fantasy. Challenges can
use Watch metrics (workouts, exercise minutes, calories) because everyone opts in.

Challenge         How it works                                                       Release
Race              Most points over 1–14 days.                                        V1
King of the Hill  Daily top scorer holds the crown. Tracks reigns and total crowns.  V1

Challenge         How it works                                                             Release
Consolation Race  Automatic Race for non-playoff Fantasy players during the playoffs.      V1
First to X        First to a step or point target wins.                                    V1.1
Personal Best     Score = your steps as a % of your own 30-day average. A level field for  V1.1
                  very different activity levels.
Team Battle       Two teams, combined points.                                              V1.1
Survival          Miss the daily minimum, lose a life. Last one standing wins.             V1.1
Boss Battle       Crew works together to drain a boss's HP with points.                    V2

7.3 Group Journey

     Combined walking and running distance from the whole crew moves a marker along a real-world
     route. Shown in miles.
     Filters: Today, This week, This month, This year, All time, Custom range. Each shows total miles and
     each person's contribution.
     Starter routes: New York → Miami, Route 66, Iceland Ring Road, Coast to Coast USA, Around the
     World.
     Milestone cards when the crew passes cities. When a route finishes, the commissioner picks the next
     one.
     Routes ship inside the app as GeoJSON lines with mile markers, so there are no map API costs.

7.4 Social

     Emoji reactions and a one-line trash-talk thread on every game card.
     Nudge: send a friend a push ("you're 800 steps from 10K"). Max one per person per day.

7.5 History, records and trophies

     Season archive: every season's standings, schedule, every game score, bracket, champion and audit
     log.
     Player career: all-time record, championships, playoff record, PF, average score, high and low game,
     10K days, longest win streak.
     Head-to-head: all-time record and points between any two players.
     Record book: highest game, biggest blowout, closest game, most PF in a season, longest win streak,
     most titles.
     Trophy room and badges: champion, Consolation Race winner, Crew Game MVP (best Crew record),
     first 10K streak of 7 days, and others.

8. Screens               What's on it

 Tab                     Today's steps and 10K ring, today's Fantasy points with breakdown, today's matchup
  Home                   (live margin and "X steps to take the lead"), today's Crew Game rank, active modifier,
                         daily leaderboard, active challenge cards, Journey progress strip, Sync now button.
  Fantasy
                         Sub-tabs: Matchup, Schedule, Standings, Bracket, Stats, History, Reviews. Commissioner
  Challenges             settings behind a gear icon.
  Journey
  Crew                   Active, upcoming, completed. Create: type → players → duration → scoring → review.
  Profile (avatar, top-
  right)                 Map with route and marker, period filter, contribution list, milestones.

                         Members, profiles, head-to-head, record book, trophy room, invites.

                         Career stats, home zone, sync setup and health check (last sync, sources, sync key),
                         notification settings, sign out, delete account.

9. Notifications

All times are your home zone. Every type can be turned off individually. Opponent alerts are limited to one
per hour per game.

Notification                                     When
Today's matchup                                  8:00 AM
Modifier revealed                                8:00 PM the night before
Opponent took the lead                           On sync, max once an hour
Within 500 steps of 10K                          On sync
Close game, 2 hours left                         10:00 PM if margin is under 10.00
Sync your final score                            11:30 PM
Open the app to lock in                          9:00 AM if you haven't synced since midnight
Final result                                     When your game goes final
Day flagged / review opened                      Event-based
Clinched playoffs / eliminated                   When mathematically decided
Nudge, challenge started/won, Journey milestone  Event-based

10. Getting it on everyone's iPhone for free

Option                Cost    Catch                                                         Verdict
                                                                                            Use this for V1
A. Home Screen        $0      Health is read by a Shortcut instead of the app. Each friend
                              spends about 5 minutes on setup. Push works once the app      Not workable
web app + Apple               is on the Home Screen.                                        for a crew

Shortcut                      The install expires every 7 days and has to be reinstalled    Skip
                              from your Mac, phone by phone. Free personal teams can't
B. Native app on a $0         use push notifications.                                       Upgrade path if
free Apple ID                                                                               the crew sticks
                              Each friend signs the app with their own Apple ID and re-     with it
C. Sideloading        $0      signs every 7 days. Same missing push. Fragile for non-
stores (AltStore,     $99/yr  developers.
SideStore)
                              Best accuracy and true background sync, widgets, and
D. Native app +               normal push. TestFlight builds expire after 90 days.
Apple Developer
Program (TestFlight)

About iCloud+: it doesn't change any of this. Apple's app signing and push rules are tied to the
Developer Program, not iCloud storage. The one iCloud piece you'll use, sharing the Shortcut as an
iCloud link, works on any free iCloud account.

Upgrade path (D) without a rewrite: wrap the same React app with Capacitor, add a native HealthKit
statistics query (which Apple de-duplicates for you) plus background delivery, and point it at the same
sync endpoint. The backend, rules and data don't change. The Shortcut is retired.

11. Tech stack (all free)

Layer                 Choice                                            Why
App                                                                     Your stack. No Mac, no App Store, instant
Charts and map        React + TypeScript + Vite, installable web app    updates.
                      (vite-plugin-pwa), Tailwind, TanStack Query       No API keys, no bills.
Hosting
Environments          Recharts; MapLibre GL with free                   Free subdomain. A custom domain is
Backend               OpenStreetMap-based tiles (OpenFreeMap).          optional.
                      Fallback: plain SVG route.                        Everything is tested on staging before
                                                                        friends see it (A12).
                      Cloudflare Pages (free HTTPS, deploys from        500 MB database is decades of data for
                      GitHub)                                           10 people.

                      Local, CI, staging (second free Supabase project
                      + Pages preview), production

                      Supabase Free: Postgres, Auth, Realtime, Edge
                      Functions, Cron (pg_cron + pg_net)

Layer          Choice                                            Why
Sign-in        Supabase email one-time code. No passwords.       Magic links open Safari, not the Home
Health bridge                                                    Screen app, but codes work inside it.
Push           Apple Shortcuts ("Toe to Toe Sync"), shared by    The only free way to read Health without
Shared engine  iCloud link                                       a paid developer account.
Time zones     Web Push (VAPID keys) sent from an Edge           Works on iPhone for Home Screen web
Tests and CI   Function                                          apps.
               One TypeScript package: scoring, Crew Game,       The same code runs on the server
Backups        scheduler, standings, de-duplication, time zones  (official) and in the app (preview).
               IANA zones everywhere; Postgres AT TIME ZONE      Handles daylight saving and half-hour
Keep-alive     plus Luxon in TypeScript                          zones correctly.
Monitoring     Vitest + fast-check (engine), pgTAP (database),   Every rule is tested automatically on
Dev tools      Deno test (functions), Playwright WebKit (end-    every push. Full plan in Appendix A3–A4.
               to-end), scripted season simulator and
               production smoke tests, GitHub Actions            The free plan has no backups. Encryption
               Nightly supabase db dump → encrypted with         keeps Health totals private even if the
               age → private GitHub repo                         repo leaks.
                                                                 Free projects pause after a week of low
               Daily syncs plus a daily GitHub Actions query     activity.
                                                                 You see problems before the crew does.
               Admin page: last sync per player, cron run
               history, failed pushes, open reviews              Free for personal use.
               Claude Code, Supabase CLI with the local stack
               (Docker)

12. Health sync design

12.1 Setup (once per friend, about 5 minutes)

  1. Open the web app in Safari → Share → Add to Home Screen. Open it from the Home Screen, sign in
     with an email code, allow notifications.

  2. Profile → Sync setup → copy your personal sync key → tap "Get the Shortcut" (iCloud link) → paste
     the key when the Shortcut asks during import.

  3. Run the Shortcut once and allow Health access for steps, flights and walking + running distance.
  4. In Shortcuts → Automation, create "When [app] is opened" for 2–3 apps you open often (Instagram,

     Messages, Snapchat). Set it to Run Immediately with notifications off.
  5. The app shows your synced total and asks you to confirm it matches the Health app.

Why app-open triggers: iPhone Health data can't be read while the phone is locked, so timed
automations at night often fail. Opening an app means the phone is unlocked, so the sync always
works.

12.2 What a sync does

  1. The Shortcut reads step, flight and distance samples from yesterday 12:00 AM to now. It skips samples
     whose source is the Health app (manual entries).

  2. It posts every sample (start, end, count, source name) to the /sync Edge Function with the sync key.
     Every sync re-sends both days, so it's safe to repeat.

  3. The server checks the key, spreads each sample evenly over the minutes it covers, and keeps the
     largest source in each minute, so a walk recorded by both iPhone and Watch counts once. Shortcuts
     can't return Health's own de-duplicated total, which is why the server does this. It stores per-source
     and de-duplicated hourly totals and discards the raw samples.

  4. The server maps hours to each player's home-zone day and updates the live score preview. The app
     updates through Realtime.

  5. At the lock, the official day total is frozen, per-source rows are deleted, and only the de-duplicated
     hourly totals remain.

If Phase 0 shows the Shortcut is too slow on Watch-heavy days, it switches to sending hourly totals per source, and the
server keeps the larger source each hour (Appendix A10).

12.3 Scheduled jobs (Supabase Cron, every 15 minutes, in UTC)

Job                       What it does

Lock and finalize         Lock every player-day that just reached local noon. Finalize games where both
                          players are locked and no review is open. Finalize Crew Games once a date is
                          locked for everyone. Update standings, records, Journey and challenges. Close
                          24-hour reviews.

Local-time pushes         Send any notification whose local time just arrived for each player (8 AM, 8
                          PM, 10 PM, 11:30 PM, 9 AM).

Season lifecycle          20th: open sign-ups. Last day 8 PM crew clock: lock rosters and zones. 9 PM:
                          build the schedule and hidden modifier draw. After the final regular-season
                          lock: seed, publish bracket, start the Consolation Race.

Nightly (GitHub Actions)  Encrypted backup and keep-alive query.

13. Data model            Key fields
                          id, email, display_name, username, avatar_url, default_tz, created_at
 Table
  users

Table                     Key fields
crews / crew_members      crew id, name, invite_code, commissioner_id, crew_tz; member role, joined_at,
                          status
sync_keys                 user_id, key_hash (SHA-256), created_at, last_used_at
source_hours (temporary)  user_id, hour_start_utc, source_name, steps, flights, distance_m — deleted at lock
hours                     user_id, hour_start_utc, steps, flights, distance_m (de-duplicated)
daily_stats               user_id, local_date, home_tz, steps, flights, distance_m, sources[], status (live /
                          locked / review / voided), locked_at, flags[], note
seasons                   crew_id, month, status (signup / live / rest / playoffs / final / cancelled),
                          scoring_config (frozen JSON), modifier_config, crew_game_on, bracket_size, key
season_players            dates
                          season_id, user_id, home_tz (frozen), status (active / inactive), seed, h2h W-L-T,
games                     crew W-L-T, PF, PA
                          season_id, date, phase (regular / playoff), series_id, player_a, player_b, score_a,
crew_games                score_b (integer hundredths), status (live / finalizing / review / final), winner,
byes / playoff_series     is_forfeit
modifiers                 season_id, date, user_id, score, beaten, beaten_by, result
reviews / votes           season_id, date, user_id / round, seed_a, seed_b, wins_a, wins_b, winner
audit_log                 season_id, date, type, revealed (false until 8 PM local the night before)
push_subscriptions        daily_stat_id, opens_at, closes_at, outcome / voter_id, vote
reactions / comments /    season_id, actor, action, before, after, at
nudges                    user_id, endpoint, keys, prefs
challenges /              game_id or user_id, author_id, emoji or text, at
challenge_entries
journeys                  type, config, dates, status; user / team, daily points, result

                          crew_id, route_id, started_on, completed_on

Security: row-level policies let users read only their own crew's data. Health totals, scores and results are written only by
server functions. The sync key is stored hashed and can be regenerated from Profile.

14. Privacy

     What leaves the phone: step, flight and walking + running distance samples (time, count, source
     name) for yesterday and today. The server turns them into hourly totals and throws the samples away.
     Never heart rate, location, workouts or anything else.
     Per-source hourly totals are deleted when your day locks. Only de-duplicated hourly totals are kept.

No ads, no analytics, no tracking, no third-party SDKs. Health data is never sold or shared.
Privacy page hosted alongside the app. In-app account deletion removes your account and Health
totals. Past games show "Former player".

15. Cost                       Cost Notes
                               $0 Free subdomain
 Item
  Web app hosting (Cloudflare  $0 500 MB database, 2 projects, pauses after a week of low activity (daily
  Pages)                                syncs prevent it)
  Supabase Free
                               $0
  GitHub (code, CI, backups)   $0
  Map tiles, push, Shortcuts   $0 Any Mac, Windows or Linux machine works for this path
  Computer                     $0 Optional later: $99/yr for the native upgrade, ~$10/yr for a custom
  Total
                                        domain

16. Build order

Phase          Target          Scope                                       Done when
0. Sync proof
               Nov 30 – Dec    Repo, CI and test harness (Appendix A).     95% of player-days synced by
               7               Shortcut, /sync function, de-duplication,   noon; totals within 2% of the
                               home-zone days, debug page. Test on 4       Health app on 90% of days,
1. Foundation  Dec 8 – 14      phones: 2 Watch wearers and 2 phone-        for Watch and phone-only
                               only (about half the crew wears a Watch),   players alike.
2. Fantasy engine Dec 15 – 21  ideally including the non-Eastern player.
                                                                           The crew sees each other's
3. Playoffs +  Dec 22 – 26     Installable app, email-code sign-in, crew   live steps.
history                        and invites, home zone, Home,
                               leaderboard, profile, push opt-in, account  Test layers 1–7 (A3) pass in
                               deletion.                                   CI. The scheduler reproduces
                                                                           Section 6. pnpm sim matches
                               Scoring (integer hundredths, cap,           hand-calculated results for a
                               modifiers), Crew Game, scheduler, game      mixed-zone month.
                               lifecycle, per-zone locks, standings,
                               tiebreakers, forfeits.                      pnpm sim runs full seasons
                                                                           for 8, 9 and 10 players to a
                               Seeding, brackets, series, rest days,       champion with zero invariant
                               archive, career stats, head-to-head, audit  failures.
                               log.

Phase           Target        Scope                                       Done when
4. Engagement   Dec 27 – 30   Notifications, modifier draw and reveal,
                              flags and reviews, reactions, trash talk,   Tests confirm every push fires
Sign-ups        Dec 20 – 31   nudges, record book.                        at the right local time in two
5. Journey +    Early Jan     Friends install, set up sync, join the      zones.
challenges      January 2027  January season.
6. Beta season                Journey map and filters; Race, King of the  At least 4 players synced for 3
                Feb+          Hill, Consolation Race.                     days.
7. Polish                     One real month, labeled Beta. 8 players:
                              24 regular days, 1 rest, 6 playoff days.    Both work alongside a live
                                                                          season.
                              Design pass, V1.1 challenges, trophies,
                              optional native upgrade.                    No scoring disputes that
                                                                          trace to bugs. Smoke tests
                                                                          and nightly invariants stay
                                                                          green all month.

Dates assume about 10 hours a week with Claude Code doing most of the typing. If Phase 0 slips, the first season moves to
February (28 days: 21 regular, 1 rest, 6 playoff for 8 or 10 players).

17. Fairness and anti-cheat summary

     Manual Health entries never count. Step sources are visible on every game card.
     iPhone + Watch overlap counts once.
     30,000-step daily scoring cap. Auto-flags at 40,000 steps, 2.5× the 30-day average, or 12,000 in one
     hour. A 24-hour crew vote can void a flagged day.
     Scoring config, home zones and the modifier draw are frozen when the season starts.
     Honest limit: on the free path, someone determined could edit their Shortcut to send fake numbers.
     The flags and the crew vote make that visible and reversible, which is the right level for a friend group.
     The native upgrade closes most of the gap.

18. What's still unproven

These aren't rule gaps. Only Phase 0 on real phones can answer them, and each has a fallback.

Risk                                           Fallback

App-open automations don't run often enough    Add more trigger apps. The 9 AM reminder and morning
for some people.                               unlock catch up. If it's still unreliable, move the lock to 6 PM.

Server de-duplication differs from the Health  Tune the rule (for example, prefer the Watch in each minute).
app by more than 2%.                           Show "Counted steps" with a short explainer.

The Shortcut is slow with a Watch's many       Send hourly totals per source instead (kind "hours" in A5). Skip
samples.                                       yesterday once it has locked.

Risk                                               Fallback
                                                   Native upgrade (Section 10, option D) on the same backend.
A future iOS update changes Shortcuts or web
push behavior.                                     Fine for about 10 people signing in once. Add a free SMTP
                                                   provider if it becomes a problem.
Supabase's built-in email sender is rate-limited.

19. Defaults chosen for you (change any)

Question                               Default in this plan
Rounding for 1.5× modifiers            Add up the day's step points, then round half up once
Bonuses and penalties use raw or       Raw counted steps
multiplied steps?
Two modifiers on one day?              Never
Games against an Inactive player       Forfeit win for the opponent
Does late data change the leaderboard  No. One official number per day, everywhere.
after the lock?
Bracket notice with only 1 rest day    Accepted (about 9–12 hours)
Score corrections                      Only proven server bugs, publicly logged
Cheating defense                       Flags + 24-hour crew vote
Third-party step apps                  Allowed and visible; no blocklist
Injuries / accessibility               Sit out the month; Challenges can use other metrics
Handicaps                              None in Fantasy; the Personal Best challenge serves that role
Social features                        Reactions, trash talk, nudges in V1. Widgets wait for the native upgrade.
Stakes                                 No money in the app; trophies and badges
Challenge membership                   Invite-only; no modifiers
Journey units                          Miles
Fractional distance in /sync           Round each sample half up to whole metres before
                                       de-duplication (Jay, 2026-11-26)
Vancouver stopped changing clocks      Follow the IANA zone America/Vancouver as is (2 h behind
(tzdata 2026)                          Eastern in winter, 3 h in summer). No rule change: days,
                                       locks and Finalizing already run per home zone (Jay,
                                       2026-11-26)
Crew membership values                 role: commissioner | member; status: active | left |
                                       removed. One active commissioner per crew, always the
                                       same user as crews.commissioner_id (the source of truth).
                                       Only active members read crew data; they still see
                                       former players' past days (Jay, 2026-11-26)
Phase 0 sync report (P0.8)             "Synced by noon" = an accepted sync (sync_log) arrived
                                       after the home-zone day ended and before its 12:00 PM
                                       lock. % error = |counted − Health| / Health, within 2%
                                       inclusive. A day with no Health number counts for the
                                       sync line and is left out of the error line; a group
                                       with no measured days fails it. Both lines must pass for
                                       Watch and phone-only separately. Testers are marked by
                                       users.dev_note (proposed, 2026-11-26)
Backups                                Encrypted before leaving Supabase
Max crew size and playoffs             12; Top 4 for 6–12 players
First season                           January 2027 (Beta)
Commissioner                           Jay

Name: Toe to Toe. Every game is head-to-head, on foot. No step app with this name turned up in an App
Store search. A different app called ToeSteps exists, so always use the full name.

20. What you need to do next

  1. Confirm whether the non-Eastern player is in Halifax or Vancouver. Nothing in the plan changes either
     way; she just picks that home zone when she signs up.

  2. Recruit 4 friends for the Phase 0 sync test: 2 Watch wearers and 2 phone-only.
  3. Do the Phase −1 setup in Appendix C (about an hour), then run prompt P0.1.
  4. Work through prompts P0.1–P0.8. Build nothing beyond a debug page and the test harness until the

     sync report passes.

Appendix A. Engineering spec

Everything needed to start building and testing. Every tool listed is free.

A1. Repository layout (one GitHub repo, pnpm workspaces)

Path                       Contents
apps/web
packages/engine            React + Vite installable web app: routes, components, service worker, Web
                           Push, Realtime subscriptions.
supabase/migrations
supabase/functions         Pure TypeScript with no I/O: scoring, Crew Game, standings, tiebreakers,
supabase/tests             scheduler, de-duplication, time zones, clock. Imported by the web app and the
supabase/seed.sql          Edge Functions.
shortcut/
tests/e2e, tests/fixtures  SQL schema, row-level security, views, cron schedules. One file per change,
                           never edited after merge.
scripts/
routes/                    Edge Functions (Deno): sync, api, jobs-tick, jobs-season, jobs-
.github/workflows          invariants, push.

                           pgTAP database tests.

                           Local dev crew: 9 players in New York, Halifax and Vancouver, half with
                           Watches, plus a hidden smoke-test crew.

                           Exported "Toe to Toe Sync" Shortcut, its action-by-action spec (A10) and
                           version file.

                           Playwright specs. Step-sample fixtures: Watch and phone overlap, phone only,
                           Watch on charger, third-party band, manual entry, DST days, half-hour zone,
                           freak day.

                           sim, smoke, sync-report, restore-drill, gen-routes.

                           Journey GeoJSON lines and milestone lists.

                           ci, deploy, smoke, backup.

A2. Scripts (run from the repo root)

Command                    What it does
pnpm dev                   Starts local Supabase and the web app with hot reload.
pnpm db:reset              Rebuilds the local database from migrations and seed.
pnpm test                  All Vitest unit tests (engine and web).
pnpm test:engine           Engine tests, including property tests and golden tables.
pnpm test:db               pgTAP tests: schema, row-level security, SQL functions.

Command                          What it does
pnpm test:functions
pnpm sim --players 9 --month     Deno tests for every Edge Function against local Supabase.
2027-01 --zones ET,AT --seed 42
                                 Runs a full season through the real database and functions on a fake
pnpm e2e                         clock. Every result is checked against the engine's independent
pnpm smoke --env prod            calculation.
pnpm sync-report --days 7
                                 Playwright (WebKit, iPhone viewport) against the local stack.
pnpm restore-drill
                                 Post-deploy checks against production, using the hidden smoke crew.
pnpm check
                                 Phase 0 report: sync coverage by noon and % error against the Health
pnpm gen:types                   app, per tester and for Watch vs phone-only.

                                 Decrypts the latest backup into a local database and runs the
                                 invariants.

                                 Lint, typecheck, test, test:db and test:functions. Runs as a pre-push
                                 hook.

                                 Generates TypeScript types from the database schema.

A3. Automated test plan

# Layer and tool What it covers                                                         Gate

1 Engine unit     Every scoring example in 5.3 as a golden test. Cap and time order.    Every rule has a
      (Vitest)    1.5× rounding. Each modifier. Bonuses on raw steps. Crew Game         test. 95% line
                  for 4–12 players with ties. Win %, tiebreak order, forfeits, playoff  coverage on the
                  ties, Inactive players.                                               engine.

2 Scheduler       Every crew size 4–12 × month 28–31 × 200 random seeds: equal Zero failures.

properties (fast- games, equal byes, nobody plays twice a day, meetings differ by

check)            at most 1, no back-to-back opponents or byes, at least one rest

                  day, playoffs fit. Summary output equals the Section 6 table

                  exactly.

3 Time zones      Day boundaries and lock times for New York, Halifax, Vancouver Zero failures.

(Vitest + Luxon) and Kolkata. 23- and 25-hour DST days. Travel (phone zone differs

                  from home zone). Half-hour zone splitting. Notification times per

                  zone.

4 De-duplication  iPhone + Watch walk counted once. Phone only. Watch on                Each fixture
      (fixtures)  charger. Third-party band. Manual entry dropped. Re-sent              matches its
                  payload changes nothing.                                              expected total
                                                                                        exactly.

5 Database        Row-level security: a user can't read another crew, write any         Zero failures.
      (pgTAP)     score, read hidden modifiers or read a sync key. Constraints:
                  integer scores, one game per player per day. Status changes only
                  through functions.

# Layer and tool        What it covers                                                         Gate
                                                                                               Zero failures.
6 Functions (Deno       /sync auth, limits, idempotency. Late data after a lock is ignored.
       test)            Flags at each threshold. Vote outcomes. Nudge rate limit. Dead         Database results
                        push subscriptions removed.                                            equal engine
7 Season                                                                                       results. Invariants
       simulation       Full months for 8, 9 and 10 players, Eastern plus Atlantic or          hold.
       (pnpm sim)       Pacific, on a fake clock. Injected chaos: late syncs, missed syncs, a  Zero failures.
                        mid-season dropout, a voided day, a cancelled season.
8 End-to-end                                                                                   Runs after every
       (Playwright,     Sign in with an email code (read from the local mail catcher), join    deploy and every 3
       WebKit)          a crew, sign up with a home zone, watch a live matchup update          hours. A failure
                        after a sync, vote on a review, confirm commissioner settings lock     alerts you.
9 Production            at season start.                                                       A failure shows on
       smoke (pnpm                                                                             the admin page and
       smoke)           App loads and service worker registers. /sync with the smoke           pushes to the
                        account returns 200. jobs-tick ran in the last 20 minutes. Push        commissioner.
10 Nightly              dry run works. Database is well under 500 MB. No open invariant        Checklist signed off
       invariants (SQL  failures.                                                              in the release notes.
       job in
       production)      Equal games per player. Stored standings equal recomputed
                        standings. Every final game has two locked days. Every score
11 Manual device        equals a recompute from hourly totals. No unrevealed modifier
       check (not       is readable.
       automatable)
                        10 minutes on a real iPhone for any release that touches sync or
                        push: Home Screen install, push received, Shortcut import with
                        key, automation runs on app open, counted steps match Health.

A4. CI/CD (GitHub Actions)

Workflow    Trigger                   Steps
ci.yml
            Every push and pull       Install → lint → typecheck → unit tests → start local Supabase →
            request                   test:db → test:functions → sim (9 players, 31 days, ET + PT) → e2e →
                                      build. Failures block merging.
deploy.yml  Push to main →
smoke.yml   staging. Tag v*.*.*       Apply migrations (supabase db push) → deploy functions →
backup.yml  → production.             deploy web app to Cloudflare Pages → smoke test that environment.
                                      A failed smoke test alerts you. See A12.
            Every 3 hours, and on
            demand                    Smoke tests against staging and production. Also keeps both free
                                      Supabase projects from pausing.
            Nightly at 3:30 AM ET;
            restore drill on the 1st  Database dump → encrypt with age → commit to the private backups
                                      repo. Monthly: restore-drill.

main is protected and CI must pass before merging. Private repos have a monthly limit on free Actions minutes. If you run
short, make the code repo public (Actions are free for public repos). The backups repo always stays private.

A5. /sync API contract

POST https://<project>.supabase.co/functions/v1/sync
Authorization: Bearer <sync key>

Content-Type: application/json

{

   "v": 1,

   "kind": "samples",

   "sent_at": "2027-01-10T21:14:03-05:00",

   "device_tz": "America/New_York",

   "shortcut_version": "1.0",

   "metrics": {

      "steps":   [{ "s": "2027-01-10T08:01:00-05:00", "e": "2027-01-10T08:09:30-05:00",

"n": 912, "src": "Jay's Apple Watch" }],

      "flights": [{ "s": "...", "e": "...", "n": 2, "src": "Jay's iPhone" }],

      "distance_m": [{ "s": "...", "e": "...", "n": 640.5, "src": "Jay's Apple Watch" }]

   }

}

// Fallback, kind "hours": items look like { "h": "2027-01-10T08:00:00-05:00", "n": 1520,

"src": "..." }

200 OK                                                                        "status":  "live" },
{ "ok": true, "home_tz": "America/New_York",                                  "status":  "finalizing"

   "ignored": { "locked_days": 0, "outside_window": 0, "manual": 0 },
   "days": [ { "date": "2027-01-10", "steps": 10431, "points": 124.32,

                     { "date": "2027-01-09", "steps": 8547, "points": 85.47,
} ] }

Status      Meaning
401         Unknown or rotated sync key.
413         Body over 1 MB or more than 5,000 samples per metric.
422         Malformed payload. The message names the field.
426         Shortcut too old. The message includes the link to the new version.
429         More than one sync per 30 seconds.
200 +       Samples older than 48 hours, for locked days, or from the Health app source (manual entries) are
ignored     counted in ignored and dropped.

A6. Other endpoints

All require a signed-in user unless noted. Reads go straight to Postgres views under row-level security. Live
updates use Realtime on games, daily_stats and crew_games.

Endpoint                             Does
                                     Join the crew.
POST /api/crew/join {invite_code}    Join next season with a home zone (open only during sign-ups).

POST /api/season/signup
{season_id, home_tz}

Endpoint                            Does
POST /api/season/leave              Before start: withdraw. After start: become Inactive.
                                    Vote "void" or "stand" on a flagged day (other active players only).
POST /api/review/vote {day_id,
vote}                               Explain your own flagged day (max 140 characters).
POST /api/day/note {day_id, text}   Push to a crew member (one per pair per day).
POST /api/nudge {to}                Reaction or trash talk on a game (max 140 characters).

POST /api/react {game_id, emoji or  Save this device's Web Push subscription.
text}
POST /api/push/subscribe            Issue a new sync key. The old one stops working.
{subscription}                      Commissioner, before the season starts only.
POST /api/sync-key/rotate           Commissioner, any time. Written to the audit log.

POST /api/admin/settings            Deletes the account and Health totals.
                                    Cron only. Requires the CRON_SECRET header.
POST /api/admin/remove-player,
/cancel-season

POST /api/account/delete

POST /jobs/tick, /jobs/season,
/jobs/invariants

A7. State machines

Object         States

Season         draft → signup → scheduled → live → rest → playoffs → final. Can become cancelled from
               any state before final.

Player day     live → finalizing (after local midnight) → locked (local noon) → review (if flagged, 24 hours)
               → locked or voided

Game           scheduled → live → finalizing → final, or finalizing → review → final

Season player  active → inactive

Every transition happens only inside a server function and is written to audit_log.

A8. Clock and jobs

     All server time checks call app_now() in SQL and clock.now() in TypeScript. In test mode these return
     a fake time that tests move forward, which is how a whole month runs in seconds. A migration test
     checks that test mode is off in production.
     Jobs are idempotent and work on a catch-up basis: each run processes everything that's due. A missed
     or doubled run never loses or repeats work.

A9. Security: secrets and access

Secret                              Stored in                              Used by
                                                                           App
Supabase URL and anon key           Web app build (public by design)       Functions, CI, smoke

Service role key                    Supabase function secrets, GitHub      Push
                                    secret
                                                                           Cron → jobs
VAPID private key                   Supabase function secrets (public key  Deploy, backup
CRON_SECRET                         in app)
                                                                           Backups / restore
                                    Function secrets and Supabase Vault
                                                                           Smoke, deploy
Supabase access token, DB           GitHub secrets
password

age public key / private key        GitHub secret / your password
                                    manager only

Smoke sync key, Cloudflare token    GitHub secrets

Row-level security: members read only their own crew. Clients can never write Health totals, scores, results
or standings. source_hours and sync_keys have no client access. Hidden modifiers are readable only
through a view that returns revealed rows. Users can edit only their own profile, reactions, comments and
push subscriptions.

A10. Shortcut spec ("Toe to Toe Sync" v1)

  1. Import question: the sync key (Text).
  2. Start = start of yesterday, phone time.
  3. For Steps, Flights Climbed and Walking + Running Distance: Find Health Samples where Start Date is

     after Start, sorted by Start Date. Drop samples whose Source is Health (manual entries).
  4. Repeat with each sample: build {s, e, n, src} with ISO 8601 dates including the offset. Add it to a

     list.
  5. Build the body (A5), then Get Contents of URL: POST to /functions/v1/sync with the key header.
  6. If the status isn't 200, show a notification with the error. Otherwise stay silent.

The payload carries a version number. The server answers 426 to outdated Shortcuts with an update link. If step 4 is too
slow on Watch-heavy days, v1.1 groups samples by hour per source and sends kind "hours".

A11. Complete dependency list

Use the current stable version of everything on setup day and pin exact versions in the lockfile.
Dependabot (built into GitHub, free) opens monthly update PRs, and CI must pass before merging. Nothing
else gets added without a reason written in the PR.

Area               Package or tool                  Purpose

Web runtime        react, react-dom, react-router   UI and routing

Area             Package or tool                               Purpose
                                                               Server state, caching, refetch
Web build        @tanstack/react-query                         Auth, queries, Realtime
Engine                                                         Time zones; validation (shared with engine)
Edge Functions   @supabase/supabase-js                         Charts; Journey map (OpenFreeMap tiles)
(Deno)                                                         Icons; celebrations; class names
Database         luxon, zod                                    Build, installable app, service worker, styling
Testing                                                        Pure rules library
                 recharts, maplibre-gl                         Sync, API, jobs, push
Tooling
Services (free)  lucide-react, canvas-confetti, clsx           Jobs, HTTP from cron, hashing, secrets,
                                                               avatars
                 vite, @vitejs/plugin-react, vite-plugin-pwa   Every layer in A3
                 (Workbox), tailwindcss, typescript
                                                               Quality gates, scripts, icons, backups
                 luxon, zod (no other runtime deps)
                                                               Hosting and infrastructure
                 @supabase/supabase-js (npm specifier),
                 zod, luxon, a Deno-compatible Web Push
                 library (for example @negrel/webpush on
                 JSR)

                 Postgres extensions pg_cron, pg_net,
                 pgcrypto; Supabase Vault, Storage,
                 Realtime, Auth

                 vitest, @vitest/coverage-v8, fast-check,
                 @testing-library/react, @testing-
                 library/user-event, happy-dom,
                 @playwright/test, pgTAP (supabase test
                 db), Deno test

                 pnpm, eslint, typescript-eslint, eslint-
                 plugin-react-hooks, prettier, lefthook, tsx,
                 Supabase CLI, pwa-asset-generator, GitHub
                 CLI, age

                 Supabase (2 projects), Cloudflare Pages,
                 GitHub + Actions + Dependabot,
                 OpenFreeMap, Apple Shortcuts, iCloud link
                 sharing

A12. Environments and release flow

Env              Where                            Data             Deploys on     Fake clock
Local            supabase start (Docker) + Vite   seed.sql         —              Allowed
                                                  Seed + fixtures  —              Allowed
CI               GitHub Actions, temporary local
Staging          stack                            Your test crew   Every push to  Allowed (for
                                                                   main           sims)
                 Supabase t2t-staging +
                 Cloudflare Pages preview

Env         Where                      Data           Deploys on      Fake clock
Production                             The real crew  Git tag v*.*.*
            Supabase t2t-prod + Pages                                 Off, enforced by
            production                                                a test

Release flow: branch → pull request → CI green → merge → staging deploy + smoke → quick check on
your phone → tag vX.Y.Z → production deploy + smoke. To roll back, re-tag the previous version.
Migrations are written to be backward compatible, so the old app keeps working during a deploy.

Appendix B. Design system and app layout

B1. Brand and voice

     Personality: scoreboard energy. Sporty, quick, a little trash-talky, never mean. It should feel like a
     sports app built for your group chat.
     Voice: second person, short sentences, exact numbers ("You're down 6.40. 640 steps flips it.").
     Celebrate effort and never shame anyone about bodies, health or low days. Penalties are stated
     neutrally ("Under 5K: −5.00").
     Name and logo: "Toe to Toe". The mark is two sneaker soles facing each other, toe to toe, on a Volt
     background.

B2. Color tokens

Dark is the hero theme. Light follows the system setting. Components only use tokens. Text on Volt is
always near-black.

Token             Dark          Light          Use
bg                   #0A0D12                   App background
surface              #131922       #F6F7F9     Cards
surface-2            #1B2330                   Inputs, secondary buttons, rows
border               #263142       #FFFFFF     Dividers, outlines
text / text-2        #F3F6F9 /                 Primary / secondary text
accent (Volt)                      #EEF1F5
                  #A3AFBD                      Primary buttons, 10K ring, active tab, route line
you / opponent       #C8F31D       #DCE2EA
win / loss / tie                               Your bars and score, opponent's bars and score
                     #4DA3FF /     #0A0D12 /
warn / modifier      #FF6B5E    #566273        Results (always paired with a W/L/T letter, never color
                     #2FD07A /                 alone)
                     #FF5C5C /     #C8F31D
                  #A3AFBD       fill, #5E7F00  Sync warnings, Finalizing / modifiers, reviews
                     #FFB020 /  text
                     #B794FF
                                #1F6FEB /
                                #E5483B

                                #12945A /
                                #D93636 /
                                #566273

                                #B26A00 /
                                #7B4FE0

Player colors (avatars and charts, assigned at crew join, 10 options): #4DA3FF, #FF6B5E, #2FD07A, #FFB020, #B794FF,
#FF7AC6, #3DD6D0, #F2C94C, #9BE564, #FF9F45. All meet 3:1 contrast against dark surfaces.

B3. Typography, spacing and shape

Style     Size / line              Use
Score
          44 / 48, bold,           Big matchup scores. ui-rounded (SF Pro Rounded) with tabular
          rounded                  numbers.

Title     28 / 34 bold             Screen titles (large title that collapses on scroll)

Headline  20 / 25 semibold         Card titles

Body      17 / 22                  Default text (iOS default size)

Callout   15 / 20                  Rows, secondary content

Footnote  13 / 18                  Meta ("Synced 4 min ago")

Caption   11 / 13 semibold, Labels ("TODAY'S GAME")
          uppercase, +0.06em

Font: system stack (-apple-system, which is SF Pro on iPhone). The base uses font: -apple-
system-body so Dynamic Type scales the whole app. All numbers use tabular figures so scores don't
jiggle.
Spacing: 4-pt grid (4, 8, 12, 16, 20, 24, 32, 40). Screen side padding 16. Card padding 16. Gap between
cards 12.

Shape: radius 8 (chips), 14 (cards, buttons), 22 (sheets), full (pills, avatars).
Elevation: dark mode separates layers with surface colors and no shadows. Light mode uses one soft
shadow (0 1 2 / 6% and 0 4 12 / 6%).
Motion: 200 ms ease-out for state changes. Scores count up on update. Confetti only for wins and
titles. Everything is turned off under prefers-reduced-motion.
Icons: Lucide, 22 pt in tabs, 18 pt inline, 2 pt stroke.

B4. Layout and navigation

     Frame: full-screen Home Screen app. Respect env(safe-area-inset-*) on all four sides. Content
     max width 480 pt, centered on bigger screens.
     Top bar (44 pt): large title on the left (collapses to inline on scroll), avatar button (32 pt) on the right
     that opens Profile. Fantasy adds a gear icon for the commissioner.
     Bottom tab bar (49 pt + safe area): Home (house), Fantasy (swords), Challenges (flag), Journey (map),
     Crew (users). Active tab uses Volt, inactive uses text-2. A red dot badge marks open reviews or invites.
     Patterns: detail screens push from the right. Explainers and quick actions open as bottom sheets. Pull
     to refresh on every list (and offers "Sync now"). Toasts sit above the tab bar.
     Global states: skeletons while loading, an empty state with one action, an error with "Try again", and
     an offline banner ("Offline: showing 9:41 AM data") backed by cached data.

B5. Components

Component          Spec and states

Button             Height 50, radius 14. Primary: Volt fill, near-black text. Secondary: surface-2. Destructive:
                   loss-colored text. Loading spinner, disabled at 40% opacity. Minimum 44 × 44 tap target.

Card               surface, radius 14, padding 16. Optional caption label, title, trailing action.

ProgressRing       10K ring, 10 pt stroke, Volt on surface-2. Steps in the center (Score style), "steps" below.
                   Over 10K the ring is full and shows "+2,638".

ScoreCard          Two avatars, names, big scores in you/opponent colors, margin bar, StatusPill, helper line
(matchup)          ("640 steps to take the lead"). Bye variant. Forfeit variant.

StatusPill         Live (pulsing win-colored dot), Finalizing (warn), Final (text-2), Review (modifier color), Bye,
                   Rest.

SyncChip           "Synced 4 min ago". Green under 3 h, amber 3–12 h, red over 12 h or never. Tap opens
                   Sync health.

Avatar             Emoji, photo or initials on the player color. Sizes 24 / 32 / 48 / 72. A "Former player"
                   variant is grey.

LeaderboardRow /   Rank, avatar, name, value(s). Your row is highlighted with a surface-2 background and Volt
StandingsRow       left edge. StandingsRow adds W-L-T, Win % and PF, plus a dashed "Playoff line".

ModifierBadge      Modifier color, sparkle icon, name, one-line effect. Tap opens an explainer sheet.

GameDots           Best-of-3 series: filled dot per win, outlined for remaining.

HourBars           Hourly steps for both players side by side (you vs opponent colors), with a modifier

ReactionBar /      window shaded.
TrashTalk
                   Fixed emoji set (🔥 😤 👀 💀 👏 🐢) with counts. One-line comments, 140 characters

                   max.

SegmentedControl,  Standard iOS-like behavior. Sheets have a grab handle and can be dragged down.
Sheet, Toast,
Skeleton,
EmptyState

B6. App icon and splash

The icon is a Volt (#C8F31D) rounded square with two near-black sneaker soles meeting toe to toe in the
center. It's simple and geometric, and still readable at 29 pt. The splash screen is the bg color with the icon
centered. One SVG source (apps/web/brand/icon.svg) generates every size through scripts/gen-
icons.

                                    Starting concept at 3 sizes. Final polish in P7.1.

B7. Screen specs

Screen            Layout, top to bottom

Onboarding (9     1 Welcome (icon, "Daily step battles with your crew", Get started) → 2 Install gate (if not
steps)            opened from the Home Screen: Share → Add to Home Screen illustration, stops here) → 3
                  Sign in (email, then 6-digit code with auto-advance, resend after 30 s) → 4 Profile (name,
                  username, avatar, home zone) → 5 Join crew (code or invite link → crew preview → Join) → 6
                  Notifications (why, then Allow) → 7 Sync setup (copy key, get Shortcut, run once; status
                  changes from "Waiting for your first sync…" to "Got it: 4,231 steps") → 8 Automations
                  (illustrated steps, "I set it up" or "Later") → 9 Verify ("Does Health say about 4,231?" Yes / No
                  → help). Progress dots at top. Every step is resumable.

Home              Title "Today" + date. Hero card: ProgressRing, points, "X to 10K", SyncChip, Sync now. Matchup
                  ScoreCard (or Bye card: "Bye today. You still play the Crew Game."). Crew Game card ("3rd of
                  9: on pace for a Crew win"). ModifierBadge (today or tomorrow once revealed). Leaderboard
                  top 5 + your row, "See all". Active challenges (horizontal cards). Journey strip (progress bar,
                  next city).

Fantasy           Scrolling chips: Matchup · Schedule · Standings · Bracket · Stats · History · Reviews (badge).
                  Gear icon for the commissioner.
                  Matchup: today's ScoreCard, Crew Game rank, this season's results (W/L/T chip, opponent,
                  scores).
                  Schedule: month list by day: opponent or Bye, result; rest and playoff days shaded; today
                  pinned.
                  Standings: Seed, player, H2H, Crew, Win %, PF; dashed playoff line; tap a player for their
                  season.
                  Bracket: semis → final columns, GameDots, live game highlighted, champion banner. Before
                  seeding: "Projected" label.
                  Stats: daily score line, steps per day bars, "When you walk" hourly heatmap, season highs.
                  History: past seasons → archive (standings, schedule, bracket, champion, audit log).
                  Reviews: flagged days with the player's note, Void / Stand buttons, time left.

Game detail       Header: both avatars, scores, StatusPill, both SyncChips. HourBars. Breakdown table per player
                  (steps, cap, bonus, penalties, modifier, flights, total). Crew Game rank for the day. ReactionBar
                  and trash talk. "Updated 4 min ago".

Challenges        Segmented Active / Upcoming / Completed. Cards with type icon, players, days left, your rank.
                  "+" button for the create flow: type → players → duration → scoring → review. Detail:
                  standings, daily chart, crowns (King of the Hill).

Journey           Map (top 55%): route line in Volt, crew marker, city dots, passed cities filled. Bottom sheet:
                  period segmented control, "1,042 of 1,280 mi", progress bar, "Next: Jacksonville in 38 mi",
                  contribution bars by player, milestone cards.

Crew              Members grid (avatar, today's steps, season record). Member profile: career stats, head-to-
                  head vs you, trophies. Record book. Trophy room. Invite (share link and code).

Profile (avatar)  Header with avatar and name. Career stats. Home zone (editable between seasons). Sync
                  health (status, last sync, sources, rotate key, re-run setup). Notifications (toggle per type).
                  Appearance (System / Light / Dark). Privacy. Sign out. Delete account (typed confirmation).

Screen             Layout, top to bottom
Commissioner
(gear)             Before lock: scoring values, flights toggle, modifiers master and per modifier, frequency, Crew
                   Game toggle, short-season start, invites and removals. After lock: read-only summary plus
Admin (/admin,     Remove player and Cancel season, both with typed confirmation and audit log.
Jay only)
                   Sync table (player, last sync, today's steps, sources, errors). Cron history. Invariant runs. Push
                   failures. DB size. Open reviews. Environment banner (STAGING in amber).

B8. Accessibility

     WCAG 2.1 AA contrast for all text. Volt is never used for text on light backgrounds (use #5E7F00).
     Tap targets at least 44 × 44 pt. Dynamic Type supported up to the largest accessibility size without
     clipping (scores scale down to fit).
     VoiceOver labels: ProgressRing reads "8,431 steps, 84 percent of 10,000". ScoreCard reads "Live. You
     84.32, Priya 79.10. You lead by 5.22."
     Results always pair color with text (W / L / T). Charts include a text summary.
     Respect prefers-reduced-motion and prefers-contrast.

B9. Copy and notification text

Notification             Example text

Today's matchup (8 AM) Game day: you vs Priya. She's 6–2 this month. Lace up.

Modifier revealed (8 PM) Tomorrow is Early Bird: steps before 9 AM count 1.5×.

Opponent took the lead Priya just took the lead, 84.32 to 79.10.

Within 500 of 10K        412 steps to 10K. One lap around the block.

Close game (10 PM)       2 hours left and you're down 6.40. 640 steps flips it.

Sync reminder (11:30 PM) Day's almost done. Open one of your sync apps to lock in today's steps.

Unsynced (9 AM)          Yesterday isn't in yet. Open one of your sync apps before noon.

Final                    Final: you beat Priya 131.38 to 118.02. You're 7–3.

Review opened            Sam's Tuesday (41,882 steps) is up for review. Vote by noon Thursday.

Clinched / eliminated    You clinched a playoff spot. / Playoffs are out of reach. The Consolation Race starts
                         Jan 26.
Nudge
Challenge won / Journey  Jay nudged you: 800 steps from 10K 👀
milestone
                         You won the 3-day Race with 412.55. / The crew just reached Savannah, GA. 412 mi
                         to Miami.

Empty states: "Nobody has synced yet today. Be first." · "No games today: rest day. Playoffs start tomorrow." · "No
challenges yet. Start a 3-day Race?"

B10. Mockups

Dark theme, iPhone proportions, sample data. These set the direction for P1.1–P5.3, not pixel-perfect specs.

 9:41                                    ●●● ▮   9:41                                ●●● ▮      9:41                              ●●● ▮

Today                                     J     ‹ Fantasy                             ● LIVE   Fantasy                               J

Tue, Jan 12        84.32 pts                    Jay vs Priya                                    Matchup Schedule     Standings Bracket

    8,431          1,569 to 10K                     JayJ 84.32 79.10 Priya P                   # PLAYER     H2H CREW WIN% PF
                     ● Synced 4 min ago                                                        1 Sam       9-2 8-3 .773 1,204
            steps    Sync now                      ● 4m ago                       ● 2h ago     2 Priya     8-3 8-3 .727 1,151
                                                                                               3 Jay       7-4 7-4 .636 1,098
                                                STEPS BY HOUR                                  4 Maya      6-5 7-4 .591 1,077

TODAY'S GAME                      ● LIVE                                                       5 Dev     PLAYOFF LINE
                                                                                               6 Nisha
JayJ 84.32 79.10 Priya P                        6a           12p         6p          10p       7 Rohan     6-5 5-6 .500 1,020
                                                                                               8 Kiran     5-5 5-6 .476 1,002
Up 5.22 · Priya has 3 more hours (Vancouver)    BREAKDOWN                                      9 Ankit     4-6 4-7 .381 951
                                                                                                           3-8 3-8 .273 903
                                                 Steps 8,431 / 7,910                                       2-8 2-9 .190 880
                                                 10K bonus
CREW GAME                                        Penalties                   84.32 · 79.10     Win % counts H2H and Crew Games · 13 regular-
                                                                                    — · —                       season days left
3rd of 9: on pace for a win W                    Total                              — · —

✦ Tomorrow: Early Bird, steps before 9 AM                                    84.32 · 79.10
×1.5

LEADERBOARD                                     🔥 😤 👀 3 1 2

1 Sam                             11,204        Priya west coast stays up late 😤
2 Priya                           9,880
                                   8,431        Sam Jay walking to Vancouver rn
 3 Jay

   ⌂      ⚔              ⚑     ◉           ☷    ⌂   ⚔                 ⚑           ◉         ☷  ⌂  ⚔               ⚑  ◉  ☷

Home  Fantasy      Challenges  Journey Crew     Home Fantasy Challenges Journey Crew           Home Fantasy Challenges Journey Crew

                   Home                                      Game detail                                 Standings

 9:41                                  ●●● ▮      9:41                         ●●● ▮               9:41                                ●●● ▮

Fantasy                                    J      Step 7 of 9                                                                          NYC

 Schedule Standings     Bracket        Stats      Sync setup

SEMIFINALS · JAN 26–28                 ● ● ○      Toe to Toe reads your steps through a Shortcut.                        Savannah
                                       ● ○ ○      It takes two minutes, once.
 1 Sam
  4 Jay                                              ✓ Copy your sync key

 Sam wins 2–1                                                  t2t_••••••••8F2K

2 Priya                                ● ● ○      ✓ Get the Shortcut                                                            Miami
                                       ○ ○ ○           Paste the key when it asks
3 Maya
Priya wins 2–0 · Game 3 not played                3 Run it once
                                                       Allow Health access for steps, flights
FINAL · JAN 29–31                                      and distance
                                                          Open Shortcuts
   ● GAME 1 LIVE
                                       102.40                                                         Week     Month     Year          All
 1 Sam                                   9 7.1 5
 2 Priya                                          ✓ Got it: 4,231 steps today                      1,042 of 1,280 mi                       182
                                                                     Continue                                                              160
   🏆 Champion crowned when Game 3                                                                  Next: Jacksonville in 38 mi              151
                                                                                                                                            141
                    locks                                                                          CONTRIBUTION THIS MONTH
             (or Game 2 if it's 2–0)                                                               Sam
                                                                                                   Priya
                                                                                                   Jay
                                                                                                   Maya

⌂  ⚔               ⚑                ◉  ☷                                                           ⌂        ⚔         ⚑         ◉           ☷

Home Fantasy Challenges Journey Crew                                                               Home Fantasy Challenges Journey Crew

                   Bracket                              Onboarding · Sync setup                                Journey

Appendix C. Claude Code playbook

These are also delivered as separate files in the starter kit: CLAUDE.md goes at the repo root and
PROMPTS.md goes in docs/. Copy prompts from the files, not from this PDF.

C1. CLAUDE.md (repo root)

Private step-competition app for one friend crew (8–10 people, all iPhone). Apple Health steps become
Fantasy points. Monthly seasons with daily head-to-head games plus a daily Crew Game, challenges and a
shared Journey map.

The rules are law. The full product rules, data model, APIs and test plan are in docs/PLAN.md (with the
same content in docs/Toe_to_Toe_Plan.pdf). Never invent or change a game rule. If a rule is unclear or
seems wrong, stop and ask Jay. The design system and screen mockups are in docs/PLAN.md Appendix B.
The mockups are drawings, so read those pages of the PDF before building UI.

Stack
     apps/web: React + TypeScript + Vite, installable Home Screen web app (vite-plugin-pwa), Tailwind,
     React Router, TanStack Query, Recharts, MapLibre GL, Lucide icons.
     packages/engine: pure TypeScript with zero I/O: scoring, Crew Game, standings, tiebreakers,
     scheduler, de-duplication, time zones, clock. Shared by the web app and Edge Functions.
     supabase/: Postgres (migrations, RLS, views, pg_cron + pg_net), Edge Functions (Deno), pgTAP tests,
     seed.
     Health data arrives from the "Toe to Toe Sync" Apple Shortcut via POST /functions/v1/sync.
     Hosting: Cloudflare Pages. CI/CD: GitHub Actions. Everything is free tier.

Golden rules (never break these)
  1. Scores are integers in hundredths. 108.43 is stored as 10843. Never use floats for points. Round half
     up once per day, only where docs/PLAN.md says to.
  2. Time comes from the clock. Call clock.now() (TS) or app_now() (SQL). Never call Date.now(), new
     Date() without arguments, or now() directly in game logic.
  3. Time zones are IANA names (America/New_York, America/Halifax, America/Vancouver). A player's
     game day is midnight to midnight in their season home zone. Use Luxon in TS and AT TIME ZONE in
     SQL. Never do hand math with UTC offsets.
  4. The engine is pure. No network, database, process.env or clock reads inside packages/engine. Pass
     everything in.
  5. Clients never write results. Health totals, scores, games, standings and reviews are written only by
     Edge Functions using the service role. RLS must deny everything else.
  6. Tests first. For any rule or bug, write a failing test, then make it pass. Every rule in docs/PLAN.md §5
     has a test in packages/engine.
  7. Migrations are append-only. Never edit a merged migration. Add a new one.

 8. Jobs are idempotent and catch-up based. Each run processes everything that's due. Running twice
    changes nothing.

 9. No new dependencies without asking Jay first. No paid services. No analytics or tracking SDKs.
10. No secrets in code. Use .env.local (gitignored), Supabase function secrets and GitHub secrets.

Commands                                        Use
                                                Local Supabase + web app
 Command                                        Rebuild local DB from migrations + seed
  pnpm dev                                      Vitest unit tests
  pnpm db:reset                                 pgTAP database tests
  pnpm test / pnpm test:engine                  Deno tests for Edge Functions
  pnpm test:db                                  Full fake-clock season through the real stack
  pnpm test:functions
  pnpm sim --players 9 --month 2027-01 --zones  Playwright (WebKit, iPhone 15 viewport)
  ET,AT --seed 42                               Smoke tests against a deployed environment
  pnpm e2e                                      lint + typecheck + test + test:db +
  pnpm smoke --env staging\|prod                test:functions (pre-push)
  pnpm check                                    Regenerate DB types after a migration

  pnpm gen:types

Definition of done (every task)
     pnpm check passes locally. If you touched game flow, pnpm sim and pnpm e2e pass too.
     New behavior has tests. Bug fixes include a regression test.
     No TODO left without an issue reference. No skipped tests.
     pnpm gen:types was run if the schema changed.
     Short summary given: what changed, which tests prove it, anything not done.

Conventions
     TypeScript strict. No any. Validate inputs with Zod, using shared schemas from
     packages/engine/schemas.
     File names in kebab-case. React components in PascalCase. One component per file.
     Points in UI always show two decimals (formatPoints(10843) returns "108.43").
     UI follows docs/PLAN.md Appendix B (tokens, components, screen specs). Use design tokens, never
     raw hex values in components.
     Accessibility: tap targets 44pt or larger, VoiceOver labels on scores and rings, respect prefers-
     reduced-motion.

Commits follow Conventional Commits (feat:, fix:, test:, chore:). After each checkpoint passes,
Jay tags it (cp-1.3).

Repo map

apps/web/             React web app                                        push
packages/engine/      pure rules engine + schemas + clock                  + smoke
supabase/migrations/  SQL (append-only)
                      sync, api, jobs-tick, jobs-season, jobs-invariants,  gen-icons
supabase/functions/   pgTAP
supabase/tests/       local crew (9 players, ET/AT/PT, half with Watches)

supabase/seed.sql     Playwright
crew                  step-sample fixtures
tests/e2e/            sim, smoke, sync-report, restore-drill, gen-routes,
                      Journey GeoJSON
tests/fixtures/       Shortcut build guide + version
scripts/              PLAN.md, PROMPTS.md, Toe_to_Toe_Plan.pdf

routes/
shortcut/
docs/

C2. Build prompts and checkpoints

Every prompt to build Toe to Toe, in order. After each prompt there's a checkpoint: the exact commands to
run and what you should see before moving on. Rules referenced as §x and Appendix x are in
docs/PLAN.md.

How to run this playbook

  1. One prompt per session. Start each prompt with /clear so Claude Code begins with a clean context.
     It reads CLAUDE.md automatically.

  2. Plan first on big prompts. Prompts marked [PLAN] go in plan mode (Shift+Tab until "plan mode"
     shows). Read the plan, push back if it drifts from docs/PLAN.md, then approve.

  3. Paste the prompt exactly. Fill in anything in <angle brackets>.

  4. Run the checkpoint yourself. Don't take "done" on faith. Run the commands and compare against
     "You should see".

  5. If a checkpoint fails, paste the failing output back with: "Fix this. Don't change or delete tests unless
     the test contradicts docs/PLAN.md. If it does, tell me which rule and stop."

  6. When it passes: git add -A && git commit -m "<prompt id>: <summary>" && git tag cp-

      <id> && git push --follow-tags

  7. To roll back: git reset --hard cp-<previous id>.
  8. Never let Claude edit a test just to make it pass. Tests encode the rules.
  9. If Claude asks a rules question, answer from docs/PLAN.md. If the plan doesn't cover it, decide, then

     add the decision to docs/PLAN.md §19 so it's written down.

Phase −1 — Setup (manual, about 1 hour)

Install: Node (current LTS), pnpm (corepack enable), Docker Desktop, Supabase CLI, GitHub CLI (gh),
Claude Code, age (brew install age or your OS's package manager). Any OS works. No Mac required.

Accounts (all free):
     GitHub: private repos toe-to-toe (code) and toe-to-toe-backups (encrypted backups).
     Supabase: two projects, t2t-staging and t2t-prod (the free plan allows 2 active projects).
     Cloudflare: Pages project connected to toe-to-toe (the build is configured in P1.7).

Repo starter files:

CLAUDE.md                 (from  the starter  kit)
                                              kit)
docs/PLAN.md              (from  the starter
docs/PROMPTS.md           (this  file)        kit)
docs/Toe_to_Toe_Plan.pdf  (from  the starter

Backup key: age-keygen -o t2t-backup.key. Put the private key in your password manager and delete
the file. Keep the public key (age1...) for P1.7.

Checkpoint −1: node -v, pnpm -v, docker info, supabase -v, gh auth status and claude --version
all work. Tag cp--1.

Phase 0 — Sync proof (target Nov 30 – Dec 7)

P0.1 Scaffold the monorepo and CI [PLAN]

  Read CLAUDE.md and docs/PLAN.md Appendix A1, A2, A4 and A11.
  Scaffold the monorepo exactly as Appendix A1 describes, using pnpm workspaces:
  - apps/web: React + TypeScript + Vite app that renders "Toe to Toe" (no features
  yet).
  - packages/engine: TypeScript library with Vitest configured, plus one trivial
  passing test.
  - supabase/: run `supabase init`. Enable pg_cron, pg_net and pgcrypto in the first
  migration. Add a pgTAP test that checks those extensions exist.
  - supabase/functions/health: Deno function that returns {ok:true, version}. Add one
  Deno test.
  - Root scripts from Appendix A2. Scripts whose features don't exist yet print "not
  implemented" and exit 0, except `check`, which must really run lint, typecheck,
  test, test:db and test:functions.
  - ESLint (typescript-eslint, strict), Prettier, and lefthook running `pnpm check` on
  pre-push.
  - .github/workflows/ci.yml per Appendix A4. Lint, typecheck, unit, start Supabase,
  db tests and function tests are real. sim and e2e are placeholders that pass.
  - .gitignore, .env.example (keys listed in Appendix A9, no values), README with
  setup steps.
  Use the current stable version of each tool and pin exact versions. Don't add any
  dependency that isn't listed in Appendix A11.

Checkpoint P0.1
     Run: pnpm install && pnpm check, then git push and watch Actions.
     You should see: check green locally, CI green on GitHub, pnpm dev showing "Toe to Toe" in the
     browser.
     Tag cp-0.1.

P0.2 Clock and time-zone module

  Read CLAUDE.md golden rules 2 and 3, and docs/PLAN.md §4 and Appendix A8.
  In packages/engine create:
  - clock.ts: a Clock interface with now(), a systemClock, and a FakeClock with
  set(iso) and advance(duration).
  - time.ts, built on Luxon:

      - localDateOf(instant, tz)
      - dayWindow(localDate, tz) → [startUtc, endUtc)
      - lockInstant(localDate, tz) → noon the next local day
      - isLocked(localDate, tz, now)
      - splitIntervalByLocalDay(startUtc, endUtc, tz) for intervals that cross midnight
      - minutesOf(interval)
  Write tests FIRST (Appendix A3 layer 3): New York, Halifax, Vancouver and Kolkata
  boundaries. The 2027 spring-forward day (23 h) and fall-back day (25 h). The lock-
  time examples table in §4. Travel (the phone's zone differs from the home zone, and
  the home zone always wins).
  In the first SQL migration that needs it, add app_now(): it returns now() unless
  test mode is on in an app_config table. Add a pgTAP test that test mode defaults to
  off.

Checkpoint P0.2

     Run: pnpm test:engine && pnpm test:db

     You should see: every §4 example reproduced in the test output. DST tests asserting 23 and 25 hours.
     app_now() test passing.

     Tag cp-0.2.

P0.3 Sync schema and security

  Read docs/PLAN.md §13 and Appendix A9.
  Create migrations for: users (linked to auth.users), crews, crew_members, sync_keys
  (key_hash only), source_hours, hours, daily_stats, audit_log. Use exactly the fields
  in §13; daily_stats.status is an enum (live, finalizing, locked, review, voided).
  RLS: users see only rows for members of their own crews. No client may insert,
  update or delete source_hours, hours, daily_stats or audit_log. sync_keys.key_hash
  is never selectable by clients.
  pgTAP tests FIRST (Appendix A3 layer 5): two crews, three users. Prove each policy
  allows the right reads and denies the wrong ones, and that clients can't write any
  of those tables.
  Update supabase/seed.sql: crew "Local Crew" with 9 users (zones: 7 New York, 1
  Halifax, 1 Vancouver; 4 marked as Watch wearers in a dev-only note column), plus a
  separate "Smoke Crew" with 1 user.
  Run pnpm gen:types.

Checkpoint P0.3

     Run: pnpm db:reset && pnpm test:db

     You should see: every policy test green, including at least one "denied" test per table. The seed loads
     10 users.

     Tag cp-0.3.

P0.4 De-duplication engine and fixtures

  Read docs/PLAN.md §12.2 and Appendix A3 layer 4.
  In packages/engine create dedup.ts:
  - Input: samples {s, e, n, src} per metric (steps, flights, distance_m), plus the
  user's home zone.
  - Spread each sample's count evenly across the UTC minutes it covers, using integer
  math. Hand leftover units to the earliest minutes so totals stay exact.
  - For each minute, keep the source with the largest count. Ties break by source
  name.
  - Output per-source hourly totals and de-duplicated hourly totals (UTC hours). Add a
  helper that sums de-duplicated hours into home-zone daily totals using time.ts.
  - Drop samples whose src is "Health" (manual entries) and report how many were
  dropped.
  Also support the fallback input kind "hours" ({h, n, src}): keep the largest source
  per hour.
  Create tests/fixtures as JSON with an expected total for each: watch-and-phone-same-
  walk, phone-only, watch-on-charger-midday, third-party-band, manual-entry, crosses-
  midnight, dst-spring-day, kolkata-half-hour, freak-day-40k. Write the tests first.

Checkpoint P0.4

     Run: pnpm test:engine

     You should see: every fixture matching its expected total exactly. Re-running the same input twice
     gives identical output.

     Tag cp-0.4.

P0.5 /sync Edge Function

  Read docs/PLAN.md Appendix A5 and A9.
  Implement supabase/functions/sync:
  - Auth: Bearer sync key → SHA-256 → look up in sync_keys. On success, update
  last_used_at.
  - Validate the body with a Zod schema in packages/engine/schemas. Enforce the limits
  and status codes in Appendix A5 (401, 413, 422, 426, 429, plus 200 with ignored
  counts).
  - Run dedup.ts. Upsert source_hours and hours for that user (idempotent). Recompute
  daily_stats for every affected home-zone date that isn't locked. Ignore data for
  locked dates.
  - Use app_now() / clock for every time check.
  - Response body exactly as in Appendix A5. Points come from a stub until P2.1: steps
  × 1, in hundredths.
  Also add supabase/functions/api with POST /api/sync-key/rotate: returns a new random
  32-byte key once and stores only its hash.
  Deno tests FIRST (Appendix A3 layer 6): good sync, each error code, an identical
  payload sent twice changes nothing, late data for a locked day is ignored, a manual
  entry is ignored.

Checkpoint P0.5

     Run: pnpm test:functions. Then pnpm dev, and with curl, POST tests/fixtures/watch-and-
     phone-same-walk.json to the local /sync using a seeded key.

     You should see: tests green. curl returns 200 with the expected step total. Sending it again returns the
     same numbers.
     Tag cp-0.5.

P0.6 Shortcut build guide (then you build it)

  Read docs/PLAN.md §12 and Appendix A10.
  Write shortcut/BUILD.md: a step-by-step guide for building the "Toe to Toe Sync"
  Shortcut by hand in the iPhone Shortcuts app. Name the exact action for each step,
  every setting to choose, and the import question for the sync key. Explain how to
  point it at staging vs production, and how to share it as an iCloud link.
  Also write shortcut/AUTOMATIONS.md: the friend-facing guide for creating "When <app>
  is opened" automations set to Run Immediately with notifications off.
  Write shortcut/VERSION containing 1.0.
  Write shortcut/VERIFY.md: a 5-minute test that the Shortcut drops manual entries and
  survives the phone being locked partway through.

Manual (you, about 30 min on your iPhone): build the Shortcut from BUILD.md, run it against local or
staging, and confirm it returns 200. Check that "Source is not Health" is really available as a filter. If it isn't,
note it in BUILD.md; the server drops manual entries anyway.

Checkpoint P0.6

     You should see: your real steps arriving in daily_stats (staging), within a few percent of the Health
     app. A manual "Add Data" entry in Health doesn't change the total.
     Tag cp-0.6.

P0.7 Debug page and staging deploy

  Read docs/PLAN.md §16 Phase 0 and Appendix A4.
  In apps/web build a single /debug page (no design work yet):
  - Email one-time-code sign-in with Supabase Auth.
  - "Generate sync key" button (calls /api/sync-key/rotate) that shows the key once
  with a Copy button.
  - Today's and yesterday's counted steps, last sync time and sources (read through
  RLS).
  - "Health says ___ steps" input that saves to a phase0_checks table (user, date,
  health_steps), with RLS limited to the user's own rows.
  Add a deploy-staging GitHub Actions workflow: on push to main, apply migrations to
  t2t-staging, deploy functions, and build the web app to the Cloudflare Pages
  preview/staging URL. Read secrets from GitHub secrets per Appendix A9. List the
  exact secrets I need to create.

Checkpoint P0.7

     Run: create the GitHub secrets Claude listed, then push to main.
     You should see: staging URL loads on your iPhone. You can sign in, get a key, sync with the Shortcut
     and see your steps.
     Tag cp-0.7.

P0.8 Sync report

  Read docs/PLAN.md §16 Phase 0 "Done when" and Appendix A2.
  Implement scripts/sync-report.ts (run with tsx): `pnpm sync-report --env staging --
  days 7`.
  For each tester and day it shows:
  - whether a sync arrived before that day's local noon lock
  - counted vs Health-reported steps (from phase0_checks), with % error
  - sources seen
  Split the summary into Watch wearers vs phone-only.
  Finish with PASS/FAIL against: ≥95% of player-days synced by lock, and ≤2% error on
  ≥90% of days for both groups.
  Use the service role key from .env.local. Never print keys.

Checkpoint P0.8 = Phase 0 exit

     Do: 4 testers (2 Watch, 2 phone-only) install the debug page and Shortcut, set up automations, and
     enter their Health number each morning for 7 days.
     Run: pnpm sync-report --env staging --days 7

     You should see: PASS on both lines. If it fails, apply the §18 fallbacks (more trigger apps, kind "hours",
     or a 6 PM lock) and run another week.
     Tag cp-0.8 / phase-0.

Phase 1 — Foundation (target Dec 8 – 14)

P1.1 App shell, design tokens, install support [PLAN]

  Read docs/PLAN.md Appendix B (all of it) and §8.
  Build the app shell in apps/web:
  - Design tokens from Appendix B1–B3 as CSS variables plus a Tailwind theme (dark and
  light, following the system setting). No raw hex values in components.
  - Layout per Appendix B4: safe-area insets, top bar with the avatar button, bottom
  tab bar (Home, Fantasy, Challenges, Journey, Crew), React Router routes for each tab
  with placeholder screens.
  - Core components from Appendix B5 with all their states: Button, Card, StatusPill,
  SyncChip, ProgressRing, Avatar, SegmentedControl, Sheet, Toast, Skeleton,
  EmptyState. Add a /dev/components page that shows every component in every state.
  - PWA: vite-plugin-pwa manifest (name "Toe to Toe", display standalone, theme colors
  from tokens). Service worker caches the app shell. Offline banner.
  - scripts/gen-icons: generates the app icon and Apple splash images from a single
  SVG (Appendix B6) using pwa-asset-generator.
  Component tests with Vitest + Testing Library for each component's states and
  accessible labels.

Checkpoint P1.1

     Run: pnpm check, then push to staging. On your iPhone: Safari → Share → Add to Home Screen.
     You should see: the Toe to Toe icon on the Home Screen. It opens full screen with no Safari bars, the
     tab bar sits above the home indicator, and dark mode follows the system. /dev/components shows

     every state.

     Tag cp-1.1.

P1.2 Auth, profile and home zone

  Read docs/PLAN.md Appendix B7 (screens 1–3 of onboarding) and §4.
  Implement:
  - Sign-in screen: email → 6-digit code (Supabase OTP). Persist the session. Don't
  use magic links.
  - Profile setup: display name, username (unique), avatar (emoji or photo upload to
  Supabase Storage, max 1 MB, resized on the client), default home zone (preselected
  from the browser's zone, searchable IANA list with friendly names like "Eastern –
  New York").
  - Profile is editable from the avatar menu.
  - E2E (Playwright, WebKit, iPhone 15 viewport): sign in using the code read from the
  local Supabase mail catcher, complete the profile, reload, still signed in.

Checkpoint P1.2

     Run: pnpm check && pnpm e2e
     You should see: the E2E sign-in flow green. On a real iPhone, the code email arrives and sign-in works
     inside the Home Screen app.
     Tag cp-1.2.

P1.3 Crews and invites

Read docs/PLAN.md §2, §5.8 and Appendix A6.                                    member
Implement crews:
- Create crew (the creator becomes commissioner). Max 12 members.
- Invite link /join/<code> and code entry. POST /api/crew/join.
- Crew screen (Appendix B7) listing members with avatars and "last synced".
- Commissioner transfer rule: if the commissioner leaves, the longest-tenured
becomes commissioner. Write it to audit_log.
pgTAP: a non-member can't read crew data, the 13th join is rejected, the
commissioner transfer works.
Function tests for /api/crew/join (bad code, full crew, already a member).

Checkpoint P1.3

     Run: pnpm check && pnpm e2e
     You should see: two test accounts in the same crew can see each other. A third account in another
     crew can't.
     Tag cp-1.3.

P1.4 Onboarding flow, push opt-in, sync setup

  Read docs/PLAN.md Appendix B7 "Onboarding" and §12.1.
  Build the full onboarding flow:
  Welcome → Install (if not in standalone mode, show the Add to Home Screen
  illustration and stop until installed) → Sign in → Profile → Join crew →
  Notifications (ask permission only after a button tap, then save the push
  subscription via /api/push/subscribe) → Sync setup (copy key, "Get the Shortcut"
  iCloud link from env, Run once, automation guide from shortcut/AUTOMATIONS.md) →
  Verify ("We counted X steps today. Does Health say about the same?" Yes / No → help
  sheet) → Done.
  Each step is resumable. Progress is stored per user. Settings → "Sync health" can
  reopen sync setup at any time.
  Push subscription storage only for now (sending comes in P4.1).
  E2E for the whole flow with standalone mode and push permission stubbed.

Checkpoint P1.4

     Do: a friend who has never seen the app goes through onboarding on their own phone while you
     watch without helping.
     You should see: they finish in about 5 minutes, and their steps appear on staging.
     Tag cp-1.4.

P1.5 Home and daily leaderboard

  Read docs/PLAN.md §7.1, §8 Home and Appendix B7 "Home".
  Build the Home tab:
  - 10K ProgressRing with today's counted steps and points (stub scoring until P2.1).
  - SyncChip ("Synced 12 min ago", turning amber after 3 h and red after 12 h), plus a
  "Sync now" button that opens the Shortcut via its shortcuts:// URL.
  - Daily leaderboard: everyone in the crew ranked by their own local today. Filters
  Today / Yesterday / This week / This month.
  - Live updates via Supabase Realtime on daily_stats for the crew.
  - Placeholder slots for matchup, modifier, challenges and Journey cards (filled in
  later phases).
  - Loading skeleton, empty state ("Nobody has synced yet today"), error state,
  offline state.
  Tests: leaderboard ordering and ties, local-today logic for a Vancouver player at 11
  PM Eastern.

Checkpoint P1.5

     Do: two phones sync a few minutes apart.
     You should see: the other phone's leaderboard updates within about 5 seconds without a refresh.
     Tag cp-1.5.

P1.6 Settings, account deletion, privacy page

  Read docs/PLAN.md §14 and Appendix B7 "Profile".
  Build Profile/Settings: career stats placeholder, home zone, Sync health (last sync,
  sources, rotate key), notification toggles (all types from §9, saved in
  push_subscriptions.prefs), sign out, Delete account (typed confirmation → POST
  /api/account/delete removes the user, Health totals, keys and subscriptions; past
  games will show "Former player").
  Add a public /privacy page with the §14 text in plain English.
  Tests: deletion removes everything listed. pgTAP proves no orphaned Health rows
  remain.

Checkpoint P1.6

     Run: pnpm check && pnpm e2e
     You should see: a deleted test user is gone from every table except anonymized game history.
     /privacy loads without signing in.
     Tag cp-1.6.

P1.7 Production pipeline, smoke, backups [PLAN]

  Read docs/PLAN.md Appendix A4, A9, A12 and D3.
  Implement:
  - deploy.yml: push to main → staging deploy → `pnpm smoke --env staging`. Git tag
  v*.*.* → production deploy to t2t-prod and the Cloudflare Pages production branch →
  `pnpm smoke --env prod`.
  - scripts/smoke.ts per Appendix A3 layer 9, using the hidden Smoke Crew user and its
  sync key from secrets. Exit non-zero on any failure, printing a short reason.
  - smoke.yml every 3 hours against staging and prod.
  - backup.yml nightly at 3:30 AM ET: supabase db dump for prod → age-encrypt with the
  public key secret → commit to toe-to-toe-backups.
  - scripts/restore-drill.ts: decrypt (private key passed via an env var, never
  stored), restore into the local stack, run invariants.
  - A failed workflow emails me (GitHub's default notifications are fine; document how
  to make sure they're on).
  List every secret and setting I need to create, step by step.

Checkpoint P1.7 = Phase 1 exit

     Run: tag v0.1.0 and push. Watch both deploys and both smoke runs. Trigger backup.yml by hand,
     then run pnpm restore-drill.
     You should see: production URL live. Smoke green on both environments. An encrypted dump in the
     backups repo. The restore drill reports invariants OK.
     Tag cp-1.7 / phase-1.

Phase 2 — Fantasy engine (target Dec 15 – 21)

P2.1 Scoring engine

  Read docs/PLAN.md §5.3 and §5.4 (modifier effects only), plus CLAUDE.md golden rule
  1.
  In packages/engine create scoring.ts: scoreDay(input) → {totalHundredths,
  breakdown[]}.
  Input: hourly de-duplicated steps (in home-zone order), flights, the season's frozen
  scoring config, today's modifier (or none).
  Rules: 1 step = 1 hundredth. Only the first 30,000 steps in time order score. 10K
  bonus and penalties use raw counted steps. Flights at the config value with a daily
  cap. Every modifier in §5.4. 1.5× windows summed and rounded half up once. Negative
  totals allowed.
  Tests FIRST: every row of the §5.3 examples table as a golden test (including 34,210
  and the Early Bird example), each modifier on/off, Pure Steps, No Excuses with both
  penalties, Stairs Day with flights off (never drawn), the cap landing inside a Final
  Push hour.
  Replace the stub in /sync with real scoring.

Checkpoint P2.1

     Run: pnpm test:engine
     You should see: all golden examples pass to the hundredth.
     Tag cp-2.1.

P2.2 Crew Game, standings, tiebreakers

  Read docs/PLAN.md §5.5, §5.6 and §5.8 (forfeits).
  In packages/engine create crewGame.ts and standings.ts.
  Crew Game: for each active player, count how many they beat and how many beat them →
  W/L/T. Inactive players are excluded. Bye players are included.
  Standings: H2H W-L-T, Crew W-L-T, Win % = (W + 0.5T) / (H2H games + Crew games), PF
  (all regular-season days), PA (H2H opponents), streak. Tiebreakers: Win % → PF →
  total counted steps → seeded random draw (the seed and result are returned so they
  can be logged).
  Forfeits: a game against an Inactive player is a win for the opponent, who keeps
  their real score for PF.
  Tests FIRST: 8-player day (top 4 win), 9-player day (middle ties), score ties at the
  boundary, a three-way tie resolved at each tiebreak level, forfeit math.

Checkpoint P2.2

     Run: pnpm test:engine
     You should see: green, with explicit tests for every tiebreak level.
     Tag cp-2.2.

P2.3 Scheduler [PLAN]

  Read docs/PLAN.md §6 (table and scheduler rules) and Appendix A3 layer 2.
  In packages/engine create scheduler.ts: buildSeason({players, monthStart,
  daysInMonth, seed}) → {regularDays, restDays, playoffDays, days[{date, games[[a,b]],
  byes[]}], perPlayer{games, byes}}.
  Rules in priority order exactly as §6. Odd crews use three-bye days only when
  needed. Meetings differ by at most 1. No same opponent on consecutive days. No back-
  to-back byes. The result is deterministic for a given seed.
  Tests FIRST:
  1. A golden test that loops crew sizes 4–12 and month lengths 28–31 and asserts the
  exact §6 cell values (games, byes, regular days, rest days).
  2. fast-check properties over 200 seeds per combination: equal games and byes,
  nobody plays twice a day, meeting spread ≤ 1, no back-to-back opponent, no back-to-
  back byes, rest ≥ 1, playoffs fit.
  If any §6 cell is mathematically impossible, stop and tell me which one instead of
  changing the test.

Checkpoint P2.3

     Run: pnpm test:engine

     You should see: 36 golden cells green and all properties green. Run time under about 60 seconds.
     Tag cp-2.3.

P2.4 Season schema and lifecycle job

  Read docs/PLAN.md §5.1, §5.8, §13 and Appendix A6–A8.
  Migrations: seasons, season_players, games, crew_games, byes, playoff_series,
  modifiers, plus a view revealed_modifiers. RLS per Appendix A9: modifiers are
  readable only through the view.
  Implement supabase/functions/jobs-season (cron, every 15 min, CRON_SECRET):
  - 20th 9:00 AM crew clock: create next month's season in signup.
  - POST /api/season/signup {season_id, home_tz}, /api/season/leave.
  - Last day 8:00 PM crew clock: lock rosters and home zones. Fewer than 4 players →
  cancelled.
  - 9:00 PM: build the schedule (scheduler.ts) and draw hidden modifiers (frequency
  from config, max 1 per day, never consecutive, skip any that need a disabled
  metric).
  - Commissioner settings (POST /api/admin/settings) allowed only before the roster
  lock. Freeze scoring_config at lock.
  - Short first season mid-month: allowed only if ≥7 regular days fit.
  - Every transition goes to audit_log.
  Tests with FakeClock: the full lifecycle for a Jan 2027 season, settings rejected
  after lock, cancelled with 3 players.

Checkpoint P2.4

     Run: pnpm test:db && pnpm test:functions

     You should see: green. A seeded staging season shows a full January schedule.
     Tag cp-2.4.

P2.5 Locks and finalization (jobs-tick) [PLAN]

  Read docs/PLAN.md §4, §5.2, §5.5, §5.6 and Appendix A7–A8.
  Implement supabase/functions/jobs-tick (cron every 15 min):
  - Move player days live → finalizing at local midnight and → locked at local noon
  (flag check runs here, review comes in P4.4).
  - Finalize a game when both players' days are locked (and not under review): write
  score_a/score_b from scoreDay, the winner, status final.
  - When every active player's day for a date is locked: compute Crew Games for that
  date.
  - Update season_players standings with standings.ts.
  - Idempotent and catch-up: process everything due as of app_now().
  Function tests with FakeClock: an ET vs Vancouver game goes final at 2:00 PM ET in
  January (3:00 PM ET in July; Vancouver no longer changes clocks, §4). Halifax locks at 11:00 AM ET. Running the job twice changes nothing. Skipping 3
  hours of runs then running once catches up correctly.

Checkpoint P2.5

     Run: pnpm test:functions
     You should see: the §4 example timings reproduced exactly.
     Tag cp-2.5.

P2.6 Season simulator and invariants

  Read docs/PLAN.md Appendix A3 layers 7 and 10.
  Implement:
  - packages/engine/invariants.ts: pure checks (equal games/byes, stored standings ==
  recomputed, every final game has two locked days, scores == recompute from hours, no
  unrevealed modifier exposed).
  - scripts/sim.ts: `pnpm sim --players N --month YYYY-MM --zones ET,AT|PT --seed S [-
  -chaos]`.

      Spin up against the local stack in test mode. Create a crew and season. Generate
  synthetic hourly steps per player (seeded, realistic daily shapes, Watch vs phone
  patterns). Advance FakeClock in 15-minute ticks, calling /sync and the jobs exactly
  like production. At the end, recompute everything independently with the engine and
  compare to the database.

      --chaos: late syncs, a missed day, a mid-season dropout (after P3.3), a voided day
  (after P4.4).

      Print a summary: champion (after P3), standings table, invariant results, runtime.
  - Turn on the sim step in ci.yml (9 players, 2027-01, ET+PT, seed 42).

Checkpoint P2.6

     Run: pnpm sim --players 9 --month 2027-01 --zones ET,PT --seed 42 and the same with --
     players 8 and --players 10.
     You should see: "invariants: all pass", DB == engine for every game, and a regular season that matches
     the §6 cells.
     Tag cp-2.6.

P2.7 Fantasy UI: Matchup, Game detail, Schedule, Standings

  Read docs/PLAN.md §8 and Appendix B7 "Fantasy" and "Game detail".
  Build the Fantasy tab with sub-tabs Matchup, Schedule and Standings (Bracket, Stats,
  History and Reviews come later; show "Coming soon").
  - Matchup: today's game card (both scores live, margin, "X steps to take the lead",
  status pill, each player's sync chip), Crew Game rank today, this season's results
  list.
  - Game detail: hourly step bars for both players (Recharts), score breakdown line by
  line from scoreDay's breakdown, reactions placeholder.
  - Schedule: whole month by day, byes marked, rest and playoff days shaded.
  - Standings: table per §5.6 with the playoff cut line.
  Realtime updates. Skeleton, empty, error states. VoiceOver labels per Appendix B8.
  E2E: a simulated day shows live → finalizing → final on the Matchup card.

Checkpoint P2.7 = Phase 2 exit
     Do: run a 3-day sim on staging (test mode) with 4 test accounts on real phones.
     You should see: live scores moving, finals at the right local times, standings updating. All test layers 1–7
     green in CI.
     Tag cp-2.7 / phase-2.

Phase 3 — Playoffs and history (target Dec 22 – 26)

P3.1 Playoffs engine

  Read docs/PLAN.md §5.7, §5.1 (rest days) and §6.
  Engine: seedPlayoffs(standings, bracketSize), series logic (fixed 3-day blocks, Game
  3 skipped at 2-0), playoff game tiebreak (more counted steps, then higher seed),
  Inactive seed replacement, opponent advances if a player leaves.
  jobs-tick: after the last regular-season day locks for everyone, seed, write
  playoff_series and games, and auto-create the Consolation Race challenge record (the
  engine for it comes in P5.1; store the entry list now).
  Champion when the final series is decided.
  Tests FIRST for Top 2 and Top 4, 2-0 and 2-1 series, a tied playoff game, an
  Inactive top seed.

Checkpoint P3.1
     Run: pnpm sim --players 8 --month 2027-01 --zones ET,PT --seed 7
     You should see: semis Jan 26–28, final Jan 29–31, and a champion named. Invariants pass.
     Tag cp-3.1.

P3.2 Bracket UI

  Read Appendix B7 "Bracket".
  Build the Bracket sub-tab: seeds, series scores (game dots), the current game
  highlighted, and the champion banner with a trophy. Before seeding, show a
  "Projected bracket" based on current standings, clearly labeled. Confetti on the
  champion view, respecting reduced motion.

Checkpoint P3.2: the bracket from P3.1's sim renders correctly on an iPhone viewport. Tag cp-3.2.

P3.3 Dropouts, commissioner powers, audit log

  Read docs/PLAN.md §5.8 and Appendix A6.
  Implement /api/season/leave after start (becomes Inactive), /api/admin/remove-
  player, /api/admin/cancel-season, forfeit handling in jobs-tick, Crew Game
  exclusion, playoff seed replacement, the "Former player" display, and the
  commissioner settings screen (gear icon), which is read-only after the lock.
  Add an Audit log view per season (Fantasy → History).
  Enable --chaos dropout in sim.

Checkpoint P3.3

     Run: pnpm sim --players 9 --month 2027-01 --zones ET,AT --seed 3 --chaos
     You should see: the dropout's remaining games are forfeits, the Crew Game excludes them, and
     invariants pass.
     Tag cp-3.3.

P3.4 History, careers, head-to-head, record book, trophies

  Read docs/PLAN.md §7.5.
  Build SQL views (with RLS) and screens: season archive, player career, head-to-head
  between any two players, record book, trophy room with badges (champion, Consolation
  Race winner, Crew Game MVP, 7-day 10K streak). Records update in jobs-tick when
  games finalize.
  Tests: views match hand-computed values from a fixed sim seed (snapshot).

Checkpoint P3.4: after two simulated seasons, careers and records match the snapshot. Tag cp-3.4.

P3.5 Nightly invariants and admin page

  Read Appendix A3 layer 10 and Appendix D3.
  Implement supabase/functions/jobs-invariants (nightly via pg_cron) using
  engine/invariants.ts against production data. Write results to an invariant_runs
  table. On failure, show it on the admin page and send a push to the commissioner
  (once P4.1 exists; log it for now).
  Admin page (/admin, only for users flagged admin): last sync per player, cron run
  history (cron.job_run_details), failed pushes, open reviews, DB size, invariant
  results.

Checkpoint P3.5 = Phase 3 exit: pnpm sim full seasons for 8, 9 and 10 players to a champion with zero
invariant failures. The admin page shows healthy staging. Tag cp-3.5 / phase-3.

Phase 4 — Engagement (target Dec 27 – 30)

P4.1 Push infrastructure [PLAN]

  Read docs/PLAN.md §9 and Appendix A6.
  Implement supabase/functions/push plus a dispatcher inside jobs-tick:
  - Web Push with VAPID (JSR web push library from Appendix A11). Payload: title,
  body, url.
  - A notification_queue table with due_at_utc, computed from each player's home zone.
  Catch-up sending. Dedupe key per (user, type, game/date).
  - Respect per-type toggles. Rate-limit opponent alerts to 1 per hour per game.
  - Delete subscriptions that return 404/410.
  - The service worker shows the notification and opens the url on tap.
  Tests: due times for ET/AT/PT users, dedupe, rate limit, 410 cleanup.

Checkpoint P4.1: a test push arrives on your iPhone (Home Screen app, notifications allowed), and tapping
it opens the right screen. Tag cp-4.1.

P4.2 Notification catalog

  Implement every notification in docs/PLAN.md §9 with the copy from Appendix B9. Each
  has a unit test for its trigger condition and local time, plus a sim assertion that
  it fires exactly once per eligible player per day.

Checkpoint P4.2: pnpm sim --players 8 --month 2027-01 --zones ET,PT --seed 11 reports the
expected count of each notification type. Tag cp-4.2.

P4.3 Modifier reveal and UI

  Read docs/PLAN.md §5.4.
  jobs-tick reveals tomorrow's modifier at 8:00 PM in each player's home zone (per-
  player visibility through revealed_modifiers, using a per-user reveal check). Show a
  ModifierBadge on Home and Matchup, with an explainer sheet. Scoring already applies
  modifiers (P2.1). Test that a player can't read a modifier before their own 8 PM.

Checkpoint P4.3: pgTAP and function tests green. The sim shows the expected number of modifier days
with no back-to-backs. Tag cp-4.3.

P4.4 Flags and crew review

  Read docs/PLAN.md §5.10.
  At lock, flag days over 40,000 steps, over 2.5× the 30-day average (once 7 days of
  history exist), or with any hour over 12,000. Flagged → daily_stats.review, and its
  games → review for 24 h. POST /api/review/vote, /api/day/note. Outcome: more than
  half of the other active players vote void → voided (scored as 0 steps, no
  penalties). Otherwise it stands. Finalize afterward. Crew Game for that date waits
  for the review.
  Reviews sub-tab UI. Enable --chaos voided day in sim.
  Tests for each flag trigger, vote math with 8/9/10 players, and the review closing
  on time with no votes.

Checkpoint P4.4: the chaos sim shows one voided day and every dependent result recomputed. Invariants
pass. Tag cp-4.4.

P4.5 Social

  Read docs/PLAN.md §7.4.
  Reactions (fixed emoji set) and one-line trash talk (max 140 characters) on game
  cards, Realtime-updated. Nudges (one per pair per day) send a push. Users can delete
  their own comments. Basic profanity isn't filtered (friends app), but HTML is
  escaped. RLS and function tests.

Checkpoint P4.5: two phones trade reactions live, and the nudge push arrives. Tag cp-4.5.

P4.6 Full end-to-end suite

  Read Appendix A3 layer 8.
  Complete the Playwright suite (WebKit, iPhone 15 viewport): onboarding; join crew;
  season signup with home zone; live matchup update after a sync; review vote;
  commissioner settings locked after start; account deletion. Run it in CI against the
  local stack with FakeClock control through a test-only endpoint that exists only
  when test mode is on (a pgTAP test proves it's off in prod).

Checkpoint P4.6 = Phase 4 exit: CI fully green including e2e. Tag cp-4.6 / phase-4.

Phase 5 — Journey and challenges (target early Jan)

P5.1 Challenges engine and API

  Read docs/PLAN.md §7.2.
  Engine + tables + API for challenges: create (type, invitees, dates 1–14 days,
  scoring config), accept/decline, daily points from locked days, results. Types:
  Race, King of the Hill (reigns, total crowns), Consolation Race (auto-created in
  P3.1). Challenges never touch Fantasy tables. No modifiers. Watch metrics allowed
  (opt-in).
  Tests FIRST for each type, including ties and a member who leaves.

Checkpoint P5.1: a sim with a concurrent Race and King of the Hill gives correct winners. Tag cp-5.1.

P5.2 Challenges UI

Read Appendix B7 "Challenges".                                    → players →   Home
Challenges tab: Active / Upcoming / Completed. Create flow: type  daily chart.
duration → scoring → review. Challenge detail with standings and
shows active challenge cards.

Checkpoint P5.2: you create a 3-day Race on your phone and a friend accepts it. Tag cp-5.2.

P5.3 Journey

  Read docs/PLAN.md §7.3 and Appendix B7 "Journey".
  scripts/gen-routes.ts: build routes/*.geojson for the 5 starter routes from a small
  list of waypoints per route (city name + lat/lng + cumulative miles). Lines are
  straight or great-circle segments between waypoints. No paid APIs.
  Journey tables, progress from crew distance (locked days only), milestone cards when
  a city is passed (with a push), the commissioner picks the next route when one
  finishes.
  Journey screen: MapLibre with OpenFreeMap tiles (fallback: SVG route), marker,
  period filter, contribution list, milestones.

Checkpoint P5.3 = Phase 5 exit: a sim month moves the marker the right number of miles, and milestones
fire once. Tag cp-5.3 / phase-5.

Phase 6 — Launch and beta season (January 2027)

P6.1 Launch hardening [PLAN]

  Read Appendix D2 (launch checklist).
  Do a hardening pass and report findings before fixing anything:
  1. RLS audit: list every table and view with its policies and prove each with a
  pgTAP test.
  2. Abuse limits: payload limits, rate limits, invite code brute force.
  3. Accessibility audit of every screen against Appendix B8.
  4. Every screen has loading, empty, error and offline states.
  5. Performance: the Home tab is interactive in under 2 s on a mid-range iPhone over
  4G (Lighthouse mobile ≥ 90 for performance and accessibility).
  6. Error messages are human and never leak internals.
  Then fix the findings in priority order.

Checkpoint P6.1: every item on the launch checklist (Appendix D2) is checked. Tag v1.0.0 → production.

Manual: launch

Follow Appendix D2: invite the crew, run onboarding sessions, open January sign-ups, and watch the first
72 hours using the Appendix D3 runbook.

Checkpoint P6 = Beta exit: January season completes. Success metrics in Appendix D1 are met.

Phase 7 — Polish (Feb and later)

     P7.1 Design pass: "Read Appendix B. Review every screen against it, list inconsistencies, then fix them.
     Add delight: score tick-up animations, win confetti, crown animation for King of the Hill, all respecting
     reduced motion."
     P7.2 V1.1 challenges: First to X, Personal Best, Team Battle, Survival, each test-first per §7.2.
     P7.3 Native upgrade (optional, needs the $99 Apple Developer Program): "Read §10 option D. Wrap
     apps/web with Capacitor. Add a HealthKit plugin that uses statistics collection queries (de-duplicated
     by Apple) plus background delivery and posts kind 'hours' to /sync. Add native push via APNs, keeping
     Web Push working for web users. Keep one codebase."

Appendix D. What success looks like

D1. A successful run

Every phase has a demo you can show a friend and a proof you can run.

Phase          Demo                                                 Proof
0 Sync proof                                                        pnpm sync-report prints PASS on both
               4 phones sync silently for a week; the debug         lines.
1 Foundation   page shows each person's counted steps.              CI green; prod and staging smoke green;
                                                                    restore drill OK.
2 Engine       A friend installs, signs in and finishes onboarding
               alone in about 5 minutes; leaderboard updates        Test layers 1–7 green; pnpm sim DB ==
3 Playoffs +   live.                                                engine.
history                                                             Sims for 8, 9, 10 players pass invariants.
4 Engagement   A 3-day fake-clock season on staging with live
               scores and correct finals across zones.              Notification counts in sim match expected;
5 Journey +                                                         e2e green.
challenges     Simulated months end with a champion, bracket        Challenge and Journey tests green.
6 Beta season  and record book.

               Pushes arrive at the right local times; reactions
               and nudges fly between phones.

               Marker moves, a Race runs next to Fantasy.

               The crew plays January 2027 start to finish.         D1 beta metrics below.

A golden day (Jan 12, 2027 · Jay in New Jersey vs Priya in Vancouver)

Time (ET)           What happens

12:00 AM            Jay's Jan 12 starts. His Jan 11 moves to Finalizing.

2:00 AM             Priya's Jan 12 starts (midnight in Vancouver, 2 hours behind ET in winter, §4).

8:00 AM / 10:00 AM  "Game day" push to Jay / to Priya (8 AM each).
All day
                    Every Instagram or Messages open triggers a silent sync. Both phones' Matchup cards
                    update within seconds.

12:00 PM            Jay's Jan 11 locks. Halifax players locked at 11 AM.

2:00 PM             Priya's Jan 11 locks → Jay vs Priya (Jan 11) goes Final, "Final" pushes sent, Crew Games for
                    Jan 11 computed (Priya was the last player), standings and records update.

8:00 PM / 10:00 PM Tomorrow's modifier (if any) revealed to Jay / Priya.

10:00 PM / 12:00 AM Close-game alert if the margin is under 10.00 (each at 10 PM local).

11:30 PM / 1:30 AM Sync reminder (11:30 PM local).

Next day 9 AM local "Yesterday isn't in yet" only for anyone with no sync since midnight.

A successful day means every player-day synced before its lock, every push fired exactly once, and the nightly invariants are
green.

A golden season (8 players, January 2027)

Date                         Event
Dec 20, 9 AM ET              Sign-ups open. Everyone confirms home zone (one player Halifax or Vancouver).

Dec 31, 8 PM / 9 PM ET Rosters lock / schedule and hidden modifier draw published.

Jan 1 – 24                   Regular season: 24 head-to-head games and 24 Crew Games each, about 4 modifier
                             days.

Jan 25                       Rest day. Bracket publishes once the last Jan 24 lock passes (2 PM ET with a Vancouver
                             player). Consolation Race starts for the bottom 4.

Jan 26 – 28                  Semifinals (best of 3).

Jan 29 – 31                  Final (best of 3).

Feb 1 (afternoon ET)         Champion crowned when the deciding game's last day locks. February season already
                             open for sign-ups since Jan 20.

Beta success metrics (January 2027)                   Target
                                                      ≥ 95%
 Metric                                               Within 2% on ≥ 90% of days (Watch and phone-only both)
  Player-days synced before lock                      0
  Counted vs Health app steps                         31 of 31
  Scoring disputes caused by bugs                     ≥ 99%
  Nightly invariant runs green                        0
  Smoke runs green                                    ≥ 80%
  Duplicate or missed scheduled pushes                < 50 MB / < 1,500 min / $0
  Players opening the app 5+ days a week              The crew signs up for February without being asked twice.
  Database size / Actions minutes / cost
  The real test

D2. Launch checklist

Area                  Check

Tech                  ☐ v1.0.0 tagged and deployed · ☐ prod smoke green for 24 h · ☐ backup + restore drill done

                      · ☐ invariants green · ☐ RLS audit done · ☐ test mode off in prod (pgTAP) · ☐ admin page

                      limited to Jay · ☐ prod secrets differ from staging · ☐ Shortcut points to prod and the iCloud

                      link works · ☐ /privacy live

Area                   Check
Each player
                       ☐ iOS 17+ · ☐ installed to Home Screen · ☐ signed in · ☐ joined crew · ☐ notifications
Season                 allowed · ☐ Shortcut imported with own key · ☐ 2+ app-open automations · ☐ verify step
People                 matched Health · ☐ home zone correct (check the Halifax/Vancouver player) · ☐ synced at
                       least once before Dec 31

                       ☐ commissioner settings reviewed · ☐ at least 4 sign-ups · ☐ "How scoring works" sheet
                       shared in the group chat

                       ☐ group-chat message with the link and the 5-minute setup · ☐ two onboarding sessions (in
                       person or FaceTime) · ☐ one person besides Jay knows how to report a problem

D3. Operations runbook

Symptom                Check                                    Fix

One friend's steps     Admin sync table, their SyncChip,        Ask them to open a trigger app. Confirm
aren't updating        function logs for their key (401?)       automations are on and set to Run
                                                                Immediately. Settings → Health → Data
Nobody's steps are     Supabase dashboard (paused?),            Access → Shortcuts has steps on. Re-run Sync
updating               function logs, last deploy               setup (rotates key if needed).

Games not going final Admin cron history                        Restore a paused project. Roll back by re-
                                                                tagging the previous version. Late data still
Push not arriving      Their toggles, subscription row, failed  counts until each lock.
                       pushes list
                                                                Jobs catch up automatically. To force it: curl
Invariant failure      Admin invariant run details, audit log   -X POST …/jobs/tick -H "x-cron-
                                                                secret: …". Check pg_cron is enabled.
Score dispute          Game breakdown vs their Health app,
                       sources, sync times                      Must be opened from the Home Screen app.
                                                                Re-allow in Profile → Notifications. Check
iOS update breaks      Shortcut test run, smoke, r/shortcuts    Focus mode. 410 errors re-subscribe
Shortcut or web push                                            automatically on next open.

Near free-tier limits  Admin DB size, Supabase usage page,      Don't edit data by hand. Reproduce with
                       Actions minutes                          pnpm sim or a fixture, fix with a regression
                                                                test, deploy. If a score changes, use the §5.8
                                                                server-bug correction and tell the crew.

                                                                De-duplication difference → explain "Counted
                                                                steps". Bug → as above. Suspected cheating
                                                                → only the flag and review rules apply.

                                                                Tell the crew, move the lock to 6 PM
                                                                temporarily (rule change only between
                                                                seasons unless the crew agrees), consider the
                                                                native upgrade.

                                                                Confirm source_hours are deleted at lock.
                                                                Make the code repo public if Actions minutes
                                                                run short.

Symptom     Check                                Fix
Data loss   Latest backup in toe-to-toe-backups
                                                 Restore with the restore script pointed at
Leaked key  Which key                            prod (two-person check: read the command
                                                 aloud first).

                                                 Sync key: rotate in Profile. Service or cron
                                                 keys: rotate in Supabase, update GitHub
                                                 secrets, redeploy.

Weekly (5 minutes): admin page, smoke history, invariants, Actions minutes, DB size. Monthly: restore drill
(automatic), season retro with the crew. Rule changes only take effect at the next season.

```
