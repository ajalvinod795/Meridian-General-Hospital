# Security Specification — Meridian General Hospital Token & Payment System

## 1. Data Invariants
1. **Identity Integrity**: No user may create a `UserProfile`, `TokenBooking`, or `PaymentRecord` with a `uid` or `patientUid` different from `request.auth.uid`.
2. **No Self-Assigned Privileges**: A user registering their own `users/{uid}` document MUST set `role: 'patient'` and `accessStatus: 'active'`. Only verified administrators (`isAdmin()`) may modify `role` or `accessStatus` or write to `admins/{uid}`.
3. **PII Isolation**: User profiles (`users/{uid}`), tokens (`tokens/{tokenId}`), and payments (`payments/{paymentId}`) contain PII (`email`, `phone`, `visitReason`, `paymentRef`). Blanket `isSignedIn()` reads and unconstrained `list` queries are forbidden; reads and list queries MUST restrict access to `resource.data.patientUid == request.auth.uid` (or `userId == request.auth.uid`) or `isAdmin()`.
4. **Atomic Sequential Token Integrity**: A patient booking a token for a doctor MUST atomically increment `doctors/{doctorId}.lastIssuedNumber` by exactly `+1`, and the created `tokens/{tokenId}` document MUST match `tokenNumber == oldLastIssuedNumber + 1`, `feeAmount == doctor.consultationFee`, and `doctor.isAvailable == true`.
5. **Global Portal & User Access Enforcement**: When `hospitalConfig/settings.portalOpen == false` or `users/{uid}.accessStatus == 'suspended'`, non-admin users are strictly denied token creation and doctor queue increments.
6. **Terminal State Locking**: Once a `TokenBooking` reaches `'completed'` or `'cancelled'`, patients may no longer modify it.
7. **Temporal & Immutable Field Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt`, `uid`, `patientUid`, and `doctorId` remain immutable on updates.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Admin Escalation**: Patient creates `users/patient1` with `{ role: 'admin', accessStatus: 'active' }` -> `PERMISSION_DENIED`.
2. **Suspended Account Bypass**: Suspended user (`accessStatus: 'suspended'`) attempts to create a `tokens/tok_1` booking -> `PERMISSION_DENIED`.
3. **Portal Closed Bypass**: When `hospitalConfig/settings.portalOpen == false`, a patient attempts to book a token -> `PERMISSION_DENIED`.
4. **Fee Manipulation**: Patient submits `tokens/tok_2` with `feeAmount: 0` when doctor fee is `65` -> `PERMISSION_DENIED`.
5. **Token Number Skipping**: Patient submits `tokens/tok_3` with `tokenNumber: 999` instead of `lastIssuedNumber + 1` -> `PERMISSION_DENIED`.
6. **Unavailable Doctor Booking**: Patient tries to book a token for a doctor with `isAvailable: false` -> `PERMISSION_DENIED`.
7. **Shadow Field Injection**: Patient updates `users/patient1` with extra ghost field `{ isVerifiedAdmin: true }` -> `PERMISSION_DENIED`.
8. **Cross-User PII Read / List**: Patient A attempts `get` or `list` on `users` or `tokens` belonging to Patient B -> `PERMISSION_DENIED`.
9. **Unverified Email Spoof**: Caller with `email == 'ajalvinod1234@gmail.com'` but `email_verified: false` attempts admin write -> `PERMISSION_DENIED`.
10. **Path ID Poisoning**: Caller attempts write to `/doctors/invalid$id!with@chars` or >128 chars -> `PERMISSION_DENIED`.
11. **Terminal Token Tampering**: Patient attempts to revert a `'completed'` or `'cancelled'` token back to `'waiting'` -> `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Patient creates a token with backdated `createdAt` != `request.time` -> `PERMISSION_DENIED`.
