import { Route, Routes } from "react-router-dom";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import { NavBar } from "./components/navbar/NavBar";
import { PokedexPage } from "./pages/PokedexPage";

const App = () => (
  <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    <NavBar />
    <Box
      component="main"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        scrollbarGutter: "stable",
        scrollbarWidth: "thin",
        scrollbarColor: (theme) =>
          `${alpha(theme.palette.primary.main, 0.5)} transparent`,
        "&::-webkit-scrollbar": { width: 10 },
        "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.4),
          borderRadius: 8,
          border: "2px solid transparent",
          backgroundClip: "padding-box",
        },
        "&::-webkit-scrollbar-thumb:hover": {
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.65),
        },
      }}
    >
      <Routes>
        <Route path="/" element={<PokedexPage />} />
      </Routes>
    </Box>
  </Box>
);

export default App;
