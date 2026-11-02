import { useState, useEffect } from "react";

export function useWindowSize() {
  const [size, setSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
    isMobile: typeof window !== "undefined" ? window.innerWidth < 768 : false,
  });

  useEffect(() => {
    let timeoutId: number | null = null;
    const handleResize = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
          isMobile: window.innerWidth < 768,
        });
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return size;
}
