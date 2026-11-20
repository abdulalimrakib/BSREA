import app from "./app";
import envConfig, { productionProblems } from "./config/env.config";

/*--Refuse to start on a production server with laptop settings (see productionProblems)--*/
const problems = productionProblems();
if (problems.length) {
  console.error(`The API can't start: backend/.env is missing production settings:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

/*--Create Server--*/
const onListening = () => console.log(`Server running on port ${envConfig.PORT}!`);
const server = envConfig.HOST ? app.listen(envConfig.PORT, envConfig.HOST, onListening) : app.listen(envConfig.PORT, onListening);

const stop = () => server.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
