import { useId, useState, type FormEvent } from "react";
import Icon from "./Icon";

interface Props {
  label: string;
  placeholder: string;
  hint?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export default function SearchField({ label, placeholder, hint, value, onChange }: Props) {
  const inputId = useId();
  const hintId = useId();
  const [internal, setInternal] = useState("");
  const query = value ?? internal;

  function update(next: string) {
    setInternal(next);
    onChange?.(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="search-field">
      <form className="search-field__form" role="search" onSubmit={handleSubmit}>
        <Icon name="search" size={18} className="search-field__icon" />
        <label className="sr-only" htmlFor={inputId}>
          {label}
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => update(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          aria-describedby={hint ? hintId : undefined}
        />
        {query ? (
          <button
            className="search-field__clear"
            type="button"
            onClick={() => update("")}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
      </form>
      {hint ? (
        <p className="search-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
