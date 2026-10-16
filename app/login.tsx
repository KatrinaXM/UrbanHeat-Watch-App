import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/auth';

type Mode = 'signIn' | 'signUp';
type Notice = { tone: 'error' | 'success' | 'info'; text: string; canResend?: boolean } | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyAuthError(message: string): Notice {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return { tone: 'error', text: 'Incorrect email or password. Please try again.' };
  }
  if (lower.includes('email not confirmed')) {
    return {
      tone: 'info',
      text: 'Please confirm your email address first. Check your inbox for the verification link.',
      canResend: true,
    };
  }
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return { tone: 'error', text: 'An account with this email already exists. Sign in instead.' };
  }
  if (lower.includes('rate limit')) {
    return { tone: 'error', text: 'Too many attempts. Please wait a few minutes and try again.' };
  }
  if (lower.includes('password')) {
    return { tone: 'error', text: message };
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return { tone: 'error', text: 'Could not reach the server. Check your internet connection.' };
  }
  return { tone: 'error', text: message };
}

function Field({
  icon,
  label,
  trailing,
  ...inputProps
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  trailing?: ReactNode;
} & ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldShell, focused && styles.fieldShellFocused]}>
        <Ionicons name={icon} size={18} color={focused ? '#F07B2E' : '#9C8E80'} />
        <TextInput
          placeholderTextColor="#A89B8D"
          style={styles.fieldInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {trailing}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { signIn, signUp, signInAsGuest, resendConfirmation } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const isSignUp = mode === 'signUp';

  function switchMode(next: Mode) {
    setMode(next);
    setNotice(null);
    setConfirmPassword('');
  }

  function validate(): string | null {
    const trimmedEmail = email.trim();
    if (isSignUp && !fullName.trim()) return 'Please enter your full name.';
    if (!trimmedEmail) return 'Please enter your email address.';
    if (!EMAIL_PATTERN.test(trimmedEmail)) return 'Please enter a valid email address.';
    if (!password) return 'Please enter your password.';
    if (isSignUp && password.length < 6) return 'Password must be at least 6 characters.';
    if (isSignUp && password !== confirmPassword) return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setNotice({ tone: 'error', text: validationError });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      if (isSignUp) {
        const { data, error } = await signUp(email.trim(), password, fullName);
        if (error) {
          setNotice(friendlyAuthError(error.message));
          return;
        }
        // Supabase returns a user with no identities when the email is already registered.
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setNotice({ tone: 'error', text: 'An account with this email already exists. Sign in instead.' });
          return;
        }
        if (data?.session) {
          router.replace('/(tabs)/home');
          return;
        }
        setMode('signIn');
        setPassword('');
        setConfirmPassword('');
        setNotice({
          tone: 'success',
          text: `Account created. We sent a verification link to ${email.trim()}. Confirm it, then sign in.`,
          canResend: true,
        });
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setNotice(friendlyAuthError(error.message));
          return;
        }
        router.replace('/(tabs)/home');
      }
    } catch (err: any) {
      setNotice(friendlyAuthError(err?.message || 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setNotice({ tone: 'error', text: 'Enter your email address above to resend the link.' });
      return;
    }
    setLoading(true);
    const { error } = await resendConfirmation(email.trim());
    setLoading(false);
    setNotice(
      error
        ? friendlyAuthError(error.message)
        : { tone: 'success', text: `A new verification link was sent to ${email.trim()}.` }
    );
  }

  function handleGuestLogin() {
    signInAsGuest();
    router.replace('/(tabs)/home');
  }

  const noticeIcon =
    notice?.tone === 'success' ? 'checkmark-circle' : notice?.tone === 'info' ? 'mail-unread' : 'alert-circle';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <Image source={require('../logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Welcome to UrbanHeat Watch</Text>
          </View>

          <Image source={require('../border2.png')} style={styles.border} resizeMode="contain" />

          <Text style={styles.heading}>{isSignUp ? 'Create your account' : 'Sign in'}</Text>
          <Text style={styles.subheading}>
            {isSignUp
              ? 'Register to save your AI research history and preferences.'
              : 'Use the email and password you registered with.'}
          </Text>

          <View style={styles.segment}>
            {(['signIn', 'signUp'] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {m === 'signIn' ? 'Sign in' : 'Create account'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {notice && (
            <View
              style={[
                styles.notice,
                notice.tone === 'error' && styles.noticeError,
                notice.tone === 'success' && styles.noticeSuccess,
                notice.tone === 'info' && styles.noticeInfo,
              ]}
            >
              <Ionicons
                name={noticeIcon}
                size={18}
                color={notice.tone === 'error' ? '#B42318' : notice.tone === 'success' ? '#067647' : '#8A4B12'}
              />
              <View style={styles.flex}>
                <Text style={styles.noticeText}>{notice.text}</Text>
                {notice.canResend && (
                  <Pressable onPress={handleResend} hitSlop={6}>
                    <Text style={styles.noticeLink}>Resend verification email</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {isSignUp && (
            <Field
              icon="person-outline"
              label="Full name"
              placeholder="Your name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          )}

          <Field
            icon="mail-outline"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Field
            icon="lock-closed-outline"
            label="Password"
            placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            textContentType={isSignUp ? 'newPassword' : 'password'}
            onSubmitEditing={isSignUp ? undefined : handleSubmit}
            trailing={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#9C8E80" />
              </Pressable>
            }
          />

          {isSignUp && (
            <Field
              icon="shield-checkmark-outline"
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={handleSubmit}
            />
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              loading && styles.buttonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => switchMode(isSignUp ? 'signIn' : 'signUp')} style={styles.switchButton}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchTextStrong}>{isSignUp ? 'Sign in' : 'Create one'}</Text>
            </Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={handleGuestLogin}
            style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}
          >
            <Ionicons name="person-circle-outline" size={20} color="#4B3F35" />
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </Pressable>
          <Text style={styles.guestHint}>Guest sessions are not saved to an account.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FBF1E4',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  logo: {
    width: 48,
    height: 64,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#2B2320',
  },
  border: {
    alignSelf: 'center',
    width: '90%',
    aspectRatio: 345 / 24,
    marginTop: 16,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2B2320',
    marginTop: 24,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 14,
    color: '#706053',
    marginTop: 6,
    lineHeight: 20,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#EFE2D2',
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#2B2320',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A7A6C',
  },
  segmentTextActive: {
    color: '#2B2320',
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 16,
  },
  noticeError: {
    backgroundColor: '#FEF3F2',
    borderColor: '#FECDCA',
  },
  noticeSuccess: {
    backgroundColor: '#ECFDF3',
    borderColor: '#ABEFC6',
  },
  noticeInfo: {
    backgroundColor: '#FFF6EA',
    borderColor: '#F6D3A8',
  },
  noticeText: {
    fontSize: 13.5,
    color: '#2B2320',
    lineHeight: 19,
  },
  noticeLink: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#C25E17',
    marginTop: 6,
  },
  fieldBlock: {
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#2B2320',
    marginBottom: 6,
  },
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E2D4C3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  fieldShellFocused: {
    borderColor: '#F07B2E',
  },
  fieldInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#2B2320',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F07B2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#F07B2E',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  switchButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  switchText: {
    color: '#706053',
    fontSize: 14,
  },
  switchTextStrong: {
    color: '#C25E17',
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2D4C3',
  },
  dividerText: {
    color: '#9C8E80',
    fontSize: 13,
    fontWeight: '500',
  },
  guestButton: {
    flexDirection: 'row',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4C3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    color: '#4B3F35',
    fontSize: 15,
    fontWeight: '600',
  },
  guestHint: {
    textAlign: 'center',
    color: '#9C8E80',
    fontSize: 12,
    marginTop: 8,
  },
});
