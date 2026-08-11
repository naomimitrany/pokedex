import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#3B4CCA" },
        secondary: { main: "#FFDE00", contrastText: "#1A1A1A" },
        background: { default: "#f4f6fb", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#8C9CFF" },
        secondary: { main: "#FFDE00", contrastText: "#1A1A1A" },
        background: { default: "#121218", paper: "#1a1b23" },
      },
    },
  },
  shape: { borderRadius: 12 },
});
