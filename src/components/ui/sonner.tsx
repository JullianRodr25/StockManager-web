import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useTheme } from "@/context/ThemeContext"

// Se usan los tokens hsl(var(--...)) de shadcn (ya adaptados a modo
// claro/oscuro en index.css) en vez de hex fijos, y se pasa el tema
// activo para que los colores por defecto de éxito/error/etc. de Sonner
// también se ajusten.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
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
          "--normal-bg": "hsl(var(--card))",
          "--normal-text": "hsl(var(--navy))",
          "--normal-border": "hsl(var(--border))",
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
