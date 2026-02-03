/**
 * Audio Visualizer Component
 * Real-time frequency visualization during recording
 */

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  frequency?: number[];
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isActive,
  frequency = Array.from({ length: 32 }, () => Math.random()),
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / 32;
      const barGap = 2;

      frequency.forEach((value, index) => {
        const barHeight = (value * canvas.height) / 1.5;
        const x = index * barWidth + barGap;
        const y = canvas.height - barHeight;

        ctx.fillStyle = isActive ? '#3b82f6' : '#6b7280';
        ctx.fillRect(x, y, barWidth - barGap, barHeight);
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [frequency, isActive]);

  return <canvas ref={canvasRef} width={300} height={80} className='w-full h-20 rounded' />;
};
