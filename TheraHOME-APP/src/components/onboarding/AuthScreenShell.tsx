import React, { useState } from 'react';
import { Animated, Image, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons/Icon';
import { RunnerDoor } from '@/components/onboarding/RunnerDoor';
import { AppleLogo } from '@/components/AppleLogo';
import { GoogleGLogo } from '@/components/GoogleGLogo';
import { useAppStore, type AppLanguage } from '@/store/useAppStore';

const BACKGROUND = require('../../../assets/auth-wellness-background.png');
const BRANDMARK = require('../../../assets/brandmark-gradient.png');
const COPY = {
  vi: { signInTitle: 'Chào mừng trở lại', signInSubtitle: 'Đăng nhập để tiếp tục hành trình chăm sóc sức khỏe', createTitle: 'Tạo tài khoản', createSubtitle: 'Bắt đầu hành trình khỏe mạnh hơn cùng TheraHOME', identity: 'Email hoặc tên đăng nhập', username: 'Tên đăng nhập', email: 'Email', password: 'Mật khẩu', forgot: 'Quên mật khẩu?', signIn: 'Đăng nhập', create: 'Đăng ký', or: 'hoặc', newUser: 'Bạn mới biết đến TheraHOME?', createLink: 'Tạo tài khoản', haveAccount: 'Bạn đã có tài khoản?', signInLink: 'Đăng nhập', legalPrefix: 'Bằng việc tiếp tục, bạn đồng ý với', terms: 'Điều khoản sử dụng', and: 'và', privacy: 'Chính sách quyền riêng tư' },
  en: { signInTitle: 'Welcome back', signInSubtitle: 'Sign in to continue your wellness journey', createTitle: 'Create account', createSubtitle: 'Begin your healthier journey with TheraHOME', identity: 'Email or username', username: 'Username', email: 'Email', password: 'Password', forgot: 'Forgot password?', signIn: 'Login', create: 'Register', or: 'or', newUser: 'New to TheraHOME?', createLink: 'Create account', haveAccount: 'Already have an account?', signInLink: 'Login', legalPrefix: 'By continuing, you agree to our', terms: 'Terms of Service', and: 'and', privacy: 'Privacy Policy' },
  ms: { signInTitle: 'Selamat kembali', signInSubtitle: 'Log masuk untuk meneruskan perjalanan kesejahteraan anda', createTitle: 'Cipta akaun', createSubtitle: 'Mulakan perjalanan lebih sihat bersama TheraHOME', identity: 'E-mel atau nama pengguna', username: 'Nama pengguna', email: 'E-mel', password: 'Kata laluan', forgot: 'Lupa kata laluan?', signIn: 'Log masuk', create: 'Daftar', or: 'atau', newUser: 'Baharu di TheraHOME?', createLink: 'Cipta akaun', haveAccount: 'Sudah mempunyai akaun?', signInLink: 'Log masuk', legalPrefix: 'Dengan meneruskan, anda bersetuju dengan', terms: 'Terma Perkhidmatan', and: 'dan', privacy: 'Dasar Privasi' },
} satisfies Record<AppLanguage, Record<string, string>>;

export interface AuthFormValues { username: string; email: string; password: string }

interface Props {
  mode: 'signIn' | 'create';
  busy?: boolean;
  error?: string | null;
  showApple?: boolean;
  onApple?: () => void;
  onGoogle?: () => void;
  /** Receives what was typed. In 'signIn' mode `username` carries whatever
   * went in the first field — it accepts an email there too. */
  onSubmit?: (values: AuthFormValues) => void;
  onForgot?: () => void;
}

export function AuthScreenShell({ mode, busy, error, showApple = true, onApple, onGoogle, onSubmit, onForgot }: Props) {
  const language = useAppStore((state) => state.language);
  const copy = COPY[language];
  const creating = mode === 'create';
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const canContinue = creating ? !!username.trim() && !!email.trim() && !!password : !!username.trim() && !!password;
  return (
    <AuthLayout brandGap={creating ? 26 : 38}>
      <>
              <Text style={styles.title}>{creating ? copy.createTitle : copy.signInTitle}</Text>
              <View style={styles.fields}>
                {/* create: this is a chosen display name, not a saved login, so
                    `textContentType="username"`/autoComplete drove iOS to pop a
                    "suggested username" strip over the form every time (owner
                    report 2026-09-09). Turn autofill off here. sign-in keeps
                    emailAddress so the OS can still offer the saved email. */}
                <AuthInput icon={creating ? 'user' : 'mail'} value={username} onChangeText={setUsername} placeholder={creating ? copy.username : copy.email} keyboardType={creating ? 'default' : 'email-address'} textContentType={creating ? 'none' : 'emailAddress'} autoComplete={creating ? 'off' : 'email'} importantForAutofill="no" />
                {/* Autofill off on create too: with a username/email field
                    advertising an account name, iOS paired it against the
                    password field and popped the "suggested username" strip
                    over the form (owner report 2026-09-09). The keyboard stays
                    email-address; only the autofill semantic is dropped. */}
                {creating ? <AuthInput icon="mail" value={email} onChangeText={setEmail} placeholder={copy.email} keyboardType="email-address" textContentType="none" autoComplete="off" importantForAutofill="no" /> : null}
                <View style={[styles.inputRow, passwordFocused && styles.inputRowFocused]}>
                  <Icon name="lock" size={20} color="#6E84A2" />
                  <TextInput value={password} onChangeText={setPassword} onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} placeholder={copy.password} placeholderTextColor="#8292AA" secureTextEntry={!showPassword} textContentType={creating ? 'newPassword' : 'password'} autoCapitalize="none" style={styles.input} />
                  <Pressable accessibilityRole="button" onPress={() => setShowPassword((value) => !value)} hitSlop={10}><Icon name={showPassword ? 'eye-off' : 'eye'} size={22} color="#627999" /></Pressable>
                </View>
              </View>
              {!creating ? <Pressable accessibilityRole="button" onPress={onForgot} style={styles.forgot}><Text style={styles.link}>{copy.forgot}</Text></Pressable> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {/* Sign-in gets its breathing room from the "Forgot password?" row
                  above; create-account has no such row, so the button sat right
                  under the password field — add the gap here (owner, 2026-09-09). */}
              {creating ? <View style={{ height: 10 }} /> : null}
              <PrimaryAuthButton
                disabled={!canContinue || !!busy}
                busy={!!busy}
                label={creating ? copy.create : copy.signIn}
                onPress={() => onSubmit?.({ username: username.trim(), email: email.trim(), password })}
              />
              <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>{copy.or}</Text><View style={styles.line} /></View>
              <View style={styles.socialRow}>
                {showApple ? <Pressable accessibilityRole="button" style={styles.socialButton} onPress={onApple} disabled={busy}><AppleLogo size={27} /></Pressable> : null}
                <Pressable accessibilityRole="button" style={styles.socialButton} onPress={onGoogle} disabled={busy}><GoogleGLogo size={27} /></Pressable>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>{creating ? copy.haveAccount : copy.newUser} </Text>
                <Pressable hitSlop={8} onPress={() => router.push(creating ? '/login' : '/create-account')}>
                  <Text style={styles.link}>{creating ? copy.signInLink : copy.createLink}</Text>
                </Pressable>
              </View>
              <Text style={styles.legal}>{copy.legalPrefix}{' '}<Text style={styles.link} onPress={() => router.push('/profile/legal/terms')}>{copy.terms}</Text>{' '}{copy.and}{' '}<Text style={styles.link} onPress={() => router.push('/profile/legal/privacy')}>{copy.privacy}</Text>.</Text>
      </>
    </AuthLayout>
  );
}

/** The background, brandmark and glass card every auth screen sits in. The
 * code-entry, forgot-password and new-password screens reuse it so the flow
 * reads as one thing rather than a designed front door followed by three
 * plain forms. */
export function AuthLayout({ children, brandGap = 38 }: { children: React.ReactNode; brandGap?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <ImageBackground source={BACKGROUND} resizeMode="cover" style={styles.screen}>
      <View pointerEvents="none" style={styles.softOverlay} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.dismissArea}>
            <View style={styles.brandBlock}>
              <Image source={BRANDMARK} resizeMode="contain" style={styles.brandmark} />
              <Text style={styles.brand}>Thera<Text style={styles.brandAccent}>HOME</Text></Text>
            </View>
            <View style={[styles.card, { marginTop: brandGap }]}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

export function AuthInput({ icon, ...props }: React.ComponentProps<typeof TextInput> & { icon: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={[styles.inputRow, focused && styles.inputRowFocused]}><Icon name={icon} size={20} color={focused ? '#078BE4' : '#6E84A2'} /><TextInput {...props} onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} placeholderTextColor="#8292AA" autoCapitalize="none" autoCorrect={false} style={styles.input} /></View>;
}

export function PrimaryAuthButton({ disabled, busy, label, onPress }: { disabled: boolean; busy?: boolean; label: string; onPress?: () => void }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const sheen = React.useRef(new Animated.Value(0)).current;
  // Each press bumps this, and RunnerDoor plays one full run-through on the
  // change. Tying the animation to a press rather than to `busy` means it
  // always completes — a fast sign-in used to cut it off before the legs
  // even pumped, so the figure only appeared to slide.
  const [playToken, setPlayToken] = React.useState(0);
  const animateTo = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 30, bounciness: 5 }).start();
  const play = () => {
    sheen.setValue(0);
    Animated.timing(sheen, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    setPlayToken((token) => token + 1);
    onPress?.();
  };
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-110, 430] });
  // "Muted" — the flat grey, clearly-not-tappable look — is for a form that
  // isn't ready to submit yet, NOT for a submit in progress. `disabled` is true
  // in both cases (the caller passes `!canContinue || busy`), so keying the
  // grey off it alone turned the button grey the instant it was pressed, mid
  // run-through. Press should play the figure on the SAME teal button, so the
  // grey is gated on `disabled && !busy`.
  const muted = disabled && !busy;
  const stops = muted ? ['#CBD4DE', '#BDC7D2', '#AFBAC7'] : ['#55E4D5', '#16CFC5', '#079FE4'];
  return (
    <Animated.View style={[styles.primaryWrap, { transform: [{ scale }] }, muted && styles.primaryDisabled]}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={play} onPressIn={() => animateTo(0.965)} onPressOut={() => animateTo(1)} style={styles.primary}>
        <Svg pointerEvents="none" width="100%" height="100%" style={styles.primaryGradient}>
          <Defs><LinearGradient id="authButtonGradient" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={stops[0]} /><Stop offset="0.54" stopColor={stops[1]} /><Stop offset="1" stopColor={stops[2]} /></LinearGradient></Defs>
          <Rect width="100%" height="100%" rx="28" fill="url(#authButtonGradient)" />
        </Svg>
        {!muted ? <Animated.View pointerEvents="none" style={[styles.primarySheen, { transform: [{ translateX: sheenX }, { rotate: '-18deg' }] }]} /> : null}
        <Text style={[styles.primaryText, muted && styles.primaryTextDisabled]}>{label}</Text>
        <View style={styles.primaryStage}><RunnerDoor playToken={playToken} size={50} /></View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#C9E7FA' }, softOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(232,246,255,0.08)' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20 }, dismissArea: { flex: 1, minHeight: 680 },
  brandBlock: { alignItems: 'center', paddingTop: 18 }, brandmark: { width: 96, height: 86 }, brand: { color: '#174C78', fontSize: 31, lineHeight: 36, fontWeight: '800', letterSpacing: -1 }, brandAccent: { color: '#078BE4' },
  card: { marginTop: 38, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 19, borderRadius: 30, backgroundColor: 'rgba(250,253,255,0.93)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', shadowColor: '#17395E', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  title: { textAlign: 'center', color: '#10244B', fontSize: 27, lineHeight: 33, fontWeight: '800', letterSpacing: -0.5, marginBottom: 17 }, subtitle: { textAlign: 'center', color: '#4A6182', fontSize: 14, lineHeight: 20, marginTop: -9, marginBottom: 17 }, fields: { gap: 10 },
  inputRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 17, borderRadius: 16, borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.98)', borderLeftColor: 'rgba(255,255,255,0.98)', borderRightColor: '#D9E2EA', borderBottomColor: '#D4DEE7', backgroundColor: '#EEF3F7', shadowColor: '#8292A5', shadowOpacity: 0.24, shadowRadius: 7, shadowOffset: { width: 5, height: 6 }, elevation: 5 }, inputRowFocused: { borderColor: '#72BDF0', backgroundColor: '#F2F8FC', shadowColor: '#078BE4', shadowOpacity: 0.25, elevation: 7 }, input: { flex: 1, minWidth: 0, paddingVertical: 14, color: '#13284D', fontSize: 15 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 9 }, link: { color: '#078BE4', fontWeight: '600' }, error: { color: '#D84545', textAlign: 'center', fontSize: 12, marginTop: 7 },
  primaryWrap: { alignSelf: 'stretch', minHeight: 57, marginTop: 4, borderRadius: 18, shadowColor: '#10CFC8', shadowOpacity: 0.46, shadowRadius: 13, shadowOffset: { width: 0, height: 7 }, elevation: 8 }, primary: { alignSelf: 'stretch', width: '100%', minHeight: 57, borderRadius: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, primaryGradient: { ...StyleSheet.absoluteFill }, primarySheen: { position: 'absolute', top: -24, bottom: -24, width: 54, backgroundColor: 'rgba(255,255,255,0.36)' }, primaryDisabled: { opacity: 0.92, shadowColor: '#93A0AE', shadowOpacity: 0.12, shadowRadius: 7, elevation: 1 }, primaryText: { color: '#103859', fontSize: 17, fontWeight: '800', marginLeft: 24 }, primaryTextDisabled: { color: '#6B7A8C' }, primaryStage: { position: 'absolute', right: 40, top: 3, bottom: 3, width: 50, alignItems: 'center', justifyContent: 'center' }, primaryIconGlow: { position: 'absolute', right: 3, width: 54, height: 54, borderRadius: 27, backgroundColor: '#7D72FF' }, primaryIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,71,159,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', shadowColor: '#514BFF', shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 15 }, line: { flex: 1, height: 1, backgroundColor: '#D6E0EC' }, or: { color: '#7F8EA4', fontSize: 12 }, socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 12 }, socialButton: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E9F1', shadowColor: '#17395E', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 13 }, switchText: { color: '#75859C' }, legal: { color: '#7D8DA3', textAlign: 'center', fontSize: 10.5, lineHeight: 15, marginTop: 13 },
});

/** Re-exported so the other screens in the auth flow share one visual
 * system instead of each re-deriving the card, title and link styling. */
export const authStyles = styles;
