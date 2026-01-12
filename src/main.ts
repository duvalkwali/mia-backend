import { app } from './app';
import { env } from '@/config/env';

app.listen(env.port, () => {
  console.log(`MIA backend running on port ${env.port}`);
});

