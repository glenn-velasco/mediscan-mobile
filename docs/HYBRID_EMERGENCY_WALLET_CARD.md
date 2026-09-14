# Wallet card QR

## Decision

MediScan's newly printed wallet card uses one `MEDISCAN:v4:` QR containing (1) a compact, signed emergency snapshot for offline use and (2) the existing random card token for an optional Supabase lookup. The responder app displays the offline snapshot before checking the network. If a current published snapshot is available, it replaces the printed view. Older `MEDISCAN:v3-ref:` cards remain online-only; on-phone `MEDISCAN:v2:` QRs remain unchanged.

This is an emergency availability trade-off, **not** a way to keep printed information permanently current. Paper cannot update or be remotely erased. Offline readers cannot know whether a card was revoked. The UI therefore labels the source and age of the snapshot; the owner should destroy and reprint old copies after important changes.

## Scope and data minimization

The offline copy includes the patient-entered name, gender, date of birth, personal phone, blood type if recorded, transfusion preference, allergies, conditions, diagnoses, medications, up to two emergency contacts (including name and relationship even when a phone number is missing), recorded address, and last-updated/generated timestamps. It omits religion, history, photos, and encounter notes. An explicit transfusion preference is shared; religion is not used to infer one. Empty medical lists retain the existing `recorded`/`confirmed_none`/`not_recorded` state so a missing entry is not falsely described as "none." If the payload exceeds the version-24 QR size limit at error-correction level M, card generation fails with an actionable message; it does not silently drop medical facts to fit the code.

The compressed, base64url-encoded contents are **not encrypted**. Anyone who obtains the paper could decode the facts, even without MediScan. The detached device signature detects alteration but does not prove the person's identity or clinical accuracy; its public key travels in the code and is self-declared. The online token is also a bearer reference and can be used by anyone possessing the card. Treat the card as sensitive and print only with the patient's consent.

## Scan behavior

1. Validate the QR signature and decode the limited offline snapshot. Reject malformed or tampered data.
2. Show the offline result immediately. Label it "Printed card · offline snapshot," with last-updated time and a warning that it may be outdated or revoked. Save this observation locally so a responder can record an encounter without connectivity.
3. If connectivity exists, resolve the token through the existing Supabase Edge Function. Accept a successfully parsed published snapshot if its medical update time is at least as recent as the printed one. Show the fuller online published snapshot and retain its own saved-scan entry. A published snapshot can still lag behind edits that have not synced or been published.
4. If the lookup fails, keep the offline result. A 404 means no active published copy matches the token; the printed copy may be unpublished or superseded by a replacement. Other failures are labelled separately. The Wallet card screen checks its stored token when opened and offers publication or replacement as appropriate; it will not generate another PDF from a token known to be superseded.

The first printed scan never depends on a Supabase request. Existing v3 reference-only cards still require internet. Creating the underlying card token and publishing online updates still require connectivity; once a valid token is stored locally, generating a *new printout* from current local data does not. Online and offline scans use the same detailed result layout for the fields available in their snapshots.

## Print and operational limits

The PDF is 3 × 1.875 inches and reserves 1.45 × 1.45 inches for the QR. The generator uses QR error correction M with a maximum 113 × 113-module symbol and a four-module quiet zone. This is a software size guard, **not a guarantee** that every phone or printer will read the card. Print at 100% scale in black on white, without a logo over the QR or cropping its white border.

Before relying on this in a study or pilot, test realistic short and long profiles on physical cards across target phones, worn/creased paper, glare, low light, and offline mode. Record scan success, time to first critical fact, misread/stale-data interpretation, and whether the contact button works. If the QR is too dense, use a larger card; do not relax the capacity guard solely to make generation succeed.

## ADR and consequences

**Accepted:** a signed, minimized offline snapshot plus an online token in one QR. This preserves a single scan action and gives useful information during an outage. **Rejected:** token-only printing (no offline facts) and copying the full on-phone v2 payload (too much personal data, larger QR, and its on-phone expiry is unsuitable for paper). A second QR is an optional future fallback if physical scan tests show one code cannot fit a safe emergency summary.

Costs and failure modes: printed facts can age; revocation only affects online lookup; multiple printed copies cannot be tracked; a stale online publication must not overwrite newer printed facts; a failed network request must not hide the offline result; and a signed QR can still contain false patient-entered information. Review and reprint after significant medical changes. This app supports, but does not replace, clinical assessment.

## Validation checklist

- Build a card from local data with internet off after card creation; scan it offline and verify essential fields, contacts, recorded address, timestamp, source label, and encounter recording.
- Reconnect after changing and publishing profile data; scan the same printed card and verify the online result is shown when newer.
- Disconnect again; verify the unchanged paper still shows its older printed snapshot.
- Revoke or replace the card while online; verify online lookup stops, but explain that a disconnected phone can still read the old paper.
- Tamper with one character, scan an invalid token, and try an oversized profile; ensure invalid QR rejection and an explicit size error without silent truncation.
- Scan an old v3 reference card and the on-phone v2 QR to confirm compatibility.

## Sources

- [DENSO WAVE: QR capacity and symbol versions](https://www.qrcode.com/en/about/version.html/)
- [DENSO WAVE: module size and print considerations](https://www.qrcode.com/en/howto/cell.html)
- [GS1: QR quiet zones](https://ref.gs1.org/docs/2025/GS1-2D-colour-guide-i10-f-25-02-10)
- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
