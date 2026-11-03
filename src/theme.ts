import { Platform } from "react-native";

export const colors = {
  paper: "#F5F0E7",
  parchment: "#D5C6B2",
  gold: "#B18A55",
  blue: "#475B70",
  wine: "#550F1D",
  ink: "#33252B",
  muted: "#6C605A",
  border: "#DCCEBB",
  surface: "#FFFCF6",
  soft: "#EAE0D1",
  amber: "#FFF2DA",
  white: "#FFFFFF",
};
export const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
});

export const TAB_SIDE_PADDING = 16;
