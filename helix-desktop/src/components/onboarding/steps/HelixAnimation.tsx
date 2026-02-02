import { useEffect, useRef } from 'react';
import './HelixAnimation.css';

/**
 * DNA Double Helix Animation
 * True intertwining strands with disintegrating data blocks at ends
 * Canvas-based for smooth animation
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
}

export function HelixAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;

    // Initialize particles for disintegration effect
    const initParticles = () => {
      const particles: Particle[] = [];
      // Create particles that will continuously spawn at helix ends
      for (let i = 0; i < 20; i++) {
        particles.push(createParticle('top'));
        particles.push(createParticle('bottom'));
      }
      return particles;
    };

    const createParticle = (end: 'top' | 'bottom'): Particle => {
      const isTop = end === 'top';
      const colors = ['#16c0cf', '#7234ED', '#0686D4'];
      return {
        x: centerX + (Math.random() - 0.5) * 50,
        y: isTop ? 8 + Math.random() * 15 : height - 8 - Math.random() * 15,
        vx: (Math.random() - 0.5) * 0.8,
        vy: isTop ? -0.3 - Math.random() * 0.5 : 0.3 + Math.random() * 0.5,
        size: 2 + Math.random() * 3,
        alpha: 0.6 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: Math.random() * 100,
      };
    };

    particlesRef.current = initParticles();

    let time = 0;

    const animate = () => {
      time += 0.006; // Very slow, gentle rotation
      ctx.clearRect(0, 0, width, height);

      // Helix parameters
      const helixHeight = height * 0.75;
      const startY = height * 0.125;
      const amplitude = 26;
      const frequency = 2.2;
      const strandWidth = 2.5;

      // Draw connecting rungs first (behind strands)
      ctx.lineWidth = 1;
      for (let i = 0; i <= 20; i++) {
        const progress = i / 20;
        const y = startY + progress * helixHeight;
        const wave1 = Math.sin(progress * Math.PI * frequency * 2 + time);
        const wave2 = Math.sin(progress * Math.PI * frequency * 2 + time + Math.PI);

        const x1 = centerX + wave1 * amplitude;
        const x2 = centerX + wave2 * amplitude;

        // Fade rungs at ends for disintegration effect
        const edgeFade = Math.min(progress * 5, (1 - progress) * 5, 1);

        const distance = Math.abs(wave1 - wave2);
        if (distance < 1.6) {
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          const alpha = (0.12 + (1 - distance / 1.6) * 0.15) * edgeFade;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.stroke();
        }
      }

      // Draw strand 1 (cyan) - segments for depth effect
      const segments = 60;
      for (let i = 0; i < segments; i++) {
        const progress1 = i / segments;
        const progress2 = (i + 1) / segments;
        const y1 = startY + progress1 * helixHeight;
        const y2 = startY + progress2 * helixHeight;

        const wave1 = Math.sin(progress1 * Math.PI * frequency * 2 + time);
        const wave2 = Math.sin(progress2 * Math.PI * frequency * 2 + time);

        const x1 = centerX + wave1 * amplitude;
        const x2 = centerX + wave2 * amplitude;

        const isFront = wave1 > 0;

        // Fade at ends for disintegration
        const edgeFade = Math.min(progress1 * 6, (1 - progress1) * 6, 1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        const baseAlpha = isFront ? 1 : 0.35;
        ctx.strokeStyle = isFront
          ? `rgba(22, 192, 207, ${baseAlpha * edgeFade})`
          : `rgba(22, 192, 207, ${baseAlpha * edgeFade})`;
        ctx.lineWidth = (isFront ? strandWidth : strandWidth * 0.6) * edgeFade;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Draw strand 2 (purple) - π phase offset
      for (let i = 0; i < segments; i++) {
        const progress1 = i / segments;
        const progress2 = (i + 1) / segments;
        const y1 = startY + progress1 * helixHeight;
        const y2 = startY + progress2 * helixHeight;

        const wave1 = Math.sin(progress1 * Math.PI * frequency * 2 + time + Math.PI);
        const wave2 = Math.sin(progress2 * Math.PI * frequency * 2 + time + Math.PI);

        const x1 = centerX + wave1 * amplitude;
        const x2 = centerX + wave2 * amplitude;

        const isFront = wave1 > 0;
        const edgeFade = Math.min(progress1 * 6, (1 - progress1) * 6, 1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        const baseAlpha = isFront ? 1 : 0.35;
        ctx.strokeStyle = isFront
          ? `rgba(114, 52, 237, ${baseAlpha * edgeFade})`
          : `rgba(114, 52, 237, ${baseAlpha * edgeFade})`;
        ctx.lineWidth = (isFront ? strandWidth : strandWidth * 0.6) * edgeFade;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Update and draw disintegrating particles (data blocks)
      particlesRef.current.forEach((particle, idx) => {
        // Update
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life += 1;
        particle.alpha -= 0.008;

        // Reset particle when faded or off screen
        if (particle.alpha <= 0 || particle.y < -10 || particle.y > height + 10) {
          const isTop = particle.vy < 0;
          const newParticle = createParticle(isTop ? 'top' : 'bottom');
          particlesRef.current[idx] = newParticle;
          return;
        }

        // Draw data block (square)
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.life * 0.02); // Slight rotation

        // Glow
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 4;

        ctx.fillStyle = particle.color + Math.floor(particle.alpha * 255).toString(16).padStart(2, '0');
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);

        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <div className="dna-helix-container">
      {/* Ambient glow background */}
      <div className="helix-glow-bg" />
      <canvas
        ref={canvasRef}
        width={100}
        height={120}
        className="helix-canvas"
        aria-hidden="true"
      />
    </div>
  );
}
