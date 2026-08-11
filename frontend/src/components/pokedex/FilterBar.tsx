import { useEffect, useRef, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { ALLOWED_PAGE_SIZES, SORT_FIELDS } from "../../constants";
import type { SortField, SortOrder } from "../../types";

export type FilterBarFilters = {
  type: string | null;
  q: string;
  sortBy: SortField;
  order: SortOrder;
  pageSize: number;
};

export type FilterBarProps = {
  types: string[];
  filters: FilterBarFilters;
  onChange: (partial: Partial<FilterBarFilters>) => void;
};

const ALL_TYPES = "__all__";
const DEBOUNCE_MS = 300;

export const FilterBar = ({ types, filters, onChange }: FilterBarProps) => {
  const [query, setQuery] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(filters.q), [filters.q]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange({ q: value }), DEBOUNCE_MS);
  };

  const handleTypeChange = (e: SelectChangeEvent) => {
    const value = e.target.value;
    onChange({ type: value === ALL_TYPES ? null : value });
  };

  const handleSortChange = (e: SelectChangeEvent) => {
    onChange({ sortBy: e.target.value as SortField });
  };

  const handleOrderChange = (_e: unknown, value: SortOrder | null) => {
    if (value) onChange({ order: value });
  };

  const handlePageSizeChange = (e: SelectChangeEvent<number>) => {
    onChange({ pageSize: Number(e.target.value) });
  };

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
      <TextField
        label="Search"
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        size="small"
        sx={{ minWidth: 200 }}
      />

      <FormControl size="small" sx={{ minWidth: 160 }}>
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

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="sort-by-label">Sort by</InputLabel>
        <Select labelId="sort-by-label" label="Sort by" value={filters.sortBy} onChange={handleSortChange}>
          {SORT_FIELDS.map((field) => (
            <MenuItem key={field.value} value={field.value}>
              {field.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <ToggleButtonGroup exclusive value={filters.order} onChange={handleOrderChange} size="small">
        <ToggleButton value="asc" aria-label="ascending">
          Asc
        </ToggleButton>
        <ToggleButton value="desc" aria-label="descending">
          Desc
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel id="page-size-label">Per page</InputLabel>
        <Select
          labelId="page-size-label"
          label="Per page"
          value={filters.pageSize}
          onChange={handlePageSizeChange}
        >
          {ALLOWED_PAGE_SIZES.map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
};
