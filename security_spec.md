# Security Specification — ORBITA AI Firestore Rules

## 1. Data Invariants
1. Every document in `/users/{userId}` must have `uid == userId == request.auth.uid`.
2. Users must have a verified Google email (`request.auth.token.email_verified == true`).
3. No user may read, list, create, update, or delete another user's `/users/{userId}` document (PII isolation).
4. `createdAt` and `uid` are immutable after creation; `createdAt` and `updatedAt` must match `request.time`.
5. No user can inject shadow fields (`role`, `isAdmin`, `plan`) into `/users/{userId}`.
6. Default-deny catch-all blocks access to every unmapped path.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated read on `/users/user_1` -> `PERMISSION_DENIED`
2. Unverified email write (`email_verified: false`) on `/users/user_1` -> `PERMISSION_DENIED`
3. Cross-user read on `/users/user_2` by `user_1` -> `PERMISSION_DENIED`
4. Collection `list` query on `/users` by non-admin -> `PERMISSION_DENIED`
5. Identity spoofing (`uid: "user_2"`) while creating `/users/user_1` -> `PERMISSION_DENIED`
6. Shadow field injection (`role: "admin"`) on create `/users/user_1` -> `PERMISSION_DENIED`
7. Shadow field injection (`isAdmin: true`) on update `/users/user_1` -> `PERMISSION_DENIED`
8. Mutating immutable `createdAt` or `uid` on update -> `PERMISSION_DENIED`
9. Client-forged timestamp (`updatedAt != request.time`) -> `PERMISSION_DENIED`
10. Oversized ID path (`userId.size() > 128`) or invalid characters -> `PERMISSION_DENIED`
11. Oversized `name` string (`name.size() > 100`) -> `PERMISSION_DENIED`
12. Unmapped collection write (`/secrets/key`) -> `PERMISSION_DENIED`
