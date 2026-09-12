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

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      // High-DPI physical backing store with CSS logical dimensions
      if (canvas.width !== Math.round(size * dpr) || canvas.height !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const center = size / 2;
      const radius = center - 14;
      const safeTopics =
        Array.isArray(topics) && topics.filter(Boolean).length > 0
          ? topics.filter(Boolean)
          : Array.from({ length: 8 }, (_, i) => ({
              id: `standby-${i + 1}`,
              topic: `Topic ${i + 1}`,
              status: 'available' as const,
              category: 'General',
            }));
      const totalSlices = safeTopics.length;

      const sliceAngle = (2 * Math.PI) / totalSlices;
      const hubRadius = Math.max(26, Math.round(size * 0.072));
      const hubInnerEdge = hubRadius + 14;
      const textOuterEdge = radius - 12;
      const maxAllowedWidth = Math.max(50, textOuterEdge - hubInnerEdge);

      ctx.clearRect(0, 0, size, size);

      // Outer glow ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();

      // Draw slices
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle);

      // Base target font size: significantly larger for projector display
      const targetBaseFontSize = Math.max(14, Math.min(24, Math.round(size * 0.034)));
      const minAllowedFontSize = Math.max(10, Math.round(size * 0.018));

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

        // Draw Topic Text using the full slice without truncation
        ctx.save();
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        const topicItem = safeTopics[i];
        const topicTitle = (topicItem?.topic || (topicItem as any)?.title || `Topic ${i + 1}`).trim();
        const rawTopicText = `${i + 1}. ${topicTitle}`;

        // Intelligent multi-line word wrapping and font scaling algorithm
        let currentFontSize = targetBaseFontSize;
        let lines: string[] = [];

        // Helper to measure text at given font size
        const measure = (text: string, fSize: number): number => {
          ctx.font = `bold ${fSize}px Outfit, sans-serif`;
          return ctx.measureText(text).width;
        };

        const words = rawTopicText.split(/\s+/).filter(Boolean);

        // Check if text fits on 1 line at targetBaseFontSize
        if (measure(rawTopicText, currentFontSize) <= maxAllowedWidth) {
          lines = [rawTopicText];
        } else if (words.length >= 2) {
          // Attempt 2-line balanced split
          let bestSplit = 1;
          let minDiff = Infinity;
          for (let s = 1; s < words.length; s++) {
            const l1 = words.slice(0, s).join(' ');
            const l2 = words.slice(s).join(' ');
            const diff = Math.abs(measure(l1, currentFontSize) - measure(l2, currentFontSize));
            if (diff < minDiff) {
              minDiff = diff;
              bestSplit = s;
            }
          }
          const l1 = words.slice(0, bestSplit).join(' ');
          const l2 = words.slice(bestSplit).join(' ');

          if (Math.max(measure(l1, currentFontSize), measure(l2, currentFontSize)) <= maxAllowedWidth) {
            lines = [l1, l2];
          } else if (words.length >= 4) {
            // Attempt 3-line balanced split for longer topics
            let bestSplit1 = 1;
            let bestSplit2 = 2;
            let minMaxLen = Infinity;

            for (let s1 = 1; s1 < words.length - 1; s1++) {
              for (let s2 = s1 + 1; s2 < words.length; s2++) {
                const p1 = words.slice(0, s1).join(' ');
                const p2 = words.slice(s1, s2).join(' ');
                const p3 = words.slice(s2).join(' ');
                const maxLen = Math.max(
                  measure(p1, currentFontSize),
                  measure(p2, currentFontSize),
                  measure(p3, currentFontSize)
                );
                if (maxLen < minMaxLen) {
                  minMaxLen = maxLen;
                  bestSplit1 = s1;
                  bestSplit2 = s2;
                }
              }
            }

            const p1 = words.slice(0, bestSplit1).join(' ');
            const p2 = words.slice(bestSplit1, bestSplit2).join(' ');
            const p3 = words.slice(bestSplit2).join(' ');

            if (minMaxLen <= maxAllowedWidth) {
              lines = [p1, p2, p3];
            } else {
              lines = [p1, p2, p3];
              // Scale down font size until the longest line fits within maxAllowedWidth
              while (
                currentFontSize > minAllowedFontSize &&
                Math.max(
                  measure(lines[0], currentFontSize),
                  measure(lines[1], currentFontSize),
                  measure(lines[2], currentFontSize)
                ) > maxAllowedWidth
              ) {
                currentFontSize--;
              }
            }
          } else {
            // Fall back to 2 lines with scaled-down font
            lines = [l1, l2];
            while (
              currentFontSize > minAllowedFontSize &&
              Math.max(measure(lines[0], currentFontSize), measure(lines[1], currentFontSize)) > maxAllowedWidth
            ) {
              currentFontSize--;
            }
          }
        } else {
          // Single long word: scale font down to fit
          lines = [rawTopicText];
          while (currentFontSize > minAllowedFontSize && measure(rawTopicText, currentFontSize) > maxAllowedWidth) {
            currentFontSize--;
          }
        }

        ctx.font = `bold ${currentFontSize}px Outfit, sans-serif`;

        // Render lines across the slice wedge without any truncation
        if (lines.length === 1) {
          ctx.fillText(lines[0], textOuterEdge, 0);
        } else if (lines.length === 2) {
          const lineSpacing = Math.round(currentFontSize * 1.16);
          ctx.fillText(lines[0], textOuterEdge, -lineSpacing * 0.52);
          ctx.fillText(lines[1], textOuterEdge, lineSpacing * 0.52);
        } else if (lines.length === 3) {
          const lineSpacing = Math.round(currentFontSize * 1.12);
          ctx.fillText(lines[0], textOuterEdge, -lineSpacing);
          ctx.fillText(lines[1], textOuterEdge, 0);
          ctx.fillText(lines[2], textOuterEdge, lineSpacing);
        }

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

      ctx.restore();
    },
    [topics, size, sliceColors]
  );

  useEffect(() => {
    drawWheel(rotationAngle);
  }, [drawWheel, rotationAngle]);

  const hubRadius = Math.max(26, Math.round(size * 0.072));
  const hubSize = hubRadius * 2;

  return (
    <div className="relative inline-block select-none" style={{ width: size, height: size }}>
      {/* Top Pointer Indicator */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none drop-shadow-xl"
        style={{ marginTop: -2 }}
      >
        <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[26px] border-t-amber-400 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]" />
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
        className="rounded-full shadow-[0_0_50px_rgba(168,85,247,0.3)] bg-slate-950 block"
      />
    </div>
  );
};
