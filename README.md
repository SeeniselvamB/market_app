# 🧺 Market Distributor Manager — Expo

Fully offline Expo app for fruit & vegetable market distributors.
All data stored in **AsyncStorage**. No backend, no internet required.
All text uses **Times New Roman** font.

---

## 📁 Project Structure

```
MarketDistributorExpo/
├── App.tsx                          ← Root (Expo entry)
├── app.json                         ← Expo config
├── package.json
├── babel.config.js
├── tsconfig.json
└── src/
    ├── utils/
    │   ├── types.ts                 ← TypeScript interfaces
    │   ├── helpers.ts               ← uid, formatCurrency, formatDate
    │   └── theme.ts                 ← Colors, Times New Roman font tokens
    ├── storage/
    │   ├── db.ts                    ← AsyncStorage CRUD
    │   └── AppContext.tsx           ← Global state + all business logic
    ├── navigation/
    │   └── AppNavigator.tsx         ← Stack + Bottom Tab navigator
    ├── components/
    │   └── UIComponents.tsx         ← Card, Button, Input, Badge, Toast...
    └── screens/
        ├── SetupScreen.tsx          ← 4-step setup wizard
        ├── DashboardScreen.tsx      ← Stats + purchase plan
        ├── OrdersScreen.tsx         ← Customer list
        ├── OrderEntryScreen.tsx     ← Enter quantities per product
        ├── BillingScreen.tsx        ← Billing customer list
        ├── BillingDetailScreen.tsx  ← Payment + share invoice
        └── SettingsScreen.tsx       ← Manage customers/products/business
```

---

## 🚀 Quick Start (VS Code)

### Step 1 — Install Expo CLI (if not already installed)

```bash
npm install -g expo-cli
```

Or use the newer EAS CLI:
```bash
npm install -g eas-cli
```

---

### Step 2 — Install project dependencies

Open VS Code terminal in the `MarketDistributorExpo` folder:

```bash
npm install
```

---

### Step 3 — Start the Expo dev server

```bash
npx expo start
```

This opens the **Expo Dev Tools** in your browser.

---

### Step 4 — Run on your phone (Easiest!)

1. Install the **Expo Go** app on your Android phone from Play Store.
2. Make sure your phone and laptop are on the **same Wi-Fi network**.
3. Open Expo Go on your phone.
4. Scan the **QR code** shown in the terminal or browser.
5. The app loads instantly on your phone! ✅

---

### Step 5 — Run on Android Emulator (optional)

If you have Android Studio installed:
```bash
npx expo start --android
```

---

## 📦 Build a Standalone APK (EAS Build — No Android Studio needed!)

This is the easiest way to get a real APK without Android Studio.

### 1. Create a free Expo account
Go to https://expo.dev and sign up (free).

### 2. Login from terminal
```bash
eas login
```

### 3. Configure EAS build
```bash
eas build:configure
```
Choose **Android** when prompted. This creates `eas.json`.

### 4. Build the APK
```bash
eas build --platform android --profile preview
```

This builds the APK **in the cloud** (free tier available).
When done, you'll get a **download link** for your APK file.
Copy the APK to your phone and install it!

> Note: First build takes ~10-15 minutes. Subsequent builds are faster.

---

### Alternative: Build locally (needs Android Studio)

```bash
npx expo run:android
```

---

## ⏱️ Daily Workflow in the App

1. **Morning** — Open Dashboard, check the Purchase Plan to know what to buy
2. **Take Orders** — Go to Orders tab, tap each customer, enter quantities
3. **Market** — Buy exactly what the Purchase Plan shows
4. **Evening** — Go to Billing tab, bill each customer
   - Edit delivered qty if different from ordered
   - Enter payment received
   - App auto-calculates: `Prev Pending + Today - Payment = New Pending`
5. **Share Invoice** — Tap "📄 Share Invoice" to send via WhatsApp/SMS
6. **Next Morning** — Tap "🔄 New Day" on Dashboard to start fresh

---

## ✨ Features

| Feature | Details |
|---|---|
| **Times New Roman** | All text uses TNR/TNR-Bold throughout the app |
| **AsyncStorage** | All data saved locally, 100% offline |
| **Setup Wizard** | 4-step first-time setup with auto-products |
| **Purchase Plan** | Aggregated market list from all orders |
| **Billing Formula** | Prev Pending + Today − Payment = New Pending |
| **Invoice Sharing** | Share via WhatsApp, SMS, Email using native share sheet |
| **Day Rollover** | New Day carries pending balances forward |
| **Settings** | Full CRUD for customers, products, business info |

---

## 🛠️ Troubleshooting

**`npm install` fails:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Metro bundler issues:**
```bash
npx expo start --clear
```

**Expo Go can't connect:**
- Make sure phone and PC are on same Wi-Fi
- Try: `npx expo start --tunnel`

**AsyncStorage warning:**
- Already included in package.json, should install automatically

---

## 📱 Requirements

- Node.js 18+
- Expo SDK 51
- Android 6.0+ (API 23+)
- iOS 13+

---

*Built with Expo + React Native + AsyncStorage. No Android Studio needed to run!*
