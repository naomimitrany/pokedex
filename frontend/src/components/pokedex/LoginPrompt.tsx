import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import trainerImg from "../../assets/trainer.webp";

export const LoginPrompt = ({
  open,
  onClose,
  onSubmit,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (username: string) => void | Promise<void>;
  error?: string | null;
}) => {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const showValidationError = touched && trimmed.length === 0;

  const handleSubmit = async () => {
    setTouched(true);
    if (trimmed.length === 0) return;
    try {
      await onSubmit(trimmed);
      setName("");
      setTouched(false);
    } catch {
      // keep the typed name so the user can retry without retyping
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: { position: "relative", overflow: "visible", borderRadius: 3 },
        },
      }}
    >
      <Avatar
        src={trainerImg}
        sx={{
          width: 110,
          height: 110,
          position: "absolute",
          top: -55,
          left: "50%",
          transform: "translateX(-50%)",
          border: (theme) => `4px solid ${theme.palette.background.paper}`,
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
          bgcolor: "background.paper",
          "& img": { objectFit: "cover" },
        }}
      />
      <DialogTitle sx={{ textAlign: "center", pt: "64px" }}>
        Name your trainer
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ textAlign: "center", mb: 1 }}>
          Pick a trainer name to start capturing Pokémon.
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          label="Trainer name"
          fullWidth
          variant="standard"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={showValidationError || Boolean(error)}
          helperText={
            showValidationError ? "Enter a trainer name to continue." : error
          }
        />
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", gap: 1.5, pb: 3, pt: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: 999,
            px: 3,
            textTransform: "none",
            fontWeight: 600,
            color: "text.secondary",
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          sx={{
            borderRadius: 999,
            px: 4,
            textTransform: "none",
            fontWeight: 700,
            color: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          }}
        >
          Start capturing
        </Button>
      </DialogActions>
    </Dialog>
  );
};
