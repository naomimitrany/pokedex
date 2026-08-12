import { memo, useState } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Popover from "@mui/material/Popover";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import SortIcon from "@mui/icons-material/Sort";
import { DEFAULT_SORT_FIELD, SORT_FIELDS } from "../../constants";
import type { SortField, SortOrder } from "../../types";

export const SortMenu = memo(
  ({
    sortBy,
    order,
    onSortByChange,
    onOrderChange,
  }: {
    sortBy: SortField;
    order: SortOrder;
    onSortByChange: (value: SortField) => void;
    onOrderChange: (value: SortOrder) => void;
  }) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const isActive = sortBy !== DEFAULT_SORT_FIELD || order !== "asc";

    return (
      <>
        <Tooltip title="Sort">
          <IconButton
            aria-label="Sort"
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ border: "1px solid", borderColor: "divider" }}
          >
            <Badge color="primary" variant="dot" invisible={!isActive}>
              <SortIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>

        <Popover
          open={Boolean(anchor)}
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box sx={{ width: 200, py: 1 }}>
            <Typography
              variant="caption"
              sx={{ px: 2, color: "text.secondary" }}
            >
              Sort by
            </Typography>
            <MenuList dense>
              {SORT_FIELDS.map((field) => (
                <MenuItem
                  key={field.value}
                  selected={sortBy === field.value}
                  onClick={() => onSortByChange(field.value)}
                >
                  {field.label}
                </MenuItem>
              ))}
            </MenuList>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ px: 2 }}>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={order}
                onChange={(_e, value: SortOrder | null) => {
                  if (value) onOrderChange(value);
                }}
                size="small"
              >
                <ToggleButton value="asc" aria-label="ascending">
                  <ArrowUpwardIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="desc" aria-label="descending">
                  <ArrowDownwardIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Popover>
      </>
    );
  },
);
