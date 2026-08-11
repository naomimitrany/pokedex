import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";

export type LoginPromptProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (username: string) => void | Promise<void>;
  error?: string | null;
};

export const LoginPrompt = ({ open, onClose, onSubmit, error }: LoginPromptProps) => {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const showValidationError = touched && trimmed.length === 0;

  const handleSubmit = () => {
    setTouched(true);
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
    setName("");
    setTouched(false);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Name your trainer</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Pick a trainer name to start capturing Pokémon. No password needed.
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
          helperText={showValidationError ? "Enter a trainer name to continue." : error}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Start capturing
        </Button>
      </DialogActions>
    </Dialog>
  );
};
