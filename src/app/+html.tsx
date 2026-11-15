import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const swRegistrationScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    if (window.location.hostname === 'localhost' && window.location.port === '8081') {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (reg) { reg.unregister(); });
      });
      return;
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (err) {
      console.warn('[SW] Registration failed:', err);
    });
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0b0e11" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Mediscan" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: swRegistrationScript }} />
      </head>
      <body style={{ backgroundColor: '#0b0e11', margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
