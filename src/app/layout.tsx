import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Koya Care | Book an appointment",
  description: "Book and manage Koya Care appointments online.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
