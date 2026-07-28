import { StyleSheet } from 'react-native';

/**
 * Shared design tokens for form fields.
 * Ensures consistent sizing, borders, and hierarchy across TextField, SelectField, DateField, etc.
 */
export const formTokens = StyleSheet.create({
  /** Container wrapping the entire field + error text */
  container: {
    marginBottom: 16,
  },

  /** The pressable/input surface */
  field: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },

  /** Floating label container (absolute positioned) */
  labelContainer: {
    position: 'absolute',
    paddingHorizontal: 4,
  },

  /** Left icon container (absolute positioned) */
  leftIcon: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    top: 0,
    justifyContent: 'center',
    paddingLeft: 14,
  },

  /** Right icon container (absolute positioned) */
  rightIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    top: 0,
    justifyContent: 'center',
    paddingRight: 12,
  },

  /** Error text below the field */
  errorText: {
    marginTop: 6,
  },

  /** Bottom sheet handle */
  sheetHandle: {
    width: 36,
  },

  /** Bottom sheet row (option, menu item) */
  sheetRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },

  /** Bottom sheet header */
  sheetHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
});

/** Field dimensions */
export const field = {
  /** Horizontal padding inside the input */
  paddingH: 16,
  /** Vertical padding inside the input */
  paddingV: 12,
  /** Border radius for all fields */
  radius: 12,
  /** Left offset when leftIcon is present */
  leftOffset: 44,
  /** Right offset when rightIcon is present */
  rightOffset: 48,
  /** Left icon container padding */
  iconPaddingL: 14,
  /** Right icon container padding */
  iconPaddingR: 12,
  /** Floating label left position (no icon) */
  labelLeft: 16,
  /** Floating label left position (with left icon) */
  labelLeftWithIcon: 48,
  /** Font size for input text */
  fontSize: 16,
  /** Line height for input text */
  lineHeight: 24,
  /** Font family for input text */
  fontFamily: 'Inter-Medium' as const,
} as const;

/** Bottom sheet tokens */
export const sheet = {
  /** Border radius for bottom sheet */
  radius: 20,
  /** Handle indicator width */
  handleWidth: 36,
  /** Row border radius */
  rowRadius: 8,
  /** Horizontal padding */
  paddingH: 24,
  /** Vertical padding bottom */
  paddingB: 40,
  /** Top padding */
  paddingT: 8,
} as const;
