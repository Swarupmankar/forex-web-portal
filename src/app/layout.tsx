import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/store';

export const metadata: Metadata = {
  title: 'Movement Markets - Web Trading Terminal',
  description: 'Next-generation Forex, Metals & Crypto Web Trading Terminal',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-mm-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[var(--mm-bg)] text-[var(--mm-ink)] antialiased overflow-hidden select-none">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
