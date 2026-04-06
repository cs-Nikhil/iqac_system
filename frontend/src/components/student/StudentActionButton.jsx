export default function StudentActionButton({
  tooltip,
  className,
  disabled,
  children,
  ...props
}) {
  const button = (
    <button {...props} disabled={disabled} className={className}>
      {children}
    </button>
  );

  if (!disabled || !tooltip) {
    return button;
  }

  return (
    <div className="w-full cursor-not-allowed" title={tooltip}>
      {button}
    </div>
  );
}
