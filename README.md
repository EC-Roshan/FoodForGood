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
| **NGO Dashboard** | [`ngo-dashboard.html`](ngo-dashboard.html) | Role-guarded placeholder page displaying verified/pending status and welcome banner. |
| **Admin Login** | [`admin-login.html`](admin-login.html) | Dedicated administrator portal. |
| **Admin Dashboard** | [`admin-dashboard.html`](admin-dashboard.html) | Role-guarded admin portal displaying live system-wide statistics (registered donors, pending NGOs, active listings, and distributions). |

---

## 🔑 Demo Login Credentials

The mock database auto-seeds verified demo accounts upon first load:

### 1. Platform Administrator (Demo Only)
- **Email:** `admin@foodforgood.in`
- **Password:** `Admin@123`
- *Access:* Opens [`admin-dashboard.html`](admin-dashboard.html) showing platform statistics.

### 2. Pre-seeded Donor Account
- **Email:** `donor@demo.com`
- **Password:** `password123`
- *Access:* Opens [`donor-dashboard.html`](donor-dashboard.html) (The Good Spoon Restaurant).

### 3. Pre-seeded Demo NGOs
- **Roti Bank Ghaziabad:** `rotibank@demo.com` &middot; `password123`
- **Hope Shelter Noida:** `hopeshelter@demo.com` &middot; `password123`
- **Annapurna Seva Delhi:** `annapurna@demo.com` &middot; `password123`

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

