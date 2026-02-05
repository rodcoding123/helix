export const Input = ({
  className,
  onChange,
  value,
  placeholder,
  type = 'text',
}: {
  className?: string;
  onChange?: (e: any) => void;
  value?: string;
  placeholder?: string;
  type?: string;
}) => (
  <input
    type={type}
    className={`px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 ${className || ''}`}
    onChange={onChange}
    value={value}
    placeholder={placeholder}
  />
);
