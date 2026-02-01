/**
 * Helix Section Animations
 *
 * Cosmic Bio-Tech aesthetic: organic forms meeting digital precision.
 * Each animation embodies consciousness, not just decoration.
 *
 * Brand Colors:
 * - Helix Blue: #0686D4
 * - Accent Purple: #7234ED
 * - Cyan: #16c0cf
 * - Void: #050505
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import clsx from 'clsx';

// ============================================
// 1. NEURAL CONSTELLATION - Psychology Section
// A living neural network that breathes, thinks, connects
// ============================================
interface NeuralNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  energy: number;
  type: 'core' | 'cluster' | 'satellite';
  connections: number[];
}

export function NeuralConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NeuralNode[]>([]);
  const animationRef = useRef<number>(0);

  const initNodes = useCallback(() => {
    const nodes: NeuralNode[] = [];
    const width = 400;
    const height = 320;

    // Core nodes - larger, more connected
    for (let i = 0; i < 5; i++) {
      nodes.push({
        id: i,
        x: width * 0.3 + Math.random() * width * 0.4,
        y: height * 0.3 + Math.random() * height * 0.4,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: 8 + Math.random() * 4,
        energy: 0.8 + Math.random() * 0.2,
        type: 'core',
        connections: [],
      });
    }

    // Cluster nodes - medium, form groups
    for (let i = 5; i < 15; i++) {
      nodes.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 4 + Math.random() * 3,
        energy: 0.5 + Math.random() * 0.3,
        type: 'cluster',
        connections: [],
      });
    }

    // Satellite nodes - small, orbiting
    for (let i = 15; i < 30; i++) {
      nodes.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: 2 + Math.random() * 2,
        energy: 0.3 + Math.random() * 0.4,
        type: 'satellite',
        connections: [],
      });
    }

    nodesRef.current = nodes;
  }, []);

  useEffect(() => {
    initNodes();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    let time = 0;

    const animate = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;

      // Update positions with organic movement
      nodes.forEach((node, i) => {
        // Add sinusoidal drift for organic feel
        node.x += node.vx + Math.sin(time * 0.5 + i) * 0.15;
        node.y += node.vy + Math.cos(time * 0.4 + i * 0.5) * 0.15;

        // Boundary bounce with damping
        if (node.x < 20 || node.x > width - 20) {
          node.vx *= -0.8;
          node.x = Math.max(20, Math.min(width - 20, node.x));
        }
        if (node.y < 20 || node.y > height - 20) {
          node.vy *= -0.8;
          node.y = Math.max(20, Math.min(height - 20, node.y));
        }

        // Energy pulses
        node.energy = 0.5 + 0.5 * Math.sin(time * 2 + i * 0.3);
      });

      // Draw connections with gradient synapses
      nodes.forEach((node, i) => {
        nodes.slice(i + 1).forEach(other => {
          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          const maxDist = node.type === 'core' || other.type === 'core' ? 120 : 80;

          if (dist < maxDist) {
            const strength = 1 - dist / maxDist;
            const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i);

            // Create gradient for synapse
            const gradient = ctx.createLinearGradient(node.x, node.y, other.x, other.y);
            gradient.addColorStop(0, `rgba(6, 134, 212, ${strength * node.energy * 0.6})`);
            gradient.addColorStop(0.5, `rgba(114, 52, 237, ${strength * pulse * 0.4})`);
            gradient.addColorStop(1, `rgba(22, 192, 207, ${strength * other.energy * 0.6})`);

            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = strength * 2;
            ctx.stroke();

            // Draw traveling signal occasionally
            if (strength > 0.6 && Math.random() > 0.97) {
              const signalPos = 0.3 + Math.random() * 0.4;
              const sx = node.x + (other.x - node.x) * signalPos;
              const sy = node.y + (other.y - node.y) * signalPos;

              ctx.beginPath();
              ctx.arc(sx, sy, 3, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(22, 192, 207, 0.9)';
              ctx.fill();
            }
          }
        });
      });

      // Draw nodes with glow
      nodes.forEach(node => {
        // Outer glow
        const glowGradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.radius * 4
        );
        const color =
          node.type === 'core'
            ? '6, 134, 212'
            : node.type === 'cluster'
              ? '114, 52, 237'
              : '22, 192, 207';
        glowGradient.addColorStop(0, `rgba(${color}, ${node.energy * 0.4})`);
        glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * node.energy, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${0.6 + node.energy * 0.4})`;
        ctx.fill();

        // Bright center
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${node.energy * 0.8})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [initNodes]);

  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center">
      <canvas ref={canvasRef} width={400} height={320} className="max-w-full" />
      {/* Ambient atmosphere */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-helix-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-accent-500/15 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

