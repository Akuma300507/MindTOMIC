import React, { useRef, useEffect, useCallback } from 'react';
import { MindToMicLogo } from './MindToMicLogo';
import type { Topic } from '../../types';

interface WheelCanvasProps {
  topics: Topic[];
  rotationAngle: number;
  size?: number;
  sliceColors?: string[];
}

const DEFAULT_SLICE_COLORS = [
  '#9333ea', // purple-600
  '#2563eb', // blue-600
  '#0d9488', // teal-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
  '#4f46e5', // indigo-600
  '#059669', // emerald-600
  '#c026d3', // fuchsia-600
  '#0284c7', // sky-600
  '#ea580c', // orange-600
];

export const WheelCanvas: React.FC<WheelCanvasProps> = ({
  topics,
  rotationAngle,
  size = 460,
  sliceColors = DEFAULT_SLICE_COLORS,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawWheel = useCallback(
    (angle: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const center = size / 2;
      const radius = center - 18;
      const totalSlices = topics.length;
      if (totalSlices === 0) return;

      const sliceAngle = (2 * Math.PI) / totalSlices;
      const hubRadius = Math.max(30, Math.round(size * 0.075));
      const safeInnerMargin = hubRadius + 16;
      const textOuterEdge = radius - 14;
      const maxAllowedWidth = Math.max(50, textOuterEdge - safeInnerMargin);

      ctx.clearRect(0, 0, size, size);

      // Outer glow ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius + 8, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();

      // Draw slices
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle);

      for (let i = 0; i < totalSlices; i++) {
        const start = i * sliceAngle;
        const end = start + sliceAngle;
        const color = sliceColors[i % sliceColors.length];

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Topic Index / Truncated text (guaranteed never to enter center circle)
        ctx.save();
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        const fontSize = Math.max(10, Math.min(14, Math.round(size / 38)));
        ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 4;

        const rawTopicText = `${i + 1}. ${topics[i].topic}`;
        let displayText = rawTopicText;

        // Dynamically measure width to prevent any characters from going under center hub
        if (ctx.measureText(displayText).width > maxAllowedWidth) {
          let trimmed = rawTopicText;
          while (trimmed.length > 0 && ctx.measureText(trimmed + '…').width > maxAllowedWidth) {
            trimmed = trimmed.slice(0, -1).trimEnd();
          }
          displayText = trimmed + '…';
        }

        ctx.fillText(displayText, textOuterEdge, 4);
        ctx.restore();
      }

      ctx.restore();

      // Center Hub Ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, hubRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#020617';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    },
    [topics, size, sliceColors]
  );

  useEffect(() => {
    drawWheel(rotationAngle);
  }, [drawWheel, rotationAngle]);

  const hubRadius = Math.max(30, Math.round(size * 0.075));
  const hubSize = hubRadius * 2;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {/* Top Pointer Indicator */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none drop-shadow-xl"
        style={{ marginTop: -2 }}
      >
        <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[26px] border-t-amber-400" />
      </div>

      {/* Center Medallion with Mind to Mic Logo */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none flex items-center justify-center rounded-full bg-slate-950/95 border-2 sm:border-[3px] border-amber-400/90 shadow-[0_0_22px_rgba(245,158,11,0.5)] overflow-hidden"
        style={{ width: hubSize, height: hubSize }}
      >
        <MindToMicLogo size={Math.max(24, Math.round(hubSize * 0.50))} variant="emblem" showGlow={false} />
      </div>

      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-full shadow-[0_0_50px_rgba(168,85,247,0.3)] bg-slate-950"
      />
    </div>
  );
};
