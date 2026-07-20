export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-background/60">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-muted-foreground sm:text-sm">
          © {year} Attendra. Developed by Boitumelo Sethole.
        </p>
      </div>
    </footer>
  );
}
