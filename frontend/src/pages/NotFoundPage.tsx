import Container from "@mui/material/Container";
import { BackButton } from "../components/general/BackButton";
import { EmptyState } from "../components/general/EmptyState";

export const NotFoundPage = () => (
  <>
    <BackButton to="/" />
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <EmptyState
        title="Page not found"
        description="That link doesn't lead anywhere in the Pokédex."
      />
    </Container>
  </>
);
