import { Icons } from "@/components/icons";

export function Footer() {
  return (
    <footer className="py-6 md:px-8 md:py-0 border-t">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built by{" "}
          <a
            href="https://portefeuille-tau.vercel.app/" 
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            Mzaza
          </a>
          . The source code is available on{" "}
          <a
            href="https://github.com/mzazakeith/Coda"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            GitHub
          </a>
          .
        </p>
        <div className="flex items-center space-x-2">
          <Icons.Logo className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Coda &copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
