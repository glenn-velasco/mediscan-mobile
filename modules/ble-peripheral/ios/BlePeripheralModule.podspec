Pod::Spec.new do |s|
  s.name           = 'BlePeripheralModule'
  s.version        = '1.0.0'
  s.summary        = 'Custom BLE GATT peripheral role for patient-side proximity sync'
  s.description    = 'Advertises a fixed GATT service (patient_id / public_key / envelope_write / envelope_ack) via CBPeripheralManager so a professional device can submit a sealed envelope over Bluetooth without a network round-trip.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
