const { defineConfig } = require("prisma");

module.exports = defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
