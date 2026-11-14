# FADE — Google Play Store Publishing & Launch Guide

This guide covers everything you need to know about publishing FADE to the Google Play Store, including costs, mandatory requirements, and the step-by-step submission process.

---

## 1. Google Play Developer Account: Cost & Requirements

### Can you get a free Google Play developer account?
**No.** Google strictly charges a **one-time registration fee of $25 USD**. 
* There is no free tier to publish on the official Google Play Store.
* The fee is paid once with a credit/debit card, and the account never expires.
* **Sign-up link:** [https://play.google.com/console/signup](https://play.google.com/console/signup)

### Identity Verification
Google requires identity verification for all new developer accounts:
1. Legal Name and physical address.
2. Official Government ID (Passport, Driver's License, or National ID card).
3. A contact email address and phone number for developer verification (verified via SMS/OTP).
4. A public support email address (e.g. `support@fade.game` or your personal email).

---

## 2. The "20 Testers for 14 Days" Policy (Crucial for New Personal Accounts)

If your Google Play Developer Console account is a **personal account** registered after **November 13, 2023**, Google mandates:
* You **cannot** publish directly to Production on day one.
* You must run a **Closed Test** with at least **20 opted-in testers**.
* These 20 testers must remain opted-in for at least **14 consecutive days**.
* Once 14 days are complete, a button appears in your console: *"Apply for production"*. You will answer a short questionnaire about your testing feedback, and Google will approve public release within 3–7 business days.

*(Note: Organization/Company accounts with a D-U-N-S number are exempt from this 14-day rule, but require business registration documents).*

---

## 3. Preparing the App Release (`.aab` Bundle)

Google Play requires an **Android App Bundle (`.aab`)**, not an `.apk`.

### How to build the production `.aab`:
In your project directory, run:
```bash
cd app
npx eas-cli build --platform android --profile production
```
This builds an optimized, signed `.aab` file in the EAS cloud ready for upload.

### Versioning Configuration (`app/app.json`):
* `version`: Display version shown to users (e.g. `"1.0.0"`).
* `versionCode`: Integer incremented on every single store upload (e.g. `1`, `2`, `3`).

---

## 4. Google Play Console Setup: Step-by-Step

### Step 1: Create Application
1. Log in to [Google Play Console](https://play.google.com/console).
2. Click **Create app**.
3. **App name:** `FADE - Timed Tic-Tac-Toe`
4. **Default language:** English (United States)
5. **App or game:** Game
6. **Free or paid:** Free
7. Accept the Declarations and click **Create app**.

---

### Step 2: Store Listing & Graphics
Under **Grow** $\rightarrow$ **Store presence** $\rightarrow$ **Main store listing**:
* **Short description (80 chars):**  
  *Fast-paced tactical tic-tac-toe where marks fade away on a shot clock.*
* **Full description (up to 4000 chars):**  
  *Think fast. Play faster. FADE reinvents tic-tac-toe as an intense real-time strategy game. Each player only has 3 marks on the board at a time—when you make your 4th move, your oldest mark vanishes! Play against players online with instant WhatsApp invites, climb the Glicko-2 ratings leaderboard, or test your skills against our AI bot across multiple difficulty levels.*
* **App icon:** 512 × 512 px PNG (32-bit, transparent background not allowed).
* **Feature graphic:** 1024 × 500 px JPG or PNG (banner on top of the store page).
* **Screenshots:** Upload at least 4 screenshots (Home screen, match in progress, victory overlay, and profile rating chart).

---

### Step 3: Policy & Data Safety Declarations
Under **Monitor and improve** $\rightarrow$ **Policy and programs** $\rightarrow$ **App content**:

1. **Privacy Policy:**  
   Provide the public URL to `docs/PRIVACY_POLICY.md` (e.g. hosted on your GitHub repository: `https://github.com/sarathbabu123/fade/blob/main/docs/PRIVACY_POLICY.md` or a GitHub Pages site).
2. **Ads:**  
   Select: **"No, my app does not contain ads"**.
3. **App Access:**  
   Select: **"All functionality is available without special access restrictions"** (guest anonymous login works automatically).
4. **Target Age & Content Rating:**  
   Fill out the IARC questionnaire:
   * Category: Game / Strategy.
   * Violence / Bad Language: None.
   * Rating result: **PEGI 3 / Everyone (All ages)**.
5. **Data Safety Section:**
   * Does your app collect or share user data? **Yes**.
   * Is all data collected encrypted in transit? **Yes** (HTTPS/WSS).
   * Do you provide a way for users to request data deletion? **Yes** (In-app Account Deletion under Settings).
   * Data Types Collected:
     * **User IDs:** Anonymous account ID for game functionality and account management.
     * **App Activity:** Gameplay history, move logs, and ratings for game functionality.
     * **Diagnostics:** General crash logs.
     * *No personal identifiers, no location, no contacts, no advertising IDs.*

---

### Step 4: Closed Testing Track (The 14-Day Phase)
1. In the sidebar, navigate to **Testing** $\rightarrow$ **Closed testing**.
2. Click **Create track** (e.g. name it "Alpha" or "Beta").
3. Click **Create new release** and upload the `fade-production.aab` generated by EAS.
4. Add release notes: `"Initial release of FADE v1.0.0"`.
5. Under **Testers** tab:
   * Create an email list of 20+ testers or create a Google Group.
   * Copy the opt-in link provided by Google and send it to your 20 testers.
   * Testers click the link, accept the invitation, and install FADE through Google Play.
6. Keep the closed test active for 14 days.

---

### Step 5: Production Release
Once 14 days have elapsed and 20 testers have tested the build:
1. Click **Apply for production** on your dashboard.
2. Complete the short production application.
3. Promote your tested build from Closed Testing directly to **Production**.
4. Google will review and publish your app to the public Play Store within 3–7 business days!

