import { createApp } from "./app";
import { env } from "./config";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`🚀 MIA.ai API running on port ${env.PORT}`);
});
