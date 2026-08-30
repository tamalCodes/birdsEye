"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/* Lenis drives the whole page's scroll: the wheel and anchor jumps are eased
   instead of stepping, which suits a site whose subject is a map you pan. It
   renders nothing - it only attaches to the window scroller.

   Two things it must stay honest about:
   - prefers-reduced-motion turns it off entirely, and back on if the OS
     preference flips while the page is open. Native scrolling then applies.
   - The anchor offset matches the sticky nav (h-16) plus the sections'
     scroll-mt-24, so in-page links land where the CSS says they should. */

const NAV_OFFSET = -96; // 6rem - matches scroll-mt-24 on the anchor targets

export default function SmoothScroll() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;

    function start() {
      if (lenis) return;
      lenis = new Lenis({
        autoRaf: true,
        anchors: { offset: NAV_OFFSET },
        duration: 1.05,
        // Standard expo-out: fast off the mark, long settle, no bounce.
        easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        // Touch devices already ease natively; overriding them feels laggy.
        syncTouch: false,
      });
    }

    function stop() {
      lenis?.destroy();
      lenis = null;
    }

    function sync() {
      if (query.matches) stop();
      else start();
    }

    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
      stop();
    };
  }, []);

  return null;
}
