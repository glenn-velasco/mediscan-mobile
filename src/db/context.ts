let currentUserId: number | null = null;

export function setCurrentUserId(id: number | null): void {
  currentUserId = id;
}

export function getCurrentUserId(): number {
  if (currentUserId === null) {
    throw new Error('No user is currently logged in');
  }
  return currentUserId;
}

export function hasCurrentUser(): boolean {
  return currentUserId !== null;
}
