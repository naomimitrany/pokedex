import { memo, useState } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Tooltip from "@mui/material/Tooltip";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { ALLOWED_PAGE_SIZES } from "../../constants";

export const PageSizeMenu = memo(
  ({
    pageSize,
    onPageSizeChange,
  }: {
    pageSize: number;
    onPageSizeChange: (value: number) => void;
  }) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    const handleChange = (e: SelectChangeEvent<number>) => {
      onPageSizeChange(Number(e.target.value));
    };

    return (
      <>
        <Tooltip title="More options">
          <IconButton
            aria-label="More options"
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ border: "1px solid", borderColor: "divider" }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Popover
          open={Boolean(anchor)}
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box sx={{ width: 180, p: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="page-size-label">Per page</InputLabel>
              <Select
                labelId="page-size-label"
                label="Per page"
                value={pageSize}
                onChange={handleChange}
              >
                {ALLOWED_PAGE_SIZES.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Popover>
      </>
    );
  },
);
