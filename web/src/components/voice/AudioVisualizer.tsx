/**
 * Audio Visualizer Component
 * Phase 4.1 Week 2: Voice Recording & Transcription
 *
 * Real-time audio visualization during recording
 * Displays waveform or frequency bars with smooth animation
 */

import React, { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  frequency?: number[];
  waveform?: number[];
  type?: 'bars' | 'waveform';
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isActive,
  frequency,
  waveform,
  type = 'bars',
  height = 80,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [data, setData] = useState<number[]>(
    waveform || frequency || Array.from({ length: 32 }, () => Math.random() * 0.8 + 0.1)
  );

  // Update data when waveform or frequency changes
  useEffect(() => {
    if (waveform) {
      setData(waveform);
    } else if (frequency) {
      setData(frequency);
    } else {
      // Generate random data if not provided
      setData(Array.from({ length: 32 }, () => Math.random() * 0.8 + 0.1));
    }
  }, [waveform, frequency]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const animate = () => {
      // Clear canvas
      ctx.fillStyle = isActive ? '#0f172a' : '#0f172a';
      ctx.fillRect(0, 0, rect.width, rect.height);

      if (type === 'bars') {
        drawBars(ctx, data, rect.width, height, isActive);
      } else {
        drawWaveform(ctx, data, rect.width, height, isActive);
      }

      if (isActive) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isActive) {
      animate();
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, data, type, height]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border border-slate-700 bg-slate-900"
      style={{ height: `${height}px` }}
    />
  );
};

/**
 * Draw frequency bars
 */
function drawBars(
  ctx: CanvasRenderingContext2D,
  data: number[],
  width: number,
  height: number,
  isActive: boolean
): void {
  const barWidth = width / data.length;
  const barGap = Math.max(1, barWidth * 0.15);
  const actualBarWidth = barWidth - barGap;

  data.forEach((value, index) => {
    const barHeight = (value * height) * 0.9; // 90% of canvas height
    const x = index * barWidth + barGap / 2;
    const y = height - barHeight;

    // Draw bar with gradient
    const gradient = ctx.createLinearGradient(x, y, x, height);
    gradient.addColorStop(0, isActive ? '#3b82f6' : '#475569');
    gradient.addColorStop(1, isActive ? '#1e40af' : '#334155');

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, actualBarWidth, barHeight);

    // Add slight glow effect
    if (isActive && value > 0.5) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, actualBarWidth, barHeight);
    }
  });
}

/**
 * Draw waveform
 */
function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: number[],
  width: number,
  height: number,
  isActive: boolean
): void {
  const centerY = height / 2;
  const pointSpacing = width / (data.length - 1);

  ctx.strokeStyle = isActive ? '#3b82f6' : '#475569';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(0, centerY);

  data.forEach((value, index) => {
    const x = index * pointSpacing;
    const amplitude = (value * centerY) * 0.8;
    const y = centerY - amplitude;

    ctx.lineTo(x, y);
  });

  ctx.stroke();

  // Draw reflection for symmetry
  ctx.strokeStyle = isActive ? '#1e40af' : '#334155';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(0, centerY);

  data.forEach((value, index) => {
    const x = index * pointSpacing;
    const amplitude = (value * centerY) * 0.8;
    const y = centerY + amplitude;

    ctx.lineTo(x, y);
  });

  ctx.stroke();
  ctx.globalAlpha = 1;
}
