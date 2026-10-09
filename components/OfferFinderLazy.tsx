"use client";

/** The finder ships the whole offer catalogue (about 60 KB gz); load it right after hydration as its own chunk so
 *  /find stays under the 250 KB first-load budget. Same UI, same behaviour, only the load moment moves. */
import dynamic from "next/dynamic";

const OfferFinder = dynamic(() => import("@/components/OfferFinder"), {
  ssr: false,
  loading: () => <div style={{ minHeight: 420 }} aria-busy="true" />,
});

export default function OfferFinderLazy(props: { compact?: boolean }) {
  return <OfferFinder {...props} />;
}
