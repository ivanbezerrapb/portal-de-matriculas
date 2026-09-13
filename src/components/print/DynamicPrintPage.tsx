import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefCallback,
} from "react";
import { BlockView } from "@/components/print/BlockView";
import {
  MM_PX,
  type PrintBlock,
  type PrintContext,
  type PrintPage,
} from "@/lib/ext/print-layout";

export type PositionedPrintBlock = {
  block: PrintBlock;
  y: number;
  h: number;
  dynamic: boolean;
  scale: number;
};

const MIN_SCALE = 0.6;
const SCALE_STEP = 0.05;
const TOLERANCE = 1; // px

function isDynamic(block: PrintBlock) {
  return block.type === "field" || block.type === "table" || block.type === "children";
}

function overlapsHorizontally(a: PrintBlock, b: PrintBlock) {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

type Fit = { scale: number; height: number };

// Mede o bloco reduzindo a fonte em passos até caber na caixa desenhada.
function measureFit(node: HTMLDivElement, block: PrintBlock): Fit {
  const boxH = block.h * MM_PX;
  const boxW = block.w * MM_PX;
  const previousHeight = node.style.height;
  node.style.height = "auto";

  const apply = (scale: number) => {
    node.style.setProperty("--pscale", String(scale));
    return { h: node.scrollHeight, w: node.scrollWidth };
  };

  let scale = 1;
  let size = apply(scale);
  while (
    (size.h > boxH + TOLERANCE || size.w > boxW + TOLERANCE) &&
    scale - SCALE_STEP >= MIN_SCALE - 0.001
  ) {
    scale = Math.round((scale - SCALE_STEP) * 100) / 100;
    size = apply(scale);
  }

  const fits = size.h <= boxH + TOLERANCE;
  node.style.height = previousHeight;
  return { scale, height: fits ? block.h : size.h / MM_PX };
}

export function useDynamicPrintLayout(
  page: PrintPage | undefined,
  ctx: PrintContext,
  pageHeight: number,
) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [fits, setFits] = useState<Record<string, Fit>>({});
  const [measured, setMeasured] = useState(false);

  const register = useCallback(
    (id: string): RefCallback<HTMLDivElement> =>
      (node) => {
        if (node) nodes.current.set(id, node);
        else nodes.current.delete(id);
      },
    [],
  );

  useLayoutEffect(() => {
    if (!page) return;
    const next: Record<string, Fit> = {};
    page.blocks.forEach((block) => {
      if (!isDynamic(block)) return;
      const node = nodes.current.get(block.id);
      if (!node) return;
      next[block.id] = measureFit(node, block);
    });
    setFits((current) => {
      const changed =
        Object.keys(next).length !== Object.keys(current).length ||
        Object.entries(next).some(
          ([id, fit]) =>
            Math.abs((current[id]?.height ?? 0) - fit.height) > 0.15 ||
            (current[id]?.scale ?? 0) !== fit.scale,
        );
      return changed ? next : current;
    });
    setMeasured(true);
  }, [ctx, page]);

  const blocks = useMemo<PositionedPrintBlock[]>(() => {
    if (!page) return [];
    const ordered = [...page.blocks].sort((a, b) => a.y - b.y || a.x - b.x);
    const placed: PositionedPrintBlock[] = [];

    ordered.forEach((block) => {
      const dynamic = isDynamic(block);
      const fit = fits[block.id];
      const h = dynamic ? Math.max(block.h, fit?.height ?? block.h) : block.h;
      let y = block.y;

      placed.forEach((previous) => {
        // Empurra qualquer bloco desenhado abaixo deste, mesmo encostado ou sobreposto,
        // preservando a distância original entre eles.
        if (block.y > previous.block.y && overlapsHorizontally(block, previous.block)) {
          const originalGap = block.y - (previous.block.y + previous.block.h);
          y = Math.max(y, previous.y + previous.h + originalGap);
        }
      });

      placed.push({ block, y, h, dynamic, scale: fit?.scale ?? 1 });
    });

    return placed;
  }, [fits, page]);

  const overflow = blocks.some(({ y, h }) => y + h > pageHeight + 0.1);
  return { blocks, measured, overflow, register };
}

export function DynamicPrintPage({
  page,
  ctx,
  width,
  height,
  preview = false,
  className,
  style,
  onStatusChange,
}: {
  page: PrintPage;
  ctx: PrintContext;
  width: number;
  height: number;
  preview?: boolean;
  className?: string;
  style?: CSSProperties;
  onStatusChange?: (status: { ready: boolean; overflow: boolean }) => void;
}) {
  const layout = useDynamicPrintLayout(page, ctx, height);

  useLayoutEffect(() => {
    onStatusChange?.({ ready: layout.measured, overflow: layout.overflow });
  }, [layout.measured, layout.overflow, onStatusChange]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: `${width}mm`,
        height: `${height}mm`,
        color: "#000",
        overflow: "hidden",
        ...style,
      }}
    >
      {layout.blocks.map(({ block, y, dynamic }) => (
        <div
          key={block.id}
          ref={registerDynamicRef(layout.register, block.id, dynamic)}
          style={{
            position: "absolute",
            left: `${block.x}mm`,
            top: `${y}mm`,
            width: `${block.w}mm`,
            minHeight: `${block.h}mm`,
            height: dynamic ? "auto" : `${block.h}mm`,
            overflow: dynamic ? "visible" : "hidden",
          }}
        >
          <BlockView block={block} ctx={ctx} preview={preview} />
        </div>
      ))}
    </div>
  );
}

function registerDynamicRef(
  register: (id: string) => RefCallback<HTMLDivElement>,
  id: string,
  dynamic: boolean,
) {
  return dynamic ? register(id) : undefined;
}