/**
 * A simple SerializeAddon for ghostty-web that serializes terminal buffer content
 * to a string for persistence/restoration. Replaces @xterm/addon-serialize.
 */
import type { ITerminalAddon } from 'ghostty-web';

interface GhosttyTerminal {
  cols: number;
  rows: number;
  buffer: {
    active: {
      length: number;
      baseY: number;
      cursorX: number;
      cursorY: number;
      getLine(y: number):
        | {
            length: number;
            isWrapped: boolean;
            getCell(x: number):
              | {
                  getChars(): string;
                  getWidth(): number;
                }
              | undefined;
          }
        | undefined;
    };
  };
}

export class SerializeAddon implements ITerminalAddon {
  private _terminal?: GhosttyTerminal;

  activate(terminal: GhosttyTerminal & { cols: number; rows: number }): void {
    this._terminal = terminal;
  }

  serialize(): string {
    if (!this._terminal) return '';

    const buffer = this._terminal.buffer.active;
    const lines: string[] = [];

    for (let y = 0; y < buffer.length; y++) {
      const line = buffer.getLine(y);
      if (!line) {
        lines.push('');
        continue;
      }

      let lineStr = '';
      for (let x = 0; x < line.length; x++) {
        const cell = line.getCell(x);
        if (!cell) continue;
        const chars = cell.getChars();
        lineStr += chars || ' ';
      }

      // Trim trailing spaces
      lineStr = lineStr.replace(/\s+$/, '');

      // For wrapped lines, don't add newline
      if (line.isWrapped && lines.length > 0) {
        lines[lines.length - 1] += lineStr;
      } else {
        lines.push(lineStr);
      }
    }

    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.join('\r\n');
  }

  dispose(): void {
    this._terminal = undefined;
  }
}
