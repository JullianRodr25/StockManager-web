interface PaginaProximamenteProps {
  titulo: string;
}

export function PaginaProximamente({ titulo }: PaginaProximamenteProps) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <h2 className="font-heading text-2xl font-semibold text-navy">{titulo}</h2>
      <p className="text-sm text-text-muted">Próximamente</p>
    </div>
  );
}
