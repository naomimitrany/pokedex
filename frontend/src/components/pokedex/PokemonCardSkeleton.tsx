import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export function PokemonCardSkeleton() {
  return (
    <Card data-testid="pokemon-card-skeleton" sx={{ height: "100%" }}>
      <Skeleton variant="rectangular" height={140} />
      <CardContent>
        <Skeleton variant="text" width="60%" height={32} />
        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={60} height={24} />
        </Stack>
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
      </CardContent>
    </Card>
  );
}
