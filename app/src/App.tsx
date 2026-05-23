import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  makeInitialState,
  generateTerrain,
  findSpawn,
  terrainAt,
  isBuildable,
  totalMaterials
} from "@nanofarm/shared";
import { reducer } from "./game/state";
import { GameLoop } from "./game/loop";
import { SaveLoop, loadOrInit } from "./game/save";
import { createStorageAdapter } from "./adapter/storage";
import { createDrainer, type TokenDrainer } from "./game/tokens";
import { computeConnected } from "./game/connectivity";
import { populationCapacity } from "./game/population";
import { BUILDING_DEFS } from "./game/buildings";
import { Stage } from "./pixi/Stage";
import { BuildPalette, type Placeable } from "./ui/BuildPalette";
import { BuildingInspector } from "./ui/BuildingInspector";
import { BuildingTooltip } from "./ui/BuildingTooltip";
import { MaterialsOverlay } from "./ui/MaterialsOverlay";

const STAGE_W = 500;
const STAGE_H = 400;
const DEFAULT_ZOOM = 1;

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
  const [buildOpen, setBuildOpen] = useState(false);
  const [selected, setSelected] = useState<Placeable | null>(null);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  // Tile-key of the building the player is currently inspecting, or
  // null. Opened by tapping a placed building when nothing is
  // selected for placement; closed by the panel's close button, by
  // tapping an empty tile, or by tapping the same building again.
  const [inspected, setInspected] = useState<string | null>(null);
  // Hover tile reported by Stage. Used to render a small floating
  // tooltip over placed buildings. Updates fire only when the
  // cursor crosses into a new tile (Stage de-dupes per pixel) so
  // App re-renders are bounded by tile transitions, not mouse pixels.
  const [hoverTile, setHoverTile] = useState<{ tx: number; ty: number } | null>(null);
  const [cameraX, setCameraX] = useState(75);
  const [cameraY, setCameraY] = useState(75);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [cameraSpawned, setCameraSpawned] = useState(false);

  const terrain = useMemo(
    () => generateTerrain(state.map.seed, state.map.width, state.map.height),
    [state.map.seed, state.map.width, state.map.height]
  );
  const terrainRef = useRef(terrain);
  terrainRef.current = terrain;

  const connected = useMemo(() => computeConnected(state), [state.map.placed, state.map.roads]);
  const popCap = useMemo(() => populationCapacity(state, connected), [state.buildings.house, state.map.placed, connected]);

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
    if (!booted || cameraSpawned) return;
    const t = terrainRef.current;
    const spawn = findSpawn(t, state.map.width, state.map.height);
    setCameraX(spawn.x);
    setCameraY(spawn.y);
    setCameraSpawned(true);
  }, [booted, cameraSpawned, state.map.width, state.map.height]);

  useEffect(() => {
    if (!booted) return;
    const game = new GameLoop({
      getState: () => stateRef.current,
      getTerrain: () => terrainRef.current,
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelected(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // auto-deselect a building type once it hits its max placement count.
  useEffect(() => {
    if (!selected || selected === "road") return;
    const def = BUILDING_DEFS[selected];
    const count = state.buildings[selected].count;
    if (def.maxCount !== undefined && count >= def.maxCount) {
      setSelected(null);
    }
  }, [selected, state.buildings]);

  function onSelectPlaceable(p: Placeable | null) {
    setSelected(p);
    // Close the build panel on selection so the player can actually
    // see and click the map to place. The lingering placement-state
    // is surfaced by the floating "placing: X" pill below, which
    // doubles as a cancel button.
    if (p !== null) setBuildOpen(false);
  }

  function onTileClick(tx: number, ty: number) {
    if (tx < 0 || tx >= state.map.width || ty < 0 || ty >= state.map.height) return;
    const key = `${tx},${ty}`;

    // No placement is queued, so this click is a "what's here?" gesture.
    // Tap a placed building -> open inspector (or close it if it was
    // already showing this tile). Tap empty space -> close any open
    // inspector. Roads are not inspectable, so they fall through to
    // close-on-empty.
    if (!selected) {
      if (state.map.placed[key]) {
        setInspected((current) => (current === key ? null : key));
      } else {
        setInspected(null);
      }
      return;
    }

    const t = terrainAt(terrainRef.current, state.map.width, state.map.height, tx, ty);
    if (!isBuildable(t)) return;
    if (state.map.placed[key]) return;
    if (state.map.roads[key]) return;

    if (selected === "road") {
      dispatch({ type: "place-road", x: tx, y: ty });
      return;
    }
    dispatch({ type: "place-building", building: selected, x: tx, y: ty });
  }

  function onCameraChange(cx: number, cy: number) {
    const w = state.map.width;
    const h = state.map.height;
    setCameraX(Math.max(0, Math.min(w - 1, cx)));
    setCameraY(Math.max(0, Math.min(h - 1, cy)));
  }

  async function onConnectHook() {
    try {
      await drainerRef.current.connect();
      setHookStatus("connected");
    } catch (e) {
      console.error("hook connect failed", e);
    }
  }

  const totalBuildings =
    state.buildings.main.count + state.buildings.farm.count + state.buildings.mine.count;
  const showStartHint = totalBuildings === 0 && !selected && !buildOpen;
  const stageSelectMode: "building" | "road" | null =
    selected === null ? null : selected === "road" ? "road" : "building";

  const roadsCount = Object.keys(state.map.roads).length;

  return (
    <div className="app">
      <div className="canvas-wrap">
        <Stage
          state={state}
          terrain={terrain}
          connected={connected}
          cameraX={cameraX}
          cameraY={cameraY}
          zoom={zoom}
          selectMode={stageSelectMode}
          inspectKey={inspected}
          width={STAGE_W}
          height={STAGE_H}
          onTileClick={onTileClick}
          onCameraChange={onCameraChange}
          onZoomChange={setZoom}
          onHoverChange={setHoverTile}
        />

        {/* Hover tooltip for placed buildings. Suppressed during
            placement (selectMode is on - the Pixi ghost preview is
            authoritative there) and while the inspector is open
            (the panel already shows fuller info). */}
        {!selected && !inspected && hoverTile &&
         state.map.placed[`${hoverTile.tx},${hoverTile.ty}`] && (
          <BuildingTooltip
            state={state}
            terrain={terrain}
            connected={connected}
            tx={hoverTile.tx}
            ty={hoverTile.ty}
            cameraX={cameraX}
            cameraY={cameraY}
            zoom={zoom}
            canvasW={STAGE_W}
            canvasH={STAGE_H}
          />
        )}

        <div className="top-hud">
          <h1 className="game-title">NanoFarm</h1>
          <div className="resource-bar">
            <span className="rb-cell">
              <span className="rb-key">credits</span>
              <span className="rb-val">{Math.floor(state.resources.credits)}</span>
            </span>
            <button
              type="button"
              className={"rb-cell rb-clickable" + (materialsOpen ? " active" : "")}
              onClick={() => setMaterialsOpen((o) => !o)}
            >
              <span className="rb-key">materials</span>
              <span className="rb-val">{Math.floor(totalMaterials(state.resources))}</span>
            </button>
            <span className="rb-cell">
              <span className="rb-key">pop</span>
              <span className="rb-val">
                {Math.floor(state.meta.population)}/{popCap}
              </span>
            </span>
            <span className="rb-cell">
              <span className="rb-key">research</span>
              <span className="rb-val">{Math.floor(state.resources.research)}</span>
            </span>
          </div>
          <div className="hook-status">
            {hookStatus === "connected" && <span className="hook-ok">hook on</span>}
            {hookStatus === "disconnected" && (
              <button onClick={onConnectHook} className="hook-btn">
                hook
              </button>
            )}
            {hookStatus === "unavailable" && <span className="hook-off">hook off</span>}
          </div>
        </div>

        {materialsOpen && <MaterialsOverlay state={state} />}

        {inspected !== null && state.map.placed[inspected] && (
          <BuildingInspector
            state={state}
            terrain={terrain}
            connected={connected}
            inspectKey={inspected}
            onClose={() => setInspected(null)}
            onRemove={() => {
              const [xs, ys] = inspected.split(",");
              dispatch({ type: "remove-building", x: Number(xs), y: Number(ys) });
              setInspected(null);
            }}
          />
        )}

        {showStartHint && (
          <div className="stage-hint">
            drag to pan. scroll to zoom. tap BUILD to place a main building.
          </div>
        )}

        {/*
          Placement hint banner. Used to live inside BuildPalette, but the
          panel auto-closes on select so the hint vanished exactly when the
          player needed it. Hoisted here so it survives the close and the
          rule for adjacency is visible while clicking the map.
        */}
        {selected !== null && (
          <div className="placement-hint">
            {selected === "main" &&
              "click a green tile to place your main building."}
            {selected === "road" &&
              "click a tile adjacent to main, an existing road, or a building."}
            {(selected === "farm" || selected === "mine" || selected === "house") &&
              "click a green tile adjacent to main or a road."}
          </div>
        )}

        <div className="bottom-hud">
          <div className="cam-meta">
            cam {Math.round(cameraX)},{Math.round(cameraY)} <span className="dim">|</span>{" "}
            zoom {zoom.toFixed(1)}x
          </div>
          {selected !== null && !buildOpen && (
            <button
              type="button"
              className="placing-pill"
              onClick={() => setSelected(null)}
              title="cancel placement"
              aria-label={`cancel placing ${selected}`}
            >
              <span className="pp-label">
                placing: {selected === "road" ? "road" : BUILDING_DEFS[selected].label.toLowerCase()}
              </span>
              <span className="pp-x">x</span>
            </button>
          )}
          {!buildOpen && (
            <button
              type="button"
              className="build-fab"
              onClick={() => setBuildOpen(true)}
            >
              build
            </button>
          )}
        </div>

        {buildOpen && (
          <div className="build-panel">
            <header className="bp-header">
              <span className="bp-title">build</span>
              <span className="bp-meta">
                main {state.buildings.main.count}/1 | farms {state.buildings.farm.count} | mines{" "}
                {state.buildings.mine.count} | roads {roadsCount}
              </span>
              <button
                type="button"
                className="bp-close"
                onClick={() => setBuildOpen(false)}
                aria-label="close build panel"
              >
                x
              </button>
            </header>
            <BuildPalette state={state} selected={selected} onSelect={onSelectPlaceable} />
            <div className="bp-stats">
              <span>ai materials this run: {Math.floor(state.meta.totalAiTokensEarned)}</span>
              <button
                type="button"
                className="bp-reset"
                onClick={() => {
                  if (window.confirm("start a new run? this wipes the current map and resources.")) {
                    dispatch({ type: "reset", now: Date.now() });
                    setSelected(null);
                    setBuildOpen(false);
                  }
                }}
              >
                new run
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
