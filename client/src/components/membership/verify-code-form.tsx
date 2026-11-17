"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldClass, primaryButtonClass } from "@/lib/styles";

/*--Type a verification code (or paste the whole QR link) and open its verification page--*/
export default function VerifyCodeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const code = value.trim().split("/").pop() ?? "";
        if (!/^[A-Za-z0-9_-]{24}$/.test(code))
          return setError("The code is 24 letters, numbers, - or _");
        router.push(`/verify/${code}`);
      }}
    >
      <label htmlFor="verify-code" className="sr-only">
        Verification code
      </label>
      <input
        id="verify-code"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder="Verification code or link"
        autoComplete="off"
        spellCheck={false}
        className={`flex-1 font-mono ${fieldClass}`}
      />
      <button type="submit" className={primaryButtonClass}>
        Verify
      </button>
      {error && (
        <p className="text-left text-xs text-red-600 sm:basis-full">{error}</p>
      )}
    </form>
  );
}
