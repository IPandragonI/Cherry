import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { StoreHydration } from "@/components/StoreHydration";
import { ThemeSync } from "@/components/ThemeSync";
import { SETTINGS_STORAGE_KEY } from "@/store/settings";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const LIGHT_THEME_COLOR = "#fcf6f2";
const DARK_THEME_COLOR = "#1c1718";

export const metadata: Metadata = {
  applicationName: "Cherry",
  title: { default: "Cherry", template: "%s · Cherry" },
  description: "Accordeur de guitare, bibliothèque d'accords et trouveur d'accords.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cherry" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: LIGHT_THEME_COLOR },
    { media: "(prefers-color-scheme: dark)", color: DARK_THEME_COLOR },
  ],
};

// Runs before first paint: applies the saved theme and language so there is no flash.
// "system" leaves data-theme unset, letting daisyUI's prefersdark media query decide.
const preHydrationScript = `(function(){try{var d=document.documentElement;var s=(JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_STORAGE_KEY,
)})||"{}").state)||{};if(s.theme==="light")d.dataset.theme="cherry";else if(s.theme==="dark")d.dataset.theme="cherry-dark";var l=s.locale;d.lang=l==="fr"||l==="en"?l:/^fr/i.test(navigator.language)?"fr":"en";}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${instrumentSans.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preHydrationScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <StoreHydration />
        <ThemeSync light={LIGHT_THEME_COLOR} dark={DARK_THEME_COLOR} />
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          reloadOnOnline={false}
        >
          {/* Fades in once at startup (this layout persists across tab changes). */}
          <div className="app-enter">{children}</div>
        </SerwistProvider>
      </body>
    </html>
  );
}
