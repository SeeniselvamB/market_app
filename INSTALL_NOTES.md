# V4 Installation Notes

## New Dependencies — Run BEFORE launching the app

```bash
npx expo install expo-print expo-sharing expo-file-system
```

These packages power the **📄 Generate Daily Report** button on the Dashboard.

| Package | Purpose |
|---|---|
| `expo-print` | Renders HTML → PDF file |
| `expo-sharing` | Opens native share sheet to save/send PDF |
| `expo-file-system` | Renames the PDF to `Daily_Report_YYYY_MM_DD.pdf` |

Without these, tapping "Generate Daily Report" will show an alert asking you to install them.

## Changes in V4

1. **Dashboard alignment** — All table rows use consistent flex layout (Product 1.5 / Qty 1 / Cost 1). Truck icon + DP stock text vertically centered. Tamil text lineHeight set throughout.
2. **DP stock panel header** — Single row with truck icon + name + Live badge using flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'.
3. **Remove "Mark as Delivery Person" from customers** — Delivery Person is always the Business Owner (set in Setup or Settings → Business tab). Customers can no longer be marked as DP.
4. **Daily Report PDF** — Dashboard button generates a PDF with: Customer Summary, Day Totals, Market Purchase list. Excludes DP transactions. Recalculates live every time pressed.
