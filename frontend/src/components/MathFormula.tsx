import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathFormulaProps {
  math: string;
  block?: boolean;
  className?: string;
}

export const MathFormula: React.FC<MathFormulaProps> = ({ math, block = false, className = '' }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(math, containerRef.current, {
          displayMode: block,
          throwOnError: false,
        });
      } catch (err) {
        console.error('KaTeX render error:', err);
      }
    }
  }, [math, block]);

  return (
    <span
      ref={containerRef}
      className={`${
        block
          ? 'block my-2.5 overflow-x-auto text-slate-900 py-1 font-normal tracking-wide'
          : 'inline-block text-slate-800 font-normal px-0.5'
      } ${className}`}
    />
  );
};
