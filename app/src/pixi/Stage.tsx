import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import type { GameState } from "@nanofarm/shared";
import {
  mountScene,
  renderScene,
  screenToTile,
  screenDeltaToTileDelta,
  type Scene
} from "./scene";

interface Props {
  state: GameState;
  terrain: Uint8Array;
  connected: Set<string>;
  cameraX: number;
  cameraY: number;
  zoom: number;
  selectMode: "building" | "road" | null;
  width: number;
  height: number;
  onTileClick?: (tx: number, ty: number) => void;
  onCameraChange?: (cx: number, cy: number) => void;
  onZoomChange?: (z: number) => void;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;
const DRAG_THRESHOLD_PX = 4;

export function Stage({
  state,
  terrain,
  connected,
  cameraX,
  cameraY,
  zoom,
  selectMode,
  width,
  height,
  onTileClick,
  onCameraChange,
  onZoomChange
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startCx: number;
    startCy: number;
    moved: boolean;
  } | null>(null);

  // refs to capture latest values in event handlers without stale closures
  const propsRef = useRef({
    cameraX,
    cameraY,
    zoom,
    selectMode,
    onTileClick,
    onCameraChange,
    onZoomChange,
    width,
    height
  });
  propsRef.current = {
    cameraX,
    cameraY,
    zoom,
    selectMode,
    onTileClick,
    onCameraChange,
    onZoomChange,
    width,
    height
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const app = new Application();

    void (async () => {
      await app.init({
        width,
        height,
        background: "#0a0e05",
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      container.appendChild(app.canvas);
      appRef.current = app;
      sceneRef.current = mountScene(app);
      doRender();
    })();

    return () => {
      cancelled = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function doRender(): void {
    if (!sceneRef.current) return;
    renderScene(sceneRef.current, {
      state,
      terrain,
      connected,
      cameraX,
      cameraY,
      zoom,
      hoverX: hoverRef.current?.x ?? null,
      hoverY: hoverRef.current?.y ?? null,
      selectMode,
      canvasW: width,
      canvasH: height
    });
  }

  useEffect(() => {
    doRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, terrain, connected, cameraX, cameraY, zoom, selectMode]);

  function localPos(e: React.MouseEvent<HTMLDivElement>): { sx: number; sy: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCx: propsRef.current.cameraX,
      startCy: propsRef.current.cameraY,
      moved: false
    };
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (drag) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        drag.moved = true;
        const { dtx, dty } = screenDeltaToTileDelta(dx, dy, propsRef.current.zoom);
        propsRef.current.onCameraChange?.(drag.startCx - dtx, drag.startCy - dty);
      }
      return;
    }
    if (propsRef.current.selectMode === null) return;
    const { sx, sy } = localPos(e);
    const { tx, ty } = screenToTile(
      sx,
      sy,
      propsRef.current.cameraX,
      propsRef.current.cameraY,
      propsRef.current.width,
      propsRef.current.height,
      propsRef.current.zoom
    );
    const prev = hoverRef.current;
    if (!prev || prev.x !== tx || prev.y !== ty) {
      hoverRef.current = { x: tx, y: ty };
      doRender();
    }
  }

  function onMouseUp(e: React.MouseEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.moved) return; // it was a pan, not a click
    if (!propsRef.current.onTileClick) return;
    const { sx, sy } = localPos(e);
    const { tx, ty } = screenToTile(
      sx,
      sy,
      propsRef.current.cameraX,
      propsRef.current.cameraY,
      propsRef.current.width,
      propsRef.current.height,
      propsRef.current.zoom
    );
    propsRef.current.onTileClick(tx, ty);
  }

  function onMouseLeave(): void {
    dragRef.current = null;
    if (hoverRef.current) {
      hoverRef.current = null;
      doRender();
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.2 : 0.2;
      const cur = propsRef.current.zoom;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cur + step));
      if (next !== cur) propsRef.current.onZoomChange?.(next);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const dragging = dragRef.current?.moved ?? false;
  const classes =
    "pixi-stage" +
    (selectMode ? " select-mode" : "") +
    (dragging ? " dragging" : "");

  return (
    <div
      ref={containerRef}
      className={classes}
      style={{ width, height }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    />
  );
}
