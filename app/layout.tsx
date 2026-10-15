import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OWN MARS — Make your mark on Mars",
  description: "A virtual display space on a digital Mars."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
