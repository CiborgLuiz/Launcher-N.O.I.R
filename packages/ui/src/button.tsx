import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary:
      "bg-[linear-gradient(135deg,rgba(199,162,74,1),rgba(142,106,34,0.96))] text-[#0B0906] shadow-glow hover:brightness-105",
    secondary: "border border-[#C7A24A]/25 bg-[#15110B] text-[#F6F0E1] hover:border-[#C7A24A]/45 hover:bg-[#1C1710]",
    ghost: "text-[#E9D8A6]/70 hover:text-[#F6F0E1] hover:bg-[#1A1610]"
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold tracking-[0.2em] uppercase transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  );
}
