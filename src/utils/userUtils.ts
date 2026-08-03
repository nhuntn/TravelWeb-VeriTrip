import { Place, User } from '../types';

/**
 * Checks whether the current user is authorized to edit a place.
 * Returns true if the user is an admin or if the user is the author who added the place.
 */
export function canEditPlace(place: Place, currentUser: User | null): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (!place || !place.addedBy) return false;

  const addedBy = place.addedBy.trim().toLowerCase();
  const username = (currentUser.username || '').trim().toLowerCase();
  const uid = (currentUser.uid || '').trim().toLowerCase();
  const email = (currentUser.email || '').trim().toLowerCase();

  // Initial seed places or anonymous posts labeled 'Thành viên cộng đồng' cannot be edited by regular non-author users
  if (addedBy === 'thành viên cộng đồng' || addedBy === 'community_member') {
    return false;
  }

  return (
    (username !== '' && addedBy === username) ||
    (uid !== '' && addedBy === uid) ||
    (email !== '' && addedBy === email)
  );
}
