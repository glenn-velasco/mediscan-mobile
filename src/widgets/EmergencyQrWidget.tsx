import { Image, Text, VStack, HStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type EmergencyQrWidgetProps = {
  imagePath: string;
};

const EmergencyQrWidget = (props: EmergencyQrWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <Image uiImage={props.imagePath} />
    );
  }

  return (
    <HStack>
      <Image
        systemName="qrcode"
        size={24}
        color={environment.colorScheme === 'dark' ? '#FFFFFF' : '#000000'}
      />
      <VStack>
        <Text modifiers={[font({ weight: 'bold' })]}>
          Emergency QR
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle('#8E8E93')]}>
          Open Mediscan
        </Text>
      </VStack>
    </HStack>
  );
};

const widget = createWidget('EmergencyQrWidget', EmergencyQrWidget);
export default widget;
