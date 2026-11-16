let GoogleSigninModule: any = null;
try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSigninModule = mod?.GoogleSignin || null;
} catch {
  GoogleSigninModule = null;
}

export function isGoogleAuthAvailable(): boolean {
  return Boolean(
    GoogleSigninModule &&
    typeof GoogleSigninModule.configure === 'function' &&
    Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
  );
}

export function initGoogleAuth() {
  if (isGoogleAuthAvailable()) {
    try {
      GoogleSigninModule.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
      });
    } catch {
      // Ignore config errors in unsupported environments
    }
  }
}

export async function promptGoogleSignIn(): Promise<string | null> {
  if (!isGoogleAuthAvailable()) {
    throw new Error('Google Sign-In is only available in a development build or production build.');
  }

  try {
    await GoogleSigninModule.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSigninModule.signIn();
    const idToken = response?.data?.idToken || response?.idToken;
    if (!idToken) {
      throw new Error('No ID token received from Google');
    }
    return idToken;
  } catch (err: any) {
    if (err?.code === 'SIGN_IN_CANCELLED') {
      return null;
    }
    throw err;
  }
}
