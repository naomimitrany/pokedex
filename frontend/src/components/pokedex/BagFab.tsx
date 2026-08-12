import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import { Link, useLocation } from "react-router-dom";
import bagIcon from "../../assets/bag.png";
import { useIdentity } from "../../hooks/useIdentity";

export const BagFab = () => {
  const identity = useIdentity();
  const location = useLocation();

  if (!identity.username || location.pathname === "/captured") return null;

  return (
    <Fab
      component={Link}
      to="/captured"
      aria-label="View captured Pokémon"
      sx={{
        position: "fixed",
        right: 24,
        bottom: 24,
        bgcolor: "background.paper",
        "&:hover": { bgcolor: "background.paper" },
      }}
    >
      <Box component="img" src={bagIcon} alt="" sx={{ width: 34, height: 34 }} />
    </Fab>
  );
};
