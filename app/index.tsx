import { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function SplashScreen() {
  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndNavigate() {
      try {
        const [{ data }] = await Promise.all([
          supabase.auth.getSession().catch(() => ({ data: { session: null } })),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);

        if (!isMounted) return;

        if (data?.session) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/login');
        }
      } catch {
        if (!isMounted) return;
        router.replace('/login');
      }
    }

    checkAuthAndNavigate();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Image
        source={require('../Appname.png')}
        style={styles.Appname}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF1E4',
  },
  logo: {
    marginBottom: 16,
    height: 160,
    width: 130,
  },
  Appname: {
    height: 66,
    width: 330,
  },
});
