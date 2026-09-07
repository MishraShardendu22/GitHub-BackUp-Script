export function LoaderPanel({ message }: { message: string }) {
  return (
    <div className="ai-loader-panel">
      <div className="ai-loader-spinner" />
      <div className="ai-loader-text">{message}</div>
    </div>
  );
}
