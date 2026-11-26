# 5-minute Shortcut check

Run this after building or changing the Shortcut (`shortcut/BUILD.md`), against local or staging,
never production. It proves two things: manual Health entries don't count, and locking the phone
partway through a sync doesn't leave a wrong total.

## Set up (1 minute)

- Use the staging (or local) copy of the Shortcut with your key in action 1.
- Temporarily add **Quick Look** with **Contents of URL** right after **Get Contents of URL**
  (action 77) so you can read each response. Remove it when you're done.
- Have the Health app open to **Browse → Activity → Steps** and note today's total: **H = \_\_\_**.
- Wait at least 30 seconds since the last sync (the server allows one per 30 s).

## Test 1: manual entries are dropped (2 minutes)

1. Run the Shortcut by hand. In Quick Look, note today's `steps` in `days`: **A = \_\_\_**. It
   should be within a few percent of H. Note `ignored.manual`: **M1 = \_\_\_**.
2. In Health: **Steps → Add Data** → `5000` steps, time a few minutes ago → **Add**. Health's total
   is now H + 5000.
3. Wait 30 seconds, run the Shortcut again. Note today's `steps`: **B = \_\_\_** and
   `ignored.manual`: **M2 = \_\_\_**.

Pass: **B is A**, give or take the steps you walked in between. It must not be about A + 5000.

Then read M2 to see who dropped the entry:

- M2 = M1 (usually 0): the Shortcut's **Source is not Health** filter dropped it before sending.
- M2 > M1: the filter isn't working (or isn't available), and the server dropped it. Still a pass for
  scoring, but record it in BUILD.md → First-build notes.

Clean up: Health → Steps → **Show All Data** → swipe the 5,000 entry → **Delete**.

## Test 2: locking mid-sync (2 minutes)

1. Wait 30 seconds. Run the Shortcut and **press the side button to lock the phone about one second
   later**.
2. Wait 10 seconds and unlock. You may see an error alert or a "Toe to Toe Sync" notification, or
   nothing. All three are fine, as long as nothing crashed the Shortcuts app.
3. Wait 30 seconds, run the Shortcut again with the phone unlocked and let it finish. Note today's
   `steps`: **C = \_\_\_** and yesterday's `steps`.

Pass: **C matches A** (plus any steps walked since) and yesterday's total hasn't dropped. Each sync
re-sends both days in full, so whatever happened to the interrupted run, the next complete one fixes
it.

Optional: check the same totals in Supabase Studio → Table Editor → `daily_stats` for your user
and today's date.

## Finish

- Remove the **Quick Look** action.
- Record any surprises (labels, timings, the M2 result) in BUILD.md → First-build notes.
