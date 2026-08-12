import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { render, renderHook, type RenderHookOptions, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { theme } from "../theme";

const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

type ProviderOptions = {
  initialEntries?: string[];
  queryClient?: QueryClient;
};

const AllProviders = ({
  children,
  queryClient,
  initialEntries,
}: {
  children: ReactNode;
  queryClient: QueryClient;
  initialEntries: string[];
}) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export const renderWithProviders = (
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, "wrapper"> = {},
) => {
  const { initialEntries = ["/"], queryClient = createTestQueryClient(), ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient} initialEntries={initialEntries}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
};

export const renderHookWithProviders = <TResult, TProps = void>(
  hook: (props: TProps) => TResult,
  options: ProviderOptions & Omit<RenderHookOptions<TProps>, "wrapper"> = {},
) => {
  const { initialEntries = ["/"], queryClient = createTestQueryClient(), ...renderOptions } = options;
  return renderHook(hook, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient} initialEntries={initialEntries}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
};
