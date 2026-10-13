export type ProfessionalVerificationRejection = {
  id: string;
  title: string;
  explanation: string;
  steps: string[];
};

export const PROFESSIONAL_VERIFICATION_REJECTIONS: ProfessionalVerificationRejection[] = [
  { id: 'id_blurry', title: 'PRC ID is blurry', explanation: 'The text or portrait on the PRC ID is not clear enough to verify.', steps: ['Clean the camera lens.', 'Place the ID on a flat, steady surface.', 'Hold the camera still and make sure the printed text is sharp before capturing.'] },
  { id: 'id_glare', title: 'Glare or poor lighting', explanation: 'Light reflection or darkness is hiding information on the PRC ID.', steps: ['Use bright, even lighting.', 'Turn off flash if it creates glare.', 'Tilt the ID slightly until every field and the portrait are visible.'] },
  { id: 'id_cropped', title: 'ID is cropped or incomplete', explanation: 'One or more edges or required fields of the PRC ID are outside the photo.', steps: ['Place the complete ID inside the camera guide.', 'Leave a small margin around all four edges.', 'Check that the name, registration number, dates, and portrait are visible.'] },
  { id: 'id_unreadable', title: 'ID details cannot be verified', explanation: 'The submitted document does not provide enough readable PRC information.', steps: ['Use the original Philippine PRC Professional Identification Card.', 'Avoid screenshots, photocopies, and heavily compressed images.', 'Capture the front of the card at full resolution.'] },
  { id: 'face_blurry', title: 'Face scan is blurry', explanation: 'The selfie frames do not show the applicant’s face clearly.', steps: ['Clean the front camera lens.', 'Face a steady light source.', 'Keep the phone still and your full face inside the guide.'] },
  { id: 'liveness_failed', title: 'Liveness check is incomplete', explanation: 'The captured sequence does not provide enough evidence of a live person.', steps: ['Remove sunglasses, masks, or anything covering the face.', 'Follow the blink and light prompts without leaving the frame.', 'Complete the scan in one continuous attempt.'] },
  { id: 'face_mismatch', title: 'Face does not match the ID', explanation: 'The selfie does not sufficiently match the portrait on the submitted PRC ID.', steps: ['Use your own current PRC ID.', 'Face the camera directly with a neutral expression.', 'Retake both the ID and face scan in clear lighting.'] },
  { id: 'details_mismatch', title: 'Application details do not match', explanation: 'The submitted identity details do not match the information visible on the PRC ID.', steps: ['Check your full name and date of birth in your MediScan profile.', 'Submit the PRC ID belonging to the same account holder.', 'Correct profile information before applying again.'] },
  { id: 'expired_id', title: 'PRC ID is expired', explanation: 'The submitted PRC ID is no longer valid.', steps: ['Renew the PRC ID before reapplying.', 'Capture the renewed card with its validity date clearly visible.'] },
];

export function formatProfessionalVerificationRejection(reason: ProfessionalVerificationRejection, notes?: string): string {
  const guidance = reason.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  return `${reason.title}\n${reason.explanation}\n\nHow to submit it properly:\n${guidance}${notes?.trim() ? `\n\nAdmin notes:\n${notes.trim()}` : ''}`;
}
