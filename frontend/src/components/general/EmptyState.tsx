import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import emptyPokeball from "../../assets/empty-pokeball.png";

export const EmptyState = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      py: 8,
    }}
  >
    <Box
      component="img"
      src={emptyPokeball}
      alt=""
      sx={{ display: "block", width: 240, opacity: 0.45, mb: 1 }}
    />
    <Typography variant="h6" sx={{ color: "text.secondary" }}>
      {title}
    </Typography>
    {description && (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {description}
      </Typography>
    )}
  </Box>
);
