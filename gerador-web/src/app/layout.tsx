import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { getThemeConfig } from "@/actions/theme-config";
import { ThemeWatcher } from "@/components/theme-watcher";

// A CSP nonce is generated per-request in proxy.ts and only gets attached to
// <script> tags when the page is dynamically rendered (Next.js has no request
// to read the nonce from during static prerendering). Without this, routes
// that don't otherwise touch a dynamic API (e.g. /setup, /) get statically
// optimized at build time and ship with no nonce on any script — every
// script load is then blocked by the CSP, leaving a blank, non-interactive
// page. Forcing dynamic rendering here guarantees every route gets a nonce.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getThemeConfig();
  const projectName = theme?.projectName || "AuthForge";
  
  return {
    title: `${projectName} — Painel Administrativo`,
    description: "Sistema de autenticação completo e seguro para suas aplicações",
    icons: theme?.faviconUrl ? [{ url: theme.faviconUrl }] : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeConfig();

  const dynamicStyles = theme ? `
    :root {
      --primary: ${theme.primaryColor};
      --secondary: ${theme.secondaryColor};
      --tertiary: ${theme.accentColor}; /* Accent = Tertiary no nosso CSS */
    }
    .dark {
      --primary: ${theme.primaryColor};
      --secondary: ${theme.secondaryColor};
      --tertiary: ${theme.accentColor};
    }
  ` : '';

  // Tema padrão definido no servidor para evitar flash
  const isDark = theme?.defaultTheme === 'dark' || !theme;

  return (
    <html lang="pt-BR" className={isDark ? 'dark' : ''} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {dynamicStyles && <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />}
      </head>
      <body className="antialiased">
        <ThemeWatcher defaultTheme={theme?.defaultTheme || 'dark'} />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
