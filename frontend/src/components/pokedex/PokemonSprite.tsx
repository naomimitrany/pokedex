import { memo, useState } from "react";
import { alpha } from "@mui/material/styles";
import Box from "@mui/material/Box";
import CardMedia from "@mui/material/CardMedia";
import Skeleton from "@mui/material/Skeleton";
import { iconUrl } from "../../api/pokemon";
import emptyPokeball from "../../assets/empty-pokeball.png";

export const PokemonSprite = memo(
  ({
    name,
    glow,
    size = 140,
    background = "background.default",
  }: {
    name: string;
    glow: string;
    size?: number;
    background?: string;
  }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageErrored, setImageErrored] = useState(false);
    const imgSize = Math.round(size * 0.77);

    return (
      <Box
        sx={{
          position: "relative",
          height: size,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 50% 38%, ${alpha(glow, 0.3)} 0%, transparent 68%)`,
          bgcolor: background,
        }}
      >
        {imageLoaded && (
          <Box
            sx={{
              position: "absolute",
              bottom: Math.round(size * 0.11),
              width: "46%",
              height: Math.max(6, Math.round(size * 0.057)),
              borderRadius: "50%",
              bgcolor: "rgba(120,120,120,0.35)",
            }}
          />
        )}
        <Box sx={{ position: "relative", height: imgSize, width: imgSize }}>
          {!imageLoaded && !imageErrored && (
            <Skeleton
              variant="circular"
              width={imgSize}
              height={imgSize}
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
                height: imgSize,
                width: imgSize,
                objectFit: "contain",
                opacity: 0.45,
              }}
            />
          ) : (
            <CardMedia
              component="img"
              src={iconUrl(name)}
              alt={name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageErrored(true)}
              sx={{
                position: "relative",
                height: imgSize,
                width: "auto",
                maxWidth: imgSize,
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
