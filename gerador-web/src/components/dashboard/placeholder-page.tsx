import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Construction size={28} className="text-primary" />
      </div>
      <h1 className="text-xl font-bold text-on-surface mb-2">{title}</h1>
      <p className="text-sm text-on-surface-variant max-w-md">{description}</p>
      <span className="mt-4 text-xs text-on-surface-variant/50 bg-surface-container px-3 py-1 rounded-full">
        Em desenvolvimento
      </span>
    </div>
  );
}
