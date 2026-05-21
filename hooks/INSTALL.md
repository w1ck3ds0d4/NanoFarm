# Installing the NanoFarm hook for Claude Code

the NanoFarm hook tells the game when claude code does work. each tool call your claude code session makes appends one line to `~/.nanofarm/tokens.jsonl`. the game reads new lines every second and converts them to bonus materials.

## prerequisites

- claude code installed and working in your terminal or vs code.
- write access to your home directory. `~/.nanofarm/` is created on the first hook call.
- the script that matches your shell (both ship in this folder):
  - `post-tool-use.sh` for bash, zsh, wsl, git bash on windows.
  - `post-tool-use.ps1` for windows powershell.

## one-time setup

1. find your claude code settings file. it lives at either:
   - global: `~/.claude/settings.json` (on windows: `%USERPROFILE%\.claude\settings.json`). applies to every project.
   - project-local: `<your-project>/.claude/settings.json`. applies only to that project.

2. open it. if there is no `hooks` key, add the snippet below. if there is, merge in a new `PostToolUse` entry.

3. pick the snippet that matches your shell. point the `command` at the absolute path to the hook script.

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

make it executable once:

```bash
chmod +x /absolute/path/to/NanoFarm/hooks/post-tool-use.sh
```

### windows powershell

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

note the forward slashes in the path. backslashes in JSON need to be escaped (`\\`), so forward slashes are simpler.

## verify it works

1. start a new claude code session.
2. run any tool call (a read, an edit, a bash command, anything).
3. check the file:

powershell:

```powershell
Get-Content $env:USERPROFILE\.nanofarm\tokens.jsonl -Tail 5
```

bash:

```bash
tail -n 5 ~/.nanofarm/tokens.jsonl
```

you should see one line per tool call, each a small json record like `{"t":1716301234567,"tool":"Bash","v":1}`.

## connect the game

open NanoFarm in your browser. click `connect claude code hook` in the top right. when the file picker opens, navigate to `~/.nanofarm/tokens.jsonl` and select it. grant readwrite permission.

the browser remembers the permission for this origin; you only do this once per browser profile. on subsequent loads the game reconnects automatically.

once connected, the game drains new lines from the file every second. each line becomes one material in your inventory.

## privacy

the hook does not read your code, your tool inputs, or your tool outputs. it writes one record per tool call containing only:

- a millisecond timestamp.
- the tool's name (e.g. `"Bash"`, `"Edit"`, `"Read"`).
- a schema version number.

nothing else. no file paths. no command arguments. no responses. you can `cat` the file yourself any time to confirm.

## uninstall

remove the `PostToolUse` entry from settings.json. optionally delete `~/.nanofarm/tokens.jsonl` to clear unread tool calls.

if you also want the game's progress wiped, use the in-app reset button or clear browser storage for the origin.
