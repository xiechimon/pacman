// PROTOTYPE shim for @pacman/shared — only the type surface the copied
// components/ui consume (tag-chip.tsx imports TagRecord as a type).

export interface TagRecord {
  id: string;
  name: string;
  color: string;
}
