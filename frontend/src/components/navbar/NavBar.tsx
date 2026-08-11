import AppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import CatchingPokemonIcon from "@mui/icons-material/CatchingPokemon";
import { ThemeToggle } from "./ThemeToggle";

export const NavBar = () => (
  <AppBar
    position="static"
    elevation={0}
    sx={{
      bgcolor: "primary.main",
      backgroundImage: "linear-gradient(135deg, transparent, rgba(255,255,255,0.1))",
      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    }}
  >
    <Toolbar>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexGrow: 1 }}>
        <CatchingPokemonIcon sx={{ color: "#fff", fontSize: 36 }} />
        <Typography
          variant="h6"
          component="h1"
          sx={{
            fontFamily: "'Pokemon Solid', 'Fredoka', sans-serif",
            fontWeight: 700,
            fontSize: "2.6rem",
            letterSpacing: 0.5,
            color: "#fff",
            textShadow:
              "1px 1px 0 rgba(0,0,0,0.3), 2px 2px 0 rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.25)",
            position: "relative",
            top: "-4px",
          }}
        >
          Pokédex
        </Typography>
      </Stack>
      <ThemeToggle />
    </Toolbar>
  </AppBar>
);
