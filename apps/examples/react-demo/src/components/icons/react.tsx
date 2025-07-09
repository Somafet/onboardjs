import type { SVGProps } from "react";

export default function ReactIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      {...props}
    >
      <g
        fill="none"
        stroke="#91d7e3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 10.8c4.14 0 7.5-1.25 7.5-2.8S12.14 5.2 8 5.2S.5 6.45.5 8s3.36 2.8 7.5 2.8"></path>
        <path d="M5.52 9.4c2.07 3.5 4.86 5.72 6.23 4.95c1.37-.78.8-4.24-1.27-7.75C8.41 3.1 5.62.88 4.25 1.65c-1.37.78-.8 4.24 1.27 7.75"></path>
        <path d="M5.52 6.6c-2.07 3.5-2.64 6.97-1.27 7.75c1.37.77 4.16-1.45 6.23-4.95s2.64-6.97 1.27-7.75C10.38.88 7.59 3.1 5.52 6.6"></path>
        <path d="M8.5 8a.5.5 0 0 1-.5.5a.5.5 0 0 1-.5-.5a.5.5 0 0 1 .5-.5a.5.5 0 0 1 .5.5"></path>
      </g>
    </svg>
  );
}
