# Privacy Policy for FADE

**Effective Date:** November 15, 2026  
**Last Updated:** November 15, 2026

Welcome to **FADE** ("we", "our", or "us"). We are committed to protecting your privacy and providing a safe, transparent gaming experience. This Privacy Policy outlines how your information is handled when you use the FADE mobile application.

---

## 1. Information We Collect

FADE is designed with a **privacy-first, data-minimization** philosophy:

### A. Information You Provide
* **Display Name (Username):** A chosen pseudonym used to identify you in matches and on the friend leaderboard.
* **Avatar Configuration:** Your selected visual glyph and neon color accent.

### B. Automatically Collected Information
* **Anonymous User Identifier:** When you start the app, a random unique identifier (UUID) is generated via Supabase Anonymous Authentication to track your game sessions, friend connections, and ratings without requiring an email address or password.
* **Gameplay & Rating Data:** We store match records, move timestamps, outcomes (win/loss/draw), and calculated Glicko-2 skill ratings and rating history to provide competitive matchmaking and statistics.
* **Technical Diagnostic Information:** General device details (OS version, device model, app version) for performance troubleshooting and crash analysis.

---

## 2. Information We DO NOT Collect

FADE **never** asks for, accesses, or collects:
* Your real legal name or date of birth.
* Your email address or phone number (unless you contact support directly).
* Your phone’s contact list, address book, or SMS messages.
* Precise GPS location or background location data.
* Camera, microphone, photo gallery, or local storage files.
* Advertising identifiers (IDFA/GAID) or third-party ad tracking cookies.

---

## 3. How We Use Your Information

We use the minimal data collected solely to:
1. Facilitate real-time multiplayer matches between players.
2. Synchronize game board states, clocks, and turns with low latency.
3. Compute and display fair ratings, leaderboards, and match history.
4. Maintain friend lists and enable mutual challenges.
5. Prevent cheating, protocol manipulation, or unauthorized automated bots.

---

## 4. Data Sharing & Third-Party Services

We do **not** sell, rent, monetize, or trade your personal data to any advertisers, data brokers, or third parties.

We utilize trusted enterprise infrastructure providers to operate the game:
* **Supabase Inc. (Database & Edge Functions):** All gameplay data, authentication tokens, and match history are stored in encrypted databases hosted in Frankfurt, Germany (EU region), complying with GDPR and international security standards.
* **Expo / 650 Industries:** Provides application runtime libraries and build infrastructure.

---

## 5. Data Retention & Account Deletion

We retain gameplay records only as long as your account remains active.

### How to Delete Your Account and Data:
You have the right to permanently erase your data at any time:
1. **In-App Deletion:** Open FADE $\rightarrow$ **Settings** $\rightarrow$ **Account** $\rightarrow$ tap **"Delete account & data"** $\rightarrow$ confirm.
2. **Immediate Effect:** All your records—including your username, rating history, match records, and friendships—are instantly and permanently deleted from our servers.
3. **Web Request:** You may also email `support@fade.game` or open an issue on our GitHub repository with your user ID to request manual deletion.

---

## 6. Children's Privacy

FADE does not knowingly collect or solicit personal information from children under the age of 13. If you believe that a child under 13 has provided personal data, please contact us and we will promptly delete the account.

---

## 7. Security

All communications between the FADE mobile application and our servers are encrypted using modern Transport Layer Security (TLS 1.3 / HTTPS and WSS). Database access is strictly partitioned using Row Level Security (RLS) policies.

---

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be reflected with an updated "Last Updated" date at the top of this document and accessible within the app.

---

## 9. Contact Us

If you have any questions or concerns regarding this Privacy Policy, please contact us:
* **Email:** `support@fade.game`
* **Repository:** [https://github.com/sarathbabu123/fade](https://github.com/sarathbabu123/fade)
