"use client";

import { Flex, Input, Select } from "antd";
import { useState, type CSSProperties } from "react";
import { PHONE_COUNTRIES, type PhoneCountry } from "@/lib/phone-countries";

const COUNTRIES: PhoneCountry[] = PHONE_COUNTRIES;
const DEFAULT = COUNTRIES[0];
const DIAL_SORTED = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

function nationalNumber(input: string, dial: string) {
  const digits = input.replace(/\D/g, "");
  const normalizedDial = dial.replace(/\D/g, "");
  let number = digits.startsWith(normalizedDial)
    ? digits.slice(normalizedDial.length)
    : digits;
  if (number.startsWith("0") && number.length > 1) number = number.slice(1);
  return number;
}

function parsePhone(value?: string, fallback: PhoneCountry = DEFAULT) {
  const raw = (value ?? "").trim();
  if (!raw) return { country: fallback, number: "" };
  const normalized = raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
  if (normalized.startsWith("+")) {
    const match = DIAL_SORTED.find((c) => normalized.startsWith(c.dial));
    if (match) {
      return {
        country: match,
        number: nationalNumber(normalized, match.dial),
      };
    }
    return { country: fallback, number: nationalNumber(normalized, "") };
  }
  const digits = normalized.replace(/\D/g, "");
  const fallbackDial = fallback.dial.replace(/\D/g, "");
  if (digits.startsWith(fallbackDial) && digits.length > fallbackDial.length) {
    return { country: fallback, number: nationalNumber(digits, fallbackDial) };
  }
  const defaultDial = DEFAULT.dial.replace(/\D/g, "");
  if (digits.startsWith(defaultDial) && digits.length > defaultDial.length) {
    return { country: DEFAULT, number: nationalNumber(digits, defaultDial) };
  }
  if (digits.startsWith("0") && digits.length > 1) {
    return { country: DEFAULT, number: digits.slice(1) };
  }
  return { country: fallback, number: digits };
}

export default function PhoneInput({
  value,
  onChange,
  disabled,
  placeholder = "Phone number or +code",
  style,
}: {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: CSSProperties;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [lastEmitted, setLastEmitted] = useState(value);
  const activeDraft = draft !== null && lastEmitted === value ? draft : null;
  const first = parsePhone(value);
  const parsed = parsePhone(activeDraft ?? value ?? "", first.country);

  const buildValue = (raw: string, number?: string) => {
    const next = parsePhone(raw, parsed.country);
    const finalNumber = number ?? next.number;
    return finalNumber ? `${next.country.dial}${finalNumber}` : "";
  };

  return (
    <Flex gap={8} style={style}>
      <Select
        disabled={disabled}
        value={parsed.country.code}
        style={{ width: 132 }}
        showSearch
        optionFilterProp="label"
        options={COUNTRIES.map((c) => ({
          value: c.code,
          label: `${c.flag} ${c.dial} ${c.name}`,
        }))}
        labelRender={(opt) => {
          const c = COUNTRIES.find((x) => x.code === opt.value) ?? DEFAULT;
          return (
            <span>
              {c.flag} {c.dial}
            </span>
          );
        }}
        onChange={(code) => {
          const next = COUNTRIES.find((c) => c.code === code) ?? DEFAULT;
          const emitted = buildValue(`${next.dial}${parsed.number}`, parsed.number);
          setLastEmitted(emitted);
          setDraft(null);
          onChange?.(emitted);
        }}
      />
      <Input
        disabled={disabled}
        value={activeDraft ?? parsed.number}
        placeholder={placeholder}
        inputMode="tel"
        onChange={(event) => {
          const raw = event.target.value;
          const emitted = buildValue(raw);
          setLastEmitted(emitted);
          setDraft(raw);
          onChange?.(emitted);
        }}
        onBlur={() => setDraft(null)}
      />
    </Flex>
  );
}
