import type { Metadata } from "next";
import HomeGate from "./home-gate";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function Home() {
  return <HomeGate />;
}
