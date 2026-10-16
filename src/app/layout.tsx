import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/store";

export const metadata: Metadata = {
  title: "Movement Markets - Web Trading Terminal",
  description:
    "Movement Markets trading workspace. Charts, watchlists, account activity, and order review.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
      data-mm-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('mm-theme');if(t==='light'||t==='dark'){var r=document.documentElement;r.dataset.mmTheme=t;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;}}catch(e){}})();` }} />
      </head>
      <body className="bg-[var(--mm-bg)] text-[var(--mm-ink)] antialiased overflow-hidden">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
