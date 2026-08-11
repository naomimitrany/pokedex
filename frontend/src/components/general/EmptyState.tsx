import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export type EmptyStateProps = {
  title: string;
  description?: string;
};

export const EmptyState = ({ title, description }: EmptyStateProps) => (
  <Box sx={{ textAlign: "center", py: 8 }}>
    <Typography variant="h6">{title}</Typography>
    {description && (
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    )}
  </Box>
);
