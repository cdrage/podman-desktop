/**********************************************************************
 * Copyright (C) 2023 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import * as monaco from 'monaco-editor';

// The below code is unedited from https://github.com/stefan-lacatus from this comment: https://github.com/microsoft/monaco-editor/issues/568#issuecomment-1499966160
// It is used to add a placeholder to the editor when it is empty.
/**
 * Represents an placeholder renderer for monaco editor
 * Roughly based on https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/codeEditor/browser/untitledTextEditorHint/untitledTextEditorHint.ts
 */
export class PlaceholderContentWidget implements monaco.editor.IContentWidget {
  private static readonly ID = 'editor.widget.placeholderHint';

  private domNode: HTMLElement | undefined;

  constructor(
    private readonly placeholder: string,
    private readonly editor: monaco.editor.ICodeEditor,
  ) {
    // register a listener for editor code changes
    editor.onDidChangeModelContent(() => this.onDidChangeModelContent());
    // ensure that on initial load the placeholder is shown
    this.onDidChangeModelContent();
  }

  private onDidChangeModelContent(): void {
    if (this.editor.getValue() === '') {
      this.editor.addContentWidget(this);
    } else {
      this.editor.removeContentWidget(this);
    }
  }

  getId(): string {
    return PlaceholderContentWidget.ID;
  }

  getDomNode(): HTMLElement {
    if (!this.domNode) {
      this.domNode = document.createElement('div');
      this.domNode.style.width = 'max-content';
      this.domNode.style.pointerEvents = 'none';
      this.domNode.textContent = this.placeholder;
      this.domNode.style.fontStyle = 'italic';
      this.editor.applyFontInfo(this.domNode);
    }

    return this.domNode;
  }

  getPosition(): monaco.editor.IContentWidgetPosition | null {
    return {
      position: { lineNumber: 1, column: 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
    };
  }

  dispose(): void {
    this.editor.removeContentWidget(this);
  }
}
