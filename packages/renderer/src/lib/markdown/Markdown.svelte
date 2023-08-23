<style>
.markdown > :global(p) {
  line-height: revert;
  padding-bottom: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

/* code blocks within p, e.g. `code`
Fixes the rendering issues when rendering markdown within svelte */
.markdown > :global(p) > :global(code) {
  font-size: 12px;
  background-color: rgb(54 55 58 / var(--tw-bg-opacity));
}

.markdown > :global(h1),
:global(h2),
:global(h3),
:global(h4),
:global(h5) {
  font-size: revert;
  line-height: normal;
  font-weight: revert;
  margin-bottom: 20px;
}

.markdown > :global(ul) {
  line-height: normal;
  list-style: revert;
  margin: revert;
  padding: revert;
}
</style>

<script lang="ts">
import { onMount } from 'svelte';
import { micromark } from 'micromark';
import { directive, directiveHtml } from 'micromark-extension-directive';
import { button } from './micromark-button-directive';

let text;
let html;

// Optional attribute to specify the markdown to use
// the user can use: <Markdown>**bold</Markdown> or <Markdown markdown="**bold**" /> syntax
export let markdown = '';

$: markdown
  ? (html = micromark(markdown, {
      extensions: [directive()],
      htmlExtensions: [directiveHtml({ button })],
    }))
  : undefined;

onMount(() => {
  if (markdown) {
    text = markdown;
  }
  // provide our custom extension that allow to create buttons
  html = micromark(text, {
    extensions: [directive()],
    htmlExtensions: [directiveHtml({ button })],
  });
});
</script>

<!-- placeholder to grab the content if people are using <Markdown>**bold</Markdown> -->
<span contenteditable="false" bind:textContent="{text}" class="hidden">
  <slot />
</span>

<section class="markdown" aria-label="markdown-content">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html html}
</section>
