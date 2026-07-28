import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { field, formTokens, sheet } from '@/components/form/tokens';

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

export type PhoneInputValue = {
  countryCode: string;
  phone: string;
};

type PhoneInputProps = {
  value: PhoneInputValue;
  onChange: (value: PhoneInputValue) => void;
  error?: string;
};

type Country = {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
};

const POPULAR_CODES: CountryCode[] = ['PH', 'US', 'GB', 'AU', 'JP', 'KR', 'SG', 'MY', 'CA', 'DE', 'FR'];

const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AS: 'American Samoa', AD: 'Andorra', AO: 'Angola',
  AI: 'Anguilla', AG: 'Antigua & Barbuda', AR: 'Argentina', AM: 'Armenia', AW: 'Aruba', AU: 'Australia',
  AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas', BH: 'Bahrain', BD: 'Bangladesh', BB: 'Barbados',
  BY: 'Belarus', BE: 'Belgium', BZ: 'Belize', BJ: 'Benin', BM: 'Bermuda', BT: 'Bhutan',
  BO: 'Bolivia', BA: 'Bosnia & Herzegovina', BW: 'Botswana', BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria',
  BF: 'Burkina Faso', BI: 'Burundi', KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada', CV: 'Cape Verde',
  KY: 'Cayman Islands', CF: 'Central African Rep.', TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia',
  KM: 'Comoros', CG: 'Congo', CD: 'Congo (DRC)', CR: 'Costa Rica', HR: 'Croatia',
  CU: 'Cuba', CW: 'Curaçao', CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark', DJ: 'Djibouti',
  DM: 'Dominica', DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador',
  GQ: 'Equatorial Guinea', ER: 'Eritrea', EE: 'Estonia', SZ: 'Eswatini', ET: 'Ethiopia',
  FJ: 'Fiji', FI: 'Finland', FR: 'France', GA: 'Gabon', GM: 'Gambia', GE: 'Georgia',
  DE: 'Germany', GH: 'Ghana', GR: 'Greece', GD: 'Grenada', GT: 'Guatemala', GN: 'Guinea',
  GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras', HK: 'Hong Kong', HU: 'Hungary',
  IS: 'Iceland', IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq', IE: 'Ireland',
  IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan',
  KE: 'Kenya', KI: 'Kiribati', KP: 'North Korea', KR: 'South Korea', KW: 'Kuwait', KG: 'Kyrgyzstan',
  LA: 'Laos', LV: 'Latvia', LB: 'Lebanon', LS: 'Lesotho', LR: 'Liberia', LY: 'Libya',
  LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg', MO: 'Macau', MG: 'Madagascar', MW: 'Malawi',
  MY: 'Malaysia', MV: 'Maldives', ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands', MR: 'Mauritania',
  MU: 'Mauritius', MX: 'Mexico', FM: 'Micronesia', MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia',
  ME: 'Montenegro', MS: 'Montserrat', MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia',
  NR: 'Nauru', NP: 'Nepal', NL: 'Netherlands', NC: 'New Caledonia', NZ: 'New Zealand',
  NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', MK: 'North Macedonia', NO: 'Norway', OM: 'Oman',
  PK: 'Pakistan', PW: 'Palau', PS: 'Palestine', PA: 'Panama', PG: 'Papua New Guinea',
  PY: 'Paraguay', PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal', PR: 'Puerto Rico',
  QA: 'Qatar', RO: 'Romania', RU: 'Russia', RW: 'Rwanda', KN: 'St. Kitts & Nevis',
  LC: 'St. Lucia', VC: 'St. Vincent & Grenadines', WS: 'Samoa', SM: 'San Marino',
  SA: 'Saudi Arabia', SN: 'Senegal', RS: 'Serbia', SC: 'Seychelles', SL: 'Sierra Leone',
  SG: 'Singapore', SK: 'Slovakia', SI: 'Slovenia', SB: 'Solomon Islands',
  SO: 'Somalia', ZA: 'South Africa', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SR: 'Suriname', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan',
  TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand', TL: 'Timor-Leste', TG: 'Togo',
  TO: 'Tonga', TT: 'Trinidad & Tobago', TN: 'Tunisia', TR: 'Turkey',
  TM: 'Turkmenistan', TC: 'Turks & Caicos Islands', TV: 'Tuvalu',
  UG: 'Uganda', UA: 'Ukraine', AE: 'United Arab Emirates', GB: 'United Kingdom', US: 'United States',
  UY: 'Uruguay', UZ: 'Uzbekistan', VU: 'Vanuatu', VE: 'Venezuela',
  VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
};

function countryToFlag(code: CountryCode): string {
  const OFFSET = 127397;
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + OFFSET))
    .join('');
}

function buildCountryList(): Country[] {
  const codes = getCountries();
  const result: Country[] = [];
  for (const code of codes) {
    try {
      const dialCode = `+${getCountryCallingCode(code)}`;
      const name = COUNTRY_NAMES[code] ?? code;
      result.push({ code, name, dialCode, flag: countryToFlag(code) });
    } catch {
      // skip countries without calling codes
    }
  }
  return result.sort((a, b) => {
    const aPopular = POPULAR_CODES.indexOf(a.code);
    const bPopular = POPULAR_CODES.indexOf(b.code);
    const aIdx = aPopular === -1 ? 1000 : aPopular;
    const bIdx = bPopular === -1 ? 1000 : bPopular;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.name.localeCompare(b.name);
  });
}

