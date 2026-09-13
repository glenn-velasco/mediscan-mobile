import type { ResponderNoteBlock } from '@/types/emergency';

export const IMAGE_TOKEN = /!\[([^\]]*)\]\(mediscan-image:([^\)]+)\)/g;

export function blocksToMarkdown(blocks: ResponderNoteBlock[]): string {
  return blocks.map((block) => block.type === 'text' ? block.text : `![Patient image](mediscan-image:${block.id})`).join('\n\n');
}

export function markdownToBlocks(markdown: string, images: Map<string, string>): ResponderNoteBlock[] {
  const blocks: ResponderNoteBlock[] = [];
  let cursor = 0;
  for (const match of markdown.matchAll(IMAGE_TOKEN)) {
    const text = markdown.slice(cursor, match.index).replace(/^\n\n|\n\n$/g, '');
    if (text || blocks.length === 0) blocks.push({ id: `text-${cursor}`, type: 'text', text, createdAt: new Date().toISOString() });
    const id = match[2];
    const uri = images.get(id);
    if (uri) blocks.push({ id, type: 'image', uri, createdAt: new Date().toISOString() });
    cursor = (match.index ?? 0) + match[0].length;
  }
  const tail = markdown.slice(cursor).replace(/^\n\n/, '');
  if (tail || blocks.length === 0 || blocks[blocks.length - 1].type === 'image') blocks.push({ id: `text-${cursor}`, type: 'text', text: tail, createdAt: new Date().toISOString() });
  return blocks;
}
