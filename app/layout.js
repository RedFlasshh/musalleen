import "./globals.css";
import RegisterSW from "./register-sw";

export const metadata = {
  title: "Musalleen — Send Blessings on the Prophet ﷺ",
  description: "Musalleen — Those Who Send Blessings Upon the Prophet ﷺ. A quiet daily practice of durud/salawat.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Musalleen",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#0B1917",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
