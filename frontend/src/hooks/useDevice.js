import { useState, useEffect } from "react";

/**
 * Custom hook for reactive, high-performance device, breakpoint, and interaction capability detection.
 * 
 * Uses standard window.matchMedia listeners instead of brittle user-agent sniffing.
 * Supports hybrid devices (tablets with detachable keyboards, 2-in-1 laptops) by dynamically
 * tracking pointer and hover capabilities.
 */
export function useDevice() {
  const [deviceState, setDeviceState] = useState(() => {
    if (typeof window === "undefined") {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouchDevice: false,
        hasHover: true,
        isFinePointer: true,
        orientation: "landscape",
        width: 1200,
        height: 800,
      };
    }

    const w = window.innerWidth;
    const isMobile = w < 768;
    const isTablet = w >= 768 && w < 1024;
    const isDesktop = w >= 1024;
    const isTouchDevice = 
      "ontouchstart" in window || 
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      window.matchMedia("(pointer: coarse)").matches;
    const hasHover = window.matchMedia("(hover: hover)").matches;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const orientation = window.innerHeight > window.innerWidth ? "portrait" : "landscape";

    return {
      isMobile,
      isTablet,
      isDesktop,
      isTouchDevice,
      hasHover,
      isFinePointer,
      orientation,
      width: w,
      height: window.innerHeight,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mobileQuery = window.matchMedia("(max-width: 767.98px)");
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1023.98px)");
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const pointerFineQuery = window.matchMedia("(pointer: fine)");
    const hoverQuery = window.matchMedia("(hover: hover)");

    const updateDeviceMetrics = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isMobile = mobileQuery.matches;
      const isTablet = tabletQuery.matches;
      const isDesktop = desktopQuery.matches;
      const isTouchDevice = 
        "ontouchstart" in window || 
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        window.matchMedia("(pointer: coarse)").matches;
      const hasHover = hoverQuery.matches;
      const isFinePointer = pointerFineQuery.matches;
      const orientation = h > w ? "portrait" : "landscape";

      setDeviceState({
        isMobile,
        isTablet,
        isDesktop,
        isTouchDevice,
        hasHover,
        isFinePointer,
        orientation,
        width: w,
        height: h,
      });
    };

    // Initial check
    updateDeviceMetrics();

    // Attach listeners
    window.addEventListener("resize", updateDeviceMetrics, { passive: true });
    window.addEventListener("orientationchange", updateDeviceMetrics, { passive: true });

    // Pointer & hover listeners for hybrid devices (connecting/disconnecting mouse or keyboard)
    if (pointerFineQuery.addEventListener) {
      pointerFineQuery.addEventListener("change", updateDeviceMetrics);
      hoverQuery.addEventListener("change", updateDeviceMetrics);
    }

    return () => {
      window.removeEventListener("resize", updateDeviceMetrics);
      window.removeEventListener("orientationchange", updateDeviceMetrics);
      if (pointerFineQuery.removeEventListener) {
        pointerFineQuery.removeEventListener("change", updateDeviceMetrics);
        hoverQuery.removeEventListener("change", updateDeviceMetrics);
      }
    };
  }, []);

  return deviceState;
}

export default useDevice;
