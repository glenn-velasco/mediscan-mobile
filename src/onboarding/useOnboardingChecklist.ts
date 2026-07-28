import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type OnboardingTaskId = 'email_verified' | 'emergency_contacts' | 'allergies' | 'conditions' | 'medications';

const SKIPPED_TASKS_IDS: OnboardingTaskId[] = ['allergies', 'conditions', 'medications'];

export type OnboardingTask = {
  id: OnboardingTaskId;
  title: string;
  body: string;
  icon: 'mail' | 'people' | 'medical' | 'medkit' | 'bandage' | 'fitness';
  done: boolean;
  skippable: boolean;
};

type ChecklistInput = {
  userId: number | undefined;
  emailVerified: boolean;
  hasEmergencyContacts: boolean;
  hasAllergies: boolean;
  hasConditions: boolean;
  hasMedications: boolean;
};

function notifiedKey(userId: number) {
  return `onboarding_checklist_notified_${userId}`;
}

function promptedKey(userId: number) {
  return `onboarding_checklist_prompted_${userId}`;
}

function skippedKey(userId: number) {
  return `onboarding_checklist_skipped_${userId}`;
}

/**
 * Derives the "finish setting up your profile" checklist from data already fetched on the
 * dashboard — no extra network calls. The card is always visible until every task is complete.
 */
export function useOnboardingChecklist({ userId, emailVerified, hasEmergencyContacts, hasAllergies, hasConditions, hasMedications }: ChecklistInput) {
  const [skipped, setSkipped] = useState<Set<OnboardingTaskId>>(new Set());
  const skippedRef = useRef(skipped);
  useEffect(() => {
    skippedRef.current = skipped;
  }, [skipped]);

  const loadSkipped = useCallback(async () => {
    if (!userId) return;
    const raw = await AsyncStorage.getItem(skippedKey(userId));
    if (raw) {
      try {
        const next = new Set<OnboardingTaskId>(JSON.parse(raw) as OnboardingTaskId[]);
        setSkipped(next);
        skippedRef.current = next;
      } catch {}
    } else {
      setSkipped(new Set());
      skippedRef.current = new Set();
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSkipped();
  }, [loadSkipped]);

  const skipTask = useCallback(async (id: OnboardingTaskId) => {
    if (!userId || !SKIPPED_TASKS_IDS.includes(id)) return;
    const next = new Set(skippedRef.current);
    next.add(id);
    setSkipped(next);
    await AsyncStorage.setItem(skippedKey(userId), JSON.stringify([...next]));
  }, [userId]);

  const tasks = useMemo<OnboardingTask[]>(
    () => [
      { id: 'email_verified', title: 'Verify your email', body: 'Confirm it\'s really you — takes one tap from your inbox.', icon: 'mail', done: emailVerified, skippable: false },
      { id: 'emergency_contacts', title: 'Add an emergency contact', body: 'Someone responders can call on your behalf.', icon: 'people', done: hasEmergencyContacts, skippable: false },
      { id: 'allergies', title: 'Add your allergies', body: 'Flag anything responders should avoid giving you.', icon: 'medical', done: hasAllergies || skipped.has('allergies'), skippable: true },
      { id: 'conditions', title: 'Add a condition', body: 'Any general health notes worth flagging in an emergency.', icon: 'fitness', done: hasConditions || skipped.has('conditions'), skippable: true },
      { id: 'medications', title: 'Add a medication', body: 'What you\'re currently taking.', icon: 'medkit', done: hasMedications || skipped.has('medications'), skippable: true },
    ],
    [emailVerified, hasEmergencyContacts, hasAllergies, hasConditions, hasMedications, skipped],
  );

  const doneCount = tasks.filter((t) => t.done).length;
  const complete = doneCount === tasks.length;
  const visible = !complete;

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

  const setAsNevermind = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    const key = promptedKey(userId);

    await AsyncStorage.setItem(key, 'true');

    return true;

  }, [userId]);

  return { tasks, doneCount, total: tasks.length, complete, visible, markNotified, markPrompted, setAsNevermind, skipTask, refreshSkipped: loadSkipped };
}
