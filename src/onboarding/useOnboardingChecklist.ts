import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type OnboardingTaskId = 'email_verified' | 'emergency_contacts' | 'allergies' | 'conditions' | 'medications';

export type OnboardingTask = {
  id: OnboardingTaskId;
  title: string;
  body: string;
  icon: 'mail' | 'people' | 'medical' | 'medkit' | 'bandage' | 'fitness';
  done: boolean;
};

type ChecklistInput = {
  userId: number | undefined;
  emailVerified: boolean;
  hasEmergencyContacts: boolean;
  hasAllergies: boolean;
  hasConditions: boolean;
  hasMedications: boolean;
};

function dismissedKey(userId: number) {
  return `onboarding_checklist_dismissed_${userId}`;
}

function notifiedKey(userId: number) {
  return `onboarding_checklist_notified_${userId}`;
}

function promptedKey(userId: number) {
  return `onboarding_checklist_prompted_${userId}`;
}

/**
 * Derives the "finish setting up your profile" checklist from data already fetched on the
 * dashboard — no extra network calls. Dismissal is persisted per-user so closing the card
 * doesn't nag again, independent of whether every task is actually complete.
 */
export function useOnboardingChecklist({ userId, emailVerified, hasEmergencyContacts, hasAllergies, hasConditions, hasMedications }: ChecklistInput) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    setDismissed(null);
    AsyncStorage.getItem(dismissedKey(userId)).then((value) => setDismissed(value === 'true'));
  }, [userId]);

  const dismiss = useCallback(async () => {
    if (!userId) return;
    await AsyncStorage.setItem(dismissedKey(userId), 'true');
    setDismissed(true);
  }, [userId]);

  const tasks = useMemo<OnboardingTask[]>(
    () => [
      { id: 'email_verified', title: 'Verify your email', body: 'Confirm it\'s really you — takes one tap from your inbox.', icon: 'mail', done: emailVerified },
      { id: 'emergency_contacts', title: 'Add an emergency contact', body: 'Someone responders can call on your behalf.', icon: 'people', done: hasEmergencyContacts },
      { id: 'allergies', title: 'Add your allergies', body: 'Flag anything responders should avoid giving you.', icon: 'medical', done: hasAllergies },
      { id: 'conditions', title: 'Add a condition', body: 'Any general health notes worth flagging in an emergency.', icon: 'fitness', done: hasConditions },
      { id: 'medications', title: 'Add a medication', body: 'What you\'re currently taking.', icon: 'medkit', done: hasMedications },
    ],
    [emailVerified, hasEmergencyContacts, hasAllergies, hasConditions, hasMedications],
  );

  const doneCount = tasks.filter((t) => t.done).length;
  const complete = doneCount === tasks.length;
  const visible = dismissed === false && !complete;

  const markNotified = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const key = notifiedKey(userId);
    const already = await AsyncStorage.getItem(key);
    if (already === 'true') return false;
    await AsyncStorage.setItem(key, 'true');
    return true;
  }, [userId]);

  /** One-shot gate for auto-presenting the full-screen onboarding-tasks modal — fires once per user, ever. */
  const markPrompted = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const key = promptedKey(userId);
    const already = await AsyncStorage.getItem(key);
    if (already === 'true') return false;
    await AsyncStorage.setItem(key, 'true');
    return true;
  }, [userId]);

  return { tasks, doneCount, total: tasks.length, complete, visible, loaded: dismissed !== null, dismiss, markNotified, markPrompted };
}
