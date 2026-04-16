import * as React from "react";
import { Input, type InputProps } from "./input";

export function formatMac(raw: string): string {
  const hex = raw.replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 12);
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
}

export interface MacInputProps extends Omit<InputProps, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
}

export const MacInput = React.forwardRef<HTMLInputElement, MacInputProps>(
  ({ value, onChange, placeholder = "AA:BB:CC:DD:EE:FF", className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(formatMac(e.target.value));
    };

    return (
      <Input
        ref={ref}
        inputMode="text"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={17}
        placeholder={placeholder}
        className={`font-mono uppercase ${className ?? ""}`}
        value={value ?? ""}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
MacInput.displayName = "MacInput";