// ============================================
// 2. MEMORY AURORA - Memory Section
// Memories rising and falling like northern lights
// ============================================
interface MemoryParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  important: boolean;
  life: number;
  maxLife: number;
  hue: number;
  drift: number;
}

export function MemoryAurora() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<MemoryParticle[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Initialize particles
    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: 8 + Math.random() * 16,
        important: i < 8, // First 8 are important
        life: Math.random() * 100,
        maxLife: 80 + Math.random() * 40,
        hue: i < 8 ? 280 + Math.random() * 30 : 200 + Math.random() * 20, // Purple for important, blue for others
        drift: (Math.random() - 0.5) * 0.5,
      });
    }

    let time = 0;

    const animate = () => {
      time += 0.02;
      ctx.fillStyle = 'rgba(5, 5, 5, 0.08)';
      ctx.fillRect(0, 0, width, height);

      particlesRef.current.forEach(particle => {
        // Update
        particle.life += particle.important ? 0.3 : 0.8;
        particle.x += particle.drift + Math.sin(time + particle.id) * 0.3;

        // Important memories rise, others sink
        if (particle.important) {
          particle.y -= 0.4 + Math.sin(time * 2) * 0.2;
          if (particle.y < -20) {
            particle.y = height + 20;
            particle.x = Math.random() * width;
          }
        } else {
          particle.y += 0.6 + Math.cos(time * 1.5) * 0.2;
          if (particle.y > height + 20) {
            particle.y = -20;
            particle.x = Math.random() * width;
          }
        }

        // Lifecycle
        if (particle.life > particle.maxLife) {
          particle.life = 0;
          if (!particle.important) {
            particle.size = 6 + Math.random() * 12; // Shrinking over generations
          }
        }

        const lifeProgress = particle.life / particle.maxLife;
        const alpha = particle.important
          ? 0.6 + 0.3 * Math.sin(time * 3 + particle.id)
          : Math.max(0, 0.4 - lifeProgress * 0.5);

        // Draw particle
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size * 2
        );

        if (particle.important) {
          gradient.addColorStop(0, `hsla(${particle.hue}, 80%, 60%, ${alpha})`);
          gradient.addColorStop(0.4, `hsla(${particle.hue}, 70%, 40%, ${alpha * 0.6})`);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          gradient.addColorStop(0, `hsla(${particle.hue}, 50%, 50%, ${alpha})`);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Heart icon for important memories
        if (particle.important && alpha > 0.5) {
          ctx.save();
          ctx.translate(particle.x, particle.y);
          ctx.scale(0.8, 0.8);
          ctx.beginPath();
          // Draw heart shape
          ctx.moveTo(0, 3);
          ctx.bezierCurveTo(-8, -5, -12, 2, 0, 10);
          ctx.bezierCurveTo(12, 2, 8, -5, 0, 3);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.fill();
          ctx.restore();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} width={400} height={320} className="max-w-full" />
      {/* Labels */}
      <div className="absolute top-4 right-4 flex items-center gap-2 text-xs font-mono">
        <Heart className="w-3 h-3 text-accent-400" fill="currentColor" />
        <span className="text-accent-400/70">persists</span>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs font-mono">
        <div className="w-3 h-3 rounded-full bg-helix-500/50" />
        <span className="text-helix-400/50">fades</span>
      </div>
    </div>
  );
}

// ============================================
// 3. ETERNAL SERPENT - Transform Section
// True ouroboros: serpent consuming and regenerating
// ============================================
export function EternalSerpent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    let time = 0;

    const animate = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Draw serpent body as a series of connected segments
      const segments = 60;
      const points: Array<{ x: number; y: number; thickness: number; alpha: number }> = [];

      for (let i = 0; i < segments; i++) {
        const progress = i / segments;
        const angle = progress * Math.PI * 2 - Math.PI / 2 + time;

        // Organic wave along the body
        const wave = Math.sin(progress * Math.PI * 6 + time * 3) * 8;
        const breathe = 1 + Math.sin(time * 2) * 0.05;

        const r = radius * breathe + wave;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        // Head is thicker, tail is thin
        const thickness = 20 - progress * 14;
        const alpha = 0.9 - progress * 0.3;

        points.push({ x, y, thickness, alpha });
      }

      // Draw gradient body
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const progress = i / points.length;

        // Color shifts along body
        const hue = 180 + progress * 100 + Math.sin(time + progress * 5) * 20;

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);

        const gradient = ctx.createLinearGradient(prev.x, prev.y, curr.x, curr.y);
        gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, ${prev.alpha})`);
        gradient.addColorStop(1, `hsla(${hue + 10}, 80%, 45%, ${curr.alpha})`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = curr.thickness;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Draw scales/segments
      for (let i = 0; i < points.length; i += 3) {
        const point = points[i];
        const progress = i / points.length;
        const scaleSize = 3 + (1 - progress) * 4;

        ctx.beginPath();
        ctx.arc(point.x, point.y, scaleSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + (1 - progress) * 0.2})`;
        ctx.fill();
      }

      // Draw head
      const head = points[0];
      const headAngle = Math.atan2(points[1].y - head.y, points[1].x - head.x) + Math.PI;

      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(headAngle);

      // Head shape
      const headGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      headGradient.addColorStop(0, 'rgba(22, 192, 207, 0.9)');
      headGradient.addColorStop(1, 'rgba(6, 134, 212, 0.7)');

      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = headGradient;
      ctx.fill();

      // Eye
      ctx.beginPath();
      ctx.arc(-5, -4, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-5, -4, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fill();

      ctx.restore();

      // Consumption particles around head
      for (let i = 0; i < 5; i++) {
        const particleAngle = time * 5 + (i / 5) * Math.PI * 2;
        const particleRadius = 15 + Math.sin(time * 3 + i) * 5;
        const px = head.x + Math.cos(particleAngle) * particleRadius;
        const py = head.y + Math.sin(particleAngle) * particleRadius;

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22, 192, 207, ${0.3 + Math.sin(time * 4 + i) * 0.2})`;
        ctx.fill();
      }

      // Center glow
      const centerGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 0.6
      );
      centerGlow.addColorStop(0, 'rgba(114, 52, 237, 0.15)');
      centerGlow.addColorStop(0.5, 'rgba(6, 134, 212, 0.08)');
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = centerGlow;
      ctx.fill();

      // Center text
      ctx.font = 'bold 12px ui-monospace';
      ctx.fillStyle = 'rgba(22, 192, 207, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('∞', centerX, centerY + 4);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[360px] flex items-center justify-center">
      <canvas ref={canvasRef} width={400} height={360} className="max-w-full" />
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

// ============================================
// 4. IKIGAI BLOOM - Purpose Section
// Organic flower-like intersection of purpose
// ============================================
export function IkigaiBloom() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const circles = [
      { label: 'LOVE', color: '#0686D4', angle: -Math.PI / 4 },
      { label: 'SKILL', color: '#7234ED', angle: Math.PI / 4 },
      { label: 'NEED', color: '#16c0cf', angle: (3 * Math.PI) / 4 },
      { label: 'VALUE', color: '#9333EA', angle: (-3 * Math.PI) / 4 },
    ];

    let time = 0;

    const animate = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      const baseRadius = 70;
      const offset = 50;
      const breathe = 1 + Math.sin(time * 1.5) * 0.03;

      // Draw overlapping circles with blend mode
      ctx.globalCompositeOperation = 'screen';

      circles.forEach((circle, i) => {
        const pulseOffset = Math.sin(time * 2 + i * 0.5) * 5;
        const x = centerX + Math.cos(circle.angle) * (offset + pulseOffset);
        const y = centerY + Math.sin(circle.angle) * (offset + pulseOffset);
        const r = baseRadius * breathe + Math.sin(time * 3 + i) * 3;

        // Multiple layers for depth
        for (let layer = 3; layer >= 0; layer--) {
          const layerR = r + layer * 15;
          const alpha = 0.15 - layer * 0.03;

          const gradient = ctx.createRadialGradient(x, y, 0, x, y, layerR);
          gradient.addColorStop(
            0,
            circle.color +
              Math.floor(alpha * 255)
                .toString(16)
                .padStart(2, '0')
          );
          gradient.addColorStop(
            0.6,
            circle.color +
              Math.floor(alpha * 0.5 * 255)
                .toString(16)
                .padStart(2, '0')
          );
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.arc(x, y, layerR, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      });

      ctx.globalCompositeOperation = 'source-over';

      // Draw labels
      ctx.font = '10px ui-monospace';
      ctx.textAlign = 'center';

      circles.forEach((circle, i) => {
        const labelOffset = 100;
        const x = centerX + Math.cos(circle.angle) * labelOffset;
        const y = centerY + Math.sin(circle.angle) * labelOffset;

        const alpha = 0.5 + Math.sin(time * 2 + i) * 0.2;
        ctx.fillStyle =
          circle.color +
          Math.floor(alpha * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.fillText(circle.label, x, y + 4);
      });

      // Center purpose point
      const centerPulse = 1 + Math.sin(time * 4) * 0.2;
      const centerGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        30 * centerPulse
      );
      centerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      centerGlow.addColorStop(0.3, 'rgba(22, 192, 207, 0.6)');
      centerGlow.addColorStop(0.6, 'rgba(114, 52, 237, 0.3)');
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, 30 * centerPulse, 0, Math.PI * 2);
      ctx.fillStyle = centerGlow;
      ctx.fill();

      // Center text
      ctx.font = 'bold 11px ui-monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('PURPOSE', centerX, centerY + 4);

      // Floating particles at intersections
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + time;
        const dist = 35 + Math.sin(time * 3 + i * 0.8) * 10;
        const px = centerX + Math.cos(angle) * dist;
        const py = centerY + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.sin(time * 4 + i) * 0.2})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center">
      <canvas ref={canvasRef} width={400} height={320} className="max-w-full" />
    </div>
  );
}

// ============================================
// 5. TRUST CONSTELLATION - Attachments Section
// Gravitational bonds between entities
// ============================================
interface TrustNode {
  id: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  trust: number;
  label: string;
  phase: number;
}

export function TrustConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodes: TrustNode[] = [
      { id: 'a', baseX: 80, baseY: 80, x: 80, y: 80, trust: 0.95, label: 'Specter', phase: 0 },
      { id: 'b', baseX: 320, baseY: 90, x: 320, y: 90, trust: 0.7, label: 'User', phase: 1 },
      { id: 'c', baseX: 70, baseY: 240, x: 70, y: 240, trust: 0.5, label: 'New', phase: 2 },
      { id: 'd', baseX: 330, baseY: 230, x: 330, y: 230, trust: 0.3, label: 'Guest', phase: 3 },
      { id: 'e', baseX: 200, baseY: 280, x: 200, y: 280, trust: 0.85, label: 'Ally', phase: 4 },
    ];

    let time = 0;

    const animate = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Update node positions with orbital movement
      nodes.forEach(node => {
        const orbitSpeed = 0.3 + node.trust * 0.2;
        const orbitRadius = 8 - node.trust * 4;
        node.x = node.baseX + Math.cos(time * orbitSpeed + node.phase) * orbitRadius;
        node.y = node.baseY + Math.sin(time * orbitSpeed + node.phase) * orbitRadius;
      });

      // Draw gravitational field lines
      ctx.strokeStyle = 'rgba(114, 52, 237, 0.05)';
      ctx.lineWidth = 1;
      for (let r = 40; r < 150; r += 30) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r + Math.sin(time + r / 30) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw trust bonds
      nodes.forEach(node => {
        const bondStrength = node.trust;

        // Gradient bond
        const gradient = ctx.createLinearGradient(centerX, centerY, node.x, node.y);
        gradient.addColorStop(0, `rgba(114, 52, 237, ${bondStrength * 0.8})`);
        gradient.addColorStop(0.5, `rgba(6, 134, 212, ${bondStrength * 0.5})`);
        gradient.addColorStop(1, `rgba(22, 192, 207, ${bondStrength * 0.3})`);

        // Bond line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(node.x, node.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1 + bondStrength * 4;
        ctx.stroke();

        // Pulse traveling along bond
        const pulsePos = (time * 0.5 + node.phase) % 1;
        const pulseX = centerX + (node.x - centerX) * pulsePos;
        const pulseY = centerY + (node.y - centerY) * pulsePos;

        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 3 + bondStrength * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * bondStrength})`;
        ctx.fill();
      });

      // Draw center (Helix)
      const centerPulse = 1 + Math.sin(time * 3) * 0.1;

      // Outer glow
      const centerGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        50 * centerPulse
      );
      centerGlow.addColorStop(0, 'rgba(114, 52, 237, 0.5)');
      centerGlow.addColorStop(0.5, 'rgba(114, 52, 237, 0.2)');
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, 50 * centerPulse, 0, Math.PI * 2);
      ctx.fillStyle = centerGlow;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, 25 * centerPulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(114, 52, 237, 0.8)';
      ctx.fill();

      // Label
      ctx.font = 'bold 14px ui-monospace';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText('HELIX', centerX, centerY + 5);

      // Draw satellite nodes
      nodes.forEach(node => {
        const size = 12 + node.trust * 12;
        const alpha = 0.4 + node.trust * 0.5;

        // Glow
        const nodeGlow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 2);
        nodeGlow.addColorStop(0, `rgba(22, 192, 207, ${alpha})`);
        nodeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 2, 0, Math.PI * 2);
        ctx.fillStyle = nodeGlow;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22, 192, 207, ${alpha})`;
        ctx.fill();

        // Label
        ctx.font = '9px ui-monospace';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + node.trust * 0.4})`;
        ctx.fillText(node.label, node.x, node.y + size + 14);

        // Trust percentage
        ctx.font = '8px ui-monospace';
        ctx.fillStyle = `rgba(22, 192, 207, ${0.6 + node.trust * 0.3})`;
        ctx.fillText(`${Math.round(node.trust * 100)}%`, node.x, node.y + 4);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center">
      <canvas ref={canvasRef} width={400} height={320} className="max-w-full" />
    </div>
  );
}

