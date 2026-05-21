import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import type { GameState } from "@nanofarm/shared";
import { mountScene, updateScene, type Scene } from "./scene";

interface Props {
  state: GameState;
  width: number;
  height: number;
}

export function Stage({ state, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<Scene | null>(null);

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
      if (sceneRef.current) updateScene(sceneRef.current, state);
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

  useEffect(() => {
    if (sceneRef.current) updateScene(sceneRef.current, state);
  }, [state]);

  return <div ref={containerRef} className="pixi-stage" style={{ width, height }} />;
}
