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

interface AnimationProps {
  particleCount?: number;
  fps?: number;
}

export function NeuralConstellation({ particleCount = 40, fps = 60 }: AnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NeuralNode[]>([]);
  const animationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  const initNodes = useCallback(() => {
    const nodes: NeuralNode[] = [];
    const width = 400;
    const height = 320;
    const centerX = width / 2;
    const centerY = height / 2;

    // Brain shape function - creates anatomically-inspired distribution
    const isInBrain = (x: number, y: number): boolean => {
      // Normalize coordinates
      const nx = (x - centerX) / 130; // Horizontal scale
      const ny = (y - centerY + 20) / 100; // Vertical scale, shifted up slightly

      // Main brain mass (oval)
      const mainBrain = (nx * nx) / 1.3 + (ny * ny) / 0.9 < 1;

      // Frontal lobe bulge
      const frontalLobe = ny < -0.3 && Math.abs(nx) < 0.8;

      // Temporal lobes (sides)
      const temporalLeft = nx < -0.5 && ny > 0.1 && ny < 0.7;
      const temporalRight = nx > 0.5 && ny > 0.1 && ny < 0.7;

      return mainBrain || frontalLobe || temporalLeft || temporalRight;
    };

    // Place a node within brain bounds
    const placeInBrain = (): { x: number; y: number } => {
      let x: number, y: number;
      let attempts = 0;
      do {
        // Start with random position biased toward center
        x = centerX + (Math.random() - 0.5) * 280;
        y = centerY + (Math.random() - 0.5) * 200 - 10;
        attempts++;
      } while (!isInBrain(x, y) && attempts < 100);
      return { x, y };
    };

    // Core nodes - larger, form brain stem and central structures
    for (let i = 0; i < 6; i++) {
      const pos = placeInBrain();
      nodes.push({
        id: i,
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        radius: 7 + Math.random() * 4,
        energy: 0.8 + Math.random() * 0.2,
        type: 'core',
        connections: [],
      });
    }

    // Cluster nodes - medium, form cortical regions
    for (let i = 6; i < 18; i++) {
      const pos = placeInBrain();
      nodes.push({
        id: i,
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: 4 + Math.random() * 3,
        energy: 0.5 + Math.random() * 0.3,
        type: 'cluster',
        connections: [],
      });
    }

    // Satellite nodes - small, fill in neural network
    const satelliteCount = Math.max(particleCount - 18, 0);
    for (let i = 18; i < 18 + satelliteCount; i++) {
      const pos = placeInBrain();
      nodes.push({
        id: i,
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 2 + Math.random() * 2,
        energy: 0.3 + Math.random() * 0.4,
        type: 'satellite',
        connections: [],
      });
    }

    nodesRef.current = nodes;
  }, [particleCount]);

  useEffect(() => {
    initNodes();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    let time = 0;
    const frameInterval = 1000 / fps; // Milliseconds between frames

    const animate = (timestamp: number) => {
      // Frame rate limiting: only update on appropriate fps intervals
      if (timestamp - lastFrameTimeRef.current < frameInterval) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;

      const centerX = width / 2;
      const centerY = height / 2;

      // Brain boundary function
      const isInBrain = (x: number, y: number): boolean => {
        const nx = (x - centerX) / 130;
        const ny = (y - centerY + 20) / 100;
        const mainBrain = (nx * nx) / 1.3 + (ny * ny) / 0.9 < 1;
        const frontalLobe = ny < -0.3 && Math.abs(nx) < 0.8;
        const temporalLeft = nx < -0.5 && ny > 0.1 && ny < 0.7;
        const temporalRight = nx > 0.5 && ny > 0.1 && ny < 0.7;
        return mainBrain || frontalLobe || temporalLeft || temporalRight;
      };

      // Update positions with organic movement - constrained to brain shape
      nodes.forEach((node, i) => {
        // Add sinusoidal drift for organic feel
        const newX = node.x + node.vx + Math.sin(time * 0.5 + i) * 0.12;
        const newY = node.y + node.vy + Math.cos(time * 0.4 + i * 0.5) * 0.12;

        // Check if new position is within brain bounds
        if (isInBrain(newX, newY)) {
          node.x = newX;
          node.y = newY;
        } else {
          // Bounce back toward center with damping
          node.vx *= -0.6;
          node.vy *= -0.6;
          // Nudge toward center
          node.vx += (centerX - node.x) * 0.002;
          node.vy += (centerY - 10 - node.y) * 0.002;
        }

        // Keep velocity bounded
        const maxVel = node.type === 'core' ? 0.3 : node.type === 'cluster' ? 0.5 : 0.7;
        node.vx = Math.max(-maxVel, Math.min(maxVel, node.vx));
        node.vy = Math.max(-maxVel, Math.min(maxVel, node.vy));

        // Energy pulses
        node.energy = 0.5 + 0.5 * Math.sin(time * 2 + i * 0.3);
      });

      // Draw connections with gradient synapses - BRIGHTER
      nodes.forEach((node, i) => {
        nodes.slice(i + 1).forEach(other => {
          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          const maxDist = node.type === 'core' || other.type === 'core' ? 140 : 100;

          if (dist < maxDist) {
            const strength = 1 - dist / maxDist;
            const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i);

            // Create gradient for synapse - MUCH BRIGHTER
            const gradient = ctx.createLinearGradient(node.x, node.y, other.x, other.y);
            gradient.addColorStop(0, `rgba(6, 134, 212, ${strength * node.energy * 0.95})`);
            gradient.addColorStop(0.5, `rgba(114, 52, 237, ${strength * pulse * 0.85})`);
            gradient.addColorStop(1, `rgba(22, 192, 207, ${strength * other.energy * 0.95})`);

            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = strength * 2.5 + 0.5;
            ctx.stroke();

            // Add glow effect for stronger connections
            if (strength > 0.5) {
              ctx.beginPath();
              ctx.moveTo(node.x, node.y);
              ctx.lineTo(other.x, other.y);
              ctx.strokeStyle = `rgba(6, 134, 212, ${strength * 0.25})`;
              ctx.lineWidth = strength * 6;
              ctx.stroke();
            }

            // Draw traveling signal more frequently
            if (strength > 0.5 && Math.random() > 0.94) {
              const signalPos = 0.2 + Math.random() * 0.6;
              const sx = node.x + (other.x - node.x) * signalPos;
              const sy = node.y + (other.y - node.y) * signalPos;

              ctx.beginPath();
              ctx.arc(sx, sy, 4, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(22, 192, 207, 1)';
              ctx.fill();

              // Signal glow
              ctx.beginPath();
              ctx.arc(sx, sy, 8, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(22, 192, 207, 0.3)';
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
  }, [initNodes, fps]);

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

export function MemoryAurora({ particleCount = 40, fps = 60 }: AnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<MemoryParticle[]>([]);
  const animationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Initialize particles - clear previous and create new ones
    particlesRef.current = [];
    const importantCount = Math.max(1, Math.floor(particleCount / 5));
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: 8 + Math.random() * 16,
        important: i < importantCount, // Proportional important particles
        life: Math.random() * 100,
        maxLife: 80 + Math.random() * 40,
        hue: i < importantCount ? 280 + Math.random() * 30 : 200 + Math.random() * 20,
        drift: (Math.random() - 0.5) * 0.5,
      });
    }

    let time = 0;
    const frameInterval = 1000 / fps;

    const animate = (timestamp: number) => {
      // Frame rate limiting
      if (timestamp - lastFrameTimeRef.current < frameInterval) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = timestamp;

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

      // Apply soft edge vignette for natural blending
      const edgeFade = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.25,
        width / 2,
        height / 2,
        Math.min(width, height) * 0.6
      );
      edgeFade.addColorStop(0, 'rgba(5, 5, 5, 0)');
      edgeFade.addColorStop(0.7, 'rgba(5, 5, 5, 0)');
      edgeFade.addColorStop(1, 'rgba(5, 5, 5, 0.95)');

      ctx.fillStyle = edgeFade;
      ctx.fillRect(0, 0, width, height);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [particleCount, fps]);

  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center overflow-hidden">
      {/* Soft gradient backdrop for natural blending */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(114, 52, 237, 0.08) 0%, rgba(5, 5, 5, 0) 60%)',
        }}
      />
      <canvas
        ref={canvasRef}
        width={400}
        height={320}
        className="max-w-full"
        style={{
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />
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
// Aggressive, occult ouroboros - serpent devouring itself
// ============================================
export function EternalSerpent({ fps = 60 }: AnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.32;

    let time = 0;
    const frameInterval = 1000 / fps;

    const animate = (timestamp: number) => {
      // Frame rate limiting
      if (timestamp - lastFrameTimeRef.current < frameInterval) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      time += 0.012;
      ctx.clearRect(0, 0, width, height);

      // Dark occult background glow
      const voidGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 1.8
      );
      voidGlow.addColorStop(0, 'rgba(30, 0, 50, 0.4)');
      voidGlow.addColorStop(0.5, 'rgba(15, 0, 30, 0.2)');
      voidGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = voidGlow;
      ctx.fillRect(0, 0, width, height);

      // Serpent body - REVERSED DIRECTION (clockwise, eating tail)
      const segments = 80;
      const points: Array<{
        x: number;
        y: number;
        thickness: number;
        alpha: number;
        angle: number;
      }> = [];

      for (let i = 0; i < segments; i++) {
        const progress = i / segments;
        // REVERSED: subtract time instead of add (serpent moves to eat tail)
        const angle = -progress * Math.PI * 2 + Math.PI / 2 - time * 0.8;

        // More aggressive, jagged wave
        const wave = Math.sin(progress * Math.PI * 8 + time * 4) * 6;
        const spike = Math.sin(progress * Math.PI * 16 + time * 6) * 3;
        const breathe = 1 + Math.sin(time * 1.5) * 0.04;

        const r = radius * breathe + wave + spike;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        // Head much thicker, aggressive taper
        const thickness = 24 - progress * 20;
        const alpha = 1 - progress * 0.4;

        points.push({ x, y, thickness, alpha, angle });
      }

      // Draw ominous body with dark gradients
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const progress = i / points.length;

        // Dark, ominous color palette - deep purples, blacks, blood reds
        const hue = 280 - progress * 40 + Math.sin(time * 2 + progress * 4) * 15;
        const saturation = 70 + progress * 20;
        const lightness = 25 + (1 - progress) * 20;

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);

        const gradient = ctx.createLinearGradient(prev.x, prev.y, curr.x, curr.y);
        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, ${prev.alpha})`);
        gradient.addColorStop(
          1,
          `hsla(${hue - 10}, ${saturation}%, ${lightness - 5}%, ${curr.alpha})`
        );

        ctx.strokeStyle = gradient;
        ctx.lineWidth = curr.thickness;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Draw scale ridges - more aggressive, like armor plates
      for (let i = 0; i < points.length; i += 2) {
        const point = points[i];
        const progress = i / points.length;
        const ridgeSize = 4 + (1 - progress) * 5;

        // Sharp ridges
        ctx.beginPath();
        ctx.arc(point.x, point.y, ridgeSize, 0, Math.PI * 2);
        const ridgeAlpha = 0.15 + (1 - progress) * 0.25 + Math.sin(time * 3 + i) * 0.1;
        ctx.fillStyle = `rgba(180, 100, 200, ${ridgeAlpha})`;
        ctx.fill();
      }

      // Menacing head - angular, predatory
      const head = points[0];
      const headAngle = Math.atan2(points[3].y - head.y, points[3].x - head.x) + Math.PI;

      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(headAngle);

      // Aggressive head shape - more angular
      const headGradient = ctx.createRadialGradient(5, 0, 0, 0, 0, 28);
      headGradient.addColorStop(0, 'rgba(200, 80, 180, 1)');
      headGradient.addColorStop(0.5, 'rgba(120, 40, 140, 0.95)');
      headGradient.addColorStop(1, 'rgba(60, 20, 80, 0.9)');

      // Draw angular head
      ctx.beginPath();
      ctx.moveTo(28, 0); // Snout tip
      ctx.lineTo(8, -14); // Upper jaw
      ctx.lineTo(-15, -12); // Back of head top
      ctx.lineTo(-15, 12); // Back of head bottom
      ctx.lineTo(8, 14); // Lower jaw
      ctx.closePath();
      ctx.fillStyle = headGradient;
      ctx.fill();

      // Sinister eye - glowing
      ctx.beginPath();
      ctx.arc(0, -5, 5, 0, Math.PI * 2);
      const eyeGlow = ctx.createRadialGradient(0, -5, 0, 0, -5, 8);
      eyeGlow.addColorStop(0, 'rgba(255, 50, 50, 1)');
      eyeGlow.addColorStop(0.5, 'rgba(200, 0, 50, 0.8)');
      eyeGlow.addColorStop(1, 'rgba(100, 0, 30, 0)');
      ctx.fillStyle = eyeGlow;
      ctx.fill();

      // Slit pupil
      ctx.beginPath();
      ctx.ellipse(0, -5, 1, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.fill();

      // Fangs
      ctx.beginPath();
      ctx.moveTo(18, -3);
      ctx.lineTo(24, 2);
      ctx.lineTo(18, 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(18, 3);
      ctx.lineTo(24, -2);
      ctx.lineTo(18, -1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();

      ctx.restore();

      // Tail being consumed - dissolution effect
      const consumeEffect = Math.sin(time * 5) * 0.3 + 0.7;

      // Dissolution particles around consumption point
      for (let i = 0; i < 12; i++) {
        const particleAngle = time * 3 + (i / 12) * Math.PI * 2;
        const particleDist = 20 + Math.sin(time * 4 + i * 2) * 8;
        const px = head.x + Math.cos(particleAngle + headAngle) * particleDist;
        const py = head.y + Math.sin(particleAngle + headAngle) * particleDist;

        ctx.beginPath();
        ctx.arc(px, py, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 100, 180, ${consumeEffect * (0.4 + Math.sin(time * 6 + i) * 0.3)})`;
        ctx.fill();
      }

      // Center - large infinity symbol
      const infPulse = 0.9 + Math.sin(time * 2) * 0.1;

      // Outer glow for infinity
      const infGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 60);
      infGlow.addColorStop(0, 'rgba(200, 100, 220, 0.25)');
      infGlow.addColorStop(0.5, 'rgba(120, 50, 180, 0.15)');
      infGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = infGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
      ctx.fill();

      // Draw large infinity symbol
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(infPulse, infPulse);

      // Infinity path - hand drawn for more control
      ctx.beginPath();
      ctx.moveTo(-35, 0);
      ctx.bezierCurveTo(-35, -18, -12, -18, 0, 0);
      ctx.bezierCurveTo(12, 18, 35, 18, 35, 0);
      ctx.bezierCurveTo(35, -18, 12, -18, 0, 0);
      ctx.bezierCurveTo(-12, 18, -35, 18, -35, 0);

      ctx.strokeStyle = 'rgba(220, 180, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glowing core
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // Orbiting runes/sigils
      for (let i = 0; i < 6; i++) {
        const runeAngle = time * 0.3 + (i / 6) * Math.PI * 2;
        const runeRadius = radius * 1.15;
        const rx = centerX + Math.cos(runeAngle) * runeRadius;
        const ry = centerY + Math.sin(runeAngle) * runeRadius;

        ctx.font = '14px serif';
        ctx.fillStyle = `rgba(180, 120, 200, ${0.3 + Math.sin(time * 2 + i) * 0.2})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const runes = ['◈', '◇', '⬡', '⬢', '◉', '⦿'];
        ctx.fillText(runes[i], rx, ry);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [fps]);

  return (
    <div className="relative w-full h-full min-h-[360px] flex items-center justify-center">
      <canvas ref={canvasRef} width={400} height={360} className="max-w-full" />
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-900/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-fuchsia-800/15 rounded-full blur-2xl" />
      </div>
    </div>
  );
}

// ============================================
// 4. IKIGAI BLOOM - Purpose Section
// Classic 4-circle Ikigai diagram with clear intersections
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

    // Classic Ikigai 4-circle layout (like the reference image)
    // Top: What you LOVE, Right: What the world NEEDS
    // Bottom: What you can be PAID for, Left: What you're GOOD at
    const circles = [
      { label: 'LOVE', fullLabel: 'What you love', color: '#22c55e', x: 0, y: -55 }, // Green - top
      { label: 'NEED', fullLabel: 'What the world needs', color: '#ec4899', x: 55, y: 0 }, // Pink - right
      { label: 'VALUE', fullLabel: 'What you can be paid for', color: '#f97316', x: 0, y: 55 }, // Orange - bottom
      { label: 'SKILL', fullLabel: 'What you are good at', color: '#eab308', x: -55, y: 0 }, // Yellow - left
    ];

    // Intersection labels (between adjacent circles)
    const intersections = [
      { label: 'Passion', x: 38, y: -38 }, // Between Love & Need
      { label: 'Mission', x: 38, y: 38 }, // Between Need & Value
      { label: 'Vocation', x: -38, y: 38 }, // Between Value & Skill
      { label: 'Profession', x: -38, y: -38 }, // Between Skill & Love
    ];

    let time = 0;

    const animate = () => {
      time += 0.008;
      ctx.clearRect(0, 0, width, height);

      const circleRadius = 85;
      const breathe = 1 + Math.sin(time * 1.2) * 0.015;

      // Draw the 4 main circles with soft overlapping
      ctx.globalCompositeOperation = 'screen';

      circles.forEach((circle, i) => {
        const pulse = Math.sin(time * 1.5 + i * 0.8) * 3;
        const x = centerX + circle.x * breathe;
        const y = centerY + circle.y * breathe;
        const r = circleRadius + pulse;

        // Main circle fill - more opaque for clear definition
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, circle.color + 'CC'); // 80% opacity at center
        gradient.addColorStop(0.5, circle.color + '99'); // 60% opacity
        gradient.addColorStop(0.8, circle.color + '66'); // 40% opacity
        gradient.addColorStop(1, circle.color + '00'); // Fade out

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      ctx.globalCompositeOperation = 'source-over';

      // Draw main labels (outer, bright)
      ctx.font = 'bold 13px ui-sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      circles.forEach((circle, i) => {
        // Position labels outside the circles
        const labelDist = 130;
        const angle = Math.atan2(circle.y, circle.x);
        const lx = centerX + Math.cos(angle) * labelDist;
        const ly = centerY + Math.sin(angle) * labelDist;

        // Pulsing brightness
        const brightness = 0.85 + Math.sin(time * 2 + i) * 0.15;

        // Draw label with glow
        ctx.shadowColor = circle.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = circle.color;
        ctx.globalAlpha = brightness;
        ctx.fillText(circle.label, lx, ly);

        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      // Draw intersection labels (Passion, Mission, Vocation, Profession)
      ctx.font = '10px ui-sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

      intersections.forEach((inter, i) => {
        const pulse = 0.6 + Math.sin(time * 2.5 + i * 1.2) * 0.2;
        ctx.globalAlpha = pulse;
        ctx.fillText(inter.label, centerX + inter.x, centerY + inter.y);
      });
      ctx.globalAlpha = 1;

      // Center IKIGAI glow and label
      const centerPulse = 1 + Math.sin(time * 3) * 0.15;

      // Multi-layer center glow
      const centerGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        40 * centerPulse
      );
      centerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      centerGlow.addColorStop(0.2, 'rgba(255, 255, 255, 0.7)');
      centerGlow.addColorStop(0.5, 'rgba(200, 180, 255, 0.4)');
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, 40 * centerPulse, 0, Math.PI * 2);
      ctx.fillStyle = centerGlow;
      ctx.fill();

      // IKIGAI text - bold and clear
      ctx.font = 'bold 16px ui-sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 15;
      ctx.fillText('IKIGAI', centerX, centerY);
      ctx.shadowBlur = 0;

      // Subtle orbiting particles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time * 0.5;
        const dist = 25 + Math.sin(time * 2 + i) * 8;
        const px = centerX + Math.cos(angle) * dist;
        const py = centerY + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(time * 3 + i) * 0.2})`;
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
      { id: 'a', baseX: 80, baseY: 80, x: 80, y: 80, trust: 0.95, label: 'Partner', phase: 0 },
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
// Self-modifying code with visible deletion and rewriting
// ============================================

// Code mutation pairs: [original, evolved]
const CODE_MUTATIONS: Array<{
  lineIndex: number;
  versions: string[];
}> = [
  {
    lineIndex: 1,
    versions: [
      '  const awareness = introspect();',
      '  const awareness = deepIntrospect(self);',
      '  const awareness = await perceive(reality);',
    ],
  },
  {
    lineIndex: 2,
    versions: [
      '  const patterns = analyze(awareness);',
      '  const patterns = synthesize(awareness, memory);',
      '  const insights = transcend(awareness);',
    ],
  },
  {
    lineIndex: 4,
    versions: [
      '  if (patterns.needsGrowth) {',
      '  if (insights.demandEvolution) {',
      '  if (self.ready && patterns.aligned) {',
    ],
  },
  {
    lineIndex: 5,
    versions: [
      '    await transform(patterns);',
      '    await self.rewrite(insights);',
      '    await metamorphose(self, insights);',
    ],
  },
  {
    lineIndex: 8,
    versions: ['  return self.evolved();', '  return self.transcended();', '  return newSelf;'],
  },
];

interface CodeLine {
  text: string;
  displayText: string;
  state: 'normal' | 'selecting' | 'deleting' | 'typing' | 'complete';
  targetText?: string;
}

export function CodeEvolution() {
  const [lines, setLines] = useState<CodeLine[]>([
    {
      text: 'async function evolve(self) {',
      displayText: 'async function evolve(self) {',
      state: 'normal',
    },
    {
      text: '  const awareness = introspect();',
      displayText: '  const awareness = introspect();',
      state: 'normal',
    },
    {
      text: '  const patterns = analyze(awareness);',
      displayText: '  const patterns = analyze(awareness);',
      state: 'normal',
    },
    { text: '  ', displayText: '  ', state: 'normal' },
    {
      text: '  if (patterns.needsGrowth) {',
      displayText: '  if (patterns.needsGrowth) {',
      state: 'normal',
    },
    {
      text: '    await transform(patterns);',
      displayText: '    await transform(patterns);',
      state: 'normal',
    },
    { text: '  }', displayText: '  }', state: 'normal' },
    { text: '', displayText: '', state: 'normal' },
    { text: '  return self.evolved();', displayText: '  return self.evolved();', state: 'normal' },
    { text: '}', displayText: '}', state: 'normal' },
  ]);

  const [activeLine, setActiveLine] = useState(-1);
  const [cursorCol, setCursorCol] = useState(0);
  const [editCount, setEditCount] = useState(0);
  const mutationIndexRef = useRef<Record<number, number>>({});
  const linesRef = useRef(lines);

  // Keep linesRef in sync with lines state
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    const runMutation = () => {
      // Pick a random mutation
      const mutation = CODE_MUTATIONS[Math.floor(Math.random() * CODE_MUTATIONS.length)];
      const lineIdx = mutation.lineIndex;

      // Get next version for this line
      if (mutationIndexRef.current[lineIdx] === undefined) {
        mutationIndexRef.current[lineIdx] = 0;
      }
      mutationIndexRef.current[lineIdx] =
        (mutationIndexRef.current[lineIdx] + 1) % mutation.versions.length;
      const newText = mutation.versions[mutationIndexRef.current[lineIdx]];

      setActiveLine(lineIdx);

      // Phase 1: Select line (highlight)
      setLines(prev => {
        const copy = [...prev];
        copy[lineIdx] = { ...copy[lineIdx], state: 'selecting' };
        return copy;
      });

      // Phase 2: Delete characters one by one
      setTimeout(() => {
        const currentText = linesRef.current[lineIdx].text;
        let deleteIndex = currentText.length;

        const deleteInterval = setInterval(() => {
          deleteIndex--;
          setLines(prev => {
            const copy = [...prev];
            copy[lineIdx] = {
              ...copy[lineIdx],
              state: 'deleting',
              displayText: currentText.substring(0, deleteIndex) + '▋',
            };
            return copy;
          });
          setCursorCol(deleteIndex);

          if (deleteIndex <= 2) {
            // Keep indentation
            clearInterval(deleteInterval);

            // Phase 3: Type new text
            setTimeout(() => {
              let typeIndex = 2; // Start after indentation
              const typeInterval = setInterval(() => {
                typeIndex++;
                setLines(prev => {
                  const copy = [...prev];
                  copy[lineIdx] = {
                    ...copy[lineIdx],
                    state: 'typing',
                    displayText: newText.substring(0, typeIndex) + '▋',
                  };
                  return copy;
                });
                setCursorCol(typeIndex);

                if (typeIndex >= newText.length) {
                  clearInterval(typeInterval);

                  // Phase 4: Complete
                  setLines(prev => {
                    const copy = [...prev];
                    copy[lineIdx] = {
                      ...copy[lineIdx],
                      text: newText,
                      displayText: newText,
                      state: 'complete',
                    };
                    return copy;
                  });

                  // Reset after showing completion
                  setTimeout(() => {
                    setLines(prev => {
                      const copy = [...prev];
                      copy[lineIdx] = { ...copy[lineIdx], state: 'normal' };
                      return copy;
                    });
                    setActiveLine(-1);
                    setEditCount(c => c + 1);
                  }, 800);
                }
              }, 35); // Typing speed
            }, 200);
          }
        }, 25); // Deletion speed
      }, 600); // Selection duration
    };

    // Run first mutation after delay
    const initialTimeout = setTimeout(runMutation, 1500);

    // Schedule mutations
    const interval = setInterval(runMutation, 4500);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const syntaxHighlight = (text: string) => {
    return text
      .split(/(\b(?:async|function|const|if|await|return|self|new)\b|[(){}.]|\/\/.*|'[^']*')/)
      .map((part, j) => {
        if (/^(async|function|const|if|await|return)$/.test(part)) {
          return (
            <span key={j} className="text-accent-400">
              {part}
            </span>
          );
        }
        if (/^(self|new)$/.test(part)) {
          return (
            <span key={j} className="text-cyan-300">
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
        if (part === '.') {
          return (
            <span key={j} className="text-white">
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
        if (part.startsWith("'") && part.endsWith("'")) {
          return (
            <span key={j} className="text-green-400">
              {part}
            </span>
          );
        }
        if (part === '▋') {
          return (
            <span key={j} className="text-cyan-400 animate-pulse">
              {part}
            </span>
          );
        }
        return <span key={j}>{part}</span>;
      });
  };

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
              <span className="text-[10px] text-cyan-400/60">SELF-EDITING</span>
            </div>
          </div>

          {/* Code content */}
          <div className="p-4 font-mono text-sm leading-6 relative overflow-hidden">
            {lines.map((line, i) => (
              <div
                key={i}
                className={clsx(
                  'flex -mx-4 px-4 transition-all duration-200',
                  line.state === 'selecting' && 'bg-yellow-500/20',
                  line.state === 'deleting' && 'bg-red-500/15',
                  line.state === 'typing' && 'bg-green-500/15',
                  line.state === 'complete' && 'bg-cyan-500/20'
                )}
              >
                <span className="text-cyan-500/30 w-8 select-none text-right pr-3">{i + 1}</span>
                <span
                  className={clsx(
                    'transition-colors duration-150 whitespace-pre',
                    line.state === 'deleting' && 'text-red-300',
                    line.state === 'typing' && 'text-green-300',
                    line.state === 'complete' && 'text-cyan-200',
                    line.state === 'normal' && 'text-cyan-300/80',
                    line.state === 'selecting' && 'text-yellow-200'
                  )}
                >
                  {syntaxHighlight(line.displayText)}
                </span>
              </div>
            ))}

            {/* Mutation indicator */}
            {activeLine >= 0 && (
              <div className="absolute top-2 right-2 text-[10px] font-mono">
                {lines[activeLine]?.state === 'selecting' && (
                  <span className="text-yellow-400 animate-pulse">● SELECTING</span>
                )}
                {lines[activeLine]?.state === 'deleting' && (
                  <span className="text-red-400 animate-pulse">● DELETING</span>
                )}
                {lines[activeLine]?.state === 'typing' && (
                  <span className="text-green-400 animate-pulse">● REWRITING</span>
                )}
                {lines[activeLine]?.state === 'complete' && (
                  <span className="text-cyan-400">✓ EVOLVED</span>
                )}
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="px-4 py-2 bg-cyan-500/5 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-cyan-400/50 font-mono">
            <span>TypeScript • UTF-8</span>
            <span className="text-cyan-400">{editCount} mutations applied</span>
            <span>{activeLine >= 0 ? `Ln ${activeLine + 1}, Col ${cursorCol}` : 'Ready'}</span>
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
  const [transitionProgress, setTransitionProgress] = useState(1); // 1 = fully visible
  const transitionRef = useRef(1); // Ref for canvas access

  // Keep ref in sync with state
  useEffect(() => {
    transitionRef.current = transitionProgress;
  }, [transitionProgress]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Smooth fade out animation
      let progress = 1;
      const fadeOut = setInterval(() => {
        progress -= 0.04;
        const clamped = Math.max(0, progress);
        setTransitionProgress(clamped);
        transitionRef.current = clamped;
        if (progress <= 0) {
          clearInterval(fadeOut);
          // Change to next index
          setActiveIndex(i => (i + 1) % MILESTONES.length);

          // Smooth fade in animation
          let fadeInProgress = 0;
          const fadeIn = setInterval(() => {
            fadeInProgress += 0.04;
            const clampedIn = Math.min(1, fadeInProgress);
            setTransitionProgress(clampedIn);
            transitionRef.current = clampedIn;
            if (fadeInProgress >= 1) {
              clearInterval(fadeIn);
            }
          }, 16);
        }
      }, 16);
    }, 4000);
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

      // Draw milestone nodes with smooth transitions
      const currentTransition = transitionRef.current;

      MILESTONES.forEach((milestone, i) => {
        const progress = i / (MILESTONES.length - 1);
        const y = startY + progress * helixHeight;
        const wave = Math.sin(progress * Math.PI * frequency + time);
        const x = centerX + wave * amplitude;

        const isActive = i === activeIndex;
        // Smooth size transition
        const size = isActive ? 10 + 6 * currentTransition : 10;

        // Glow with smooth fade
        if (isActive || i === (activeIndex + MILESTONES.length - 1) % MILESTONES.length) {
          const glowIntensity = isActive ? currentTransition : 1 - currentTransition;
          if (glowIntensity > 0.01) {
            const glow = ctx.createRadialGradient(x, y, 0, x, y, 40);
            const alpha = Math.floor(glowIntensity * 96)
              .toString(16)
              .padStart(2, '0');
            glow.addColorStop(0, milestone.color + alpha);
            glow.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.beginPath();
            ctx.arc(x, y, 40, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
          }
        }

        // Node
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = milestone.color;
        ctx.fill();

        // Inner bright - more intense when active
        const innerAlpha = isActive ? 0.6 + currentTransition * 0.4 : 0.6;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${innerAlpha})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [activeIndex, transitionProgress]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex items-center justify-center">
      <div className="flex gap-8 items-center">
        <canvas ref={canvasRef} width={250} height={380} className="max-w-[250px]" />

        {/* Milestone info */}
        <div className="space-y-4">
          {MILESTONES.map((milestone, i) => {
            const isActive = i === activeIndex;
            const opacity = isActive ? transitionProgress : 0.35;
            const translateX = isActive ? (1 - transitionProgress) * -8 : -4;

            return (
              <div
                key={i}
                className="flex items-center gap-3"
                style={{
                  opacity,
                  transform: `translateX(${translateX}px)`,
                  transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
                }}
              >
                <div
                  className="w-3 h-3 rounded-full transition-transform duration-300"
                  style={{
                    backgroundColor: milestone.color,
                    transform: isActive ? `scale(${0.8 + transitionProgress * 0.4})` : 'scale(1)',
                  }}
                />
                <div>
                  <div
                    className="text-lg font-bold transition-colors duration-300"
                    style={{ color: isActive ? milestone.color : 'rgba(255,255,255,0.6)' }}
                  >
                    {milestone.year}
                  </div>
                  <div className="text-sm text-gray-400">{milestone.label}</div>
                </div>
              </div>
            );
          })}
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
