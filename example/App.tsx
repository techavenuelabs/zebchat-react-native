import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { ZebChat, useZebChatUnread } from '@zebchat/react-native';

/**
 * Your website's site key (dashboard → Websites → Install). Add this app's id to the website's
 * Mobile apps tab first: Android `com.zebchat.example`, iOS `com.zebchat.example`.
 */
const SITE_KEY = 'zc_your_site_key';

const LOCALES = ['auto', 'en', 'fr', 'de', 'es'] as const;

function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const unread = useZebChatUnread();
  const [email, setEmail] = useState('ana@example.com');
  const [locale, setLocale] = useState<(typeof LOCALES)[number]>('auto');

  useEffect(() => {
    ZebChat.configure({ siteKey: SITE_KEY });
    ZebChat.trackScreen('Home');
  }, []);

  const nextLocale = () => {
    const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length] ?? 'auto';
    setLocale(next);
    ZebChat.setLocale(next);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>ZebChat example</Text>

      <Button
        title={unread > 0 ? `Chat with us (${unread} unread)` : 'Chat with us'}
        onPress={() => ZebChat.show()}
      />

      <View style={styles.section}>
        <Text style={styles.label}>Signed-in user</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          style={styles.input}
          value={email}
        />
        <Button
          title="Set user"
          onPress={() => ZebChat.setUser({ id: email, email, name: email.split('@')[0] })}
        />
        <Button title="Log out" onPress={() => ZebChat.logout()} />
      </View>

      <View style={styles.section}>
        <Button title="Track screen “Checkout”" onPress={() => ZebChat.trackScreen('Checkout')} />
        <Button title={`Language: ${locale}`} onPress={nextLocale} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  section: { marginTop: 16, gap: 8 },
  label: { fontSize: 14, color: '#555' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#0b6e4f',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
