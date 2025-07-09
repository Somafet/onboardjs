import clsx from "clsx";
import React from "react";

type AvatarProps = {
  src?: string | null;
  square?: boolean;
  alt?: string;
  className?: string;
};

export function Avatar({
  src = null,
  square = false,
  alt = "",
  className,
  ...props
}: AvatarProps & React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="avatar"
      {...props}
      className={clsx(
        className,
        // Basic layout
        "inline-grid shrink-0 align-middle [--avatar-radius:20%] *:col-start-1 *:row-start-1",
        "outline -outline-offset-1 outline-black/10 dark:outline-white/10",
        // Border radius
        square
          ? "rounded-(--avatar-radius) *:rounded-(--avatar-radius)"
          : "rounded-full *:rounded-full",
      )}
    >
      {src && <img className="size-full" src={src} alt={alt} />}
    </span>
  );
}
