import React, { useRef, useEffect, useCallback } from 'react';
import { MindToMicLogo } from './MindToMicLogo';
import type { Topic } from '../../types';

interface WheelCanvasProps {
  topics: Topic[];
  rotationAngle: number;
  size?: number;
  sliceColors?: string[];
  fontSize?: number;
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
  fontSize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawWheel = useCallback(
    (angle: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }

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
      const maxAllowedWidth = Math.max(40, textOuterEdge - hubInnerEdge);

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

      // Base target font size: user configured font size or auto proportioned
      const baseFontSize =
        typeof fontSize === 'number' && fontSize > 0
          ? fontSize
          : Math.max(10, Math.min(14, Math.round(size * 0.028)));

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

        // Draw Topic Text strictly inside slice boundaries with NO '..' ellipsis effect
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

        const words = rawTopicText.split(/\s+/).filter(Boolean);

        // Helper to measure text width
        const measure = (text: string, sz: number) => {
          ctx.font = `bold ${sz}px Outfit, sans-serif`;
          return ctx.measureText(text).width;
        };

        // Determine if text can fit in 1 line or 2 lines strictly inside the slice bounds
        // WITHOUT any '..' or '...' truncation effect
        let useTwoLines = false;
        let line1 = '';
        let line2 = '';
        let chosenFontSize = baseFontSize;

        // Check if 1 line fits at baseFontSize
        if (measure(rawTopicText, chosenFontSize) <= maxAllowedWidth) {
          useTwoLines = false;
        } else if (words.length >= 3) {
          // Check if a balanced 2-line split can fit safely in the wider outer half of the wedge
          let bestSplit = 1;
          let minDiff = Infinity;
          for (let s = 1; s < words.length; s++) {
            const l1 = words.slice(0, s).join(' ');
            const l2 = words.slice(s).join(' ');
            const diff = Math.abs(measure(l1, chosenFontSize) - measure(l2, chosenFontSize));
            if (diff < minDiff) {
              minDiff = diff;
              bestSplit = s;
            }
          }
          const cand1 = words.slice(0, bestSplit).join(' ');
          const cand2 = words.slice(bestSplit).join(' ');

          let twoLineFont = chosenFontSize;
          while (
            twoLineFont > 7 &&
            Math.max(measure(cand1, twoLineFont), measure(cand2, twoLineFont)) > maxAllowedWidth
          ) {
            twoLineFont -= 0.5;
          }

          const w1 = measure(cand1, twoLineFont);
          const w2 = measure(cand2, twoLineFont);
          const xInner1 = textOuterEdge - w1;
          const xInner2 = textOuterEdge - w2;
          const lineSpacing = twoLineFont * 0.55;
          const textMaxY = lineSpacing + twoLineFont * 0.5;

          // Geometric verification: at the innermost point of each line, is the text within the slice wedge?
          const tanHalf = Math.tan(sliceAngle / 2);
          const maxAllowedY1 = xInner1 * tanHalf * 0.86; // 14% safety buffer from slice border
          const maxAllowedY2 = xInner2 * tanHalf * 0.86;

          if (
            textMaxY <= maxAllowedY1 &&
            textMaxY <= maxAllowedY2 &&
            xInner1 >= hubInnerEdge &&
            xInner2 >= hubInnerEdge
          ) {
            useTwoLines = true;
            line1 = cand1;
            line2 = cand2;
            chosenFontSize = twoLineFont;
          }
        }

        // If not using 2 lines, scale font on single line until full text fits without ANY ellipsis
        if (!useTwoLines) {
          chosenFontSize = baseFontSize;
          while (chosenFontSize > 5 && measure(rawTopicText, chosenFontSize) > maxAllowedWidth) {
            chosenFontSize -= 0.25;
          }
        }

        ctx.font = `bold ${chosenFontSize}px Outfit, sans-serif`;

        if (useTwoLines) {
          const spacing = Math.round(chosenFontSize * 0.55);
          ctx.fillText(line1, textOuterEdge, -spacing);
          ctx.fillText(line2, textOuterEdge, spacing);
        } else {
          // Strictly on centerline (y = 0) - guaranteed 100% inside slice
          ctx.fillText(rawTopicText, textOuterEdge, 0);
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
    },
    [topics, size, sliceColors, fontSize]
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
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full shadow-[0_0_50px_rgba(168,85,247,0.3)] bg-slate-950 block"
      />
    </div>
  );
};
