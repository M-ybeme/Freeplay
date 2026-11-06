import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import "./ConfirmPrompt.css";

interface ConfirmPromptProps {
  /** The question, e.g. "Start a new game? This one will be lost." */
  message: string;
  /** Names the action, e.g. "New game" or "Deal Fortress". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/*
 * The one inline "are you sure?" bar every game uses before throwing away
 * progress. Focus starts on Keep playing (the safe choice), and Escape
 * cancels, so a keyboard player can't lose a game by pressing Enter twice.
 */
export function ConfirmPrompt({ message, confirmLabel, onConfirm, onCancel }: ConfirmPromptProps) {
  const keepRef = useRef<HTMLButtonElement>(null);
  const textId = useId();

  useEffect(() => {
    keepRef.current?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    onCancel();
  }

  return (
    <div className="fp-confirm fp-enter" role="alertdialog" aria-labelledby={textId} onKeyDown={onKeyDown}>
      <p className="fp-confirm__text" id={textId}>
        {message}
      </p>
      <div className="fp-confirm__actions">
        <button type="button" className="fp-btn fp-btn--danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button ref={keepRef} type="button" className="fp-btn fp-btn--secondary" onClick={onCancel}>
          Keep playing
        </button>
      </div>
    </div>
  );
}
