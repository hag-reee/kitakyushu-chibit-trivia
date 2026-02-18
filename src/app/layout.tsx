import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "北九州ちびっとトリビア — どんな単語でも北九州の小ネタに変換",
  description:
    "単語一つで、北九州にまつわる豆知識をちびっと紹介。",
  icons: {
    icon: [
      { url: "/favicon-16x16.ico", sizes: "16x16", type: "image/x-icon" },
      { url: "/favicon-32x32.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  },
  openGraph: {
    title: "北九州ちびっとトリビア",
    description: "単語一つで、北九州にまつわる豆知識をちびっと紹介。",
    type: "website",
    images: [
      {
        url: "/ogp.png",
        width: 1200,
        height: 630,
        alt: "北九州ちびっとトリビア",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "北九州ちびっとトリビア",
    description: "単語一つで、北九州にまつわる豆知識をちびっと紹介。",
    images: ["/ogp.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Ysabeau+Infant:ital,wght@0,1..1000;1,1..1000&family=Zen+Kaku+Gothic+New&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
