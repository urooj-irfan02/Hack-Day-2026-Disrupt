/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "../src/index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
