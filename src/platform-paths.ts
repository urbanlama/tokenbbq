import { homedir } from 'node:os';
import path from 'node:path';

const HOME = homedir();

/**
 * Returns the candidate data-directory paths for a tool whose vendor follows
 * the platform's standard application-data convention. Order is platform's
 * native directory first, then fallbacks. Caller decides which marker file
 * (e.g. `opencode.db`, `threads/`) makes a candidate "real".
 *
 * - Windows: `%APPDATA%\<tool>` (Roaming) and `%LOCALAPPDATA%\<tool>`
 * - macOS:   `~/Library/Application Support/<tool>`
 * - Linux:   `$XDG_DATA_HOME/<tool>` (if set), then `~/.local/share/<tool>`
 *
 * The Linux path is also appended on macOS / Windows as a final fallback —
 * some tools (Bun-distributed CLIs, in particular) install to XDG-style
 * paths regardless of host OS.
 */
export function getPlatformDataDirs(toolName: string): string[] {
	const candidates: string[] = [];

	if (process.platform === 'win32') {
		const appdata = process.env.APPDATA;
		const localAppdata = process.env.LOCALAPPDATA;
		if (appdata) candidates.push(path.join(appdata, toolName));
		if (localAppdata) candidates.push(path.join(localAppdata, toolName));
	} else if (process.platform === 'darwin') {
		candidates.push(path.join(HOME, 'Library', 'Application Support', toolName));
	}

	const xdg = process.env.XDG_DATA_HOME;
	if (xdg) candidates.push(path.join(xdg, toolName));
	candidates.push(path.join(HOME, '.local', 'share', toolName));

	return candidates;
}
