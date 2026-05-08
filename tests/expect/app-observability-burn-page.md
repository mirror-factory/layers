# Expect flow: app/observability/burn/page.tsx

Open `/observability/burn`.

Verify:

- The page renders the Vendor Burn Rate header.
- Summary tiles show highest cap use, rows at or above 80%, observed rows, and capped rows.
- The vendor table includes Vercel AI Gateway, AssemblyAI, Supabase storage, Supabase egress, Inngest, Resend, and Stripe.
- Rows show Vendor, Daily Burn, 30d Run, Cap, Cap Use, Alerts, Source, and Kill Switch columns.
- Rows are sorted by 30-day run-rate as a percentage of the cap, descending.
- Resize to mobile width and confirm the table scrolls horizontally without overlapping text.
- Check for console errors.
