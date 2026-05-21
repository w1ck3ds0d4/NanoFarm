import { useEffect, useReducer, useRef, useState } from "react";
import type { BuildingId } from "@nanofarm/shared";
import { makeInitialState } from "@nanofarm/shared";
import { reducer } from "./game/state";
import { GameLoop } from "./game/loop";
import { SaveLoop, loadOrInit } from "./game/save";
import { createStorageAdapter } from "./adapter/storage";
import { createDrainer, type TokenDrainer } from "./game/tokens";
import { effectsFor } from "./game/events";
import { Stage } from "./pixi/Stage";
import { ResourcePanel } from "./ui/ResourcePanel";
import { BuildPalette } from "./ui/BuildPalette";
import { EventDialog } from "./ui/EventDialog";

const STAGE_W = 384;
const STAGE_H = 256;

type HookStatus = "unavailable" | "disconnected" | "connected";

export function App() {
  const adapterRef = useRef(createStorageAdapter());
  const drainerRef = useRef<TokenDrainer>(createDrainer());
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    makeInitialState(Date.now())
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const [booted, setBooted] = useState(false);
  const [hookStatus, setHookStatus] = useState<HookStatus>(
    drainerRef.current.isAvailable() ? "disconnected" : "unavailable"
  );

  useEffect(() => {
    void (async () => {
      const loaded = await loadOrInit(adapterRef.current, Date.now());
      dispatch({ type: "hydrate", state: loaded });
      await drainerRef.current.restore();
      if (drainerRef.current.isConnected()) setHookStatus("connected");
      setBooted(true);
    })();
  }, []);

  useEffect(() => {
    if (!booted) return;
    const game = new GameLoop({
      getState: () => stateRef.current,
      dispatch,
      drainer: drainerRef.current
    });
    const saver = new SaveLoop(adapterRef.current, () => stateRef.current);
    game.start();
    saver.start();
    return () => {
      game.stop();
      saver.stop();
    };
  }, [booted]);

  useEffect(() => {
    if (state.events.activeId === null && state.events.queuedIds.length > 0) {
      const next = state.events.queuedIds[0];
      dispatch({ type: "open-event", eventId: next });
    }
  }, [state.events.activeId, state.events.queuedIds]);

  function onHarvest() {
    dispatch({ type: "harvest" });
  }

  function onBuy(id: BuildingId) {
    dispatch({ type: "buy-building", building: id });
  }

  function onChooseEvent(eventId: string, choiceIndex: number) {
    const effects = effectsFor(eventId, choiceIndex);
    dispatch({ type: "apply-effects", effects });
    dispatch({ type: "resolve-event", eventId });
  }

  async function onConnectHook() {
    try {
      await drainerRef.current.connect();
      setHookStatus("connected");
    } catch (e) {
      console.error("hook connect failed", e);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>NanoFarm</h1>
        <div className="hook-status">
          {hookStatus === "connected" && <span>hook connected</span>}
          {hookStatus === "disconnected" && (
            <button onClick={onConnectHook}>connect claude code hook</button>
          )}
          {hookStatus === "unavailable" && <span>hook unavailable in this browser</span>}
        </div>
      </header>
      <main>
        <section className="stage-section">
          <Stage state={state} width={STAGE_W} height={STAGE_H} />
        </section>
        <section className="panels">
          <ResourcePanel state={state} onHarvest={onHarvest} />
          <BuildPalette state={state} onBuy={onBuy} />
        </section>
      </main>
      <EventDialog state={state} onChoose={onChooseEvent} />
    </div>
  );
}
