export function LoaderPanel({ message }: { message: string }) {
  return (
    <div className="m-state" role="status" aria-live="polite">
      <div className="m-state__icon">
        <span className="m-spinner m-spinner--lg" aria-hidden="true" />
      </div>
      <p className="m-state__description">{message}</p>
    </div>
  );
}
