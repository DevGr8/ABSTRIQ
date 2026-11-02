import React from "react";
import { motion } from "motion/react";
import type { CriterionScore } from "../../types";

interface CriteriaBreakdownProps {
  scores: Record<string, CriterionScore>;
}

export const CriteriaBreakdown: React.FC<CriteriaBreakdownProps> = ({ scores }) => {
  const items = Object.entries(scores);

  const getLevelLabel = (score: number) => {
    switch (score) {
      case 4:
        return "Exemplary (4)";
      case 3:
        return "Good (3)";
      case 2:
        return "Adequate (2)";
      case 1:
        return "Poor (1)";
      default:
        return "Missing (0)";
    }
  };

  const getColor = (score: number) => {
    if (score >= 4) return "bg-emerald-400 shadow-neon-green-sm";
    if (score === 3) return "bg-cyan-400";
    if (score === 2) return "bg-amber-400";
    return "bg-rose-500";
  };

  return (
    <div className="space-y-3.5">
      {items.map(([key, data], idx) => {
        const percent = (data.score / (data.max || 4)) * 100;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-200 capitalize">
                {data.title || key}
              </span>
              <div className="flex items-center space-x-2 font-mono">
                <span className="text-[11px] text-slate-400">{getLevelLabel(data.score)}</span>
                <span className="font-bold text-white">
                  {data.score}
                  <span className="text-slate-500 font-normal">/{data.max || 4}</span>
                </span>
              </div>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden relative border border-slate-700/50">
              <motion.div
                className={`h-full rounded-full transition-all ${getColor(data.score)}`}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.8, delay: idx * 0.1, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
