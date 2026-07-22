/**
 * Events broadcast on the user's own private channel (`App.Models.User.{id}`).
 * Add a new key here — no other plumbing changes needed (handlers auto-register).
 */
export type UserChannelEventMap = {
  EmailChanged: { user_id: number };
  EmailVerified: { email_verified_at: string };
  UserDeactivated: { user_id: number };
  UserDeleted: { user_id: number };
  /** A professional submitted an envelope over the relay while this device was offline/backgrounded. */
  PendingSyncEnvelopeCreated: { envelope_id: number; envelope_type: string };
  /** Professional application was approved/rejected by admin or background job. */
  ProfessionalApplicationStatusChanged: { application_id: number; status: string };
  /**
   * A patient-authored record (allergy/diagnosis/medication/emergency_contact) changed - created,
   * updated, or deleted - on another device or via the web. Independent of PendingSyncEnvelopeCreated
   * above: this is the patient-authored CRUD sync system, not the BLE/professional-attestation relay.
   * See the backend repo's docs/SYNC.md and docs/BROADCASTING.md.
   */
  PatientRecordUpdated: { record_type: string; record_id: string };
};

export type UserChannelEventHandlers = {
  [K in keyof UserChannelEventMap]?: (payload: UserChannelEventMap[K]) => void | Promise<void>;
};

/**
 * Presence channel member shape returned by Laravel Echo's presence channel.
 */
export type PresenceMember = {
  id: number;
  name: string;
  email: string;
};

export type PresenceChannelHandlers = {
  onHere: (members: PresenceMember[]) => void;
  onJoining: (member: PresenceMember) => void;
  onLeaving: (member: PresenceMember) => void;
};

/**
 * Client-side whisper events (sent directly between clients, no server round-trip).
 */
export type WhisperEventMap = {
  QRCodeViewed: { viewer_id: number };
  EmergencyDataAccessed: { viewer_id: number; timestamp: string };
};
