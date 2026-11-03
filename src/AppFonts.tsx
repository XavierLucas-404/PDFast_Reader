import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useFonts } from "expo-font";
import { TypographyContext } from "./Typography";
import { colors } from "./theme";

const fonts = {
  EBGaramond_400Regular: require("../assets/fonts/EBGaramond_400Regular.ttf"),
  EBGaramond_500Medium: require("../assets/fonts/EBGaramond_500Medium.ttf"),
  EBGaramond_600SemiBold: require("../assets/fonts/EBGaramond_600SemiBold.ttf"),
  EBGaramond_700Bold: require("../assets/fonts/EBGaramond_700Bold.ttf"),
  EBGaramond_800ExtraBold: require("../assets/fonts/EBGaramond_800ExtraBold.ttf"),
};
export function AppFonts({ children }: { children: React.ReactNode }) {
  const [loaded, error] = useFonts(fonts);
  if (!loaded && !error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.paper,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.wine} />
      </View>
    );
  }
  return (
    <TypographyContext.Provider value={loaded}>
      {children}
    </TypographyContext.Provider>
  );
}
