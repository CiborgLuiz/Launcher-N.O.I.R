import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary:
      "bg-[linear-gradient(135deg,#E8C472_0%,#B98A35_48%,#6B521F_100%)] text-[#090709] shadow-glow hover:brightness-110",
    secondary: "border border-[#C9A24E]/25 bg-[#0C0C0C] text-[#F7E8C3] hover:border-[#C9A24E]/50 hover:bg-[#19150B]",
    ghost: "text-[#E8C472]/72 hover:text-[#F7E8C3] hover:bg-[#14120B]"
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] transition duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  );
}
