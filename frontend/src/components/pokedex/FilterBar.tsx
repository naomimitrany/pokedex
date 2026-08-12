import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import { PageSizeMenu } from "./PageSizeMenu";
import { SortMenu } from "./SortMenu";
import type { SortField, SortOrder } from "../../types";

export type FilterBarFilters = {
  type: string | null;
  q: string;
  sortBy: SortField;
  order: SortOrder;
  pageSize: number;
};

const ALL_TYPES = "__all__";
const DEBOUNCE_MS = 300;

export const FilterBar = ({
  types,
  filters,
  onChange,
}: {
  types: string[];
  filters: FilterBarFilters;
  onChange: (partial: Partial<FilterBarFilters>) => void;
}) => {
  const [query, setQuery] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the last value we sent via onChange, so the sync-back effect
  // below can tell "the parent caught up with what we typed" (skip) apart
  // from "the parent changed q for some other reason" (e.g. browser
  // back/forward — apply it). Without this, a debounce commit landing back
  // as a prop while the user kept typing would snap the field back and
  // erase whatever they'd typed since.
  const lastSentRef = useRef(filters.q);

  useEffect(() => {
    if (filters.q === lastSentRef.current) return;
    setQuery(filters.q);
    lastSentRef.current = filters.q;
  }, [filters.q]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastSentRef.current = value;
      onChange({ q: value });
    }, DEBOUNCE_MS);
  };

  const handleTypeChange = (e: SelectChangeEvent) => {
    const value = e.target.value;
    onChange({ type: value === ALL_TYPES ? null : value });
  };

  const handleSortByChange = useCallback(
    (value: SortField) => onChange({ sortBy: value }),
    [onChange],
  );
  const handleOrderChange = useCallback(
    (value: SortOrder) => onChange({ order: value }),
    [onChange],
  );
  const handlePageSizeChange = useCallback(
    (value: number) => onChange({ pageSize: value }),
    [onChange],
  );

  return (
    <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: "center" }}>
      <FormControl size="small" sx={{ minWidth: 130, flex: "0 0 auto" }}>
        <InputLabel id="type-filter-label">Type</InputLabel>
        <Select
          labelId="type-filter-label"
          label="Type"
          value={filters.type ?? ALL_TYPES}
          onChange={handleTypeChange}
        >
          <MenuItem value={ALL_TYPES}>All types</MenuItem>
          {types.map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <TextField
          label="Search"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          size="small"
          sx={{ width: "100%", maxWidth: 340 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    fontSize="small"
                    sx={{ color: "text.disabled" }}
                  />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Stack direction="row" spacing={0.5} sx={{ flex: "0 0 auto" }}>
        <SortMenu
          sortBy={filters.sortBy}
          order={filters.order}
          onSortByChange={handleSortByChange}
          onOrderChange={handleOrderChange}
        />
        <PageSizeMenu
          pageSize={filters.pageSize}
          onPageSizeChange={handlePageSizeChange}
        />
      </Stack>
    </Stack>
  );
};
