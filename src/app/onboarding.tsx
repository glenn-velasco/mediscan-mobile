import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '@/onboarding/useOnboarding';

const SLIDES = [
  {
    icon: 'qr-code',
    title: 'One scan, everything they need',
    body: 'Your complete medical profile — blood type, allergies, emergency contacts — lives behind a QR code on your phone. When you can\'t explain, your QR will.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Encrypted end-to-end',
    body: 'Your data stays encrypted from the moment you create it. Share updates securely with family or responders. Only the right people see your information.',
  },
  {
    icon: 'medkit',
    title: 'Built for real emergencies',
    body: 'Healthcare providers can scan your code to view and update your profile in real time — no app download, no account needed. Just instant, accurate care.',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const { complete } = useOnboarding();
  const flatListRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  const slidePadding = Math.min(Math.round(width * 0.08), 40);

  const onMomentumScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }, [width]);

  const goNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      flatListRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true });
      setIndex(index + 1);
    } else {
      void complete();
    }
  }, [index, width, complete]);

  const isLast = index === SLIDES.length - 1;

  const renderSlide = useCallback(
    ({ item }: { item: (typeof SLIDES)[number] }) => (
      <View style={{ width, paddingHorizontal: slidePadding }} className="items-center justify-center">
        <View className="mb-8 h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary + '1a' }}>
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={36} color={theme.primary} />
        </View>
        <ThemedText type="title" className="mb-3 text-center">
          {item.title}
        </ThemedText>
        <ThemedText type="body" color="mutedForeground" className="text-center">
          {item.body}
        </ThemedText>
      </View>
    ),
    [width, slidePadding, theme.primary],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="items-end px-5 pt-2">
        <Pressable onPress={() => void complete()} hitSlop={8}>
          <ThemedText type="linkPrimary">Skip</ThemedText>
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        className="flex-1"
      />

      <View className="mb-8 flex-row items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <View
            key={i}
            className={i === index ? 'h-2 w-6 rounded-full' : 'h-2 w-2 rounded-full'}
            style={{ backgroundColor: i === index ? theme.primary : theme.muted }}
          />
        ))}
      </View>

      <View className="px-5">
        <PrimaryButton label={isLast ? 'Get Started' : 'Next'} onPress={goNext} />
      </View>
    </View>
  );
}
