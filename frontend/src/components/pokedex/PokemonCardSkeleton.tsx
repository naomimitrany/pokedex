import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

const StatBarSkeleton = () => (
  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
    <Skeleton variant="text" width={30} height={16} sx={{ flexShrink: 0 }} />
    <Skeleton
      variant="rounded"
      height={7}
      sx={{ flexGrow: 1, borderRadius: "4px" }}
    />
    <Skeleton variant="text" width={26} height={16} sx={{ flexShrink: 0 }} />
  </Stack>
);

export const PokemonCardSkeleton = () => (
  <Box
    data-testid="pokemon-card-skeleton"
    sx={{
      position: "relative",
      height: "100%",
      borderRadius: "20px",
      overflow: "hidden",
    }}
  >
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        bgcolor: "divider",
      }}
    />
    <Card
      sx={{
        position: "relative",
        zIndex: 1,
        m: "3px",
        height: "calc(100% - 6px)",
        borderRadius: "17px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
        }}
      >
        <Skeleton variant="text" width="55%" height={28} />
        <Skeleton
          variant="rounded"
          width={40}
          height={20}
          sx={{ borderRadius: "8px" }}
        />
      </Box>

      <Box
        sx={{
          position: "relative",
          height: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Skeleton variant="circular" width={108} height={108} />
        <Skeleton
          variant="circular"
          width={32}
          height={32}
          sx={{ position: "absolute", top: 6, right: 6 }}
        />
      </Box>

      <Stack sx={{ flexGrow: 1, px: 1.5, py: 1.25 }} spacing={1}>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
          <Skeleton
            variant="rounded"
            width={55}
            height={22}
            sx={{ borderRadius: "11px" }}
          />
          <Skeleton
            variant="rounded"
            width={55}
            height={22}
            sx={{ borderRadius: "11px" }}
          />
        </Stack>

        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <StatBarSkeleton key={i} />
          ))}
        </Stack>
      </Stack>
    </Card>
  </Box>
);
