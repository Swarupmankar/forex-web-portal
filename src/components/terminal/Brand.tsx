export function Brand() {
  return (
    <span className="terminal-brand">
      <svg viewBox="0 0 456 495" aria-hidden="true">
        <polygon
          points="4,4 164,125 164,370 4,491"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <polygon
          points="452,4 292,125 292,370 452,491"
          fill="#b0f000"
          stroke="#b0f000"
          strokeWidth="8"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        <span className="terminal-wordmark">
          <b>Movement</b> Markets
        </span>
        <span className="terminal-brand-sub">Web terminal</span>
      </span>
    </span>
  );
}
