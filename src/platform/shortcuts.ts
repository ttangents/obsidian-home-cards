/**
 * Run a macOS shortcut with text in and text out, through Apple's
 * `shortcuts` command-line tool.
 *
 * This is how the plugin reaches Apple Intelligence: the user's shortcut
 * holds a "Use Model" action set to the on-device model, and the plugin
 * hands it a prompt and reads back the reply. The plugin itself makes no
 * network request and bundles no model.
 *
 * Desktop macOS only. Node's modules exist only in the desktop app, so
 * they load lazily behind a platform check, and every other platform sees
 * `shortcutsSupported()` return false.
 */

import { Platform } from "obsidian";

/** Electron's CommonJS loader, present in the desktop app only. */
declare const require: (id: string) => unknown;

interface ChildProcess {
  execFile(
    file: string,
    args: readonly string[],
    options: { timeout: number },
    callback: (error: (Error & { code?: unknown }) | null, stdout: string, stderr: string) => void
  ): unknown;
}
interface FsPromises {
  mkdtemp(prefix: string): Promise<string>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
}
interface Os {
  tmpdir(): string;
}

const SHORTCUTS_CLI = "/usr/bin/shortcuts";

export function shortcutsSupported(): boolean {
  return Platform.isDesktop && Platform.isDesktopApp && Platform.isMacOS;
}

/**
 * Run `name` with `input` as its text input and resolve with its text
 * output. Rejects with a readable message when the shortcut is missing,
 * fails, or runs past `timeoutMs`.
 */
export async function runShortcut(name: string, input: string, timeoutMs = 20_000): Promise<string> {
  if (!Platform.isDesktop) throw new Error("Shortcuts are available only in the desktop app.");
  if (!shortcutsSupported()) throw new Error("Shortcuts are available only on macOS.");

  const cp = require("child_process") as ChildProcess;
  const fs = (require("fs") as { promises: FsPromises }).promises;
  const os = require("os") as Os;

  // Files rather than pipes: `shortcuts run` reads and writes paths.
  const dir = await fs.mkdtemp(`${os.tmpdir()}/home-cards-`);
  const inPath = `${dir}/prompt.txt`;
  const outPath = `${dir}/reply.txt`;
  try {
    await fs.writeFile(inPath, input, "utf8");
    await new Promise<void>((resolve, reject) => {
      cp.execFile(
        SHORTCUTS_CLI,
        ["run", name, "--input-path", inPath, "--output-path", outPath, "--output-type", "public.plain-text"],
        { timeout: timeoutMs },
        (error, _stdout, stderr) => {
          if (!error) return resolve();
          const detail = String(stderr || error.message).trim();
          reject(new Error(/couldn.t find|not found|no shortcut/i.test(detail)
            ? `Shortcuts has no shortcut named "${name}".`
            : detail || "The shortcut did not finish."));
        }
      );
    });
    return await fs.readFile(outPath, "utf8");
  } finally {
    void fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
