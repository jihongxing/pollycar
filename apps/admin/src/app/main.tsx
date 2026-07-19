import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "./providers";
import { Shell } from "./shell";

createRoot(document.getElementById("root")!).render(<StrictMode><Providers><Shell /></Providers></StrictMode>);
