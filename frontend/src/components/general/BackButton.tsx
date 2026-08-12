import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

type BackButtonProps = { to: string; onClick?: never } | { to?: never; onClick: () => void };

export const BackButton = (props: BackButtonProps) => (
  <Box sx={{ px: 2, pt: 2 }}>
    <Button
      startIcon={<ArrowBackIcon />}
      {...(props.to
        ? { component: Link, to: props.to }
        : { onClick: props.onClick })}
    >
      Back
    </Button>
  </Box>
);
