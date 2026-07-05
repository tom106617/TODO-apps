import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from "react-native";

export default function home() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <h1>
        Welcome to&nbsp; Tin Pay World!!!!!!
      </h1>
    </ThemeProvider>
  );
}

