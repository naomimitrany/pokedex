import AppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT_FIELD } from "../../constants";
import { clearSavedScroll } from "../../hooks/useScrollRestoration";
import { getScrollContainer } from "../../utils/scrollContainer";
import { buildScrollKey } from "../../utils/scrollKey";

const DEFAULT_SCROLL_KEY = buildScrollKey({
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: DEFAULT_SORT_FIELD,
  order: "asc",
  type: null,
  q: "",
});

export const NavBar = () => (
  <AppBar
    position="static"
    elevation={0}
    enableColorOnDark
    sx={{
      bgcolor: "primary.main",
      color: "#fff",
      backgroundImage:
        "linear-gradient(135deg, transparent, rgba(255,255,255,0.1))",
      boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    }}
  >
    <Toolbar>
      <Stack
        component={Link}
        to="/"
        onClick={() => {
          // Clicking the title is an explicit "start over", not a returning
          // session -- clear whatever scroll position was last saved for the
          // default view so this always lands at a clean top, instead of
          // scroll restoration faithfully re-fetching and jumping back down
          // to wherever an earlier visit left off.
          clearSavedScroll(DEFAULT_SCROLL_KEY);
          getScrollContainer()?.scrollTo({ top: 0, behavior: "smooth" });
        }}
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          flexGrow: 1,
          textDecoration: "none",
          color: "inherit",
          width: "fit-content",
        }}
      >
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
            top: "-7px",
          }}
        >
          Pokédex
        </Typography>
      </Stack>
      <ThemeToggle />
    </Toolbar>
  </AppBar>
);
