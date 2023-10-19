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

import * as fs from 'node:fs';
import * as jsYaml from 'js-yaml';

// Read a YAML file from the specified path and return its content as a formatted string
// this allows the function to validate each file before returning the data.
export async function readYamlFile(filePath: string): Promise<string> {
  try {
    const yamlLoad = fs.readFileSync(filePath, 'utf8');

    // Process each YAML document and add it to the array
    const documents: any[] = [];
    jsYaml.loadAll(yamlLoad, (doc: any) => {
      documents.push(doc);
    });

    // Now it's loaded, dump each document as a (formatted) string
    // Dump each document and join them with '---'
    const output: string = documents.map(doc => formatYaml(doc)).join('---\n');
    return output;
  } catch (err) {
    return Promise.reject(err);
  }
}

// Write the provided content to a YAML file at the specified path.
export async function writeYamlFile(filePath: string, content: string): Promise<void> {
  try {
    const yamlDump = formatYaml(content);
    fs.writeFileSync(filePath, yamlDump, 'utf8');
  } catch (err) {
    return Promise.reject(err);
  }
}

// Convert a content to a formatted YAML string.
function formatYaml(content: string): string {
  return jsYaml.dump(content, { noArrayIndent: true, quotingType: '"', lineWidth: -1 });
}
