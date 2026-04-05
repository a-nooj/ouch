FROM node:20-alpine
WORKDIR /app

# Copy manifests and PostCSS/Tailwind config — these are static and
# baked into the image so the dev server can resolve them at startup.
COPY package.json postcss.config.cjs tailwind.config.cjs ./

# Install deps (cached layer); source is bind-mounted at runtime.
RUN npm install

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
