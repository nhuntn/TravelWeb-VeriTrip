import { Place, User } from '../types';

/**
 * Checks whether the current user is authorized to edit a place.
 * Returns true if the user is an admin or if the user is the author who added the place.
 */
export function canEditPlace(place: Place, currentUser: User | null): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  return !!place.addedByUid && place.addedByUid === currentUser.uid;
}
