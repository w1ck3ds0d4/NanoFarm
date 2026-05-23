# Installing the NanoFarm hook for Claude Code

The NanoFarm hook tells the game when Claude Code does work. Each tool call your Claude Code session makes appends one line to `~/.nanofarm/tokens.jsonl`. The game reads new lines every second and converts each one into a basket of raw materials split across wood / iron / stone / food.

The hook is **additive**. The game plays normally without it. With it, heavy coding sessions can outpace passive production by several multiples.

## Prerequisites

- Claude Code installed and working in your terminal or VS Code.
- Write access to your home directory. `~/.nanofarm/` is created on the first hook call.
- One of the shipped scripts:
  - `post-tool-use.sh` for bash, zsh, wsl, git bash on Windows.
  - `post-tool-use.ps1` for Windows PowerShell.

## One-time setup

1. Find your Claude Code settings file. It lives at either:
   - Global: `~/.claude/settings.json` (on Windows: `%USERPROFILE%\.claude\settings.json`). Applies to every project.
   - Project-local: `<your-project>/.claude/settings.json`. Applies only to that project.

2. Open it. If there is no `hooks` key, add the snippet below. If there is, merge in a new `PostToolUse` entry.

3. Pick the snippet that matches your shell. Point the `command` at the absolute path to the hook script.

### bash / zsh / wsl / git bash

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/NanoFarm/hooks/post-tool-use.sh"
          }
        ]
      }
    ]
  }
}
```

Make it executable once:

```bash
chmod +x /absolute/path/to/NanoFarm/hooks/post-tool-use.sh
```

### Windows PowerShell

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:/absolute/path/to/NanoFarm/hooks/post-tool-use.ps1"
          }
        ]
      }
    ]
  }
}
```

Note the forward slashes in the path. Backslashes in JSON need to be escaped (`\\`), so forward slashes are simpler.

## Verify it works

1. Start a new Claude Code session.
2. Run any tool call (a read, an edit, a bash command, anything).
3. Check the file:

PowerShell:

```powershell
Get-Content $env:USERPROFILE\.nanofarm\tokens.jsonl -Tail 5
```

bash:

```bash
tail -n 5 ~/.nanofarm/tokens.jsonl
```

You should see one line per tool call, each a small JSON record like `{"t":1716301234567,"tool":"Bash","v":1}`.

## Connect the game

NanoFarm runs on two surfaces. The connect step depends on which one you're using.

### VS Code extension (preferred)

There's nothing to click. The extension reads the file through its own Node process and ships entries to the webview automatically. Open Settings (bottom-left button) → the **hook** row will show `hook on` once `~/.nanofarm/tokens.jsonl` exists.

If you see `hook off - no file at C:\Users\...\.nanofarm\tokens.jsonl`, the hook script hasn't fired yet — run any Claude Code tool call to create the file, then click `connect hook` in Settings to re-poll.

The extension uses the default path `~/.nanofarm/tokens.jsonl`. If your hook writes elsewhere, that's a bug in your hook config (or you'll need a custom adapter — open an issue).

### Standalone browser

Open NanoFarm at `http://localhost:5173` (after `pnpm dev`) or wherever you host the built `dist/`. Open Settings → click **connect hook**. A file picker opens; navigate to `~/.nanofarm/tokens.jsonl` and select it. Grant readwrite permission.

The browser remembers the permission for this origin via the File System Access API; you only do this once per browser profile. On subsequent loads the game reconnects automatically.

Requires a Chromium-based browser (Chrome, Edge, Brave). Firefox / Safari don't implement the File System Access API yet, so the button is disabled there — those browsers see `hook off` permanently. Use the VS Code extension or a Chromium browser.

## What you'll see in-game

Once connected, the game drains new lines every second. Each line becomes a small basket of raw materials (wood + iron + stone + food, distributed evenly). The flow ticker next to the materials HUD cell shows the boost in real time as you code.

## Privacy

The hook does not read your code, your tool inputs, or your tool outputs. It writes one record per tool call containing only:

- a millisecond timestamp.
- the tool's name (e.g. `"Bash"`, `"Edit"`, `"Read"`).
- a schema version number.

Nothing else. No file paths. No command arguments. No responses. You can `cat` the file yourself any time to confirm.

## Uninstall

Remove the `PostToolUse` entry from `settings.json`. Optionally delete `~/.nanofarm/tokens.jsonl` to clear unread tool calls.

If you also want the game's progress wiped, use Settings → **new run** in the in-game settings panel, or — if running in VS Code — uninstall the extension and let the per-workspace state get GC'd.
