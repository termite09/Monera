import { LayoutDashboard, List, PieChart, Upload, Settings } from "lucide-react";

/** The app's main sections, shared by the desktop sidebar and the phone bottom bar. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/insights", label: "Insights", icon: PieChart },
  { href: "/upload", label: "Statements", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];
