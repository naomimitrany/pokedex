import { memo, useState } from "react";
import { keyframes } from "@emotion/react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CatchingPokemonIcon from "@mui/icons-material/CatchingPokemon";
import CatchingPokemonOutlinedIcon from "@mui/icons-material/CatchingPokemonOutlined";

const shake = keyframes`
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-12deg); }
  40% { transform: rotate(10deg); }
  60% { transform: rotate(-8deg); }
  80% { transform: rotate(6deg); }
`;

export const CaptureButton = memo(
  ({
    name,
    captured,
    loading,
    onToggle,
  }: {
    name: string;
    captured: boolean;
    loading?: boolean;
    onToggle: () => void;
  }) => {
    const [isShaking, setIsShaking] = useState(false);

    return (
      <Tooltip title={captured ? "Release" : "Capture"} arrow>
        <IconButton
          aria-label={`${captured ? "Release" : "Capture"} ${name}`}
          disabled={loading}
          onClick={(e) => {
            e.currentTarget.blur();
            setIsShaking(true);
            onToggle();
          }}
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
            bgcolor: "background.paper",
            boxShadow: 2,
            border: "2px solid",
            borderColor: captured ? "#EE1515" : "divider",
            animation: isShaking ? `${shake} 0.4s ease-in-out` : undefined,
            "&:hover": { bgcolor: "background.paper" },
          }}
          onAnimationEnd={() => setIsShaking(false)}
          size="small"
        >
          {captured ? (
            <CatchingPokemonIcon fontSize="small" sx={{ color: "#EE1515" }} />
          ) : (
            <CatchingPokemonOutlinedIcon
              fontSize="small"
              sx={{ color: "text.disabled" }}
            />
          )}
        </IconButton>
      </Tooltip>
    );
  },
);
