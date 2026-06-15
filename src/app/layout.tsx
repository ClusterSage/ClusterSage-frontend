import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "ClusterSage", description: "Kubernetes observability SaaS" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
