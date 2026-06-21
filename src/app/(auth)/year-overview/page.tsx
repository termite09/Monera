import { redirect } from "next/navigation";

// Year Overview now lives as a tab inside Insights. Keep this route as a redirect
// so existing bookmarks and the installed PWA shortcut still work.
export default function YearOverviewPage() {
  redirect("/insights?tab=year");
}
