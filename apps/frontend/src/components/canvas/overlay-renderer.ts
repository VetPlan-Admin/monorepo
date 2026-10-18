import { colors } from "@vet-plan/tokens";
import type { OverlayEmphasis, OverlayShape, Point2D } from "@vet-plan/shared";
import { imageToScreen } from "./viewport";
import type { Viewport } from "./viewport";

// High contrast on any radiograph: every stroke is drawn over a dark outline
const OUTLINE = "rgba(0, 0, 0, 0.85)";
const STROKES: Record<OverlayEmphasis, { color: string; width: number; dash: number[] }> = {
  primary: { color: colors.brand.yellow, width: 2.5, dash: [] },
  secondary: { color: "rgba(255, 255, 255, 0.9)", width: 2, dash: [] },
  guide: { color: colors.brand.yellow, width: 2, dash: [8, 6] },
};
const LABEL_FONT = "600 13px system-ui, sans-serif";

function strokeOutlined(context: CanvasRenderingContext2D, emphasis: OverlayEmphasis, path: () => void): void {
  const stroke = STROKES[emphasis];
  context.setLineDash(stroke.dash);
  context.lineWidth = stroke.width + 3;
  context.strokeStyle = OUTLINE;
  context.beginPath();
  path();
  context.stroke();
  context.lineWidth = stroke.width;
  context.strokeStyle = stroke.color;
  context.beginPath();
  path();
  context.stroke();
  context.setLineDash([]);
}

function drawArrowHead(context: CanvasRenderingContext2D, from: Point2D, to: Point2D, emphasis: OverlayEmphasis) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 10;
  const left = { x: to.x - size * Math.cos(angle - Math.PI / 6), y: to.y - size * Math.sin(angle - Math.PI / 6) };
  const right = { x: to.x - size * Math.cos(angle + Math.PI / 6), y: to.y - size * Math.sin(angle + Math.PI / 6) };
  strokeOutlined(context, emphasis === "guide" ? "primary" : emphasis, () => {
    context.moveTo(left.x, left.y);
    context.lineTo(to.x, to.y);
    context.lineTo(right.x, right.y);
  });
}

function drawLabel(context: CanvasRenderingContext2D, at: Point2D, text: string): void {
  context.font = LABEL_FONT;
  const paddingX = 6;
  const height = 22;
  const width = context.measureText(text).width + paddingX * 2;
  const x = at.x + 10;
  const y = at.y - height - 8;
  context.fillStyle = `${colors.brand.purple}e6`;
  context.strokeStyle = colors.brand.yellow;
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x, y, width, height, 4);
  context.fill();
  context.stroke();
  context.fillStyle = colors.brand.yellow;
  context.textBaseline = "middle";
  context.fillText(text, x + paddingX, y + height / 2);
}

/** Draws measurement shapes (image coordinates) in screen space so line widths stay constant. */
export function drawOverlay(
  context: CanvasRenderingContext2D,
  shapes: readonly OverlayShape[],
  viewport: Viewport,
  dimmed: boolean,
): void {
  context.save();
  context.globalAlpha = dimmed ? 0.55 : 1;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const shape of shapes) {
    switch (shape.kind) {
      case "segment":
      case "arrow": {
        const from = imageToScreen(viewport, shape.from);
        const to = imageToScreen(viewport, shape.to);
        strokeOutlined(context, shape.emphasis, () => {
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
        });
        if (shape.kind === "arrow") drawArrowHead(context, from, to, shape.emphasis);
        break;
      }
      case "circle": {
        const center = imageToScreen(viewport, shape.center);
        strokeOutlined(context, shape.emphasis, () => {
          context.arc(center.x, center.y, shape.radius * viewport.scale, 0, Math.PI * 2);
        });
        break;
      }
      case "label":
        drawLabel(context, imageToScreen(viewport, shape.at), shape.text);
        break;
    }
  }
  context.restore();
}

/** Landmark handles: yellow for the active measurement, white otherwise; larger when hovered. */
export function drawHandles(
  context: CanvasRenderingContext2D,
  points: readonly { point: Point2D; hovered: boolean }[],
  viewport: Viewport,
  active: boolean,
): void {
  context.save();
  context.globalAlpha = active ? 1 : 0.7;
  for (const { point, hovered } of points) {
    const screen = imageToScreen(viewport, point);
    context.beginPath();
    context.arc(screen.x, screen.y, hovered ? 7 : 5, 0, Math.PI * 2);
    context.fillStyle = active ? colors.brand.yellow : "#ffffff";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = OUTLINE;
    context.stroke();
  }
  context.restore();
}
