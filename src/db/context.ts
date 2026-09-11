export type LocalUserId = string | number;

let currentUserId: LocalUserId | null = null;

export function setCurrentUserId(id: LocalUserId | null): void {
  currentUserId = id;
}

export function getCurrentUserId(): LocalUserId {
  if (currentUserId === null) {
    throw new Error('No user is currently logged in');
  }
  return currentUserId;
}

export function hasCurrentUser(): boolean {
  return currentUserId !== null;
}
