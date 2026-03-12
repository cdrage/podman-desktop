/**
 * A simple SearchAddon for ghostty-web that provides find next/previous
 * functionality in the terminal buffer. Replaces @xterm/addon-search.
 */
import type { ITerminalAddon } from 'ghostty-web';

interface SearchOptions {
  incremental?: boolean;
}

interface GhosttyTerminal {
  cols: number;
  rows: number;
  buffer: {
    active: {
      length: number;
      baseY: number;
      viewportY: number;
      getLine(y: number):
        | {
            length: number;
            getCell(x: number):
              | {
                  getChars(): string;
                }
              | undefined;
          }
        | undefined;
    };
  };
  select(column: number, row: number, length: number): void;
  clearSelection(): void;
  scrollLines(amount: number): void;
}

export class SearchAddon implements ITerminalAddon {
  private _terminal?: GhosttyTerminal;
  private _lastSearchTerm = '';
  private _lastMatchRow = -1;
  private _lastMatchCol = -1;

  activate(terminal: GhosttyTerminal & { cols: number; rows: number }): void {
    this._terminal = terminal;
  }

  private _getLineText(y: number): string {
    if (!this._terminal) return '';
    const line = this._terminal.buffer.active.getLine(y);
    if (!line) return '';
    let text = '';
    for (let x = 0; x < line.length; x++) {
      const cell = line.getCell(x);
      text += cell?.getChars() ?? ' ';
    }
    return text;
  }

  findNext(term: string, options?: SearchOptions): boolean {
    if (!this._terminal || !term) {
      this._terminal?.clearSelection();
      return false;
    }

    const buffer = this._terminal.buffer.active;
    const searchLower = term.toLowerCase();

    // Start searching from current match position or beginning
    let startRow = 0;
    let startCol = 0;
    if (this._lastSearchTerm === term && this._lastMatchRow >= 0) {
      startRow = this._lastMatchRow;
      startCol = this._lastMatchCol + 1;
    } else if (options?.incremental) {
      startRow = this._lastMatchRow >= 0 ? this._lastMatchRow : 0;
      startCol = 0;
    }

    for (let i = 0; i < buffer.length; i++) {
      const y = (startRow + i) % buffer.length;
      const lineText = this._getLineText(y);
      const searchFrom = i === 0 ? startCol : 0;
      const idx = lineText.toLowerCase().indexOf(searchLower, searchFrom);

      if (idx >= 0) {
        this._lastSearchTerm = term;
        this._lastMatchRow = y;
        this._lastMatchCol = idx;
        this._terminal.select(idx, y, term.length);
        // Scroll to the match
        const viewportRow = y - buffer.viewportY;
        if (viewportRow < 0 || viewportRow >= this._terminal.rows) {
          this._terminal.scrollLines(y - buffer.viewportY - Math.floor(this._terminal.rows / 2));
        }
        return true;
      }
    }

    // Wrap around - reset and try from beginning
    if (startRow > 0 || startCol > 0) {
      this._lastMatchRow = -1;
      this._lastMatchCol = -1;
      return this.findNext(term, options);
    }

    this._terminal.clearSelection();
    return false;
  }

  findPrevious(term: string, _options?: SearchOptions): boolean {
    if (!this._terminal || !term) {
      this._terminal?.clearSelection();
      return false;
    }

    const buffer = this._terminal.buffer.active;
    const searchLower = term.toLowerCase();

    let startRow = buffer.length - 1;
    let startCol = -1; // -1 means search whole line
    if (this._lastSearchTerm === term && this._lastMatchRow >= 0) {
      startRow = this._lastMatchRow;
      startCol = this._lastMatchCol - 1;
    }

    for (let i = 0; i < buffer.length; i++) {
      const y = (startRow - i + buffer.length) % buffer.length;
      const lineText = this._getLineText(y);
      const searchIn = i === 0 && startCol >= 0 ? lineText.substring(0, startCol + term.length - 1) : lineText;
      const idx = searchIn.toLowerCase().lastIndexOf(searchLower);

      if (idx >= 0) {
        this._lastSearchTerm = term;
        this._lastMatchRow = y;
        this._lastMatchCol = idx;
        this._terminal.select(idx, y, term.length);
        const viewportRow = y - buffer.viewportY;
        if (viewportRow < 0 || viewportRow >= this._terminal.rows) {
          this._terminal.scrollLines(y - buffer.viewportY - Math.floor(this._terminal.rows / 2));
        }
        return true;
      }
    }

    this._terminal.clearSelection();
    return false;
  }

  dispose(): void {
    this._terminal = undefined;
    this._lastSearchTerm = '';
    this._lastMatchRow = -1;
    this._lastMatchCol = -1;
  }
}
