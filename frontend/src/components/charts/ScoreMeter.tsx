import React from "react";
import { motion } from "motion/react";

interface ScoreMeterProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
}

export const ScoreMeter: React.FC<ScoreMeterProps> = ({
  score,
  maxScore = 20,
  size = 150,
  strokeWidth = 10,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedScore = Math.max(0, Math.min(maxScore, score));
  const progress = clampedScore / maxScore;
  const offset = circumference - progress * circumference;

  // Color selection based on 20-mark rubric thresholds
  let colorClass = "#10b981"; // Emerald (16-20)
  let glowColor = "rgba(16, 185, 129, 0.4)";
  let grade = "Exemplary";

  if (clampedScore < 6) {
    colorClass = "#ef4444"; // Red (0-5)
    glowColor = "rgba(239, 68, 68, 0.4)";
    grade = "Critical Deficit";
  } else if (clampedScore <= 10) {
    colorClass = "#f59e0b"; // Amber (6-10)
    glowColor = "rgba(245, 158, 11, 0.4)";
    grade = "Flagged (Under 10)";
  } else if (clampedScore <= 15) {
    colorClass = "#06b6d4"; // Cyan (11-15)
    glowColor = "rgba(6, 182, 212, 0.4)";
    grade = "Competent";
  }

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(30, 41, 59, 0.7)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress Ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorClass}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeLinecap="round"
          fill="transparent"
          style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
      </svg>

      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-mono text-3xl font-extrabold text-white tracking-tight"
        >
          {score}
          <span className="text-xs text-slate-400 font-normal">/{maxScore}</span>
        </motion.span>
        <span
          className="text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full mt-0.5"
          style={{ color: colorClass, backgroundColor: `${colorClass}18` }}
        >
          {grade}
        </span>
      </div>
    </div>
  );
};
