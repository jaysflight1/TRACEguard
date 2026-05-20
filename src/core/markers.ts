import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const START = (id: string) => `<!-- TRACEguard:start blockId=${id} -->`;
const END = (id: string) => `<!-- TRACEguard:end blockId=${id} -->`;

/**
 * Insert or replace a TRACEguard-marked block in `filePath`.
 *
 * - If the file does not exist, it is created containing only the block.
 * - If the block already exists (matching `blockId`), its contents are replaced.
 * - Otherwise the block is appended to the existing file content.
 *
 * User-authored content outside the markers is never touched.
 */
export function insertBlock(filePath: string, blockId: string, content: string): void {
  const startMarker = START(blockId);
  const endMarker = END(blockId);
  const blockBody = content.endsWith('\n') ? content : content + '\n';
  const block = `${startMarker}\n${blockBody}${endMarker}\n`;

  if (!existsSync(filePath)) {
    writeFileSync(filePath, block, 'utf8');
    return;
  }

  const existing = readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + endMarker.length);
    const trimmedAfter = after.startsWith('\n') ? after.slice(1) : after;
    writeFileSync(filePath, before + block + trimmedAfter, 'utf8');
    return;
  }

  const separator = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  writeFileSync(filePath, existing + separator + (existing.length ? '\n' : '') + block, 'utf8');
}

/**
 * Remove a TRACEguard-marked block from `filePath`, preserving user content.
 * Returns true if a block was removed.
 */
export function removeBlock(filePath: string, blockId: string): boolean {
  if (!existsSync(filePath)) return false;
  const startMarker = START(blockId);
  const endMarker = END(blockId);
  const existing = readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return false;

  const before = existing.slice(0, startIdx).replace(/\n+$/, '');
  let after = existing.slice(endIdx + endMarker.length);
  if (after.startsWith('\n')) after = after.slice(1);
  const joined = before + (before && after ? '\n\n' : '') + after;
  const final = joined.endsWith('\n') || joined.length === 0 ? joined : joined + '\n';
  writeFileSync(filePath, final, 'utf8');
  return true;
}

export function hasBlock(filePath: string, blockId: string): boolean {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf8');
  return content.includes(START(blockId)) && content.includes(END(blockId));
}
