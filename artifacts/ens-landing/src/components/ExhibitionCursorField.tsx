import { useEffect, useRef } from 'react';

type ExhibitionCursorFieldProps = {
  variant: 'client' | 'staff';
};

type Point = {
  x: number;
  y: number;
};

type FieldColors = {
  accent: string;
  line: string;
  muted: string;
  surface: string;
};

const DPR_LIMIT = 1.5;
const SETTLE_EPSILON = 0.0004;

function cssHsl(variable: string, alpha: number) {
  return `hsl(${variable} / ${alpha})`;
}

export function ExhibitionCursorField({ variant }: ExhibitionCursorFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const context = canvas?.getContext('2d');

    if (!canvas || !host || !context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { targetX: 0.5, targetY: 0.48, x: 0.5, y: 0.48, active: false };
    let width = 1;
    let height = 1;
    let devicePixelRatio = 1;
    let frame = 0;
    let visible = true;
    let disposed = false;
    let colors: FieldColors;

    const readColors = () => {
      const styles = getComputedStyle(host);
      const primary = styles.getPropertyValue('--primary').trim() || '213 94% 68%';
      const foreground = styles.getPropertyValue('--foreground').trim() || '222 47% 11%';
      const muted = styles.getPropertyValue('--muted-foreground').trim() || '215 16% 47%';
      const background = styles.getPropertyValue('--background').trim() || '0 0% 100%';

      colors = {
        accent: cssHsl(primary, 0.52),
        line: cssHsl(foreground, 0.2),
        muted: cssHsl(muted, 0.24),
        surface: cssHsl(background, 0.82),
      };
    };

    const warpedPoint = (x: number, y: number, depth = 1): Point => {
      const parallaxX = (pointer.x - 0.5) * 20 * depth;
      const parallaxY = (pointer.y - 0.5) * 12 * depth;
      let screenX = x + parallaxX;
      let screenY = y + parallaxY;

      if (!pointer.active || reducedMotion.matches) {
        return { x: screenX, y: screenY };
      }

      const cursorX = pointer.x * width;
      const cursorY = pointer.y * height;
      const dx = screenX - cursorX;
      const dy = screenY - cursorY;
      const distance = Math.hypot(dx, dy) || 1;
      const radius = Math.min(width, height) * 0.24;

      if (distance < radius) {
        const force = (1 - distance / radius) * 7 * depth;
        screenX += (dx / distance) * force;
        screenY += (dy / distance) * force;
      }

      return { x: screenX, y: screenY };
    };

    const line = (from: Point, to: Point, color: string, lineWidth = 1) => {
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.stroke();
    };

    const polyline = (points: Point[], color: string, lineWidth = 1, close = false) => {
      if (points.length < 2) return;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      if (close) context.closePath();
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.stroke();
    };

    const drawDimension = (from: Point, to: Point, label: string) => {
      context.save();
      context.setLineDash([6, 5]);
      line(from, to, colors.muted);
      context.setLineDash([]);

      const middleX = (from.x + to.x) / 2;
      const middleY = (from.y + to.y) / 2;
      context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      const textWidth = context.measureText(label).width;
      context.fillStyle = colors.surface;
      context.fillRect(middleX - textWidth / 2 - 5, middleY - 8, textWidth + 10, 16);
      context.fillStyle = colors.muted;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, middleX, middleY);
      context.restore();
    };

    const drawFlowMarker = (x: number, y: number, angle: number, index: number) => {
      const spacing = 8;
      const size = 5;
      const offset = ((pointer.x + pointer.y) * 8 + index * 3) % spacing;
      const center = warpedPoint(
        x + Math.cos(angle) * offset,
        y + Math.sin(angle) * offset,
        1.15,
      );
      const left = {
        x: center.x - Math.cos(angle - Math.PI / 4) * size,
        y: center.y - Math.sin(angle - Math.PI / 4) * size,
      };
      const right = {
        x: center.x - Math.cos(angle + Math.PI / 4) * size,
        y: center.y - Math.sin(angle + Math.PI / 4) * size,
      };
      polyline([left, center, right], colors.accent, 1.35);
    };

    const drawCursorInspection = () => {
      if (!pointer.active || reducedMotion.matches) return;

      const x = pointer.x * width;
      const y = pointer.y * height;
      const overPrimaryContent = x > width * 0.22 && x < width * 0.78 && y > height * 0.12 && y < height * 0.7;
      if (overPrimaryContent) return;

      const cell = Math.max(30, Math.min(48, width / 28));
      const left = Math.floor(x / cell) * cell;
      const top = Math.floor(y / cell) * cell;

      context.save();
      context.setLineDash([3, 4]);
      context.strokeStyle = colors.accent;
      context.lineWidth = 1;
      context.strokeRect(left + 4, top + 4, cell - 8, cell - 8);
      context.setLineDash([]);
      line({ x: x - 8, y }, { x: x + 8, y }, colors.accent);
      line({ x, y: y - 8 }, { x, y: y + 8 }, colors.accent);
      context.restore();
    };

    const drawClientBooth = () => {
      const scale = Math.min(width / 12.5, height / 6.4);
      const originX = width * 0.5;
      const originY = height * 0.84;
      const project = (x: number, y: number, z: number, depth = 1) => warpedPoint(
        originX + (x - z) * scale,
        originY + (x + z) * scale * 0.24 - y * scale,
        depth,
      );

      const floor = [
        project(-3, 0, -1.5, 0.55),
        project(3, 0, -1.5, 0.55),
        project(3, 0, 1.5, 0.55),
        project(-3, 0, 1.5, 0.55),
      ];
      polyline(floor, colors.line, 1, true);

      const backLeft = project(-3, 0, 1.5);
      const backRight = project(3, 0, 1.5);
      const backLeftTop = project(-3, 2.5, 1.5, 1.2);
      const backRightTop = project(3, 2.5, 1.5, 1.2);
      const frontLeftTop = project(-3, 2.5, -1.5, 1.2);
      const frontRightTop = project(3, 2.5, -1.5, 1.2);

      polyline([backLeft, backLeftTop, backRightTop, backRight], colors.line, 1.1);
      polyline([frontLeftTop, frontRightTop, backRightTop, backLeftTop, frontLeftTop], colors.accent, 1.25);
      line(project(-3, 0, -1.5), frontLeftTop, colors.line, 1.1);
      line(project(3, 0, -1.5), frontRightTop, colors.line, 1.1);

      for (let panel = -2; panel <= 2; panel += 1) {
        line(project(panel, 0, 1.5, 0.8), project(panel, 2.5, 1.5, 1.1), colors.line);
      }

      const fasciaBottomLeft = project(-3, 2.18, -1.5, 1.35);
      const fasciaBottomRight = project(3, 2.18, -1.5, 1.35);
      line(fasciaBottomLeft, fasciaBottomRight, colors.accent, 1.5);

      drawDimension(
        project(-3, -0.42, -1.5, 0.45),
        project(3, -0.42, -1.5, 0.45),
        '6.0 m',
      );

      const routeY = height * 0.74;
      for (let index = 0; index < 9; index += 1) {
        drawFlowMarker(width * 0.17 + index * width * 0.083, routeY, 0, index);
      }
    };

    const drawStaffPlan = () => {
      const marginX = Math.max(30, width * 0.055);
      const planTop = height * 0.24;
      const planBottom = height * 0.84;
      const aisleLeft = width * 0.22;
      const aisleRight = width * 0.78;
      const rows = 4;

      context.save();
      context.setLineDash([7, 7]);
      line(
        warpedPoint(width * 0.5, planTop, 0.4),
        warpedPoint(width * 0.5, planBottom, 0.4),
        colors.muted,
      );
      context.setLineDash([]);

      for (let row = 0; row < rows; row += 1) {
        const gap = (planBottom - planTop) / rows;
        const top = planTop + row * gap + 5;
        const bottom = planTop + (row + 1) * gap - 5;
        const leftBooth = [
          warpedPoint(marginX, top, 0.75),
          warpedPoint(aisleLeft, top, 0.75),
          warpedPoint(aisleLeft, bottom, 0.75),
          warpedPoint(marginX, bottom, 0.75),
        ];
        const rightBooth = [
          warpedPoint(aisleRight, top, 0.75),
          warpedPoint(width - marginX, top, 0.75),
          warpedPoint(width - marginX, bottom, 0.75),
          warpedPoint(aisleRight, bottom, 0.75),
        ];

        polyline(leftBooth, row === 1 ? colors.accent : colors.line, row === 1 ? 1.4 : 1, true);
        polyline(rightBooth, row === 2 ? colors.accent : colors.line, row === 2 ? 1.4 : 1, true);

        const moduleWidth = (aisleLeft - marginX) / 3;
        for (let module = 1; module < 3; module += 1) {
          line(
            warpedPoint(marginX + module * moduleWidth, top, 0.6),
            warpedPoint(marginX + module * moduleWidth, bottom, 0.6),
            colors.muted,
          );
          line(
            warpedPoint(aisleRight + module * moduleWidth, top, 0.6),
            warpedPoint(aisleRight + module * moduleWidth, bottom, 0.6),
            colors.muted,
          );
        }
      }

      for (let index = 0; index < 8; index += 1) {
        const markerY = planTop + 20 + index * ((planBottom - planTop - 40) / 7);
        drawFlowMarker(width * 0.285, markerY, Math.PI / 2, index);
        drawFlowMarker(width * 0.715, markerY, -Math.PI / 2, index + 8);
      }

      const statusPoints = [
        { x: aisleLeft - 12, y: planTop + (planBottom - planTop) * 0.375 },
        { x: aisleRight + 12, y: planTop + (planBottom - planTop) * 0.625 },
      ];
      statusPoints.forEach((point) => {
        const warped = warpedPoint(point.x, point.y, 1.1);
        context.beginPath();
        context.arc(warped.x, warped.y, 4, 0, Math.PI * 2);
        context.fillStyle = colors.accent;
        context.fill();
      });
      context.restore();
    };

    const draw = () => {
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.lineCap = 'square';
      context.lineJoin = 'miter';

      if (variant === 'client') {
        drawClientBooth();
      } else {
        drawStaffPlan();
      }
      drawCursorInspection();
    };

    const scheduleDraw = () => {
      if (!frame && visible && !disposed) frame = window.requestAnimationFrame(tick);
    };

    const tick = () => {
      frame = 0;
      if (disposed || !visible) return;

      const previousX = pointer.x;
      const previousY = pointer.y;
      const easing = reducedMotion.matches ? 1 : 0.13;
      pointer.x += (pointer.targetX - pointer.x) * easing;
      pointer.y += (pointer.targetY - pointer.y) * easing;
      draw();

      const movement = Math.abs(previousX - pointer.x) + Math.abs(previousY - pointer.y);
      if (movement > SETTLE_EPSILON) scheduleDraw();
    };

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      devicePixelRatio = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
      canvas.width = Math.round(width * devicePixelRatio);
      canvas.height = Math.round(height * devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      scheduleDraw();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      const bounds = host.getBoundingClientRect();
      pointer.targetX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      pointer.targetY = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      pointer.active = true;
      scheduleDraw();
    };

    const onPointerLeave = () => {
      pointer.targetX = 0.5;
      pointer.targetY = 0.48;
      pointer.active = false;
      scheduleDraw();
    };

    const onMotionPreferenceChange = () => {
      pointer.targetX = 0.5;
      pointer.targetY = 0.48;
      pointer.active = false;
      scheduleDraw();
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) scheduleDraw();
    }, { rootMargin: '120px' });
    const themeObserver = new MutationObserver(() => {
      readColors();
      scheduleDraw();
    });

    readColors();
    resizeObserver.observe(host);
    intersectionObserver.observe(host);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave, { passive: true });
    reducedMotion.addEventListener('change', onMotionPreferenceChange);
    resize();

    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      reducedMotion.removeEventListener('change', onMotionPreferenceChange);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className="ens-exhibition-cursor-field"
      aria-hidden="true"
      data-variant={variant}
    />
  );
}
