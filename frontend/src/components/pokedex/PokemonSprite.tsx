import { memo, useState } from "react";
import { alpha } from "@mui/material/styles";
import Box from "@mui/material/Box";
import CardMedia from "@mui/material/CardMedia";
import Skeleton from "@mui/material/Skeleton";
import { iconUrl } from "../../api/pokemon";
import emptyPokeball from "../../assets/empty-pokeball.png";

export const PokemonSprite = memo(
  ({ name, glow }: { name: string; glow: string }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageErrored, setImageErrored] = useState(false);

    return (
      <Box
        sx={{
          position: "relative",
          height: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 50% 38%, ${alpha(glow, 0.3)} 0%, transparent 68%)`,
          bgcolor: "background.default",
        }}
      >
        {imageLoaded && (
          <Box
            sx={{
              position: "absolute",
              bottom: 16,
              width: "46%",
              height: 8,
              borderRadius: "50%",
              bgcolor: "rgba(120,120,120,0.35)",
            }}
          />
        )}
        <Box sx={{ position: "relative", height: 108, width: 108 }}>
          {!imageLoaded && !imageErrored && (
            <Skeleton
              variant="circular"
              width={108}
              height={108}
              sx={{ position: "absolute", inset: 0 }}
            />
          )}
          {imageErrored ? (
            <Box
              component="img"
              src={emptyPokeball}
              alt=""
              sx={{
                position: "relative",
                height: 108,
                width: 108,
                objectFit: "contain",
                opacity: 0.45,
              }}
            />
          ) : (
            <CardMedia
              component="img"
              src={iconUrl(name)}
              alt={name}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageErrored(true)}
              sx={{
                position: "relative",
                height: 108,
                width: "auto",
                maxWidth: 108,
                mx: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.25))",
                opacity: imageLoaded ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
            />
          )}
        </Box>
      </Box>
    );
  },
);
