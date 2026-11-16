import type { Metadata } from "next";
import { Archive } from "@/components/Archive";

export const metadata: Metadata = { title: "Previous puzzles" };

export default function ArchivePage() {
  return <Archive />;
}