const FALLBACK_COUNTRY: Country = { code: 'PH' as CountryCode, name: 'Philippines', dialCode: '+63', flag: '🇵🇭' };

function CountryItem({
  item,
  isSelected,
  onSelect,
  theme,
}: {
  item: Country;
  isSelected: boolean;
  onSelect: (code: CountryCode) => void;
  theme: Record<string, string>;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.code)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: isSelected ? theme.primary + '15' : 'transparent',
      }}
    >
      <ThemedText type="subtitle" style={{ marginRight: 12 }}>{item.flag}</ThemedText>
      <View style={{ flex: 1 }}>
        <ThemedText type="body">{item.name}</ThemedText>
      </View>
      <ThemedText type="small" style={{ marginRight: 8 }}>
        {item.dialCode}
      </ThemedText>
      {isSelected ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: field.radius,
    borderWidth: 1,
    backgroundColor: 'transparent', // overridden by theme at runtime
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: field.paddingH,
    paddingRight: 8,
    paddingVertical: field.paddingV,
    gap: 4,
  },
  divider: {
    width: 1,
    height: 24,
    marginVertical: 'auto',
  },
  phoneInput: {
    flex: 1,
    fontSize: field.fontSize,
    lineHeight: field.lineHeight,
    fontFamily: field.fontFamily,
    paddingVertical: field.paddingV,
    paddingRight: field.paddingH,
    paddingLeft: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    borderRadius: field.radius,
    paddingHorizontal: field.paddingH,
    paddingVertical: field.paddingV,
    fontSize: 15,
  },
});

export function PhoneInput({ value, onChange, error }: PhoneInputProps) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadCountries = () => {
    setLoading(true);
    setTimeout(() => {
      const list = buildCountryList();
      if (mountedRef.current) {
        setCountries(list);
        setLoading(false);
      }
    }, 0);
  };

  const handleOpen = () => {
    Keyboard.dismiss();
    sheetRef.current?.present();
    loadCountries();
  };

  const selectedCountry = countries.find((c) => c.code === value.countryCode) ?? FALLBACK_COUNTRY;

  const filtered = (() => {
    if (!search.trim()) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q),
    );
  })();

  const handleSelect = (code: CountryCode) => {
    onChange({ countryCode: code, phone: value.phone });
    sheetRef.current?.dismiss();
  };

  const handlePhoneChange = (text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    onChange({ countryCode: value.countryCode, phone: digitsOnly });
  };

  const renderItem = ({ item }: { item: Country }) => (
    <CountryItem item={item} isSelected={item.code === selectedCountry.code} onSelect={handleSelect} theme={theme} />
  );

  const renderSeparator = () => (
    <View style={{ height: 1, marginLeft: 52, backgroundColor: theme.mutedForeground + '20' }} />
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.card,
            borderColor: error ? theme.destructive : focused ? theme.primary : theme.input,
          },
        ]}
      >
        <Pressable
          onPress={handleOpen}
          style={styles.countryButton}
        >
          <ThemedText style={{ fontSize: 18 }}>{selectedCountry.flag}</ThemedText>
          <ThemedText style={{ fontSize: field.fontSize, fontFamily: field.fontFamily, color: theme.foreground }}>
            {selectedCountry.dialCode}
          </ThemedText>
          <Ionicons name="chevron-down" size={16} color={theme.mutedForeground} />
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <TextInput
          value={value.phone}
          onChangeText={handlePhoneChange}
          placeholder="Phone number"
          placeholderTextColor={theme.mutedForeground}
          keyboardType="phone-pad"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.phoneInput, { color: theme.foreground }]}
        />
      </View>
      {error ? (
        <ThemedText type="small" color="destructive" style={formTokens.errorText}>
          {error}
        </ThemedText>
      ) : null}

      <BottomSheetModal
        ref={sheetRef}
        stackBehavior="push"
        snapPoints={['70%']}
        index={0}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: sheet.radius }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: sheet.handleWidth }}
        backdropComponent={renderBackdrop}
        onDismiss={() => setSearch('')}
      >
        <View style={styles.sheetHeader}>
          <ThemedText type="heading" style={{ flex: 1 }}>Select country</ThemedText>
          <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
            <Ionicons name="close" size={20} color={theme.mutedForeground} />
          </Pressable>
        </View>
        <View style={styles.searchContainer}>
          <BottomSheetTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search country..."
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.input,
                color: theme.foreground,
                fontFamily: field.fontFamily,
              },
            ]}
          />
        </View>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <BottomSheetFlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            ItemSeparatorComponent={renderSeparator}
            contentContainerStyle={{ paddingBottom: 32 }}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={15}
            removeClippedSubviews
          />
        )}
      </BottomSheetModal>
    </View>
  );
}
