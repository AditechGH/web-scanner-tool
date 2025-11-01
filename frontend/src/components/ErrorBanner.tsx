import "./ErrorBanner.css";

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="error-banner">
      <strong>Error:</strong> {message}
    </div>
  );
}
