interface Props {
  onClose: () => void;
  onResetZoom: () => void;
  onRecenter: () => void;
  onNewRun: () => void;
}

export function SettingsPanel({
  onClose,
  onResetZoom,
  onRecenter,
  onNewRun
}: Props) {
  return (
    <div className="settings-panel">
      <div className="sp-header">
        <span className="sp-title">SETTINGS</span>
        <button className="sp-close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>
      <div className="sp-section">
        <div className="sp-row">
          <button className="sp-btn" onClick={onRecenter}>
            recenter on main
          </button>
          <span className="sp-hint">jump to your main building</span>
        </div>
        <div className="sp-row">
          <button className="sp-btn" onClick={onResetZoom}>
            reset zoom
          </button>
          <span className="sp-hint">restore 1.0x</span>
        </div>
        <div className="sp-row danger">
          <button className="sp-btn danger" onClick={onNewRun}>
            new run
          </button>
          <span className="sp-hint">wipe map + resources</span>
        </div>
      </div>
    </div>
  );
}
