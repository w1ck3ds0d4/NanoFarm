export interface HookLine {
  /** ms since epoch */
  t: number;
  /** claude code tool name */
  tool: string;
  /** schema version */
  v: 1;
}

export const HOOK_FILE_RELATIVE = ".nanofarm/tokens.jsonl";
