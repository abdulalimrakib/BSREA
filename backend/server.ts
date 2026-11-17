import app from "./app";
import envConfig from "./config/env.config";

/*--Create Server--*/
const onListening = () => console.log(`Server running on port ${envConfig.PORT}!`);
const server = envConfig.HOST ? app.listen(envConfig.PORT, envConfig.HOST, onListening) : app.listen(envConfig.PORT, onListening);

const stop = () => server.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
