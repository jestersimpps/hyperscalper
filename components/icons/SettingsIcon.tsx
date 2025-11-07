export default function SettingsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m-5.196-13.804l4.242 4.242m6.364 6.364l4.242 4.242M1 12h6m6 0h6M4.222 19.778l4.242-4.242m6.364-6.364l4.242-4.242" />
    </svg>
  );
}
