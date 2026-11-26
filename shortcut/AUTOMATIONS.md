# Make Toe to Toe sync by itself

Your iPhone only lets apps read Health data while the phone is unlocked, so a timed sync at night
often fails. Instead, the Toe to Toe Sync Shortcut runs whenever you open an app you use all the
time. You'll never notice it, and your steps stay up to date.

Takes about 3 minutes. Do it once.

## Before you start

You should already have:

- the **Toe to Toe Sync** Shortcut (from the "Get the Shortcut" link in the app, with your sync key
  pasted in when it asked), and
- run it once by tapping it in the Shortcuts app, and tapped **Allow** for Health and **Always
  Allow** when it asked to send data.

Then check one setting: **Settings → Apps → Shortcuts → Advanced → Allow Sharing Large Amounts of
Data** → on. (On older iPhones it's **Settings → Shortcuts → Advanced**.)

## Create the automation

1. Open the **Shortcuts** app and tap **Automation** at the bottom.
2. Tap **+** (or **New Automation** / **Create Personal Automation** if that's what you see).
3. Scroll down and tap **App**.
4. Tap **Choose** and pick 2 or 3 apps you open many times a day, for example **Instagram**,
   **Messages** and **Snapchat**. Tap **Done**.
5. Make sure **Is Opened** is ticked and **Is Closed** is not.
6. Choose **Run Immediately**, and turn **Notify When Run** off.
7. Tap **Next**.
8. Pick **Toe to Toe Sync** from the list (if you see **New Blank Automation** instead, tap it, add
   the action **Run Shortcut**, and choose **Toe to Toe Sync**).
9. Tap **Done**.

On older iPhones the order is a little different: after step 5 tap **Next**, add **Run Shortcut** →
**Toe to Toe Sync**, tap **Next**, then turn **Ask Before Running** off (tap **Don't Ask**) and turn
**Notify When Run** off.

## Check it works

Open one of the apps you picked. Nothing pops up, and that's the point. Open Toe to Toe: your step
total should match the Health app (within a few minutes of walking).

## If you see a "Toe to Toe Sync" notification

The Shortcut only speaks up when something's wrong. Common ones:

- **"Unknown or rotated sync key…"**: your key changed. In Toe to Toe go to **Profile → Sync
  setup**, copy the key, open the Shortcuts app, tap **…** on Toe to Toe Sync, and paste it over the
  first **Text** box.
- **"…Shortcut is too old. Get the new version…"**: open the link in the message, tap **Add
  Shortcut** (replace the old one) and paste your key when asked.
- **"One sync per 30 seconds…"**: you opened two of your apps quickly. Nothing's wrong; the first
  sync already counted.
- **"Couldn't reach Toe to Toe…"**: no signal. It'll catch up next time you open one of your apps.

Anything else, screenshot it and send it to Jay.
