import type { Metadata } from "next";
import { Game } from "@/components/Game";

export const metadata: Metadata = { title: "Unlimited" };

export default function UnlimitedPage() {
  return <Game mode="unlimited" />;
}
