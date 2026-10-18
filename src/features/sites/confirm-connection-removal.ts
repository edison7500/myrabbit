import { Alert } from 'react-native';

export function confirmConnectionRemoval(serverUrl: string): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert('Remove saved connection?',
      `Remove the saved API URL and API key for ${serverUrl} from MyRabbit on this device? Your Rybbit sites and analytics data will be kept.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Remove connection', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) });
  });
}
