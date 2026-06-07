# FlowMoney — Expense Tracker

Expo + React Native app with Supabase backend. Tracks personal expenses via ICICI bank CSV import and Google Pay Takeout JSON.

## Stack
- **Frontend**: Expo Router (React Native + Web), TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Charts**: react-native-svg (SvgBarChart, SvgLineChart, DonutChart, SpendCalendar)
- **Deploy**: Vercel (flowmoney-ten.vercel.app)
- **Repo**: https://github.com/Gouri174/flowmoney

## Dev Commands
```bash
npx expo start          # Start dev server (web + mobile)
npx expo export --platform web  # Build for Vercel
git push                # Vercel auto-deploys on push to main
```

## Project Structure
```
app/(tabs)/
  index.tsx        — Dashboard (summary cards, calendar, projection, recurring)
  transactions.tsx — All transactions with date/category filters + CSV/GPay import
  insights.tsx     — Charts with period filter + drill-down (donut, bar, line)
  budget.tsx       — Monthly budget by category with month navigation
  notifications.tsx
  profile.tsx

components/
  SvgBarChart.tsx    — Bar chart with optional reference line
  SvgLineChart.tsx   — Area line chart
  DonutChart.tsx     — SVG donut/pie chart
  SpendCalendar.tsx  — Heat-map calendar (green/amber/red by spend intensity)
  MerchantIcon.tsx
  CategoryBadge.tsx

context/
  AppContext.tsx    — transactions, budgets, import functions
  AuthContext.tsx   — Supabase auth, user profile

services/
  csvImporter.ts   — ICICI bank CSV parser + UPI merchant extractor
  takeoutImporter.ts — Google Pay Takeout JSON parser
  categorizer.ts   — Rule-based auto-categorization

constants/
  theme.ts         — COLORS, SPACING, RADIUS, FONT, CATEGORY_COLORS, ALL_CATEGORIES
```

## Supabase
- URL: https://ggrdhmecomgoeijoxtzz.supabase.co
- Tables: `profiles`, `transactions`, `budgets`, `notifications`
- RLS enabled on all tables
- Env vars in `.env` (gitignored): EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

## Key Conventions
- All amounts in INR (₹), stored as numeric in Supabase
- `is_debit: true` = expense, `is_debit: false` = income/credit
- `external_id` = dedup key, format: `csv_${date}_${amount}_${index}`
- Categories defined in `constants/theme.ts` → ALL_CATEGORIES array
- Date strings stored as ISO format, parsed with `new Date(t.date)`
- Charts use `onPress` per data point for drill-down into transactions
- Drill-down uses stack navigation in insights (push/pop), single modal in dashboard/budget

## What's Built
- ✅ CSV import (ICICI format) with UPI merchant extraction
- ✅ Google Pay Takeout JSON import
- ✅ Auto-categorization (rule-based regex patterns)
- ✅ Dashboard: today/week/month cards (tappable), projection, recurring, calendar, custom period picker
- ✅ Cash flow heat-map calendar with month navigation
- ✅ Insights: period filter (this/last/3m/custom), donut, daily line, day-of-week bar
- ✅ Budget: per-category monthly limits with month navigation, tap category → see transactions
- ✅ Transactions: date range + category filters, import modal
- ✅ Drill-down on all charts → transaction list → tap merchant → all transactions from that merchant
