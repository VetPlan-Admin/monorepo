"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OverlayShape, Point2D } from "@vet-plan/shared";
import type { RadiographImage, WindowLevel } from "./image/types";
import { adjustWindow, renderWindowed } from "./image/windowing";
import { drawHandles, drawOverlay } from "./overlay-renderer";
import type { PointHandle } from "./planner-state";
import { fitToCanvas, isInsideImage, panBy, screenToImage, zoomAt } from "./viewport";
import type { Viewport } from "./viewport";

export interface CanvasLayer {
  id: string;
  active: boolean;
  overlay: readonly OverlayShape[];
  handles: readonly (PointHandle & { point: Point2D })[];
}

interface PlannerCanvasProps {
  image: RadiographImage;
  windowLevel: WindowLevel;
  onWindowLevelChange: (window: WindowLevel) => void;
  /** null = fit the image to the canvas. */
  viewport: Viewport | null;
  onViewportChange: (viewport: Viewport) => void;
  layers: readonly CanvasLayer[];
  /** True while the active measurement still needs landmarks: clicks place points. */
  placing: boolean;
  onPlacePoint: (point: Point2D) => void;
  onMovePoint: (handle: PointHandle, point: Point2D) => void;
  findHandle: (point: Point2D, tolerance: number) => PointHandle | null;
  onUndo: () => void;
}

type Drag =
  | { kind: "point"; handle: PointHandle; startX: number; startY: number; moved: boolean }
  | { kind: "pan"; startX: number; startY: number; startViewport: Viewport; moved: boolean; click: boolean }
  | { kind: "window"; startX: number; startY: number; startWindow: WindowLevel };

const HANDLE_TOLERANCE_PX = 10;
const CLICK_SLOP_PX = 4;

export function PlannerCanvas(props: PlannerCanvasProps) {
  const {
    image, windowLevel, onWindowLevelChange, viewport, onViewportChange, layers, placing,
    onPlacePoint, onMovePoint, findHandle, onUndo,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<PointHandle | null>(null);
  const [dragKind, setDragKind] = useState<Drag["kind"] | null>(null);
  // Window last rendered into `imageCanvas` (re-windowing a large radiograph is the costly step)
  const renderedWindowRef = useRef<WindowLevel | null>(null);

  // Offscreen copy of the windowed image, one per loaded image
  const imageCanvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    return canvas;
  }, [image]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!viewport && size.width > 0 && size.height > 0) {
      onViewportChange(fitToCanvas(image.width, image.height, size.width, size.height));
    }
  }, [viewport, size, image, onViewportChange]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport || size.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(size.width * ratio);
    const height = Math.round(size.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    const frame = requestAnimationFrame(() => {
      if (renderedWindowRef.current !== windowLevel) {
        const imageContext = imageCanvas.getContext("2d");
        if (imageContext) {
          const imageData = imageContext.createImageData(image.width, image.height);
          renderWindowed(image.pixels, windowLevel, image.invert, imageData.data);
          imageContext.putImageData(imageData, 0, 0);
          renderedWindowRef.current = windowLevel;
        }
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio * viewport.scale, 0, 0, ratio * viewport.scale, ratio * viewport.offsetX, ratio * viewport.offsetY);
      context.imageSmoothingEnabled = viewport.scale < 2;
      context.drawImage(imageCanvas, 0, 0);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Inactive measurements first, the active one on top
      const ordered = [...layers].sort((a, b) => Number(a.active) - Number(b.active));
      for (const layer of ordered) {
        drawOverlay(context, layer.overlay, viewport, !layer.active);
        drawHandles(
          context,
          layer.handles.map((h) => ({
            point: h.point,
            hovered: hovered?.id === h.id && hovered.landmarkKey === h.landmarkKey && hovered.index === h.index,
          })),
          viewport,
          layer.active,
        );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [image, imageCanvas, windowLevel, viewport, size, layers, hovered]);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      onViewportChange(zoomAt(viewport, point, Math.exp(-event.deltaY * 0.0015)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [viewport, onViewportChange]);

  function localPoint(event: React.PointerEvent): Point2D {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!viewport) return;
    const screen = localPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = startDrag(event.button, screen, viewport);
    setDragKind(dragRef.current.kind);
  }

  function startDrag(button: number, screen: Point2D, current: Viewport): Drag {
    if (button === 2) {
      return { kind: "window", startX: screen.x, startY: screen.y, startWindow: windowLevel };
    }
    if (button === 0) {
      const handle = findHandle(screenToImage(current, screen), HANDLE_TOLERANCE_PX / current.scale);
      if (handle) return { kind: "point", handle, startX: screen.x, startY: screen.y, moved: false };
    }
    return { kind: "pan", startX: screen.x, startY: screen.y, startViewport: current, moved: false, click: button === 0 };
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!viewport) return;
    const screen = localPoint(event);
    const drag = dragRef.current;
    if (!drag) {
      setHovered(findHandle(screenToImage(viewport, screen), HANDLE_TOLERANCE_PX / viewport.scale));
      return;
    }
    if (drag.kind === "point") {
      // Only a real drag moves a landmark; a click without movement may place a new point
      if (drag.moved || Math.hypot(screen.x - drag.startX, screen.y - drag.startY) > CLICK_SLOP_PX) {
        drag.moved = true;
        onMovePoint(drag.handle, screenToImage(viewport, screen));
      }
    } else if (drag.kind === "window") {
      onWindowLevelChange(
        adjustWindow(drag.startWindow, screen.x - drag.startX, screen.y - drag.startY, image.maxValue - image.minValue),
      );
    } else {
      const dx = screen.x - drag.startX;
      const dy = screen.y - drag.startY;
      if (drag.moved || Math.hypot(dx, dy) > CLICK_SLOP_PX) {
        drag.moved = true;
        onViewportChange(panBy(drag.startViewport, dx, dy));
      }
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragKind(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const isClick = (drag?.kind === "pan" && drag.click && !drag.moved) || (drag?.kind === "point" && !drag.moved);
    if (isClick && placing && viewport) {
      const point = screenToImage(viewport, localPoint(event));
      if (isInsideImage(point, image.width, image.height)) onPlacePoint(point);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      onUndo();
    } else if (event.key === "f" || event.key === "F") {
      onViewportChange(fitToCanvas(image.width, image.height, size.width, size.height));
    } else if ((event.key === "+" || event.key === "=" || event.key === "-") && viewport) {
      const center = { x: size.width / 2, y: size.height / 2 };
      onViewportChange(zoomAt(viewport, center, event.key === "-" ? 1 / 1.25 : 1.25));
    }
  }

  const cursor = dragKind === "pan" ? "grabbing" : dragKind === "point" || hovered ? "move" : placing ? "crosshair" : "grab";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Radiograph. Click to place landmarks, drag points to adjust, scroll to zoom, drag to pan, right-drag for window and level, Backspace to undo, F to fit."
      role="application"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHovered(null)}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
}
