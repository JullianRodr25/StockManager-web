import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// La app no tiene modo oscuro/claro, por lo que el Toaster se fija
// siempre en tema "light" y usa directamente la paleta Ferretería Gold
// en lugar de los tokens hsl(var(--...)) genéricos de shadcn.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "#FFFFFF",
          "--normal-text": "#16233B",
          "--normal-border": "#E5E1D8",
          "--border-radius": "0.75rem",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "font-body shadow-md",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
