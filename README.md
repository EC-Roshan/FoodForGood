# Food For Good — Surplus Food Redistribution Platform

**Food For Good** is a digital platform connecting surplus food providers (restaurants, caterers, hotels, event organizers) with verified Non-Governmental Organizations (NGOs) to ensure safe, edible food reaches communities in need rather than ending in landfills.

> **Note on Storage:** This front-end prototype uses browser `localStorage` as a mock database (mirroring future MySQL schemas) until the production backend API is integrated.

---

## 🚀 How to Run the Project

1. **Option 1 (Direct in Browser):**
   - Double-click [`index.html`](index.html) or right-click &rarr; *Open With &rarr; Chrome / Edge / Firefox*.
2. **Option 2 (VS Code Live Server - Recommended):**
   - Open the project folder in VS Code.
   - Install the **Live Server** extension.
   - Right-click `index.html` and choose **"Open with Live Server"** (runs at `http://127.0.0.1:5500/index.html`).

---

## 📄 Pages Included

| Page | File | Description |
|---|---|---|
| **Landing Page** | [`index.html`](index.html) | Hero, problem/solution breakdown, live animated impact counters, mobile menu, and smooth scrolling. |
| **Role Selector** | [`login.html`](login.html) | Interactive role gateway (Donor, NGO, Admin) with active session detection and keyboard navigation. |
| **Donor Sign-Up** | [`donor-signup.html`](donor-signup.html) | Donor registration with live password strength bar, dynamic individual/org toggle, and validation. |
| **Donor Login** | [`donor-login.html`](donor-login.html) | Secure SHA-256 login with "Remember me" and prototype Forgot Password reset. |
| **Donor Dashboard** | [`donor-dashboard.html`](donor-dashboard.html) | Complete donor workstation: Overview stats, impact metrics, Add Surplus Food form, My Listings with live countdowns, simulated NGO request testing, pickup scheduling, handover confirmation, History with CSV export, and Profile management. |
| **NGO Sign-Up** | [`ngo-signup.html`](ngo-signup.html) | NGO registration with Darpan/trust verification, certificate upload check, and pickup capability selection. |
| **NGO Login** | [`ngo-login.html`](ngo-login.html) | NGO authentication with role-guard and password recovery. |
| **NGO Dashboard** | [`ngo-dashboard.html`](ngo-dashboard.html) | Complete NGO workstation: Overview stats with nearby expiring food, Browse Food with live countdowns & search/filters, Send Pickup Request modal, My Requests tracking (Cancel, Schedule Pickup, Mark Collected), Distribution logging & CSV export, and Profile management with verification status. |
| **Admin Login** | [`admin-login.html`](admin-login.html) | Dedicated administrator portal. |
| **Admin Dashboard** | [`admin-dashboard.html`](admin-dashboard.html) | Comprehensive 9-section central admin workstation: Platform Overview (with Canvas 2D charts and urgent alerts), NGO/Donor Verifications (Approve/Reject with feedback), User Management (Block/Unblock, Password Reset, Provision Admins, CSV Export), Listings Directory (Lifecycle timeline drawer, Mark Expired, Cancel), Requests & Pickups Monitoring (Stale item highlighting, Admin cancellation), Distribution Audits, Reports & Audits (Custom date range filters, Top Donors/NGOs leaderboards, Printable format), System Activity Log (Comprehensive audit trail), and Platform Policies & Settings (Default expiry hours, Unverified donor controls, Danger Zone). |

---

## 🔑 Demo Login Credentials

The mock database auto-seeds verified demo accounts upon first load:

### 1. Platform Administrator (Demo Only)
- **Email:** `admin@foodforgood.in`
- **Password:** `Admin@123`
- *Access:* Opens [`admin-dashboard.html#overview`](admin-dashboard.html#overview) with full platform control across all 9 workstation sections.

### 2. Pre-seeded Donor Account
- **Email:** `donor@demo.com`
- **Password:** `password123`
- *Access:* Opens [`donor-dashboard.html`](donor-dashboard.html) (The Good Spoon Restaurant, Greater Noida).
- **Pending Donor for Verification Testing:** `royalfeast@demo.com` &middot; `password123` (The Royal Feast Caterers, Noida)

### 3. Pre-seeded Demo NGOs (All passwords: `password123`)
- **Roti Bank Ghaziabad (Verified):** `rotibank@demo.com` &middot; `password123` (Opens [`ngo-dashboard.html`](ngo-dashboard.html))
- **Hope Shelter Noida (Verified):** `hopeshelter@demo.com` &middot; `password123`
- **Annapurna Seva Delhi (Verified):** `annapurna@demo.com` &middot; `password123`
- **Jan Seva Trust Meerut (Pending Verification):** `pendingngo@demo.com` &middot; `password123` *(For testing verification review & banner)*
- **Samarpan Seva Sanstha (Pending Verification):** `samarpan@demo.com` &middot; `password123` *(For testing verification review queue)*
- **Global Care Alliance (Rejected):** `fakerelief@demo.com` &middot; `password123` *(For testing reviewed tab)*

---

## 🔄 How to Reset Demo Data

To clear all created listings, requests, sessions, and test users, and re-seed clean demo records:

1. Open DevTools in your browser (**F12** or **Ctrl + Shift + I**).
2. Go to the **Console** tab.
3. Paste and run this command:
   ```javascript
   Object.keys(localStorage)
     .filter(key => key.startsWith('ffg_'))
     .forEach(key => localStorage.removeItem(key));
   sessionStorage.removeItem('ffg_session');
   location.reload();
   ```
4. The page will reload with fresh initial demo data.

