import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { ThemeToggle } from "./ThemeToggle";

export const NavBar = () => (
  <AppBar position="static" color="primary" enableColorOnDark>
    <Toolbar>
      <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
        Pokédex
      </Typography>
      <ThemeToggle />
    </Toolbar>
  </AppBar>
);
