import app from "./app";
import { NODE_ENV, PORT } from "./utils/constants";

/**
 * The process entry point.
 *
 * Split out of app.ts so that importing the app does not bind a port: the HTTP
 * tests need the fully wired application - every route with its real
 * middleware - without starting a server.
 */
app.listen(PORT, "0.0.0.0", () => {
  if (NODE_ENV !== "production") {
    console.log(`Server running on port ${PORT}`);
  }
});
