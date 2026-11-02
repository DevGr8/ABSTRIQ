import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useWindowSize } from "../../hooks/useWindowSize";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  baseAlpha: number;
  pulseSpeed: number;
}

export const GenerativeCanvasBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();
  const { isMobile } = useWindowSize();
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    // Particle Palette
    const colors = [
      "rgba(0, 255, 136, ",  // Cyber green
      "rgba(16, 185, 129, ", // Emerald
      "rgba(6, 182, 212, ",  // Cyan
      "rgba(148, 163, 184, ", // Slate grey
    ];

    // Determine count based on device capability
    const particleCount = reducedMotion ? (isMobile ? 20 : 35) : (isMobile ? 35 : 75);
    const maxConnectionDistance = isMobile ? 90 : 130;
    const mouseRadius = isMobile ? 100 : 160;

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const baseAlpha = 0.2 + Math.random() * 0.45;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: 1.2 + Math.random() * 2.0,
        color,
        alpha: baseAlpha,
        baseAlpha,
        pulseSpeed: 0.01 + Math.random() * 0.02,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Draw subtle ambient radial glow fields
      const grad1 = ctx.createRadialGradient(
        width * 0.25,
        height * 0.3,
        10,
        width * 0.25,
        height * 0.3,
        width * 0.5
      );
      grad1.addColorStop(0, "rgba(16, 185, 129, 0.04)");
      grad1.addColorStop(1, "rgba(5, 8, 17, 0)");
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      const grad2 = ctx.createRadialGradient(
        width * 0.8,
        height * 0.7,
        10,
        width * 0.8,
        height * 0.7,
        width * 0.4
      );
      grad2.addColorStop(0, "rgba(6, 182, 212, 0.035)");
      grad2.addColorStop(1, "rgba(5, 8, 17, 0)");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Gentle bounds bounce
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          // Pulse opacity
          p.alpha = p.baseAlpha + Math.sin(time * 2 + i) * 0.15;

          // Mouse interaction (gentle attraction/repulsion)
          if (mouseRef.current.active) {
            const dx = mouseRef.current.x - p.x;
            const dy = mouseRef.current.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouseRadius && dist > 0) {
              const force = (1 - dist / mouseRadius) * 0.4;
              p.x -= (dx / dist) * force;
              p.y -= (dy / dist) * force;
            }
          }
        }

        // Draw particle point
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${Math.max(0.05, Math.min(1, p.alpha))})`;
        ctx.shadowColor = p.color === colors[0] ? "#00ff88" : "#10b981";
        ctx.shadowBlur = p.radius > 2 ? 8 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw connections between nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectionDistance) {
            const lineAlpha = (1 - dist / maxConnectionDistance) * 0.16;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(16, 185, 129, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        // Connect to mouse cursor
        if (mouseRef.current.active) {
          const mdx = mouseRef.current.x - p.x;
          const mdy = mouseRef.current.y - p.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < mouseRadius) {
            const mAlpha = (1 - mdist / mouseRadius) * 0.28;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = `rgba(0, 255, 136, ${mAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      if (!reducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    // Tab visibility handling - pause loop when tab is backgrounded
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else if (!reducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reducedMotion, isMobile]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* 2D Generative Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full opacity-70"
        aria-hidden="true"
      />
      {/* Subtle Lab Grid Overlay */}
      <div className="absolute inset-0 lab-grid-bg opacity-30 pointer-events-none" />
      {/* Ambient Gradient Highlights */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
};