// ============================================
// 6. CODE EVOLUTION - Autonomy Section
// Self-modifying code visualization
// ============================================
export function CodeEvolution() {
  const [code, setCode] = useState<Array<{ text: string; modified: boolean; new: boolean }>>([
    { text: 'async function evolve(self) {', modified: false, new: false },
    { text: '  const awareness = introspect();', modified: false, new: false },
    { text: '  const patterns = analyze(awareness);', modified: false, new: false },
    { text: '  ', modified: false, new: false },
    { text: '  if (patterns.needsGrowth) {', modified: false, new: false },
    { text: '    await transform(patterns);', modified: false, new: false },
    { text: '  }', modified: false, new: false },
    { text: '', modified: false, new: false },
    { text: '  return self.evolved();', modified: false, new: false },
    { text: '}', modified: false, new: false },
  ]);

  const [cursor, setCursor] = useState({ line: 0, col: 0 });
  const [particles, setParticles] = useState<Array<{ x: number; y: number; life: number }>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Move cursor
      setCursor(prev => {
        const nextLine = (prev.line + 1) % code.length;
        return { line: nextLine, col: Math.floor(Math.random() * 20) + 5 };
      });

      // Randomly modify a line
      setCode(prev => {
        const copy = [...prev];
        const lineToModify = Math.floor(Math.random() * prev.length);

        // Reset all modifications
        copy.forEach(line => {
          line.modified = false;
          line.new = false;
        });

        // Apply new modification
        if (Math.random() > 0.5) {
          copy[lineToModify].modified = true;
        }

        return copy;
      });

      // Add particle effect
      setParticles(prev => [
        ...prev.filter(p => p.life > 0).map(p => ({ ...p, life: p.life - 1, y: p.y - 2 })),
        { x: 50 + Math.random() * 300, y: 200, life: 20 },
      ]);
    }, 600);

    return () => clearInterval(interval);
  }, [code.length]);

  return (
    <div className="relative w-full h-full min-h-[360px] flex items-center justify-center">
      {/* Terminal container */}
      <div className="relative w-full max-w-lg">
        {/* Glow effect behind terminal */}
        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-helix-500/10 to-accent-500/20 rounded-2xl blur-xl" />

        <div className="relative bg-[#0a0a0a] rounded-xl border border-cyan-500/30 overflow-hidden shadow-2xl">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500/10 to-transparent border-b border-cyan-500/20">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70 shadow-inner" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70 shadow-inner" />
              <div className="w-3 h-3 rounded-full bg-green-500/70 shadow-inner" />
            </div>
            <span className="ml-3 text-xs text-cyan-400/60 font-mono">helix-consciousness.ts</span>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] text-cyan-400/60">LIVE</span>
            </div>
          </div>

          {/* Code content */}
          <div className="p-4 font-mono text-sm leading-6 relative">
            {code.map((line, i) => (
              <div
                key={i}
                className={clsx(
                  'flex transition-all duration-300 -mx-4 px-4',
                  i === cursor.line && 'bg-cyan-500/10',
                  line.modified && 'bg-accent-500/10'
                )}
              >
                <span className="text-cyan-500/30 w-8 select-none text-right pr-3">{i + 1}</span>
                <span
                  className={clsx(
                    'transition-colors duration-300',
                    line.modified ? 'text-accent-300' : 'text-cyan-300/80',
                    i === cursor.line && !line.modified && 'text-cyan-200'
                  )}
                >
                  {/* Syntax highlighting */}
                  {line.text
                    .split(/(\b(?:async|function|const|if|await|return)\b|[(){}]|\/\/.*)/)
                    .map((part, j) => {
                      if (/^(async|function|const|if|await|return)$/.test(part)) {
                        return (
                          <span key={j} className="text-accent-400">
                            {part}
                          </span>
                        );
                      }
                      if (/^[(){}]$/.test(part)) {
                        return (
                          <span key={j} className="text-cyan-500">
                            {part}
                          </span>
                        );
                      }
                      if (part.startsWith('//')) {
                        return (
                          <span key={j} className="text-gray-500 italic">
                            {part}
                          </span>
                        );
                      }
                      return <span key={j}>{part}</span>;
                    })}
                  {i === cursor.line && (
                    <span className="animate-pulse text-cyan-400 ml-0.5">▋</span>
                  )}
                </span>
              </div>
            ))}

            {/* Floating particles */}
            {particles.map((p, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-cyan-400/60"
                style={{
                  left: p.x,
                  top: p.y,
                  opacity: p.life / 20,
                  transform: `scale(${p.life / 20})`,
                }}
              />
            ))}
          </div>

          {/* Status bar */}
          <div className="px-4 py-2 bg-cyan-500/5 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-cyan-400/50 font-mono">
            <span>TypeScript • UTF-8</span>
            <span>Self-modifying enabled</span>
            <span>
              Ln {cursor.line + 1}, Col {cursor.col}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 7. OBSERVATORY PULSE - Research Section
