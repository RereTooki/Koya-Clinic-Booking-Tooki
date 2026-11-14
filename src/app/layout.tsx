import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Koya Care | Book an appointment",
  description: "A focused clinic appointment booking experience.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
