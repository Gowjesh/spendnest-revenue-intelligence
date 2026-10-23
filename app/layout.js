// app/layout.js
import './globals.css';

export const metadata = {
  title: 'Revenue Intelligence Inbox',
  description: 'Managerial revenue intelligence inbox for sales calls, meetings, evidence-backed routing, and activity analysis.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
