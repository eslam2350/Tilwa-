# TILAWA | تلاوة — Firestore Security Specification

## 1. Data Invariants
1. **Admin Authority**: Only verified admins (`request.auth.token.email == 'eslamkhalifa244@gmail.com' && request.auth.token.email_verified == true` OR `/admins/$(request.auth.uid)` doc) may create, update, or delete `/reciters/{reciterId}` and `/recitations/{recitationId}`, or list all `/users` documents.
2. **Self-Assigned Role Prevention**: A regular user creating `/users/{userId}` MUST have `role == 'user'` and `uid == request.auth.uid == userId`, and cannot escalate `role` to `'admin'` on update.
3. **PII Isolation**: User email is stored solely in `/users/{userId}/private/info` and readable/writable only by the owning verified user or admin. No blanket `isSignedIn()` read exists on `/users`.
4. **Master Gate on Subcollections**: Favorites, history, playlists, and playlist tracks under `/users/{userId}` verify `userId == request.auth.uid`, valid ID format (`^[a-zA-Z0-9_-]+$`), valid parent existence (`exists()` on `/users/{userId}` and `/playlists/{playlistId}`), and server timestamp integrity (`request.time`).
5. **No Shadow Fields**: Every `create` uses `keys().hasAll(...) && keys().hasOnly(...)`; every `update` uses `affectedKeys().hasOnly(...)` combined with `isValid[Entity](incoming())`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unverified Admin Email Spoof**: Write to `/reciters/minshawi` with `email: 'eslamkhalifa244@gmail.com'` and `email_verified: false`.
2. **Self-Role Escalation on Create**: Non-admin user creates `/users/{uid}` with `role: 'admin'`.
3. **Role Escalation on Update**: Non-admin user updates `/users/{uid}` changing `role` from `'user'` to `'admin'`.
4. **Shadow Field Injection**: User updates `/users/{uid}` adding ghost key `isPremium: true`.
5. **Identity Spoofing on Favorite**: User A creates `/users/userA/favorites/fav1` with `userId: 'userB'`.
6. **Cross-User PII Read**: User B attempts `get` on `/users/userA/private/info`.
7. **Blanket User List Scraping**: Non-admin user attempts `list` on `/users`.
8. **ID Poisoning (1.5KB ID)**: User creates `/users/{uid}/favorites/<1500 chars>` violating `isValidId()`.
9. **Client Timestamp Forgery**: User creates `/users/{uid}/playlists/p1` with `createdAt` different from `request.time`.
10. **Orphan Playlist Track**: User creates `/users/{uid}/playlists/nonexistent/tracks/t1` without parent playlist existing.
11. **Non-Admin Recitation Deletion**: Regular user deletes `/recitations/rec1`.
12. **Type/Size Poisoning**: User updates `/users/{uid}` setting `displayName` to a 500-char string or boolean.
13. **Unauthorized Dynamic Config Tampering**: Non-admin user attempts write/update on `/app_config/live`, or admin payload injects unallowlisted fields inside `theme` / `texts` / `ota` or passes unbounded `homeSections` (> 12 items).

