import "@fontsource/barlow/400.css"
import "@fontsource/barlow/600.css"
import "@fontsource/barlow-condensed/600.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Page } from "./page.js"
import "./styles.css"

const root = document.getElementById("root")
if (!root) throw new Error("root is required")

createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
