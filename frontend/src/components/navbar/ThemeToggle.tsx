import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import IconButton from "@mui/material/IconButton";
import { useColorScheme } from "@mui/material/styles";

export const ThemeToggle = () => {
  const { colorScheme, setMode } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <IconButton
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setMode(isDark ? "light" : "dark")}
      color="inherit"
    >
      {isDark ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  );
};
