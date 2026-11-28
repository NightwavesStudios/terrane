import { useId, useState, type FormEvent } from "react";
import Icon from "./Icon";

interface Props {
  label: string;
  placeholder: string;
  hint?: string;
  onSubmit?: (query: string) => void;
  onChange?: (query: string) => void;
}

export default function SearchField({ label, placeholder, hint, onSubmit, onChange }: Props) {
  const inputId = useId();
  const hintId = useId();
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(query.trim());
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
          onChange={(event) => {
            setQuery(event.target.value);
            onChange?.(event.target.value);
          }}
          placeholder={placeholder}
          autoComplete="off"
          aria-describedby={hint ? hintId : undefined}
        />
        {query ? (
          <button
            className="search-field__clear"
            type="button"
            onClick={() => {
              setQuery("");
              onChange?.("");
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
        <button className="search-field__submit" type="submit" aria-label="Search">
          <Icon name="arrow" size={17} />
        </button>
      </form>
      {hint ? (
        <p className="search-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
