import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ClusterSage",
  description: "Cluster activity, incidents, and next steps in one workspace.",
};

const themeInitScript = `
  (function () {
    try {
      var key = 'clustersage-theme';
      var stored = window.localStorage.getItem(key);
      var preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var theme = stored === 'dark' || stored === 'light' ? stored : preferred;
      document.documentElement.setAttribute('data-theme', theme);
    } catch (error) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="theme-transition antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
