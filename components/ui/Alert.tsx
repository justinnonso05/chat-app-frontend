import React from 'react';

interface AlertProps {
  type: 'success' | 'error';
  title?: string;
  message: string;
}

export const Alert: React.FC<AlertProps> = ({ type, title, message }) => {
  const isError = type === 'error';

  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 
      ${isError
        ? 'bg-error/10 border-error/20 text-error'
        : 'bg-success/10 border-success/20 text-success'}`}
    >
      <div>
        {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
        <p className="text-sm opacity-90">{message}</p>
      </div>
    </div>
  );
};
