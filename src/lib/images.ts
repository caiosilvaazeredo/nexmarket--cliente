import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Pick (or capture) an image, downscale + compress it and return a base64
 * JPEG data URI. We store images inline in Firestore exactly like the loja and
 * entregador apps do, which keeps the three apps consistent and avoids extra
 * Storage rules. Compression keeps each image well under the Firestore limit.
 */
export async function pickImage(opts?: {
  camera?: boolean;
  maxWidth?: number;
  quality?: number;
}): Promise<string | null> {
  const { camera = false, maxWidth = 900, quality = 0.5 } = opts || {};

  const perm = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const res = camera
    ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });

  if (res.canceled || !res.assets?.length) return null;

  const processed = await ImageManipulator.manipulateAsync(
    res.assets[0].uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  return processed.base64 ? `data:image/jpeg;base64,${processed.base64}` : null;
}
