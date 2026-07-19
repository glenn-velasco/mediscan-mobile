import type { ComponentProps } from 'react';
import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';

import { TextField } from '@/components/form/text-field';
import { useTheme } from '@/hooks/use-theme';

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  leftIcon?: ComponentProps<typeof TextField>['leftIcon'];
};

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();

  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      rightIcon={
        <MaterialIcons
          name={visible ? 'visibility' : 'visibility-off'}
          size={22}
          color={theme.mutedForeground}
        />
      }
      onRightIconPress={() => setVisible((v) => !v)}
    />
  );
}