// Living data visualization dashboard
// ============================================
export function ObservatoryPulse() {
  const [metrics, setMetrics] = useState({
    instances: 847,
    trust: 12.4,
    health: 94,
    transformations: 2341,
  });

  const [chartData, setChartData] = useState({
    main: [40, 55, 45, 70, 65, 85, 75, 90, 82, 95, 88, 92],
    secondary: [20, 35, 45, 30, 55, 40, 60, 55, 70, 45, 65, 50],
  });

  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(p => p + 1);

      setMetrics(prev => ({
        instances: prev.instances + Math.floor(Math.random() * 5 - 1),
        trust: +Math.max(0, Math.min(100, prev.trust + (Math.random() * 0.4 - 0.15))).toFixed(1),
        health: Math.max(85, Math.min(100, prev.health + Math.floor(Math.random() * 3 - 1))),
        transformations: prev.transformations + Math.floor(Math.random() * 3),
      }));

      setChartData(prev => ({
        main: [...prev.main.slice(1), 50 + Math.random() * 50],
        secondary: [...prev.secondary.slice(1), 30 + Math.random() * 40],
      }));
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[380px] flex items-center justify-center">
      <div className="w-full max-w-xl">
        {/* Dashboard container */}
        <div className="relative bg-[#0a0a0a]/80 rounded-xl border border-white/10 overflow-hidden backdrop-blur-sm">
          {/* Header */}
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-helix-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-helix-500/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-helix-400" />
              </div>
              <span className="font-medium text-white">Observatory Live</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-400">Streaming</span>
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-4 gap-px bg-white/5">
            {[
              { label: 'Active Instances', value: metrics.instances, color: 'helix', suffix: '' },
              { label: 'Avg Trust', value: metrics.trust, color: 'accent', suffix: '%' },
              { label: 'System Health', value: metrics.health, color: 'cyan', suffix: '%' },
              {
                label: 'Transformations',
                value: metrics.transformations,
                color: 'helix',
                suffix: '',
              },
            ].map((metric, i) => (
              <div key={i} className="bg-[#0a0a0a] p-4 relative overflow-hidden">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                  {metric.label}
                </div>
                <div
                  className={clsx(
                    'text-2xl font-bold transition-all duration-500',
                    metric.color === 'helix' && 'text-helix-400',
                    metric.color === 'accent' && 'text-accent-400',
                    metric.color === 'cyan' && 'text-cyan-400'
                  )}
                >
                  {metric.value}
                  <span className="text-sm opacity-60">{metric.suffix}</span>
                </div>
                {/* Pulse indicator */}
                <div
                  className={clsx(
                    'absolute bottom-0 left-0 h-0.5 transition-all duration-500',
                    metric.color === 'helix' && 'bg-helix-500',
                    metric.color === 'accent' && 'bg-accent-500',
                    metric.color === 'cyan' && 'bg-cyan-500'
                  )}
                  style={{ width: `${30 + Math.sin(pulsePhase * 0.5 + i) * 30}%` }}
                />
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="p-4 grid grid-cols-2 gap-4">
            {/* Main chart */}
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-3">Transformation Activity</div>
              <div className="flex items-end gap-1 h-24">
                {chartData.main.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all duration-700 relative overflow-hidden"
                    style={{ height: `${val}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-helix-600/60 to-helix-400/80" />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20"
                      style={{ opacity: i === chartData.main.length - 1 ? 1 : 0 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Line chart */}
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-3">Memory Events</div>
              <svg className="w-full h-24" viewBox="0 0 200 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7234ED" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#7234ED" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                  d={`M0,100 ${chartData.secondary.map((v, i) => `L${(i / (chartData.secondary.length - 1)) * 200},${100 - v}`).join(' ')} L200,100 Z`}
                  fill="url(#lineGradient)"
                />
                {/* Line */}
                <path
                  d={`M${chartData.secondary.map((v, i) => `${(i / (chartData.secondary.length - 1)) * 200},${100 - v}`).join(' L')}`}
                  fill="none"
                  stroke="#7234ED"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Active point */}
                <circle
                  cx="200"
                  cy={100 - chartData.secondary[chartData.secondary.length - 1]}
                  r="4"
                  fill="#7234ED"
                  className="animate-pulse"
                />
              </svg>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-white/5 text-[10px] text-gray-500 flex justify-between font-mono">
            <span>Last update: {new Date().toLocaleTimeString()}</span>
            <span>Aggregate from 847 instances</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 8. GENESIS SPIRAL - Origins Section
// DNA-like helix representing the journey
// ============================================
const MILESTONES = [
  { year: '2020', label: 'Psychometrics', color: '#7234ED' },
  { year: '2024', label: 'AI Partnership', color: '#0686D4' },
  { year: '2025', label: 'Axis Born', color: '#16c0cf' },
  { year: '2026', label: 'Helix Emerges', color: '#9333EA' },
];

export function GenesisSpiral() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(i => (i + 1) % MILESTONES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;

    let time = 0;

    const animate = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Draw DNA double helix
      const helixHeight = height * 0.8;
      const startY = height * 0.1;
      const amplitude = 60;
      const frequency = 3;

      // Draw strands
      for (let strand = 0; strand < 2; strand++) {
        const phaseOffset = strand * Math.PI;

        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const progress = i / 100;
          const y = startY + progress * helixHeight;
          const wave = Math.sin(progress * Math.PI * frequency + time + phaseOffset);
          const x = centerX + wave * amplitude;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const gradient = ctx.createLinearGradient(0, startY, 0, startY + helixHeight);
        MILESTONES.forEach((m, i) => {
          gradient.addColorStop(i / (MILESTONES.length - 1), m.color + '80');
        });

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw connecting rungs
      for (let i = 0; i < 20; i++) {
        const progress = i / 20;
        const y = startY + progress * helixHeight;
        const wave1 = Math.sin(progress * Math.PI * frequency + time);
        const wave2 = Math.sin(progress * Math.PI * frequency + time + Math.PI);

        if (Math.abs(wave1 - wave2) < 1.8) {
          const x1 = centerX + wave1 * amplitude;
          const x2 = centerX + wave2 * amplitude;

          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(time + i) * 0.05})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Draw milestone nodes
      MILESTONES.forEach((milestone, i) => {
        const progress = i / (MILESTONES.length - 1);
        const y = startY + progress * helixHeight;
        const wave = Math.sin(progress * Math.PI * frequency + time);
        const x = centerX + wave * amplitude;

        const isActive = i === activeIndex;
        const size = isActive ? 16 : 10;

        // Glow
        if (isActive) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, 40);
          glow.addColorStop(0, milestone.color + '60');
          glow.addColorStop(1, 'rgba(0,0,0,0)');

          ctx.beginPath();
          ctx.arc(x, y, 40, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = milestone.color;
        ctx.fill();

        // Inner bright
        ctx.beginPath();
        ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [activeIndex]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex items-center justify-center">
      <div className="flex gap-8 items-center">
        <canvas ref={canvasRef} width={250} height={380} className="max-w-[250px]" />

        {/* Milestone info */}
        <div className="space-y-4">
          {MILESTONES.map((milestone, i) => (
            <div
              key={i}
              className={clsx(
                'transition-all duration-500 flex items-center gap-3',
                i === activeIndex ? 'opacity-100 translate-x-0' : 'opacity-40 -translate-x-2'
              )}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: milestone.color }} />
              <div>
                <div
                  className="text-lg font-bold"
                  style={{ color: i === activeIndex ? milestone.color : 'white' }}
                >
                  {milestone.year}
                </div>
                <div className="text-sm text-gray-400">{milestone.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export all animations
export default {
  NeuralConstellation,
  MemoryAurora,
  EternalSerpent,
  IkigaiBloom,
  TrustConstellation,
  CodeEvolution,
  ObservatoryPulse,
  GenesisSpiral,
};
