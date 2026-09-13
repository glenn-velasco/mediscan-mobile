import { blocksToMarkdown, markdownToBlocks } from '@/lib/responder-note-markdown';

test('preserves text-image-text order', () => {
  const blocks = [
    { id: 'a', type: 'text' as const, text: 'Before', createdAt: '2026-01-01' },
    { id: 'img', type: 'image' as const, uri: 'file://photo.jpg', createdAt: '2026-01-01' },
    { id: 'b', type: 'text' as const, text: 'After', createdAt: '2026-01-01' },
  ];
  const parsed = markdownToBlocks(blocksToMarkdown(blocks), new Map([['img', 'file://photo.jpg']]));
  expect(parsed.map((block) => block.type)).toEqual(['text', 'image', 'text']);
});
